import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlUY50heKZ_bp-PZUr76S0SiI1_zN6aOA",
    authDomain: "plmun-engage.firebaseapp.com",
    projectId: "plmun-engage",
    storageBucket: "plmun-engage.firebasestorage.app",
    messagingSenderId: "701791153164",
    appId: "1:701791153164:web:45422fd17af3493a04d229"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let quizId = null;
let quizData = null;
let resultsData = [];

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    
    // Get quiz ID from sessionStorage
    quizId = sessionStorage.getItem('viewQuizId');
    
    if (!quizId) {
        alert('❌ No quiz selected');
        window.location.href = 'class-detail.html';
        return;
    }
    
    await loadQuizResults();
});

// Load quiz results
async function loadQuizResults() {
    try {
        console.log('📊 Loading results for quiz:', quizId);
        
        // Get quiz data
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        
        if (!quizDoc.exists()) {
            console.error('❌ Quiz not found in database');
            alert('❌ Quiz not found');
            window.location.href = 'class-detail.html';
            return;
        }
        
        quizData = { id: quizDoc.id, ...quizDoc.data() };
        console.log('✅ Quiz data loaded:', quizData.title);
        console.log('📋 Quiz code:', quizData.code);
        console.log('❓ Total questions:', quizData.questions?.length || 0);
        
        // Get all results for this quiz
        const resultsRef = collection(db, 'quizResults');
        const q = query(resultsRef, where('quizId', '==', quizId));
        const resultsSnapshot = await getDocs(q);
        
        console.log('🔍 Checking quiz results...');
        console.log('📦 Results found:', resultsSnapshot.size);
        
        // Hide loading
        document.getElementById('loadingState').style.display = 'none';
        
        if (resultsSnapshot.empty) {
            console.log('⚠️ No students have taken this quiz yet');
            
            // Still show quiz name even when no results
            document.getElementById('navQuizTitle').innerHTML = `<i class='bx bxs-bar-chart-alt-2'></i> ${quizData.title}`;
            
            document.getElementById('noResultsState').style.display = 'block';
            return;
        }
        
        // Process results
        resultsData = resultsSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log('👤 Student result:', data.userName, '-', data.percentage + '%');
            return {
                id: doc.id,
                ...data
            };
        }).sort((a, b) => b.percentage - a.percentage); // Sort by score descending
        
        console.log('✅ Processed', resultsData.length, 'student results');
        console.log('🏆 Top score:', resultsData[0]?.percentage + '%');
        
        // Display everything
        displayQuizInfo();
        displayStatistics();
        displayResults();
        
        // Show content
        document.getElementById('resultsContent').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading quiz results:', error);
        console.error('Error details:', error.message);
        alert('Failed to load quiz results: ' + error.message);
        
        // Hide loading and show error state
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('noResultsState').style.display = 'flex';
    }
}

// Display quiz information
function displayQuizInfo() {
    const quizTitle = quizData.title;
    
    // Update navbar title
    document.getElementById('navQuizTitle').innerHTML = `<i class='bx bxs-bar-chart-alt-2'></i> ${quizTitle}`;
    
    // Update quiz header card
    document.getElementById('quizTitle').textContent = quizTitle;
    document.getElementById('quizCode').textContent = quizData.code;
    document.getElementById('questionCount').textContent = quizData.questions.length;
    
    const createdDate = new Date(quizData.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('createdDate').textContent = createdDate;
}

// ✅ UPDATED: Display only 3 statistics (removed highest and lowest)
function displayStatistics() {
    const totalStudents = resultsData.length;
    const avgScore = Math.round(resultsData.reduce((sum, r) => sum + r.percentage, 0) / totalStudents);
    const passRate = Math.round((resultsData.filter(r => r.percentage >= 60).length / totalStudents) * 100);
    
    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('avgScore').textContent = avgScore + '%';
    document.getElementById('passRate').textContent = passRate + '%';
}

// Display results table
function displayResults() {
    const tableBody = document.getElementById('resultsTableBody');
    
    tableBody.innerHTML = resultsData.map((result, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        const scoreColor = result.percentage >= 75 ? '#00ff88' : result.percentage >= 60 ? '#ffd700' : '#ff4b2b';
        
        const date = new Date(result.completedAt).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const time = new Date(result.completedAt).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `
            <div class="results-table-row">
                <div class="col-rank ${rankClass}">${index + 1}</div>
                <div class="col-name">${result.userName}</div>
                <div class="col-score">${result.score}/${result.totalQuestions}</div>
                <div class="col-percentage" style="color: ${scoreColor};">
                    ${result.percentage}%
                </div>
                <div class="col-coins" style="color: gold;">
                    ${result.coinsEarned || 0}
                </div>
                <div class="col-date">
                    ${date}<br>
                    <span style="opacity: 0.6;">${time}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ✅ UPDATED: Download CSV with Student Number
window.downloadQuizCSV = async function() {
    try {
        console.log('📥 Generating CSV...');
        
        // Create CSV content with Student Number column
        let csvContent = "Rank,Student Name,Student Number,Score,Total Questions,Percentage,Coins Earned,Completed At\n";
        
        // Fetch student numbers for each result
        for (let index = 0; index < resultsData.length; index++) {
            const result = resultsData[index];
            const rank = index + 1;
            
            // Get student number from user profile
            let studentNumber = 'N/A';
            try {
                const userDoc = await getDoc(doc(db, 'users', result.userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    studentNumber = userData.studentId || 'N/A';
                }
            } catch (error) {
                console.error('Error fetching student number for:', result.userName, error);
            }
            
            const completedDate = new Date(result.completedAt).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            // Escape commas in names
            const studentName = `"${result.userName}"`;
            
            csvContent += `${rank},${studentName},${studentNumber},${result.score},${result.totalQuestions},${result.percentage}%,${result.coinsEarned || 0},"${completedDate}"\n`;
        }
        
        // Create downloadable file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const fileName = `${quizData.title.replace(/[^a-z0-9]/gi, '_')}_Results_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ CSV downloaded with student numbers:', fileName);
        
    } catch (error) {
        console.error('❌ CSV download error:', error);
        alert('Failed to download CSV: ' + error.message);
    }
};

// Go back to class details
window.goBack = function() {
    sessionStorage.removeItem('viewQuizId');
    sessionStorage.setItem('openTab', 'quizzes'); // Open quizzes tab when returning
    window.location.href = 'class-detail.html';
};