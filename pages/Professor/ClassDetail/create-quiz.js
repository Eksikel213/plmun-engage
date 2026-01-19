import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let currentClassId = null;
let currentClassName = null;
let quizTimerInterval = null;

// Check authentication and load class info
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    currentClassId = sessionStorage.getItem('currentClassId');
    
    if (!currentClassId) {
        showModal('error', 'No Class Selected', 'Please select a class first.', () => {
            window.location.href = '../professor.html';
        });
        return;
    }
    
    // Load class name
    try {
        const classDoc = await getDoc(doc(db, 'classes', currentClassId));
        if (classDoc.exists()) {
            currentClassName = classDoc.data().name;
            document.getElementById('currentClassName').textContent = currentClassName;
        }
    } catch (error) {
        console.error('Error loading class:', error);
    }
    
    // Auto-add first question when page loads
    const container = document.getElementById('questionsContainer');
    if (container.children.length === 0) {
        addQuestion();
    }
});

// ✅ NEW: Custom Modal System
function showModal(type, title, message, confirmCallback = null, showCancel = false) {
    const modal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    
    // Set icon based on type
    const icons = {
        success: 'bx-check-circle',
        error: 'bx-error-circle',
        warning: 'bx-error',
        info: 'bx-info-circle'
    };
    
    modalIcon.className = `modal-icon ${type}`;
    modalIcon.innerHTML = `<i class='bx ${icons[type] || icons.info}'></i>`;
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;
    
    // Show/hide cancel button
    if (showCancel) {
        cancelBtn.style.display = 'flex';
        confirmBtn.textContent = 'Confirm';
    } else {
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = 'OK';
    }
    
    // Set confirm callback
    confirmBtn.onclick = () => {
        closeModal();
        if (confirmCallback) confirmCallback();
    };
    
    modal.classList.add('show');
}

window.closeModal = function() {
    document.getElementById('customModal').classList.remove('show');
};

// Generate unique quiz code
function generateQuizCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PLM-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Timer UI toggle
window.updateTimerUI = function() {
    const timerOption = document.querySelector('input[name="timerOption"]:checked').value;
    const timerInputGroup = document.getElementById('timerInputGroup');
    
    if (timerOption === 'custom-timer') {
        timerInputGroup.style.display = 'block';
    } else {
        timerInputGroup.style.display = 'none';
    }
};

// Add question
window.addQuestion = function() {
    console.log('📝 Adding question');
    const container = document.getElementById('questionsContainer');
    const qNum = container.children.length + 1;
    
    const questionHtml = `
        <div class="question-item">
            <div class="q-header">
                <span class="q-label">Question ${qNum}</span>
                <i class='bx bx-trash' onclick="removeQuestion(this)"></i>
            </div>
            <input type="text" placeholder="Type your question here..." class="q-input question-text">
            <div class="options-grid">
                <input type="text" placeholder="✓ Correct Answer" class="opt-input correct" data-correct="true">
                <input type="text" placeholder="Option B" class="opt-input">
                <input type="text" placeholder="Option C" class="opt-input">
                <input type="text" placeholder="Option D" class="opt-input">
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', questionHtml);
};

// Remove question
window.removeQuestion = function(btn) {
    console.log('🗑️ Removing question');
    
    if (document.querySelectorAll('.question-item').length === 1) {
        showModal('warning', 'Cannot Delete', 'You must have at least one question!');
        return;
    }
    
    btn.closest('.question-item').remove();
    reIndexQuestions();
};

function reIndexQuestions() {
    const labels = document.querySelectorAll('.q-label');
    labels.forEach((label, index) => {
        label.innerText = "Question " + (index + 1);
    });
}

// Confirm quiz
window.confirmQuiz = async function() {
    const quizTitle = document.getElementById('quizTitleInput').value.trim();
    
    if (!quizTitle) {
        showModal('warning', 'Missing Quiz Name', 'Please enter a name for your quiz!');
        return;
    }
    
    // Get timer settings
    const timerOption = document.querySelector('input[name="timerOption"]:checked').value;
    let timerSettings = { enabled: false, minutes: 0 };
    
    if (timerOption === 'custom-timer') {
        const minutes = parseInt(document.getElementById('timerMinutes').value);
        if (minutes < 1 || minutes > 120) {
            showModal('warning', 'Invalid Time Limit', 'Please enter a valid time limit between 1 and 120 minutes.');
            return;
        }
        timerSettings = { enabled: true, minutes: minutes };
    }
    
    const questionItems = document.querySelectorAll('.question-item');
    if (questionItems.length === 0) {
        showModal('warning', 'No Questions', 'Please add at least one question!');
        return;
    }
    
    const questions = [];
    let isValid = true;
    
    questionItems.forEach((item, index) => {
        const questionText = item.querySelector('.question-text').value.trim();
        const options = item.querySelectorAll('.opt-input');
        
        if (!questionText) {
            showModal('warning', 'Incomplete Question', `Please fill in Question ${index + 1}`);
            isValid = false;
            return;
        }
        
        const optionsArray = [];
        let correctIndex = -1;
        
        options.forEach((opt, i) => {
            const optText = opt.value.trim();
            if (!optText) {
                showModal('warning', 'Missing Options', `Please fill all options for Question ${index + 1}`);
                isValid = false;
                return;
            }
            optionsArray.push(optText);
            if (opt.dataset.correct === 'true') {
                correctIndex = i;
            }
        });
        
        if (correctIndex === -1) {
            showModal('warning', 'No Correct Answer', `No correct answer marked for Question ${index + 1}`);
            isValid = false;
            return;
        }
        
        questions.push({
            question: questionText,
            choices: optionsArray,
            correctAnswer: optionsArray[correctIndex],
            type: 'multiple-choice'
        });
    });
    
    if (!isValid) return;
    
    const quizCode = generateQuizCode();
    
    // Disable confirm button
    const confirmBtn = document.querySelector('.confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Creating Quiz...';
    
    try {
        // Calculate expiry time if timer is enabled
        let expiresAt = null;
        if (timerSettings.enabled) {
            expiresAt = new Date(Date.now() + timerSettings.minutes * 60 * 1000).toISOString();
        }
        
        const quizData = {
            title: quizTitle,
            code: quizCode,
            questions: questions,
            classId: currentClassId,
            className: currentClassName,
            professorId: currentUser.uid,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt,
            isActive: true,
            participants: [],
            completedBy: [],
            settings: {
                timer: timerSettings,
                shuffleQuestions: false,
                shuffleChoices: false,
                showResults: true,
                rewardCoins: 100
            }
        };
        
        const docRef = await addDoc(collection(db, 'quizzes'), quizData);
        console.log('✅ Quiz created with ID:', docRef.id);
        
        // Store quiz ID for ending session
        window.currentQuizId = docRef.id;
        
        // Show code result
        document.getElementById('quizCreator').style.display = 'none';
        document.getElementById('codeResult').style.display = 'block';
        document.getElementById('blurOverlay').classList.add('active');
        document.getElementById('liveQuizTitle').innerText = quizTitle + " is Live!";
        document.getElementById('displayCode').innerText = quizCode;
        
        // Show expiration info
        let expirationText = "🔒 Code active until you click 'End Session'";
        if (timerSettings.enabled) {
            expirationText = `⏱️ Code will auto-expire after ${timerSettings.minutes} minutes when timer runs out`;
        }
        document.getElementById('expirationInfo').innerHTML = expirationText;
        
        // ✅ Show/hide timer display box
        const timerBox = document.getElementById('timerBox');
        if (timerSettings.enabled) {
            timerBox.style.display = 'flex';
            startQuizTimer(expiresAt);
        } else {
            timerBox.style.display = 'none';
        }
        
        // Start polling for completion count
        startCompletionCounter(docRef.id);
        
    } catch (error) {
        console.error('❌ Error creating quiz:', error);
        showModal('error', 'Quiz Creation Failed', 'Failed to create quiz: ' + error.message);
        
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bx bx-check-circle"></i> Confirm & Generate Code';
    }
};

// ✅ NEW: Start quiz countdown timer with live display
function startQuizTimer(expiresAt) {
    const expiryTime = new Date(expiresAt).getTime();
    const timerDisplay = document.getElementById('timerDisplay');
    
    // Clear any existing timer
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
    }
    
    function updateTimer() {
        const now = Date.now();
        const timeLeft = expiryTime - now;
        
        if (timeLeft <= 0) {
            // Timer expired
            clearInterval(quizTimerInterval);
            timerDisplay.textContent = '00:00';
            timerDisplay.style.color = '#ff4b2b';
            autoExpireQuiz();
        } else {
            // Update display
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            
            // Format as MM:SS
            const formattedTime = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
            timerDisplay.textContent = formattedTime;
            
            // Change color when less than 1 minute
            if (minutesLeft < 1) {
                timerDisplay.style.color = '#ff4b2b';
            }
        }
    }
    
    // Update immediately and then every second
    updateTimer();
    quizTimerInterval = setInterval(updateTimer, 1000);
}

// ✅ Auto-expire quiz when timer runs out
async function autoExpireQuiz() {
    console.log('⏰ Timer expired! Auto-deactivating quiz...');
    
    try {
        await updateDoc(doc(db, 'quizzes', window.currentQuizId), {
            isActive: false,
            endedAt: new Date().toISOString(),
            endReason: 'timer-expired'
        });
        
        // Show notification
        showModal('warning', 'Quiz Timer Expired', 
            'The quiz code has been automatically deactivated.<br><br>Redirecting to quizzes tab...', 
            () => {
                document.getElementById('blurOverlay').classList.remove('active');
                sessionStorage.setItem('openTab', 'quizzes');
                window.location.href = 'class-detail.html';
            }
        );
        
    } catch (error) {
        console.error('❌ Error auto-expiring quiz:', error);
    }
}

// ✅ Show end confirmation modal
window.showEndConfirmation = function() {
    showModal('warning', 'End Quiz Session?', 
        '• This will deactivate the quiz code immediately<br>' +
        '• Students currently taking the quiz will be able to finish<br>' +
        '• New students will NOT be able to join<br>' +
        '• You can view results in the Quizzes tab<br><br>' +
        '<strong>Do you want to continue?</strong>',
        endQuizSession,
        true // Show cancel button
    );
};

// ✅ End quiz session
async function endQuizSession() {
    const endBtn = document.querySelector('.end-btn');
    endBtn.disabled = true;
    endBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Ending Session...';
    
    try {
        // Clear timer if running
        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
        }
        
        await updateDoc(doc(db, 'quizzes', window.currentQuizId), {
            isActive: false,
            endedAt: new Date().toISOString(),
            endReason: 'manual-end'
        });
        
        // Show success notification
        showModal('success', 'Session Ended Successfully', 
            'The quiz code is now deactivated.<br><br>Redirecting to quizzes tab...',
            () => {
                document.getElementById('blurOverlay').classList.remove('active');
                sessionStorage.setItem('openTab', 'quizzes');
                window.location.href = 'class-detail.html';
            }
        );
        
    } catch (error) {
        console.error('❌ Error ending session:', error);
        showModal('error', 'Failed to End Session', 
            'Failed to end session. Please try again.<br><br>Error: ' + error.message
        );
        
        endBtn.disabled = false;
        endBtn.innerHTML = '<i class="bx bx-power-off"></i> End Session & Deactivate Code';
    }
}

// Poll completion count
function startCompletionCounter(quizId) {
    async function updateCount() {
        try {
            const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
            if (quizDoc.exists()) {
                const completedBy = quizDoc.data().completedBy || [];
                document.getElementById('completionCount').textContent = completedBy.length;
            }
        } catch (error) {
            console.error('Error fetching completion count:', error);
        }
    }
    
    updateCount();
    setInterval(updateCount, 5000); // Update every 5 seconds
}

// ✅ Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
    }
});