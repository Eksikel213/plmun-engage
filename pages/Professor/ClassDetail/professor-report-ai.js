// professor-report-ai.js - COLLAPSIBLE CARDS VERSION
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function analyzeClassWithGemini(db, currentClassId) {
    try {
        console.log('🤖 Starting AI analysis for class:', currentClassId);
        
        const quizzesRef = collection(db, 'quizzes');
        const qQuizzes = query(quizzesRef, where('classId', '==', currentClassId));
        const quizzesSnapshot = await getDocs(qQuizzes);
        
        if (quizzesSnapshot.empty) {
            return { hasResults: false, message: 'No quizzes created yet' };
        }
        
        const quizzes = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📚 Found', quizzes.length, 'quiz(zes) in this class');
        
        const resultsRef = collection(db, 'quizResults');
        const allResults = [];
        
        for (const quiz of quizzes) {
            const qResults = query(resultsRef, where('quizId', '==', quiz.id));
            const resultsSnapshot = await getDocs(qResults);
            
            resultsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                allResults.push({ 
                    id: doc.id, 
                    ...data,
                    quizTitle: quiz.title,
                    quizCode: quiz.code
                });
            });
        }
        
        if (allResults.length === 0) {
            return { hasResults: false, message: 'No student results yet' };
        }
        
        console.log('✅ Loaded', allResults.length, 'total student result(s)');
        
        allResults.sort((a, b) => {
            const timeA = a.completedAtTimestamp || new Date(a.completedAt).getTime();
            const timeB = b.completedAtTimestamp || new Date(b.completedAt).getTime();
            return timeB - timeA;
        });
        
        const latestResult = allResults[0];
        const latestQuizId = latestResult.quizId;
        const latestQuizTitle = latestResult.quizTitle;
        const latestQuizCode = latestResult.quizCode;
        
        const latestQuizResults = allResults.filter(r => r.quizId === latestQuizId);
        
        console.log('🎯 Latest quiz:', latestQuizTitle, '(Code:', latestQuizCode + ')');
        console.log('📊 Students who took it:', latestQuizResults.length);
        
        const stats = calculateLatestQuizStats(latestQuizResults, latestQuizTitle, latestQuizCode);
        const commonMistakes = extractCommonMistakes(latestQuizResults);
        
        const aiInsights = await generateGroqInsights(stats, commonMistakes, latestQuizResults);
        
        return {
            hasResults: true,
            stats,
            commonMistakes,
            aiInsights,
            allResults: latestQuizResults,
            latestQuizInfo: {
                title: latestQuizTitle,
                code: latestQuizCode,
                date: new Date(latestResult.completedAt).toLocaleDateString()
            }
        };
        
    } catch (error) {
        console.error('❌ Error analyzing class:', error);
        throw error;
    }
}

function calculateLatestQuizStats(results, quizTitle, quizCode) {
    const uniqueStudents = new Set(results.map(r => r.userId)).size;
    const totalAttempts = results.length;
    
    const percentages = results.map(r => r.percentage);
    const classAvg = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);
    
    const studentPerf = {};
    results.forEach(result => {
        if (!studentPerf[result.userId]) {
            studentPerf[result.userId] = {
                name: result.userName,
                attempts: 0,
                totalScore: 0,
                totalQuestions: 0
            };
        }
        studentPerf[result.userId].attempts++;
        studentPerf[result.userId].totalScore += result.score;
        studentPerf[result.userId].totalQuestions += result.totalQuestions;
    });
    
    const studentList = Object.values(studentPerf)
        .map(s => ({
            ...s,
            avg: Math.round((s.totalScore / s.totalQuestions) * 100)
        }))
        .sort((a, b) => b.avg - a.avg);
    
    const strugglingStudents = studentList.filter(s => s.avg < 60).length;
    const excellentStudents = studentList.filter(s => s.avg >= 85).length;
    
    return {
        uniqueStudents,
        totalAttempts,
        classAvg,
        highest,
        lowest,
        studentList,
        strugglingStudents,
        excellentStudents,
        totalQuizzes: 1,
        latestQuizTitle: quizTitle,
        latestQuizCode: quizCode
    };
}

// ✅ NEW: Return 1-3 gaps based on what exists (not forced to 3)
function extractCommonMistakes(results) {
    const wrongQuestions = {};
    
    results.forEach(result => {
        if (result.detailedResults) {
            result.detailedResults.forEach(detail => {
                if (!detail.isCorrect) {
                    const key = detail.question;
                    if (!wrongQuestions[key]) {
                        wrongQuestions[key] = {
                            question: detail.question,
                            count: 0,
                            correctAnswer: detail.correctAnswer,
                            studentsMissed: [],
                            wrongAnswersGiven: []
                        };
                    }
                    wrongQuestions[key].count++;
                    wrongQuestions[key].studentsMissed.push(result.userName);
                    wrongQuestions[key].wrongAnswersGiven.push(detail.userAnswer);
                }
            });
        }
    });
    
    // Return TOP mistakes (1-3, not forced)
    return Object.values(wrongQuestions)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
}

async function generateGroqInsights(stats, commonMistakes, allResults) {
    try {
        const prompt = buildGroqPrompt(stats, commonMistakes);
        
        console.log('🤖 Calling Groq AI for teaching insights...');
        
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
                max_tokens: 1200,
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
        
        console.log('✅ Groq AI response received');
        return parseGroqResponse(aiResponse, stats, commonMistakes);
        
    } catch (error) {
        console.error('❌ Groq Error:', error);
        console.log('⚠️ Falling back to rule-based insights...');
        return generateFallbackInsights(stats, commonMistakes);
    }
}

function buildGroqPrompt(stats, commonMistakes) {
    const mistakesText = commonMistakes.length > 0
        ? commonMistakes.map((m, i) => {
            const percentage = Math.round((m.count / stats.totalAttempts) * 100);
            const exampleWrongAnswers = [...new Set(m.wrongAnswersGiven)].slice(0, 3).join('", "');
            return `${i + 1}. Question: "${m.question}"
   - ${m.count} student(s) (${percentage}%) got this wrong
   - Correct answer: "${m.correctAnswer}"
   - Common wrong answers: "${exampleWrongAnswers}"`;
        }).join('\n\n')
        : 'No common mistakes - students are doing exceptionally well! 🎉';
    
    return `You are an expert educational AI advisor helping a professor improve their teaching effectiveness.

**LATEST QUIZ ANALYSIS:**
Quiz: "${stats.latestQuizTitle}" (Code: ${stats.latestQuizCode})
This analysis focuses ONLY on the most recent quiz taken by students.

**Class Performance on This Quiz:**
- Total Students Who Took It: ${stats.uniqueStudents}
- Class Average: ${stats.classAvg}%
- Highest Score: ${stats.highest}%
- Lowest Score: ${stats.lowest}%
- Struggling Students (< 60%): ${stats.strugglingStudents}
- Excellent Students (≥ 85%): ${stats.excellentStudents}

**Questions Students Got Wrong:**
${mistakesText}

**Your Task:**
Analyze this LATEST QUIZ data and provide teaching insights. Return ONLY valid JSON (no markdown, no code blocks):

{
    "overallMessage": "2-3 sentence assessment of how students performed on THIS specific quiz",
    "knowledgeGaps": [
        {
            "topic": "Specific concept from the quiz",
            "severity": "high/medium/low",
            "affectedStudents": "X students (Y%)",
            "teachingTip": "Specific, actionable advice on HOW to re-teach THIS concept"
        }
    ],
    "teachingRecommendations": [
        "Specific teaching strategy 1",
        "Specific teaching strategy 2",
        "Specific teaching strategy 3"
    ]
}

**CRITICAL REQUIREMENTS:**
1. Base analysis ONLY on the questions students got wrong
2. Provide ${commonMistakes.length} knowledge gap(s) (one for each wrong question, NOT forced to 3)
3. If only 1 question was wrong, provide 1 gap. If 2 were wrong, provide 2 gaps. Maximum 3.
4. Each teaching tip must be SPECIFIC to the actual question
5. Provide exactly 3 teaching recommendations
6. If students did perfectly (no wrong answers), say so and suggest enrichment

Return ONLY the JSON object.`;
}

function parseGroqResponse(aiResponse, stats, commonMistakes) {
    try {
        let cleanResponse = aiResponse.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(cleanResponse);
        
        console.log('✅ Successfully parsed Groq response');
        
        if (!parsed.overallMessage || !Array.isArray(parsed.knowledgeGaps) || !Array.isArray(parsed.teachingRecommendations)) {
            throw new Error('Invalid response structure');
        }
        
        // ✅ NEW: Keep only as many gaps as there are actual mistakes (max 3)
        const maxGaps = Math.min(commonMistakes.length, 3);
        parsed.knowledgeGaps = parsed.knowledgeGaps.slice(0, maxGaps);
        
        // ✅ Ensure exactly 3 recommendations
        while (parsed.teachingRecommendations.length < 3) {
            parsed.teachingRecommendations.push('Continue monitoring student progress and adjust teaching pace accordingly');
        }
        parsed.teachingRecommendations = parsed.teachingRecommendations.slice(0, 3);
        
        return parsed;
        
    } catch (error) {
        console.error('❌ Parse error:', error);
        return generateFallbackInsights(stats, commonMistakes);
    }
}

// ✅ NEW: Generate 1-3 gaps based on actual mistakes (not forced)
function generateFallbackInsights(stats, commonMistakes) {
    console.log('🔧 Generating rule-based insights for latest quiz...');
    
    let message = `Analysis of "${stats.latestQuizTitle}" (Code: ${stats.latestQuizCode}): `;
    
    if (stats.classAvg >= 85) {
        message += `Excellent! Class averaged ${stats.classAvg}%. ${stats.uniqueStudents} student(s) mastered this quiz. Consider advanced challenges. 🌟`;
    } else if (stats.classAvg >= 70) {
        message += `Good performance! Class averaged ${stats.classAvg}%. ${commonMistakes.length > 0 ? `Focus on ${commonMistakes.length} question(s) that need review.` : 'Keep it up!'} 💪`;
    } else if (stats.classAvg >= 55) {
        message += `Class averaged ${stats.classAvg}%. ${stats.strugglingStudents} student(s) need support on ${commonMistakes.length} key topic(s). 📚`;
    } else {
        message += `Class averaged ${stats.classAvg}% - immediate review needed for ${commonMistakes.length} critical topic(s). 🆘`;
    }
    
    // ✅ Build gaps based on ACTUAL mistakes (1-3, not forced)
    const knowledgeGaps = [];
    
    for (let i = 0; i < commonMistakes.length; i++) {
        const mistake = commonMistakes[i];
        const percentage = Math.round((mistake.count / stats.totalAttempts) * 100);
        const severity = percentage >= 50 ? 'high' : percentage >= 30 ? 'medium' : 'low';
        const topic = extractTopicFromQuestion(mistake.question);
        const teachingTip = generateSpecificTeachingTip(topic, mistake);
        
        knowledgeGaps.push({
            topic,
            severity,
            affectedStudents: `${mistake.count} student(s) (${percentage}%)`,
            teachingTip
        });
    }
    
    // ✅ If NO mistakes, add a positive gap
    if (knowledgeGaps.length === 0) {
        knowledgeGaps.push({
            topic: 'No Knowledge Gaps Identified',
            severity: 'low',
            affectedStudents: '0 students (0%)',
            teachingTip: '🎉 Excellent! All students understood the material. Consider introducing more challenging content or advanced topics to keep students engaged.'
        });
    }
    
    // ✅ Generate exactly 3 teaching recommendations
    const teachingRecommendations = [];
    
    if (stats.classAvg < 60) {
        teachingRecommendations.push(`🆘 Schedule a review session specifically for "${stats.latestQuizTitle}" before moving forward`);
    }
    
    if (commonMistakes.length > 0) {
        const topMistake = commonMistakes[0];
        teachingRecommendations.push(`🎯 Re-teach the concept: "${topMistake.question}" with different examples`);
    }
    
    if (stats.strugglingStudents > 0) {
        teachingRecommendations.push(`💥 Offer one-on-one help to ${stats.strugglingStudents} struggling student(s) on this quiz`);
    } else if (stats.excellentStudents > 0) {
        teachingRecommendations.push(`🌟 Challenge ${stats.excellentStudents} high-performer(s) with advanced questions`);
    }
    
    // Fill to exactly 3
    if (teachingRecommendations.length < 3) {
        teachingRecommendations.push('✅ Create a follow-up quiz to verify understanding');
    }
    if (teachingRecommendations.length < 3) {
        teachingRecommendations.push('📖 Provide study materials specific to this quiz\'s topics');
    }
    
    const finalRecs = teachingRecommendations.slice(0, 3);
    
    return {
        overallMessage: message,
        knowledgeGaps: knowledgeGaps, // 1-3 gaps based on actual mistakes
        teachingRecommendations: finalRecs
    };
}

function generateSpecificTeachingTip(topic, mistakeExample) {
    const question = mistakeExample.question.toLowerCase();
    
    if (question.includes('color') && question.includes('sky')) {
        return 'Use visual aids! Show photos of the sky at different times of day. Take students outside to observe directly.';
    }
    
    if (question.match(/\d+\s*\+\s*\d+/) || question.includes('add') || question.includes('sum')) {
        return 'Use manipulatives like blocks or counters. Practice with real-world scenarios (e.g., "If you have 2 apples and get 3 more...").';
    }
    
    if (question.includes('mona lisa') || question.includes('artist') || question.includes('leonardo')) {
        return 'Use visual aids like images of the Mona Lisa and provide biographical information about Leonardo da Vinci to help distinguish between the artist and other historical or contemporary figures.';
    }
    
    return `${mistakeExample.count} student(s) missed this. Break down "${question}" into simpler steps. Use concrete examples before abstract explanations.`;
}

function extractTopicFromQuestion(question) {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('mona lisa')) return 'Artist of the Mona Lisa';
    if (lowerQ.includes('color') || lowerQ.includes('colour')) return 'Color Recognition';
    if (lowerQ.match(/\d+\s*\+\s*\d+/)) return 'Addition';
    if (lowerQ.includes('capital')) return 'Geography - Capitals';
    
    const words = question.split(' ').slice(0, 5).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
}

// ✅ NEW: Display as COLLAPSIBLE CARDS with 2-column layout
export function displayClassAIInsights(insights, stats) {
    const quizInfo = `"${stats.latestQuizTitle}" (Code: ${stats.latestQuizCode})`;
    
    document.getElementById('aiMessage').innerHTML = `
        <strong style="color: #00d4ff;">📊 Latest Quiz Analyzed:</strong> ${quizInfo}<br><br>
        ${insights.overallMessage}
    `;
    
    document.getElementById('totalStudentsReport').textContent = stats.uniqueStudents;
    document.getElementById('classAvgReport').textContent = stats.classAvg + '%';
    document.getElementById('totalQuizzesReport').textContent = '1 (Latest)';
    document.getElementById('strugglingStudentsReport').textContent = stats.strugglingStudents;
    document.getElementById('excellentStudentsReport').textContent = stats.excellentStudents;
    
    // ✅ Display knowledge gaps as COLLAPSIBLE CARDS
    const knowledgeGapsDiv = document.getElementById('knowledgeGaps');
    
    if (insights.knowledgeGaps.length === 0 || insights.knowledgeGaps[0].topic === 'No Knowledge Gaps Identified') {
        knowledgeGapsDiv.innerHTML = `
            <div class="mistake-item">
                <p style="color: #00ff88; text-align: center; font-size: 16px; padding: 20px;">
                    🎉 Excellent! No knowledge gaps in the latest quiz!
                </p>
            </div>
        `;
    } else {
        knowledgeGapsDiv.innerHTML = insights.knowledgeGaps.map((gap, index) => {
            const severityColor = {
                'high': '#ff4b2b',
                'medium': '#ffa500',
                'low': '#00d4ff'
            }[gap.severity] || '#00d4ff';
            
            const severityIcon = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🔵'
            }[gap.severity] || '🔵';
            
            const cardId = `gap-card-${index}`;
            
            return `
                <div class="knowledge-gap-card" style="border-left: 4px solid ${severityColor};">
                    <div class="gap-card-header" onclick="toggleGapCard('${cardId}')">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <span style="font-size: 24px;">${severityIcon}</span>
                            <div style="flex: 1;">
                                <strong style="color: ${severityColor}; font-size: 16px; display: block;">
                                    ${gap.topic}
                                </strong>
                                <span style="font-size: 13px; opacity: 0.8; color: rgba(255,255,255,0.7);">
                                    📊 ${gap.affectedStudents}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: ${severityColor}33; color: ${severityColor}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                                ${gap.severity} priority
                            </span>
                            <i class='bx bx-chevron-down' id="${cardId}-icon" style="font-size: 24px; color: ${severityColor}; transition: transform 0.3s;"></i>
                        </div>
                    </div>
                    <div class="gap-card-content" id="${cardId}" style="display: none;">
                        <p style="font-size: 14px; background: rgba(0, 212, 255, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #00d4ff; line-height: 1.6; margin-top: 15px;">
                            💡 <strong>Teaching Tip:</strong> ${gap.teachingTip}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // ✅ Display exactly 3 recommendations
    const recList = document.getElementById('teachingRecommendations');
    const displayRecs = insights.teachingRecommendations.slice(0, 3);
    
    recList.innerHTML = displayRecs.map((rec, index) => `
        <li style="margin-bottom: 12px; line-height: 1.6; font-size: 15px;">
            <i class='bx bx-check-double' style="color: #00ff88; font-size: 20px;"></i> 
            ${rec}
        </li>
    `).join('');
}

// ✅ NEW: Toggle collapsible card
window.toggleGapCard = function(cardId) {
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

export function displayStudentPerformance(studentList) {
    const perfDiv = document.getElementById('studentPerformance');
    
    if (studentList.length === 0) {
        perfDiv.innerHTML = '<p style="opacity: 0.7;">No student data available</p>';
        return;
    }
    
    perfDiv.innerHTML = studentList.map((student, index) => {
        const scoreColor = student.avg >= 80 ? '#00ff88' : student.avg >= 60 ? '#ffa500' : '#ff4b2b';
        const badge = student.avg >= 85 ? '🌟' : student.avg < 60 ? '⚠️' : '';
        
        return `
            <div class="mistake-item" style="display: flex; justify-content: space-between; align-items: center; ${index === 0 ? 'border: 2px solid #00d4ff;' : ''}">
                <div>
                    <strong style="font-size: 16px;">${index + 1}. ${student.name} ${badge}</strong>
                    <p style="font-size: 13px; opacity: 0.8; margin-top: 5px;">
                        Latest quiz performance
                    </p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 24px; font-weight: 700; color: ${scoreColor};">
                        ${student.avg}%
                    </p>
                    <p style="font-size: 13px; opacity: 0.8;">${student.totalScore}/${student.totalQuestions}</p>
                </div>
            </div>
        `;
    }).join('');
}