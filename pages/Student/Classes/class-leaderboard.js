import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let currentClassData = null;
let isPrivacyHidden = false;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('coin-count').textContent = userData.coins || 500;
        document.getElementById('level').textContent = userData.level || 1;
        
        isPrivacyHidden = userData.leaderboardHidden || false;
        updatePrivacyToggle(isPrivacyHidden);
    }
    
    const currentClassId = sessionStorage.getItem('currentClassId');
    
    if (!currentClassId) {
        alert('No class selected');
        window.location.href = 'student-classes.html';
        return;
    }
    
    // ✅ DEBUG: Log the current class ID
    console.log('📚 Current Class ID:', currentClassId);
    
    await loadClassData();
    await loadLeaderboard();
});

async function loadClassData() {
    try {
        const classId = sessionStorage.getItem('currentClassId');
        
        if (!classId) {
            alert('❌ No class selected');
            window.location.href = 'student-classes.html';
            return;
        }
        
        const classDoc = await getDoc(doc(db, 'classes', classId));
        
        if (!classDoc.exists()) {
            alert('❌ Class not found');
            window.location.href = 'student-classes.html';
            return;
        }
        
        currentClassData = { id: classDoc.id, ...classDoc.data() };
        
        document.getElementById('className').textContent = currentClassData.name + ' - Leaderboard';
        document.getElementById('classInfo').textContent = `${currentClassData.name} • Based on total correct answers`;
        
    } catch (error) {
        console.error('Error loading class:', error);
    }
}

async function loadLeaderboard() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        
        // ✅ DEBUG: Log what we're searching for
        console.log('🔍 Searching for quizzes in class:', currentClassData.id);
        
        // Get all quizzes from this class
        const quizzesRef = collection(db, 'quizzes');
        const quizzesQuery = query(quizzesRef, where('classId', '==', currentClassData.id));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        // ✅ DEBUG: Log found quizzes
        console.log('📝 Found quizzes:', quizzesSnapshot.size);
        
        if (quizzesSnapshot.empty) {
            console.log('⚠️ No quizzes found for this class');
            showEmptyState();
            return;
        }
        
        const quizIds = quizzesSnapshot.docs.map(doc => {
            console.log('   Quiz ID:', doc.id, '| Title:', doc.data().title);
            return doc.id;
        });
        
        // Get all quiz results for this class
        const resultsRef = collection(db, 'quizResults');
        const allResults = [];
        
        for (const quizId of quizIds) {
            const resultsQuery = query(resultsRef, where('quizId', '==', quizId));
            const resultsSnapshot = await getDocs(resultsQuery);
            
            // ✅ DEBUG: Log results for each quiz
            console.log(`   📊 Results for quiz ${quizId}:`, resultsSnapshot.size, 'results');
            
            resultsSnapshot.docs.forEach(doc => {
                const result = doc.data();
                console.log('      Student:', result.userName, '| Score:', result.score, '/', result.totalQuestions);
                allResults.push(result);
            });
        }
        
        // ✅ DEBUG: Log total results
        console.log('✅ Total quiz results found:', allResults.length);
        
        if (allResults.length === 0) {
            console.log('⚠️ No quiz results found');
            showEmptyState();
            return;
        }
        
        // Calculate rankings
        const studentStats = {};
        
        allResults.forEach(result => {
            if (!studentStats[result.userId]) {
                studentStats[result.userId] = {
                    userId: result.userId,
                    userName: result.userName,
                    totalCorrect: 0,
                    totalQuestions: 0,
                    coins: 0,
                    level: 1
                };
            }
            
            studentStats[result.userId].totalCorrect += result.score;
            studentStats[result.userId].totalQuestions += result.totalQuestions;
        });
        
        // ✅ DEBUG: Log student stats
        console.log('👥 Student stats:', Object.keys(studentStats).length, 'students');
        Object.values(studentStats).forEach(student => {
            console.log('   Student:', student.userName, '| Correct:', student.totalCorrect);
        });
        
        // Get user data including privacy settings
        for (const userId in studentStats) {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                studentStats[userId].coins = userData.coins || 0;
                studentStats[userId].level = userData.level || 1;
                studentStats[userId].avatar = userData.equippedAvatar || 'scholar';
                studentStats[userId].customAvatarURL = userData.customAvatarURL || null;
                studentStats[userId].isHidden = userData.leaderboardHidden || false;
                
                // ✅ DEBUG: Log privacy status
                console.log('   Privacy for', userData.fullName, ':', studentStats[userId].isHidden ? 'HIDDEN' : 'VISIBLE');
            }
        }
        
        // Sort by total correct answers (descending)
        const allRankings = Object.values(studentStats).sort((a, b) => b.totalCorrect - a.totalCorrect);
        
        // ✅ DEBUG: Log all rankings before filtering
        console.log('📊 All rankings (before privacy filter):', allRankings.length);
        allRankings.forEach((student, index) => {
            console.log(`   #${index + 1}:`, student.userName, '| Hidden:', student.isHidden);
        });
        
        // Filter hidden users (except current user)
        const visibleRankings = allRankings.filter(student => {
            const isVisible = student.userId === currentUser.uid || !student.isHidden;
            if (!isVisible) {
                console.log('   🚫 Hiding student from view:', student.userName);
            }
            return isVisible;
        });
        
        // ✅ DEBUG: Log visible rankings
        console.log('👁️ Visible rankings (after privacy filter):', visibleRankings.length);
        
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('studentCount').textContent = visibleRankings.length;
        
        displayLeaderboard(visibleRankings);
        
    } catch (error) {
        console.error('❌ Error loading leaderboard:', error);
        document.getElementById('loadingState').style.display = 'none';
    }
}

function displayLeaderboard(rankings) {
    if (rankings.length === 0) {
        showEmptyState();
        return;
    }
    
    // Display top 3 podium
    if (rankings.length >= 3) {
        displayPodium(rankings.slice(0, 3));
    }
    
    // Display full list
    displayRankingsList(rankings);
}

function displayPodium(top3) {
    const podium = document.getElementById('podium');
    podium.style.display = 'flex';
    
    const avatarIcons = {
        'scholar': { icon: 'bxs-face', color: '#ffcc00' },
        'dean': { icon: 'bxs-graduation', color: '#ff7675' },
        'night-owl': { icon: 'bxs-ghost', color: '#a29bfe' },
        'tech-whiz': { icon: 'bxs-cool', color: '#00d4ff' }
    };
    
    const medals = ['🥇', '🥈', '🥉'];
    
    podium.innerHTML = top3.map((student, index) => {
        const avatar = avatarIcons[student.avatar] || avatarIcons['scholar'];
        const percentage = Math.round((student.totalCorrect / student.totalQuestions) * 100);
        const isCurrentUser = student.userId === currentUser.uid;
        const isHiddenUser = student.isHidden && isCurrentUser;
        
        let avatarHTML = '';
        if (student.customAvatarURL) {
            avatarHTML = `<img src="${student.customAvatarURL}" alt="${student.userName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatarHTML = `<i class='bx ${avatar.icon}'></i>`;
        }
        
        const displayName = isHiddenUser 
            ? '<i class="bx bx-lock-alt"></i> Hidden' 
            : student.userName;
        
        return `
            <div class="podium-place podium-${index + 1}">
                <div class="podium-rank">${medals[index]}</div>
                <div class="podium-avatar" style="color: ${avatar.color}; position: relative;">
                    ${avatarHTML}
                    ${isHiddenUser ? '<div style="position: absolute; top: -5px; right: -5px; background: #f59e0b; border-radius: 50%; padding: 4px;"><i class="bx bx-hide" style="font-size: 14px; color: white;"></i></div>' : ''}
                </div>
                <div class="podium-name">${displayName}</div>
                <div class="podium-stats">
                    <div style="color: #00ff88; font-weight: 700; font-size: 24px;">
                        ${student.totalCorrect} correct
                    </div>
                    <div style="opacity: 0.8; font-size: 12px;">
                        ${percentage}% accuracy
                    </div>
                    <div style="margin-top: 8px;">
                        <i class='bx bxs-coin-stack' style="color: gold;"></i> ${student.coins}
                    </div>
                    <div>
                        <i class='bx bxs-star' style="color: cyan;"></i> LVL ${student.level}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayRankingsList(rankings) {
    const list = document.getElementById('leaderboardList');
    
    const avatarIcons = {
        'scholar': { icon: 'bxs-face', color: '#ffcc00' },
        'dean': { icon: 'bxs-graduation', color: '#ff7675' },
        'night-owl': { icon: 'bxs-ghost', color: '#a29bfe' },
        'tech-whiz': { icon: 'bxs-cool', color: '#00d4ff' }
    };
    
    list.innerHTML = rankings.map((student, index) => {
        const rank = index + 1;
        const avatar = avatarIcons[student.avatar] || avatarIcons['scholar'];
        const percentage = Math.round((student.totalCorrect / student.totalQuestions) * 100);
        const isCurrentUser = student.userId === currentUser.uid;
        const isHiddenUser = student.isHidden && isCurrentUser;
        
        let avatarHTML = '';
        if (student.customAvatarURL) {
            avatarHTML = `<img src="${student.customAvatarURL}" alt="${student.userName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatarHTML = `<i class='bx ${avatar.icon}'></i>`;
        }
        
        const displayName = isHiddenUser 
            ? '<i class="bx bx-lock-alt"></i> Hidden' 
            : student.userName;
        
        const userBadge = isCurrentUser && !isHiddenUser 
            ? '<span style="color: #00d4ff;">(You)</span>' 
            : '';
        
        const hiddenBadge = isHiddenUser 
            ? '<span style="background: #f59e0b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;"><i class="bx bx-hide"></i> Private</span>'
            : '';
        
        return `
            <div class="rank-item ${isCurrentUser ? 'current-user' : ''}">
                <div class="rank-number">#${rank}</div>
                <div class="rank-avatar" style="border-color: ${avatar.color}; position: relative;">
                    ${avatarHTML}
                    ${isHiddenUser ? '<div style="position: absolute; top: -3px; right: -3px; background: #f59e0b; border-radius: 50%; padding: 3px;"><i class="bx bx-hide" style="font-size: 12px; color: white;"></i></div>' : ''}
                </div>
                <div class="rank-info">
                    <div class="rank-name">
                        ${displayName} ${userBadge} ${hiddenBadge}
                    </div>
                    <div class="rank-details">
                        <span><i class='bx bxs-coin-stack' style="color: gold;"></i> ${student.coins}</span>
                        <span><i class='bx bxs-star' style="color: cyan;"></i> LVL ${student.level}</span>
                        <span>${percentage}% accuracy</span>
                    </div>
                    ${isHiddenUser ? `
                        <div style="margin-top: 8px; padding: 8px 12px; background: rgba(245, 158, 11, 0.2); border-left: 3px solid #f59e0b; border-radius: 6px;">
                            <p style="font-size: 12px; color: #fbbf24; display: flex; align-items: center; gap: 6px; margin: 0;">
                                <i class='bx bx-lock-alt'></i>
                                Only you can see this. Other students see ${rankings.length - 1} students.
                            </p>
                        </div>
                    ` : ''}
                </div>
                <div class="rank-score">
                    <div class="correct-answers">${student.totalCorrect}</div>
                    <div style="font-size: 12px; opacity: 0.7;">correct answers</div>
                </div>
            </div>
        `;
    }).join('');
}

function updatePrivacyToggle(isHidden) {
    const toggleSwitch = document.getElementById('privacyToggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const privacyStatus = document.getElementById('privacyStatus');
    const privacyMessage = document.getElementById('privacyMessage');
    const warningBanner = document.getElementById('privacyWarning');
    
    isPrivacyHidden = isHidden;
    
    if (isHidden) {
        toggleSwitch.classList.add('active');
        toggleIcon.className = 'bx bx-hide';
        privacyStatus.textContent = 'Hidden from Leaderboard';
        privacyMessage.textContent = 'Your rank is hidden from other students. You can still see your position.';
        warningBanner.style.display = 'block';
    } else {
        toggleSwitch.classList.remove('active');
        toggleIcon.className = 'bx bx-show';
        privacyStatus.textContent = 'Visible on Leaderboard';
        privacyMessage.textContent = 'Your rank is visible to everyone in this class.';
        warningBanner.style.display = 'none';
    }
}

window.toggleLeaderboardPrivacy = async function() {
    try {
        const newState = !isPrivacyHidden;
        
        console.log('🔄 Toggling privacy to:', newState ? 'HIDDEN' : 'VISIBLE');
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            leaderboardHidden: newState
        });
        
        console.log('✅ Privacy updated in Firebase');
        
        updatePrivacyToggle(newState);
        
        await loadLeaderboard();
        
        console.log('✅ Leaderboard reloaded');
        
    } catch (error) {
        console.error('❌ Error updating privacy:', error);
        alert('Failed to update privacy setting. Please try again.');
    }
};

function showEmptyState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('studentCount').textContent = '0';
}

window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = '../../../index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};