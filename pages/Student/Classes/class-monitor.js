// class-monitor.js - Real-time class membership monitor
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let currentClassId = null;
let currentUserId = null;
let unsubscribe = null;

// Start monitoring class membership
export function startClassMonitor(db, classId, userId) {
    console.log('👀 Starting class monitor for:', classId);
    
    currentClassId = classId;
    currentUserId = userId;
    
    // Stop any existing listener
    if (unsubscribe) {
        unsubscribe();
    }
    
    // Listen to class document changes in real-time
    const classRef = doc(db, 'classes', classId);
    
    unsubscribe = onSnapshot(classRef, (docSnapshot) => {
        if (!docSnapshot.exists()) {
            console.log('⚠️ Class no longer exists');
            showKickedModal('This class has been deleted by the professor.');
            return;
        }
        
        const classData = docSnapshot.data();
        const students = classData.students || [];
        
        // Check if current user is still in the students array
        if (!students.includes(currentUserId)) {
            console.log('🚨 User has been removed from class!');
            showKickedModal('You have been removed from this class by the professor.');
        }
    }, (error) => {
        console.error('❌ Monitor error:', error);
    });
}

// Stop monitoring when leaving page
export function stopClassMonitor() {
    if (unsubscribe) {
        console.log('🛑 Stopping class monitor');
        unsubscribe();
        unsubscribe = null;
    }
}

// Show "You've been kicked" modal
function showKickedModal(message) {
    // Stop monitoring immediately
    stopClassMonitor();
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'kickedModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, rgba(8, 27, 41, 0.98), rgba(255, 75, 43, 0.15));
            border: 3px solid #ff4b2b;
            border-radius: 25px;
            padding: 50px 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            animation: modalBounce 0.5s ease;
            box-shadow: 0 20px 60px rgba(255, 75, 43, 0.5);
        ">
            <div style="font-size: 100px; margin-bottom: 20px; animation: shake 0.5s;">
                🚫
            </div>
            <h2 style="color: #ff4b2b; font-size: 32px; margin-bottom: 20px; font-weight: 800;">
                Access Removed
            </h2>
            <p style="color: white; font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
                ${message}
            </p>
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-bottom: 30px;">
                You will be redirected to your classes page in <span id="kickCountdown" style="color: #00d4ff; font-weight: 700;">5</span> seconds...
            </p>
            <button id="kickOkBtn" style="
                padding: 15px 40px;
                background: #ff4b2b;
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 18px;
                font-weight: 700;
                cursor: pointer;
                transition: 0.3s;
            ">
                Go to My Classes
            </button>
        </div>
        
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalBounce {
                0% { transform: scale(0.5); opacity: 0; }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-15px) rotate(-5deg); }
                75% { transform: translateX(15px) rotate(5deg); }
            }
            
            #kickOkBtn:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 30px rgba(255, 75, 43, 0.5);
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Countdown timer
    let countdown = 5;
    const countdownEl = document.getElementById('kickCountdown');
    
    const timer = setInterval(() => {
        countdown--;
        if (countdownEl) {
            countdownEl.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(timer);
            redirectToClasses();
        }
    }, 1000);
    
    // Manual redirect button
    document.getElementById('kickOkBtn').addEventListener('click', () => {
        clearInterval(timer);
        redirectToClasses();
    });
}

// Redirect to classes page
function redirectToClasses() {
    // Clear session storage
    sessionStorage.removeItem('currentClassId');
    sessionStorage.removeItem('currentClassName');
    
    // Redirect
    window.location.href = 'student-classes.html';
}