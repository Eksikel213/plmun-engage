// report-ai.js - UPDATED to use Groq AI instead of Gemini
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// ✅ Using Groq AI (same API key as chatbot)
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function analyzeWithGemini(db, currentUser) {
    try {
        console.log('🔍 Fetching quiz results...');
        
        const resultsRef = collection(db, 'quizResults');
        const q = query(resultsRef, where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const quizResults = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                // ✅ FIXED: Sort by timestamp (most recent first)
                const aTime = a.completedAtTimestamp || new Date(a.completedAt).getTime();
                const bTime = b.completedAtTimestamp || new Date(b.completedAt).getTime();
                return bTime - aTime;
            });
        
        console.log('📊 Total quiz results found:', quizResults.length);
        
        if (quizResults.length === 0) {
            return { hasResults: false };
        }
        
        const latestQuiz = quizResults[0];
        console.log('📝 Latest quiz:', latestQuiz.quizTitle, '- Score:', latestQuiz.score, '/', latestQuiz.totalQuestions);
        
        const wrongAnswers = [];
        
        if (latestQuiz.detailedResults) {
            latestQuiz.detailedResults.forEach(detail => {
                if (!detail.isCorrect) {
                    wrongAnswers.push({
                        question: detail.question,
                        userAnswer: detail.userAnswer,
                        correctAnswer: detail.correctAnswer,
                        options: detail.options || []
                    });
                }
            });
        }
        
        console.log('❌ Wrong answers found:', wrongAnswers.length);
        
        const stats = calculateStats(quizResults);
        
        // ✅ NEW: Use Groq AI instead of Gemini
        const aiInsights = await generateGroqInsights(latestQuiz, wrongAnswers, stats);
        
        return {
            hasResults: true,
            latestQuiz,
            wrongAnswers,
            stats,
            aiInsights,
            allQuizzes: quizResults
        };
        
    } catch (error) {
        console.error('❌ Error analyzing:', error);
        throw error;
    }
}

function calculateStats(quizResults) {
    const totalQuizzes = quizResults.length;
    const totalScore = quizResults.reduce((sum, r) => sum + r.score, 0);
    const totalQuestions = quizResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    const avgPercentage = Math.round((totalScore / totalQuestions) * 100);
    const totalCoinsEarned = quizResults.reduce((sum, r) => sum + (r.coinsEarned || 0), 0);
    
    let trend = 'stable';
    if (quizResults.length >= 2) {
        const recent3 = quizResults.slice(0, 3).map(r => r.percentage);
        const older3 = quizResults.slice(3, 6).map(r => r.percentage);
        
        if (recent3.length > 0 && older3.length > 0) {
            const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
            const olderAvg = older3.reduce((a, b) => a + b, 0) / older3.length;
            
            if (recentAvg > olderAvg + 5) trend = 'improving';
            else if (recentAvg < olderAvg - 5) trend = 'declining';
        }
    }
    
    return {
        totalQuizzes,
        totalScore,
        totalQuestions,
        avgPercentage,
        totalCoinsEarned,
        trend
    };
}

// ✅ NEW: Generate insights using Groq AI
async function generateGroqInsights(latestQuiz, wrongAnswers, stats) {
    try {
        console.log('🤖 Calling Groq AI for analysis...');
        
        const prompt = buildAnalysisPrompt(latestQuiz, wrongAnswers, stats);
        
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 1000,
                top_p: 1,
                stream: false
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Groq API Error:', errorData);
            throw new Error(`Groq API error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content.trim();
        
        console.log('✅ AI Response received');
        console.log('📄 Raw response:', aiResponse.substring(0, 100) + '...');
        
        return parseGroqResponse(aiResponse, latestQuiz, wrongAnswers, stats);
        
    } catch (error) {
        console.error('❌ Groq Error:', error);
        console.log('⚠️ Falling back to rule-based analysis...');
        return generateFallbackInsights(latestQuiz, wrongAnswers, stats);
    }
}

// ✅ NEW: Build detailed analysis prompt for Groq
function buildAnalysisPrompt(latestQuiz, wrongAnswers, stats) {
    const wrongQuestionsText = wrongAnswers.length > 0 
        ? wrongAnswers.map((wa, i) => 
            `Question ${i + 1}: "${wa.question}"\n` +
            `Student's Answer: "${wa.userAnswer}"\n` +
            `Correct Answer: "${wa.correctAnswer}"\n`
        ).join('\n')
        : 'Perfect score! All answers were correct! 🎉';
    
    return `You are an expert educational AI analyzing a student's quiz performance. 

**LATEST QUIZ DETAILS:**
- Quiz Title: ${latestQuiz.quizTitle}
- Score: ${latestQuiz.score} out of ${latestQuiz.totalQuestions} (${latestQuiz.percentage}%)
- Date Taken: ${new Date(latestQuiz.completedAt).toLocaleDateString()}

**QUESTIONS THE STUDENT GOT WRONG:**
${wrongQuestionsText}

**OVERALL PERFORMANCE STATS:**
- Total Quizzes Taken: ${stats.totalQuizzes}
- Average Score: ${stats.avgPercentage}%
- Performance Trend: ${stats.trend}

**YOUR TASK:**
Analyze this data and return a JSON response with THREE sections:

1. **overallMessage**: A 2-3 sentence summary that is:
   - Encouraging but honest
   - Mentions specific score (${latestQuiz.score}/${latestQuiz.totalQuestions})
   - If score is low, acknowledge it but stay motivating
   - If perfect score, celebrate and encourage advancement

2. **weakAreas**: Array of 1-5 specific weak areas. IMPORTANT RULES:
   - If student got ALL questions correct, return EMPTY ARRAY []
   - If student got questions wrong, identify ACTUAL topics from the wrong answers
   - Each area should have:
     * "topic": Specific subject/concept (e.g., "Multiplication", "Python Loops", "Cell Biology")
     * "description": Clear explanation of what went wrong (1-2 sentences)
     * "priority": "high" if multiple mistakes in same topic, "medium" if 1-2 mistakes, "low" if minor

3. **recommendations**: Array of EXACTLY 5 actionable study tips:
   - First 2-3 should be specific to their mistakes
   - Last 2-3 should be general good study practices
   - Make them practical and achievable

**OUTPUT FORMAT (MUST BE VALID JSON, NO MARKDOWN):**
{
    "overallMessage": "Great effort! You scored ${latestQuiz.score}/${latestQuiz.totalQuestions} on this quiz...",
    "weakAreas": [
        {
            "topic": "Specific Topic Name",
            "description": "Why this is challenging for you",
            "priority": "high"
        }
    ],
    "recommendations": [
        "Specific tip 1",
        "Specific tip 2",
        "Specific tip 3",
        "Specific tip 4",
        "Specific tip 5"
    ]
}

Return ONLY the JSON, no extra text or markdown formatting.`;
}

// ✅ NEW: Parse Groq AI response
function parseGroqResponse(aiResponse, latestQuiz, wrongAnswers, stats) {
    try {
        // Remove markdown code blocks if present
        let cleanResponse = aiResponse.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/g, '');
        }
        
        // Try to parse JSON
        const parsed = JSON.parse(cleanResponse);
        
        console.log('✅ Successfully parsed AI response');
        console.log('📊 Weak areas found:', parsed.weakAreas?.length || 0);
        console.log('💡 Recommendations:', parsed.recommendations?.length || 0);
        
        // Validate structure
        if (!parsed.overallMessage || !Array.isArray(parsed.weakAreas) || !Array.isArray(parsed.recommendations)) {
            throw new Error('Invalid response structure');
        }
        
        // Ensure exactly 5 recommendations
        while (parsed.recommendations.length < 5) {
            parsed.recommendations.push('Continue practicing regularly');
        }
        parsed.recommendations = parsed.recommendations.slice(0, 5);
        
        return parsed;
        
    } catch (error) {
        console.error('❌ Parse error:', error);
        console.log('⚠️ Using fallback insights...');
        return generateFallbackInsights(latestQuiz, wrongAnswers, stats);
    }
}

// ✅ IMPROVED: Fallback insights that actually look at wrong answers
function generateFallbackInsights(latestQuiz, wrongAnswers, stats) {
    console.log('🔧 Generating fallback insights...');
    
    // Build overall message based on ACTUAL score
    let message = '';
    const percentage = latestQuiz.percentage;
    
    if (wrongAnswers.length === 0) {
        message = `🎉 Perfect score on "${latestQuiz.quizTitle}"! You got all ${latestQuiz.totalQuestions} questions correct! Keep up the excellent work!`;
    } else if (percentage >= 80) {
        message = `Great job on "${latestQuiz.quizTitle}"! You scored ${latestQuiz.score}/${latestQuiz.totalQuestions} (${percentage}%). Let's review the ${wrongAnswers.length} question(s) you missed to reach perfection!`;
    } else if (percentage >= 60) {
        message = `Good effort on "${latestQuiz.quizTitle}"! You scored ${latestQuiz.score}/${latestQuiz.totalQuestions} (${percentage}%). Focus on the ${wrongAnswers.length} areas below to improve!`;
    } else {
        message = `You completed "${latestQuiz.quizTitle}" and scored ${latestQuiz.score}/${latestQuiz.totalQuestions} (${percentage}%). Don't worry - let's identify what needs work and get you on track!`;
    }
    
    // Build weak areas from ACTUAL wrong answers
    const weakAreas = [];
    
    if (wrongAnswers.length > 0) {
        // Group similar wrong answers by topic
        const topicGroups = {};
        
        wrongAnswers.forEach(wa => {
            const topic = extractTopic(wa.question);
            if (!topicGroups[topic]) {
                topicGroups[topic] = [];
            }
            topicGroups[topic].push(wa);
        });
        
        // Create weak area entries
        Object.entries(topicGroups).forEach(([topic, mistakes]) => {
            const priority = mistakes.length >= 2 ? 'high' : mistakes.length === 1 ? 'medium' : 'low';
            
            const description = mistakes.length === 1
                ? `You answered "${mistakes[0].userAnswer}" but the correct answer was "${mistakes[0].correctAnswer}".`
                : `You got ${mistakes.length} questions wrong in this area. Review the fundamentals.`;
            
            weakAreas.push({
                topic,
                description,
                priority
            });
        });
    }
    
    // Build recommendations based on weak areas
    const recommendations = [];
    
    if (weakAreas.length > 0) {
        recommendations.push(`Review "${latestQuiz.quizTitle}" - focus on the ${wrongAnswers.length} question(s) you missed`);
        recommendations.push(`Study: ${weakAreas[0].topic} - this was your main challenge`);
        
        if (weakAreas.length > 1) {
            recommendations.push(`Also practice: ${weakAreas[1].topic}`);
        } else {
            recommendations.push('Create flashcards for difficult concepts');
        }
    } else {
        recommendations.push('Challenge yourself with more advanced topics');
        recommendations.push('Help classmates who are struggling');
        recommendations.push('Try timed quizzes to improve speed');
    }
    
    // Add general tips to reach 5
    recommendations.push('Ask your professor for clarification on confusing topics');
    recommendations.push('Form a study group with classmates');
    
    console.log('✅ Fallback insights generated:', {
        weakAreas: weakAreas.length,
        recommendations: recommendations.length
    });
    
    return {
        overallMessage: message,
        weakAreas: weakAreas.slice(0, 5),
        recommendations: recommendations.slice(0, 5)
    };
}

// ✅ IMPROVED: Better topic extraction
function extractTopic(question) {
    const lowerQ = question.toLowerCase();
    
    // Math topics
    if (lowerQ.match(/\+|add|sum|plus/)) return 'Addition';
    if (lowerQ.match(/\-|subtract|minus|difference/)) return 'Subtraction';
    if (lowerQ.match(/\*|×|multiply|times|product/)) return 'Multiplication';
    if (lowerQ.match(/\/|÷|divide|quotient/)) return 'Division';
    if (lowerQ.match(/fraction|decimal|percent/)) return 'Fractions & Decimals';
    if (lowerQ.match(/equation|solve|algebra/)) return 'Algebra';
    if (lowerQ.match(/geometry|angle|triangle|circle/)) return 'Geometry';
    
    // Programming topics
    if (lowerQ.match(/variable|declare|assign/)) return 'Variables';
    if (lowerQ.match(/loop|for|while|iterate/)) return 'Loops';
    if (lowerQ.match(/function|method|return/)) return 'Functions';
    if (lowerQ.match(/array|list|index/)) return 'Arrays';
    if (lowerQ.match(/object|class|property/)) return 'Objects & Classes';
    if (lowerQ.match(/if|else|condition|boolean/)) return 'Conditionals';
    if (lowerQ.match(/string|text|char/)) return 'Strings';
    
    // Science topics
    if (lowerQ.match(/atom|element|molecule|chemical/)) return 'Chemistry';
    if (lowerQ.match(/cell|organism|biology|dna/)) return 'Biology';
    if (lowerQ.match(/force|energy|physics|motion/)) return 'Physics';
    if (lowerQ.match(/plant|animal|ecosystem/)) return 'Life Science';
    
    // Default: use first few words
    const words = question.split(' ').slice(0, 3).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
}

// Keep existing display functions
// ✅ UPDATED: Display AI insights with MOTIVATIONAL MESSAGE in performance card
export function displayAIInsights(insights, stats, latestQuiz) {
    console.log('🎨 Displaying AI insights on page...');
    
    document.getElementById('aiMessage').textContent = insights.overallMessage;
    document.getElementById('quizzesTaken').textContent = stats.totalQuizzes;
    document.getElementById('avgScore').textContent = stats.avgPercentage + '%';
    document.getElementById('totalCoins').textContent = stats.totalCoinsEarned;
    
    // ✅ NEW: Generate and display motivational message
    const motivationalMsg = generateMotivationalMessage(latestQuiz, stats, insights.weakAreas.length);
    document.getElementById('motivationalMessage').innerHTML = motivationalMsg;
    
    const weakAreasDiv = document.getElementById('weakAreas');
    
    // ✅ If no weak areas, show success message
    if (insights.weakAreas.length === 0) {
        console.log('✅ No weak areas - showing perfect message');
        weakAreasDiv.innerHTML = `
            <div class="mistake-item">
                <p style="color: #00ff88; font-size: 16px; text-align: center; padding: 20px;">
                    🎉 Excellent! No major weak areas detected!<br>
                    <span style="font-size: 14px; opacity: 0.8; margin-top: 8px; display: block;">
                        Keep up the great work! Consider challenging yourself with advanced topics.
                    </span>
                </p>
            </div>
        `;
    } else {
        // ✅ Display collapsible cards (max 3, but can be 1-3 based on actual mistakes)
        console.log('📋 Displaying', insights.weakAreas.length, 'weak areas as collapsible cards');
        
        weakAreasDiv.innerHTML = insights.weakAreas.slice(0, 3).map((area, index) => {
            const priorityColor = {
                'high': '#ff4b2b',
                'medium': '#ffa500',
                'low': '#00d4ff'
            }[area.priority] || '#00d4ff';
            
            const priorityIcon = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🔵'
            }[area.priority] || '🔵';
            
            const cardId = `weak-card-${index}`;
            
            return `
                <div class="knowledge-gap-card" style="border-left: 4px solid ${priorityColor};">
                    <div class="gap-card-header" onclick="toggleWeakCard('${cardId}')">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <span style="font-size: 24px;">${priorityIcon}</span>
                            <div style="flex: 1;">
                                <strong style="color: ${priorityColor}; font-size: 16px; display: block;">
                                    ${area.topic}
                                </strong>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: ${priorityColor}33; color: ${priorityColor}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                                ${area.priority} priority
                            </span>
                            <i class='bx bx-chevron-down' id="${cardId}-icon" style="font-size: 24px; color: ${priorityColor}; transition: transform 0.3s;"></i>
                        </div>
                    </div>
                    <div class="gap-card-content" id="${cardId}" style="display: none;">
                        <p style="font-size: 14px; background: rgba(0, 212, 255, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #00d4ff; line-height: 1.6; margin-top: 15px;">
                            💡 <strong>Why This Matters:</strong> ${area.description}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    const recList = document.getElementById('recommendations');
    console.log('💡 Displaying', insights.recommendations.length, 'recommendations');
    
    recList.innerHTML = insights.recommendations.map((rec, index) => `
        <li style="margin-bottom: 12px; line-height: 1.6; font-size: 15px;">
            <i class='bx bx-check-double' style="color: #00ff88; font-size: 20px;"></i> 
            ${rec}
        </li>
    `).join('');
}

// ✅ NEW: Generate motivational message based on performance
function generateMotivationalMessage(latestQuiz, stats, weakAreasCount) {
    const percentage = latestQuiz.percentage;
    const trend = stats.trend;
    const avgScore = stats.avgPercentage;
    
    let icon = '';
    let message = '';
    let colorClass = '';
    
    // Perfect Score (100%)
    if (percentage === 100) {
        icon = '🌟';
        colorClass = 'motivation-perfect';
        const messages = [
            'Flawless victory! You\'re unstoppable!',
            'Perfect score! Your dedication is paying off!',
            'Phenomenal! Keep this momentum going!',
            'Outstanding! You\'ve mastered this topic!'
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
    }
    // Excellent (90-99%)
    else if (percentage >= 90) {
        icon = '🎯';
        colorClass = 'motivation-excellent';
        const messages = [
            'Excellent work! You\'re almost at perfection!',
            'Amazing performance! Just one more push to 100%!',
            'Superb! You\'re in the top tier!',
            'Fantastic! Keep pushing for that perfect score!'
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
    }
    // Great (80-89%)
    else if (percentage >= 80) {
        icon = '🚀';
        colorClass = 'motivation-great';
        if (trend === 'improving') {
            message = 'You\'re on fire! Your scores are climbing!';
        } else {
            const messages = [
                'Great job! You\'re showing solid understanding!',
                'Strong performance! Keep building on this!',
                'Well done! You\'re making excellent progress!'
            ];
            message = messages[Math.floor(Math.random() * messages.length)];
        }
    }
    // Good (70-79%)
    else if (percentage >= 70) {
        icon = '💪';
        colorClass = 'motivation-good';
        if (trend === 'improving') {
            message = 'Nice improvement! You\'re getting stronger!';
        } else if (weakAreasCount === 1) {
            message = 'Good effort! Just 1 area to work on!';
        } else {
            message = 'Solid work! Focus on those weak areas!';
        }
    }
    // Fair (60-69%)
    else if (percentage >= 60) {
        icon = '📚';
        colorClass = 'motivation-fair';
        if (trend === 'improving') {
            message = 'You\'re improving! Keep studying consistently!';
        } else if (weakAreasCount <= 2) {
            message = 'You\'re getting there! Review those key topics!';
        } else {
            message = 'Keep going! Progress takes time and effort!';
        }
    }
    // Needs Work (50-59%)
    else if (percentage >= 50) {
        icon = '🎓';
        colorClass = 'motivation-needswork';
        if (trend === 'improving') {
            message = 'You\'re on the right track! Keep improving!';
        } else {
            message = 'Don\'t give up! Focus on understanding the basics!';
        }
    }
    // Struggling (< 50%)
    else {
        icon = '💡';
        colorClass = 'motivation-struggling';
        if (trend === 'improving') {
            message = 'Every step forward counts! You\'re improving!';
        } else if (stats.totalQuizzes === 1) {
            message = 'First attempt is tough! You\'ll improve with practice!';
        } else {
            message = 'Don\'t worry! Ask your professor for help!';
        }
    }
    
    // Add trend-specific messages
    let trendEmoji = '';
    if (trend === 'improving' && percentage < 100) {
        trendEmoji = ' 📈';
    } else if (trend === 'declining') {
        trendEmoji = ' ⚠️';
    }
    
    return `
        <div class="motivational-message ${colorClass}">
            <div class="motivation-icon">${icon}</div>
            <div class="motivation-text">
                ${message}${trendEmoji}
            </div>
        </div>
    `;
}

// ✅ Toggle collapsible weak area cards
window.toggleWeakCard = function(cardId) {
    const content = document.getElementById(cardId);
    const icon = document.getElementById(`${cardId}-icon`);
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};

// ✅ NEW: Toggle collapsible weak area cards
window.toggleWeakCard = function(cardId) {
    const content = document.getElementById(cardId);
    const icon = document.getElementById(`${cardId}-icon`);
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};

export function displayQuizHistory(quizResults) {
    const historyDiv = document.getElementById('quizHistory');
    
    if (quizResults.length === 0) {
        historyDiv.innerHTML = '<p style="opacity: 0.7;">No quiz history</p>';
        return;
    }
    
    historyDiv.innerHTML = quizResults.slice(0, 5).map((result, index) => {
        const date = new Date(result.completedAt);
        const scoreColor = result.percentage >= 70 ? '#00ff88' : result.percentage >= 50 ? '#ffa500' : '#ff4b2b';
        
        return `
            <div class="mistake-item" style="display: flex; justify-content: space-between; align-items: center; ${index === 0 ? 'border: 2px solid #00d4ff;' : ''}">
                <div>
                    <strong>${result.quizTitle}</strong>
                    ${index === 0 ? '<span style="background: #00d4ff; color: #081b29; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; margin-left: 8px;">LATEST</span>' : ''}
                    <p style="font-size: 13px; opacity: 0.8; margin-top: 5px;">
                        ${date.toLocaleDateString()} • ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 20px; font-weight: 700; color: ${scoreColor};">
                        ${result.score}/${result.totalQuestions}
                    </p>
                    <p style="font-size: 14px; opacity: 0.9;">${result.percentage}%</p>
                    <p style="font-size: 12px; color: gold; margin-top: 3px;">+${result.coinsEarned || 0} coins</p>
                </div>
            </div>
        `;
    }).join('');
}