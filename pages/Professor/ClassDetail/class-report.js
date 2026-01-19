// AI-Powered Class Reports Module
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Initialize when reports section becomes active
export async function initializeReports(db, currentClassId) {
    console.log('📊 Initializing AI reports for class:', currentClassId);
    
    const reportsContainer = document.getElementById('reportsSection');
    if (!reportsContainer) {
        console.error('❌ Reports container not found');
        return;
    }
    
    // Show loading state
    reportsContainer.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p style="color: #00d4ff; font-size: 18px;">AI is analyzing class performance...</p>
        </div>
    `;
    
    try {
        // Load all quiz results for this class
        const resultsData = await loadClassResults(db, currentClassId);
        
        if (resultsData.length === 0) {
            showNoResultsState(reportsContainer);
            return;
        }
        
        // Generate AI analysis
        const analysis = analyzeClassData(resultsData);
        
        // Display the report
        displayReport(reportsContainer, analysis);
        
    } catch (error) {
        console.error('❌ Error loading reports:', error);
        reportsContainer.innerHTML = `
            <div class="no-results-state">
                <i class='bx bx-error-circle'></i>
                <h2>Error Loading Reports</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function loadClassResults(db, classId) {
    console.log('📥 Loading quiz results for class:', classId);
    
    // Get all quizzes for this class
    const quizzesRef = collection(db, 'quizzes');
    const qQuizzes = query(quizzesRef, where('classId', '==', classId));
    const quizzesSnapshot = await getDocs(qQuizzes);
    
    if (quizzesSnapshot.empty) {
        console.log('⚠️ No quizzes found for this class');
        return [];
    }
    
    const quizIds = quizzesSnapshot.docs.map(doc => doc.id);
    console.log('📝 Found quizzes:', quizIds);
    
    // Get all results for these quizzes
    const resultsRef = collection(db, 'quizResults');
    const allResults = [];
    
    for (const quizId of quizIds) {
        const qResults = query(resultsRef, where('quizId', '==', quizId));
        const resultsSnapshot = await getDocs(qResults);
        
        resultsSnapshot.docs.forEach(doc => {
            allResults.push({ id: doc.id, ...doc.data() });
        });
    }
    
    console.log('✅ Loaded results:', allResults.length);
    return allResults;
}

function analyzeClassData(results) {
    console.log('🤖 Analyzing class data...');
    
    const uniqueStudents = new Set(results.map(r => r.userId)).size;
    const totalAttempts = results.length;
    
    const percentages = results.map(r => r.percentage);
    const classAvg = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);
    
    // Find common wrong answers
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
                            correctAnswer: detail.correctAnswer
                        };
                    }
                    wrongQuestions[key].count++;
                }
            });
        }
    });
    
    const topMistakes = Object.values(wrongQuestions)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    // Student performance breakdown
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
    
    return {
        uniqueStudents,
        totalAttempts,
        classAvg,
        highest,
        lowest,
        topMistakes,
        studentList,
        totalAttempts
    };
}

function showNoResultsState(container) {
    container.innerHTML = `
        <div class="no-results-state">
            <i class='bx bxs-inbox'></i>
            <h2>No Student Results Yet</h2>
            <p>Students need to take your quizzes first!</p>
            <button class="ai-btn-primary" onclick="window.showSection('quizzes')" style="margin-top: 20px;">
                View Quizzes
            </button>
        </div>
    `;
}

function displayReport(container, analysis) {
    const { uniqueStudents, totalAttempts, classAvg, highest, lowest, topMistakes, studentList } = analysis;
    
    // Generate AI message
    let aiMessage = '';
    if (classAvg >= 75) {
        aiMessage = `Great teaching! Your class is averaging ${classAvg}%. ${uniqueStudents} students have participated so far. Keep up the excellent work! 🌟`;
    } else if (classAvg >= 60) {
        aiMessage = `Your class is averaging ${classAvg}%. I've identified ${topMistakes.length} topics where students struggle. Let's focus on those areas! 💪`;
    } else {
        aiMessage = `Class average is ${classAvg}%. ${topMistakes.length} key topics need reinforcement. I have recommendations to help improve student understanding. 📚`;
    }
    
    // Generate teaching recommendations
    const recommendations = generateTeachingRecs(classAvg, topMistakes.length, uniqueStudents);
    
    container.innerHTML = `
        <div class="reports-container">
            <!-- AI Assistant Card -->
            <div class="ai-assistant-card">
                <div class="ai-profile">
                    <div class="ai-avatar">
                        <i class='bx bxs-bot'></i>
                    </div>
                    <div class="ai-info">
                        <h2>Teaching Assistant</h2>
                        <p>AI-Powered Class Analysis</p>
                    </div>
                </div>
                <div class="ai-prompt">
                    <p>${aiMessage}</p>
                    <button class="ai-btn-primary" onclick="document.getElementById('aiFeedback').style.display='grid'; window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});">
                        Show Detailed Analysis
                    </button>
                </div>
            </div>

            <!-- Detailed Feedback (Hidden Initially) -->
            <div id="aiFeedback" class="feedback-grid" style="display: none;">
                <!-- Class Overview -->
                <div class="analysis-card">
                    <h3><i class='bx bxs-bar-chart-alt-2'></i> Class Overview</h3>
                    <div class="mistake-item">
                        <p><strong>Total Students:</strong> ${uniqueStudents}</p>
                        <p><strong>Total Quiz Attempts:</strong> ${totalAttempts}</p>
                        <p><strong>Class Average:</strong> ${classAvg}%</p>
                        <p><strong>Highest Score:</strong> <span style="color: #00ff88;">${highest}%</span></p>
                        <p><strong>Lowest Score:</strong> <span style="color: #ff4b2b;">${lowest}%</span></p>
                    </div>
                </div>

                <!-- Student Knowledge Gaps -->
                <div class="analysis-card">
                    <h3><i class='bx bxs-error-circle' style="color: #ff4b2b;"></i> Student Knowledge Gaps</h3>
                    ${topMistakes.length === 0 ? 
                        '<div class="mistake-item"><p style="color: #00ff88;">🎉 No common mistakes! Students are doing great!</p></div>' :
                        topMistakes.map(mistake => `
                            <div class="mistake-item">
                                <p><strong>Topic:</strong> ${mistake.question.substring(0, 60)}${mistake.question.length > 60 ? '...' : ''}</p>
                                <p style="font-size: 13px; opacity: 0.8; margin-top: 10px;">
                                    <strong style="color: #ff4b2b;">AI Tip:</strong> ${Math.round((mistake.count / totalAttempts) * 100)}% of students struggled with this. Consider re-explaining this concept.
                                </p>
                                <p style="font-size: 12px; color: #00ff88; margin-top: 5px;">
                                    Correct answer: ${mistake.correctAnswer}
                                </p>
                            </div>
                        `).join('')
                    }
                </div>

                <!-- Teaching Recommendations -->
                <div class="review-card full-width">
                    <h3><i class='bx bxs-bulb' style="color: gold;"></i> AI Teaching Recommendations</h3>
                    <ul class="study-list">
                        ${recommendations.map(rec => `<li><i class='bx bx-check-double'></i> ${rec}</li>`).join('')}
                    </ul>
                </div>

                <!-- Student Performance List -->
                <div class="review-card full-width">
                    <h3><i class='bx bxs-user-detail'></i> Student Performance</h3>
                    ${studentList.map((student, index) => `
                        <div class="mistake-item" style="display: flex; justify-content: space-between; align-items: center; margin-top: ${index > 0 ? '15px' : '0'};">
                            <div>
                                <strong>${index + 1}. ${student.name}</strong>
                                <p style="font-size: 13px; opacity: 0.8; margin-top: 5px;">
                                    ${student.attempts} quiz(es) taken
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-size: 24px; font-weight: 700; color: ${student.avg >= 70 ? '#00ff88' : '#ff4b2b'};">
                                    ${student.avg}%
                                </p>
                                <p style="font-size: 12px;">${student.totalScore}/${student.totalQuestions}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function generateTeachingRecs(classAvg, mistakeCount, studentCount) {
    const recs = [];
    
    if (classAvg < 70) {
        recs.push('Consider reviewing fundamental concepts with the class');
        recs.push('Break down complex topics into smaller, digestible parts');
    }
    
    if (mistakeCount > 0) {
        recs.push(`Focus on the ${mistakeCount} topics where most students struggled`);
        recs.push('Provide additional examples and practice problems for difficult topics');
    }
    
    if (studentCount < 5) {
        recs.push('Encourage more students to participate in quizzes');
    }
    
    if (classAvg >= 80) {
        recs.push('Excellent! Consider introducing more challenging material');
        recs.push('Identify top performers who could mentor struggling students');
    }
    
    recs.push('Use quiz analytics to identify students who need extra help');
    recs.push('Schedule review sessions for topics with high error rates');
    recs.push('Provide positive reinforcement to students showing improvement');
    
    return recs;
}