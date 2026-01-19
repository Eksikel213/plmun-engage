import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { startClassMonitor, stopClassMonitor } from './class-monitor.js';

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

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    
    // ✅ Add this line
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('coin-count').textContent = userData.coins || 500;
        document.getElementById('level').textContent = userData.level || 1;
    }
    
    const currentClassId = sessionStorage.getItem('currentClassId');
    
    if (!currentClassId) {
        alert('No class selected');
        window.location.href = 'student-classes.html';
        return;
    }
    
    await loadClassData();
    await loadRecentActivity(); // ✅ ADD THIS - it was missing!
    
    startClassMonitor(db, currentClassId, user.uid);
});

// ✅ NEW: Stop monitoring when leaving page
window.addEventListener('beforeunload', () => {
    stopClassMonitor();
});

// Load class information
// Load class information
async function loadClassData() {
    try {
        const classId = sessionStorage.getItem('currentClassId');
        
        if (!classId) {
            alert('❌ No class selected');
            window.location.href = 'student-classes.html';
            return;
        }
        
        console.log('📚 Loading class:', classId);
        
        const classDoc = await getDoc(doc(db, 'classes', classId));
        
        if (!classDoc.exists()) {
            alert('❌ Class not found');
            window.location.href = 'student-classes.html';
            return;
        }
        
        currentClassData = { id: classDoc.id, ...classDoc.data() };
        
        // Update class info in card
        document.getElementById('classTitle').textContent = currentClassData.name;
        document.getElementById('classDetails').textContent = `${currentClassData.subjectCode} • Section ${currentClassData.section}`;
        document.getElementById('displayClassCode').textContent = currentClassData.classCode;
        
        // ✅ Load professor info with profile picture
        await loadProfessorInfo(currentClassData.professorId, currentClassData.professorName);
        
        console.log('✅ Class loaded:', currentClassData.name);
        
    } catch (error) {
        console.error('❌ Error loading class:', error);
        alert('Failed to load class data');
    }
}

// ✅ NEW: Load professor's profile picture and name
async function loadProfessorInfo(professorId, fallbackName) {
    try {
        console.log('👨‍🏫 Loading professor info for:', professorId);
        
        if (!professorId) {
            console.warn('⚠️ No professor ID provided');
            document.getElementById('professorName').textContent = fallbackName || 'Prof. Unknown';
            return;
        }
        
        // Get professor's user document
        const profDoc = await getDoc(doc(db, 'users', professorId));
        
        if (profDoc.exists()) {
            const profData = profDoc.data();
            const profName = profData.fullName || fallbackName || 'Professor';
            const profAvatar = profData.customAvatarURL;
            
            console.log('✅ Professor data loaded:', profName);
            console.log('🖼️ Avatar URL:', profAvatar);
            
            // Update professor name
            document.getElementById('professorName').textContent = `Prof. ${profName}`;
            
            // Update professor avatar
            const avatarContainer = document.getElementById('professorAvatar');
            
            if (profAvatar && profAvatar.trim().length > 0) {
                // Professor has uploaded a custom avatar
                console.log('✅ Using custom professor avatar');
                
                const img = document.createElement('img');
                img.src = profAvatar;
                img.alt = profName;
                img.crossOrigin = 'anonymous';
                
                img.onload = function() {
                    console.log('✅ Professor avatar loaded successfully');
                    avatarContainer.innerHTML = '';
                    avatarContainer.appendChild(img);
                };
                
                img.onerror = function() {
                    console.warn('⚠️ Failed to load professor avatar, using default icon');
                    avatarContainer.innerHTML = '<i class="bx bx-user-circle"></i>';
                };
            } else {
                // No custom avatar, use default icon
                console.log('ℹ️ No custom avatar, using default icon');
                avatarContainer.innerHTML = '<i class="bx bx-user-circle"></i>';
            }
        } else {
            console.warn('⚠️ Professor document not found');
            document.getElementById('professorName').textContent = fallbackName || 'Prof. Unknown';
        }
        
    } catch (error) {
        console.error('❌ Error loading professor info:', error);
        document.getElementById('professorName').textContent = fallbackName || 'Prof. Unknown';
    }
}

// Load recent quiz activity for THIS SPECIFIC CLASS ONLY
async function loadRecentActivity() {
    try {
        console.log('📊 Loading recent activity for class:', currentClassData.id);
        
        const quizzesRef = collection(db, 'quizzes');
        const quizzesQuery = query(quizzesRef, where('classId', '==', currentClassData.id));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        if (quizzesSnapshot.empty) {
            console.log('ℹ️ No quizzes posted in this class yet');
            document.getElementById('activityList').innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <i class='bx bxs-inbox' style="font-size: 60px; color: #00d4ff; margin-bottom: 15px;"></i>
                    <p>No quizzes posted in this class yet</p>
                </div>
            `;
            return;
        }
        
        const quizIds = quizzesSnapshot.docs.map(doc => doc.id);
        console.log('🔍 Found', quizIds.length, 'quizzes in this class');
        
        const resultsRef = collection(db, 'quizResults');
        const resultsQuery = query(
            resultsRef,
            where('userId', '==', currentUser.uid)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        const classResults = resultsSnapshot.docs
            .map(doc => doc.data())
            .filter(result => quizIds.includes(result.quizId))
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, 5);
        
        console.log('✅ Found', classResults.length, 'quiz results for this class');
        
        if (classResults.length === 0) {
            document.getElementById('activityList').innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <i class='bx bxs-inbox' style="font-size: 60px; color: #00d4ff; margin-bottom: 15px;"></i>
                    <p>No quiz activity yet in this class</p>
                    <p style="font-size: 14px; margin-top: 10px; opacity: 0.6;">Take a quiz to see your results here!</p>
                </div>
            `;
            return;
        }
        
        const activityHTML = classResults.map(result => {
            const scoreColor = result.percentage >= 70 ? '#00ff88' : '#ff4b2b';
            const date = new Date(result.completedAt).toLocaleDateString();
            const time = new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="activity-item">
                    <div class="activity-info">
                        <h4>${result.quizTitle}</h4>
                        <p>${date} • ${time}</p>
                    </div>
                    <div class="activity-score">
                        <div class="score" style="color: ${scoreColor};">
                            ${result.score}/${result.totalQuestions}
                        </div>
                        <div class="coins">+${result.coinsEarned} coins</div>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('activityList').innerHTML = activityHTML;
        
        console.log('✅ Activity loaded for this class');
        
    } catch (error) {
        console.error('❌ Error loading activity:', error);
        document.getElementById('activityList').innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff4b2b;">
                Failed to load activity: ${error.message}
            </div>
        `;
    }
}

// Show error modal
function showErrorModal(title, message, icon = '⛔') {
    document.getElementById('modalIcon').textContent = icon;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').innerHTML = message;
    document.getElementById('errorModal').classList.add('show');
}

// Close error modal
window.closeErrorModal = function() {
    document.getElementById('errorModal').classList.remove('show');
    document.getElementById('studentCodeInput').value = '';
};

// Join Quiz Function
window.joinQuiz = async function() {
    const code = document.getElementById('studentCodeInput').value.trim().toUpperCase();
    const errorMsg = document.getElementById('errorMsg');
    
    errorMsg.style.display = 'none';
    
    if (!code) {
        errorMsg.textContent = 'Please enter a quiz code!';
        errorMsg.style.display = 'block';
        return;
    }
    
    try {
        const quizzesRef = collection(db, 'quizzes');
        const q = query(quizzesRef, where('code', '==', code));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showErrorModal(
                'Invalid Quiz Code',
                `The code <strong>${code}</strong> does not match any active quiz.`,
                '❌'
            );
            return;
        }
        
        const quizDoc = querySnapshot.docs[0];
        const quizData = quizDoc.data();
        const quizId = quizDoc.id;
        
        if (!quizData.isActive) {
            showErrorModal(
                'Session Expired',
                `<strong>${quizData.title}</strong><br><br>This quiz session has been ended by the professor.`,
                '🔒'
            );
            return;
        }
        
        if (quizData.timer && quizData.timer.enabled) {
            const createdAt = new Date(quizData.createdAt).getTime();
            const now = Date.now();
            const timeLimit = quizData.timer.minutes * 60 * 1000;
            const timeElapsed = now - createdAt;
            
            if (timeElapsed > timeLimit) {
                const endedTime = new Date(createdAt + timeLimit).toLocaleString();
                showErrorModal(
                    'Quiz Time Expired',
                    `<strong>${quizData.title}</strong><br><br>This quiz had a ${quizData.timer.minutes}-minute time limit and expired at:<br><strong>${endedTime}</strong>`,
                    '⏰'
                );
                return;
            }
        }
        
        const resultsRef = collection(db, 'quizResults');
        const resultsQuery = query(
            resultsRef, 
            where('quizId', '==', quizId),
            where('userId', '==', currentUser.uid)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        if (!resultsSnapshot.empty) {
            const existingResult = resultsSnapshot.docs[0].data();
            const completedDate = new Date(existingResult.completedAt).toLocaleString();
            
            showErrorModal(
                'Already Completed',
                `<strong>${quizData.title}</strong><br><br>You already took this quiz on:<br><strong>${completedDate}</strong><br><br>Score: <strong style="color: #00d4ff;">${existingResult.score}/${existingResult.totalQuestions} (${existingResult.percentage}%)</strong><br><br>You cannot retake this quiz.`,
                '✅'
            );
            return;
        }
        
        console.log('✅ All checks passed - Student can take quiz');
        
        sessionStorage.setItem('currentQuiz', JSON.stringify({
            id: quizId,
            ...quizData
        }));
        
        window.location.href = '../Join/game.html';
        
    } catch (error) {
        console.error('❌ Error joining quiz:', error);
        showErrorModal(
            'Connection Error',
            'Failed to connect to the server. Please check your internet connection.',
            '⚠️'
        );
    }
};

// ✅ Leave Class Confirmation (FIXED - Now outside other functions)
// ✅ FIXED: Leave Class Confirmation with proper modal
window.confirmLeaveClass = function() {
    if (!currentClassData) {
        alert('⚠️ No class data found');
        return;
    }
    
    // Remove any existing modals first
    const existingModal = document.querySelector('.modal.show');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'leaveClassModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeLeaveModal()"></div>
        <div class="modal-content" style="border-color: #ff4b2b; background: linear-gradient(135deg, rgba(8, 27, 41, 0.98), rgba(255, 75, 43, 0.1));">
            <div class="modal-icon" style="color: #ff4b2b;">⚠️</div>
            <h2 style="color: #ff4b2b; font-size: 28px; margin-bottom: 15px;">Leave Class?</h2>
            <p style="margin-bottom: 15px; color: white;">
                You are about to leave:<br>
                <strong style="color: #00d4ff; font-size: 20px;">${currentClassData.name}</strong><br>
                <span style="font-size: 14px; opacity: 0.8;">${currentClassData.subjectCode} • Section ${currentClassData.section}</span>
            </p>
            <p style="font-size: 14px; opacity: 0.9; margin-bottom: 25px; color: white; background: rgba(255,75,43,0.2); padding: 15px; border-radius: 10px; border-left: 4px solid #ff4b2b;">
                ⚠️ <strong>Warning:</strong> Your quiz history and activity in this class will be permanently deleted. 
                This will NOT affect your data in other classes.
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="closeLeaveModal()" 
                        style="background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); color: #fff; padding: 12px 30px; border-radius: 10px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600;">
                    <i class='bx bx-x'></i> Cancel
                </button>
                <button onclick="confirmLeaveNow()" 
                        style="background: #ff4b2b; border: none; color: white; padding: 12px 30px; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: 'Poppins', sans-serif;">
                    <i class='bx bx-exit'></i> Yes, Leave Class
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    console.log('✅ Leave class modal shown');
};

// ✅ Close leave modal
window.closeLeaveModal = function() {
    const modal = document.getElementById('leaveClassModal');
    if (modal) {
        modal.remove();
    }
};

// ✅ Second confirmation before actual deletion
window.confirmLeaveNow = function() {
    const modal = document.getElementById('leaveClassModal');
    if (modal) {
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="border-color: #ff4b2b;">
                <div class="modal-icon" style="color: #ff4b2b;">❓</div>
                <h2 style="color: #ff4b2b;">Are You Sure?</h2>
                <p style="color: white; margin-bottom: 25px;">
                    This action <strong>cannot be undone</strong>.<br>
                    All your progress in <strong>${currentClassData.name}</strong> will be lost forever.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="closeLeaveModal()" 
                            style="background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); color: #fff; padding: 12px 30px; border-radius: 10px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600;">
                        No, Go Back
                    </button>
                    <button onclick="leaveClass()" 
                            style="background: #ff4b2b; border: none; color: white; padding: 12px 30px; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: 'Poppins', sans-serif;">
                        Yes, I'm Sure
                    </button>
                </div>
            </div>
        `;
    }
};

// ✅ Leave Class Function (FIXED - Properly deletes only this class's data)
// ✅ Leave Class Function - FIXED for your database structure
window.leaveClass = async function() {
    try {
        console.log('🚪 Starting leave class process...');
        
        const classId = currentClassData.id;
        const modal = document.getElementById('leaveClassModal');
        
        // Show loading
        if (modal) {
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content" style="border-color: #00d4ff;">
                    <div style="width: 60px; height: 60px; border: 6px solid rgba(0,212,255,0.3); border-top-color: #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="color: white; font-size: 18px;">Leaving class...</p>
                    <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 10px;">Removing your data from this class...</p>
                </div>
            `;
        }
        
        // ✅ Step 1: Remove student from class roster (based on your DB structure)
        const classRef = doc(db, 'classes', classId);
        const classDoc = await getDoc(classRef);
        
        if (classDoc.exists()) {
            const currentStudents = classDoc.data().students || [];
            console.log('📋 Current students:', currentStudents);
            console.log('🆔 Removing user:', currentUser.uid);
            
            // Filter out current user (it's an array of UIDs)
            const updatedStudents = currentStudents.filter(uid => uid !== currentUser.uid);
            
            await updateDoc(classRef, {
                students: updatedStudents
            });
            
            console.log('✅ Removed from class roster');
            console.log('📋 New student count:', updatedStudents.length);
        }
        
        // ✅ Step 2: Delete quiz results from THIS class only
        const quizzesRef = collection(db, 'quizzes');
        const quizzesQuery = query(quizzesRef, where('classId', '==', classId));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        const quizIds = quizzesSnapshot.docs.map(doc => doc.id);
        console.log('📝 Found', quizIds.length, 'quizzes in this class');
        
        if (quizIds.length > 0) {
            const resultsRef = collection(db, 'quizResults');
            const resultsQuery = query(
                resultsRef,
                where('userId', '==', currentUser.uid)
            );
            const resultsSnapshot = await getDocs(resultsQuery);
            
            // Delete ONLY results from THIS class
            const deletePromises = resultsSnapshot.docs
                .filter(resultDoc => quizIds.includes(resultDoc.data().quizId))
                .map(resultDoc => {
                    console.log('🗑️ Deleting result:', resultDoc.id);
                    return deleteDoc(resultDoc.ref);
                });
            
            await Promise.all(deletePromises);
            
            console.log('✅ Deleted', deletePromises.length, 'quiz results from this class');
        }
        
        // ✅ Success!
        if (modal) modal.remove();
        
        // Show success message
        const successModal = document.createElement('div');
        successModal.className = 'modal show';
        successModal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content" style="border-color: #00ff88;">
                <div class="modal-icon" style="color: #00ff88;">✅</div>
                <h2 style="color: #00ff88;">Successfully Left Class!</h2>
                <p style="color: white;">You have been removed from <strong>${currentClassData.name}</strong>.</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 10px;">Your data in other classes remains intact.</p>
                <button onclick="window.location.href='student-classes.html'" 
                        style="background: #00ff88; border: none; color: #081b29; padding: 12px 30px; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: 'Poppins', sans-serif; margin-top: 20px;">
                    Back to Classes
                </button>
            </div>
        `;
        document.body.appendChild(successModal);
        
        setTimeout(() => {
            window.location.href = 'student-classes.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error leaving class:', error);
        
        const modal = document.getElementById('leaveClassModal');
        if (modal) modal.remove();
        
        alert('❌ Failed to leave class: ' + error.message + '\n\nPlease try again or contact support.');
    }
};

// Logout
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = '../../../index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};