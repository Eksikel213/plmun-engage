// report-ai.js - FIXED with correct API version
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// ✅ FIXED: Using v1 (stable) instead of v1beta
const GEMINI_API_KEY = "AIzaSyCIUn_mXTd52An2BIlz38bpP7QUVWiulQM"; 
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

export async function analyzeWithGemini(db, currentUser) {
    try {
        const resultsRef = collection(db, 'quizResults');
        const q = query(resultsRef, where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const quizResults = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        
        if (quizResults.length === 0) {
            return { hasResults: false };
        }
        
        const latestQuiz = quizResults[0];
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
        
        const stats = calculateStats(quizResults);
        const aiInsights = await generateGeminiInsights(latestQuiz, wrongAnswers, stats);
        
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

async function generateGeminiInsights(latestQuiz, wrongAnswers, stats) {
    try {
        const prompt = buildGeminiPrompt(latestQuiz, wrongAnswers, stats);
        
        console.log('🤖 Calling Gemini API...');
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            throw new Error(`Gemini API error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        console.log('✅ AI Response received');
        return parseGeminiResponse(aiResponse);
        
    } catch (error) {
        console.error('❌ Gemini Error:', error);
        return generateFallbackInsights(latestQuiz, wrongAnswers, stats);
    }
}

function buildGeminiPrompt(latestQuiz, wrongAnswers, stats) {
    const wrongQuestionsText = wrongAnswers.length > 0 
        ? wrongAnswers.map((wa, i) => 
            `Question ${i + 1}: ${wa.question}\n` +
            `Student's Answer: ${wa.userAnswer}\n` +
            `Correct Answer: ${wa.correctAnswer}\n`
        ).join('\n')
        : 'All answers were correct!';
    
    return `You are an expert educational AI tutor. Analyze this student's quiz performance:

**Latest Quiz:**
- Title: ${latestQuiz.quizTitle}
- Score: ${latestQuiz.score}/${latestQuiz.totalQuestions} (${latestQuiz.percentage}%)

**Wrong Answers:**
${wrongQuestionsText}

**Stats:**
- Total Quizzes: ${stats.totalQuizzes}
- Average: ${stats.avgPercentage}%
- Trend: ${stats.trend}

Return ONLY valid JSON (no markdown):

{
    "overallMessage": "2-3 sentence motivational summary",
    "weakAreas": [
        {
            "topic": "Specific topic",
            "description": "Why challenging",
            "priority": "high/medium/low"
        }
    ],
    "recommendations": [
        "Actionable tip 1",
        "Actionable tip 2",
        "Actionable tip 3",
        "Actionable tip 4",
        "Actionable tip 5"
    ]
}

Provide EXACTLY 5 recommendations.`;
}

function parseGeminiResponse(aiResponse) {
    try {
        let cleanResponse = aiResponse.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/g, '');
        }
        
        return JSON.parse(cleanResponse);
        
    } catch (error) {
        console.error('❌ Parse error:', error);
        
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error('❌ Extraction failed');
            }
        }
        
        return {
            overallMessage: aiResponse.substring(0, 200) + '...',
            weakAreas: [],
            recommendations: [
                'Review the questions you missed',
                'Practice more on similar topics',
                'Ask your professor for help',
                'Form a study group',
                'Take another practice quiz'
            ]
        };
    }
}

function generateFallbackInsights(latestQuiz, wrongAnswers, stats) {
    const weakAreas = wrongAnswers.slice(0, 3).map(wa => ({
        topic: extractTopic(wa.question),
        description: `You answered "${wa.userAnswer}" but correct was "${wa.correctAnswer}"`,
        priority: 'high'
    }));
    
    const recommendations = [
        `Review "${latestQuiz.quizTitle}" - focus on ${wrongAnswers.length} missed question(s)`,
        `Study: ${weakAreas[0]?.topic || 'areas you struggled with'}`,
        'Practice similar questions',
        'Create flashcards for difficult concepts',
        'Ask your professor for clarification'
    ];
    
    let message = '';
    if (stats.avgPercentage >= 80) {
        message = `Great job! ${stats.avgPercentage}% average. Keep challenging yourself!`;
    } else if (stats.avgPercentage >= 60) {
        message = `Good progress at ${stats.avgPercentage}%. Focus on areas below to improve further.`;
    } else {
        message = `${stats.totalQuizzes} quiz(es) completed. Let's focus on improvement areas.`;
    }
    
    return {
        overallMessage: message,
        weakAreas,
        recommendations
    };
}

function extractTopic(question) {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.match(/\+|add|sum/)) return 'Addition';
    if (lowerQ.match(/\-|subtract|minus/)) return 'Subtraction';
    if (lowerQ.match(/\*|×|multiply|times/)) return 'Multiplication';
    if (lowerQ.match(/\/|÷|divide/)) return 'Division';
    if (lowerQ.match(/fraction|decimal/)) return 'Fractions & Decimals';
    if (lowerQ.match(/variable|declare/)) return 'Variables';
    if (lowerQ.match(/loop|for|while/)) return 'Loops';
    if (lowerQ.match(/function|method/)) return 'Functions';
    if (lowerQ.match(/array|list/)) return 'Arrays';
    if (lowerQ.match(/object|class/)) return 'Objects & Classes';
    if (lowerQ.match(/atom|element|molecule/)) return 'Chemistry';
    if (lowerQ.match(/cell|organism|biology/)) return 'Biology';
    if (lowerQ.match(/force|energy|physics/)) return 'Physics';
    
    return question.substring(0, 30) + '...';
}

export function displayAIInsights(insights, stats, latestQuiz) {
    document.getElementById('aiMessage').textContent = insights.overallMessage;
    document.getElementById('quizzesTaken').textContent = stats.totalQuizzes;
    document.getElementById('avgScore').textContent = stats.avgPercentage + '%';
    document.getElementById('totalCoins').textContent = stats.totalCoinsEarned;
    
    const weakAreasDiv = document.getElementById('weakAreas');
    if (insights.weakAreas.length === 0) {
        weakAreasDiv.innerHTML = `
            <div class="mistake-item">
                <p style="color: #00ff88;">🎉 Excellent! No major weak areas!</p>
            </div>
        `;
    } else {
        weakAreasDiv.innerHTML = insights.weakAreas.map(area => {
            const priorityColor = {
                'high': '#ff4b2b',
                'medium': '#ffa500',
                'low': '#00d4ff'
            }[area.priority] || '#00d4ff';
            
            return `
                <div class="mistake-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: ${priorityColor};">${area.topic}</strong>
                        <span style="background: ${priorityColor}33; color: ${priorityColor}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                            ${area.priority} priority
                        </span>
                    </div>
                    <p style="font-size: 14px; opacity: 0.9; line-height: 1.5;">${area.description}</p>
                </div>
            `;
        }).join('');
    }
    
    const recList = document.getElementById('recommendations');
    const displayRecs = insights.recommendations.slice(0, 5);
    
    while (displayRecs.length < 5) {
        displayRecs.push('Continue practicing regularly');
    }
    
    recList.innerHTML = displayRecs.map((rec, index) => `
        <li style="margin-bottom: 12px; line-height: 1.6;">
            <i class='bx bx-check-double' style="color: #00ff88;"></i> 
            ${rec}
        </li>
    `).join('');
}

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