import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, addDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Firebase Configuration
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

// Game State
let currentUser = null;
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = []; // ✅ Will store DETAILED results
let correctAnswers = 0;
let quizStartTime = Date.now();
let playerAvatarType = 'scholar';

// Timer State
let questionTimer = null;
let timeRemaining = 10;
const QUESTION_TIME_LIMIT = 10;

// Health System
let playerMaxHP = 100;
let playerCurrentHP = 100;
let enemyMaxHP = 100;
let enemyCurrentHP = 100;
let damagePerQuestion = 0;
let damageToPlayer = 0;

// Avatar images mapping
const avatarImages = {
    'scholar': 'assets/characters/scholarfront-removebg-preview.png',
    'dean': 'assets/characters/deanfront-removebg-preview.png',
    'night-owl': 'assets/characters/nightowlfront-removebg-preview.png',
    'tech-whiz': 'assets/characters/techwizfront-removebg-preview.png'
};

// Monster images array
const monsterImages = [
    'assets/characters/monster1-removebg-preview.png',
    'assets/characters/monster2-removebg-preview.png',
    'assets/characters/monster3-removebg-preview.png'
];

// ✅ NEW: Select random monster and remember which one
const monsterIndex = Math.floor(Math.random() * monsterImages.length);
const selectedMonster = monsterImages[monsterIndex];
const monsterType = monsterIndex + 1; // 1, 2, or 3

// ✅ NEW: Background images array
const backgroundImages = [
    'assets/characters/game-bg.png',
    'assets/characters/game1-bg.png',
    'assets/characters/game2-bg.png'
];

// Select random background
const selectedBackground = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];

// Initialize Game
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    console.log('✅ User authenticated:', user.uid);
    
    const quizJson = sessionStorage.getItem('currentQuiz');
    if (!quizJson) {
        alert('No quiz found. Please enter a quiz code.');
        window.location.href = '../Classes/class-view.html';
        return;
    }
    
    quizData = JSON.parse(quizJson);
    console.log('📚 Full Quiz Data:', quizData);
    console.log('📝 Quiz Title:', quizData.title);
    console.log('🔢 Total Questions:', quizData.questions?.length);
    
    if (quizData.questions && quizData.questions.length > 0) {
        console.log('❓ First Question Structure:', quizData.questions[0]);
        console.log('   - Question text:', quizData.questions[0].question);
        console.log('   - Options:', quizData.questions[0].options);
        console.log('   - Correct answer:', quizData.questions[0].correctAnswer);
    } else {
        console.error('❌ No questions found in quiz data!');
        alert('This quiz has no questions! Please check the quiz creation.');
        window.location.href = '../Classes/class-view.html';
        return;
    }
    
    const totalQuestions = quizData.questions.length;
    enemyMaxHP = 100;
    enemyCurrentHP = enemyMaxHP;
    damagePerQuestion = Math.ceil(100 / totalQuestions);
    damageToPlayer = Math.ceil(100 / totalQuestions);
    
    console.log('❤️ Enemy HP:', enemyMaxHP, '| Damage per correct:', damagePerQuestion);
    console.log('💔 Player damage per wrong/timeout:', damageToPlayer);
    
    // ✅ NEW: Initialize detailed answer tracking
    userAnswers = quizData.questions.map((q, index) => ({
        questionNumber: index + 1,
        question: q.question || '',
        options: q.choices || q.options || [],
        correctAnswer: '',
        userAnswer: null,
        isCorrect: false,
        answeredAt: null
    }));
    
    console.log('📋 Initialized answer tracking for', userAnswers.length, 'questions');
    
    await loadPlayerAvatar();
    loadEnemyMonster();
    loadBattleBackground(); // ✅ ADD THIS LINE
    
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
        startCountdown();
    }, 1000);
});

// Load player's equipped avatar with image
async function loadPlayerAvatar() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const avatarId = userData.equippedAvatar || 'scholar';
            const avatarImage = avatarImages[avatarId] || avatarImages['scholar'];
            
            // ✅ NEW: Store avatar type for attack animations
            playerAvatarType = avatarId;
            
            document.getElementById('player-sprite').innerHTML = 
                `<img src="${avatarImage}" alt="${avatarId}" style="width: 100%; height: 100%; object-fit: contain;">`;
            
            document.getElementById('player-name').textContent = userData.fullName || 'SCHOLAR';
            
            console.log('👤 Player avatar loaded:', avatarId);
            console.log('⚔️ Attack style set:', playerAvatarType); // ✅ NEW
        }
    } catch (error) {
        console.error('❌ Error loading avatar:', error);
    }
}

// Load random enemy monster
function loadEnemyMonster() {
    document.getElementById('enemy-sprite').innerHTML = 
        `<img src="${selectedMonster}" alt="monster" style="width: 100%; height: 100%; object-fit: contain;">`;
    
    console.log('👾 Enemy monster loaded:', selectedMonster);
    console.log('🎭 Monster type:', monsterType); // ✅ NEW
}

function loadBattleBackground() {
    const battleBg = document.getElementById('battle-bg');
    battleBg.style.backgroundImage = `url('${selectedBackground}')`;
    
    console.log('🎨 Battle background loaded:', selectedBackground);
}

// Start countdown before battle
function startCountdown() {
    const countdownEl = document.getElementById('countdown');
    const numberEl = countdownEl.querySelector('.countdown-number');
    
    countdownEl.classList.remove('hidden');
    let count = 3;
    
    const interval = setInterval(() => {
        if (count > 0) {
            numberEl.textContent = count;
        } else {
            numberEl.textContent = 'BATTLE!';
        }
        
        count--;
        
        if (count < -1) {
            clearInterval(interval);
            countdownEl.classList.add('hidden');
            startBattle();
        }
    }, 1000);
}

// Start the battle
function startBattle() {
    console.log('⚔️ BATTLE START!');
    
    document.getElementById('battle-ui').classList.remove('hidden');
    updateHealthBar('player', playerCurrentHP, playerMaxHP);
    updateHealthBar('enemy', enemyCurrentHP, enemyMaxHP);
    
    showQuestion();
}

// Display current question with timer
function showQuestion() {
    if (currentQuestionIndex >= quizData.questions.length) {
        endBattle();
        return;
    }
    
    const question = quizData.questions[currentQuestionIndex];
    console.log(`❓ Question ${currentQuestionIndex + 1}:`, question);
    
    const questionText = question.question || 'Question not found';
    const options = question.choices || question.options || [];
    
    // Find correct answer index
    let correctIndex = 0;
    let correctAnswerText = '';
    
    if (typeof question.correctAnswer === 'string') {
        correctIndex = options.indexOf(question.correctAnswer);
        correctAnswerText = question.correctAnswer;
        console.log('✅ Correct answer text:', question.correctAnswer);
        console.log('✅ Correct answer index:', correctIndex);
    } else {
        correctIndex = question.correctAnswer || 0;
        correctAnswerText = options[correctIndex] || '';
    }
    
    // ✅ NEW: Store correct answer in tracking array
    userAnswers[currentQuestionIndex].correctAnswer = correctAnswerText;
    
    console.log('📝 Question:', questionText);
    console.log('📋 Choices:', options);
    console.log('✅ Correct index:', correctIndex);
    
    const questionEl = document.getElementById('battle-question');
    if (questionEl) {
        questionEl.textContent = questionText;
    }
    
    if (!options || options.length === 0) {
        console.error('❌ No options found in question!');
        alert('Error: This question has no answer options!');
        return;
    }
    
    const shuffledOptions = shuffleOptions(options, correctIndex);
    
    const choiceBtns = document.querySelectorAll('.choice-btn');
    
    choiceBtns.forEach((btn, index) => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
        
        const choiceTextEl = btn.querySelector('.choice-text');
        if (choiceTextEl && shuffledOptions[index]) {
            choiceTextEl.textContent = shuffledOptions[index].text;
            btn.dataset.isCorrect = shuffledOptions[index].isCorrect;
            btn.dataset.originalText = shuffledOptions[index].text;
        }
    });
    
    setupChoiceHandlers();
    startQuestionTimer();
    updateBattleLog('Choose your answer! You have 10 seconds!');
}

// Start question timer (10 seconds)
function startQuestionTimer() {
    timeRemaining = QUESTION_TIME_LIMIT;
    
    const timerFill = document.getElementById('timer-bar-fill');
    const timerText = document.getElementById('timer-display');
    
    timerFill.style.width = '100%';
    timerFill.style.background = 'linear-gradient(90deg, #00ff88, #00d4ff)';
    timerText.textContent = `${timeRemaining}s`;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    questionTimer = setInterval(() => {
        timeRemaining--;
        timerText.textContent = `${timeRemaining}s`;
        
        const percentage = (timeRemaining / QUESTION_TIME_LIMIT) * 100;
        timerFill.style.width = percentage + '%';
        
        if (timeRemaining <= 3) {
            timerFill.style.background = 'linear-gradient(90deg, #ff4b2b, #ff0000)';
        } else if (timeRemaining <= 5) {
            timerFill.style.background = 'linear-gradient(90deg, #ffd700, #ff8800)';
        }
        
        if (timeRemaining <= 0) {
            clearInterval(questionTimer);
            handleTimeout();
        }
    }, 1000);
}

// Handle timeout (no answer selected)
function handleTimeout() {
    console.log('⏰ Time\'s up!');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const allBtns = document.querySelectorAll('.choice-btn');
    allBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.isCorrect === 'true') {
            btn.classList.add('correct');
        }
    });
    
    // ✅ NEW: Record timeout in detailed results
    userAnswers[currentQuestionIndex].userAnswer = 'No answer (timeout)';
    userAnswers[currentQuestionIndex].isCorrect = false;
    userAnswers[currentQuestionIndex].answeredAt = new Date().toISOString();
    
    console.log('💾 Recorded timeout for question', currentQuestionIndex + 1);
    
    playerCurrentHP = Math.max(0, playerCurrentHP - damageToPlayer);
    updateHealthBar('player', playerCurrentHP, playerMaxHP);
    updateBattleLog('❌ Time\'s up! Enemy counterattacks!');
    
    animateHit('player');
    
    if (playerCurrentHP <= 0) {
        setTimeout(() => {
            playerDefeated();
        }, 2000);
        return;
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        showQuestion();
    }, 2000);
}

// Shuffle options while tracking correct answer
function shuffleOptions(options, correctIndex) {
    console.log('🔀 Shuffling options:', options, 'Correct index:', correctIndex);
    
    if (!options || !Array.isArray(options) || options.length === 0) {
        console.error('❌ Invalid options array:', options);
        return [
            { text: 'Error loading option 1', isCorrect: false },
            { text: 'Error loading option 2', isCorrect: false },
            { text: 'Error loading option 3', isCorrect: false },
            { text: 'Error loading option 4', isCorrect: false }
        ];
    }
    
    if (correctIndex === undefined || correctIndex === null) {
        console.error('❌ Invalid correctIndex:', correctIndex);
        correctIndex = 0;
    }
    
    const optionsWithCorrectFlag = options.map((text, idx) => ({
        text: text || `Option ${idx + 1}`,
        isCorrect: idx === correctIndex
    }));
    
    console.log('Options with flags:', optionsWithCorrectFlag);
    
    for (let i = optionsWithCorrectFlag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithCorrectFlag[i], optionsWithCorrectFlag[j]] = 
        [optionsWithCorrectFlag[j], optionsWithCorrectFlag[i]];
    }
    
    console.log('Shuffled result:', optionsWithCorrectFlag);
    
    return optionsWithCorrectFlag;
}

// Setup click handlers for choices
function setupChoiceHandlers() {
    const choiceBtns = document.querySelectorAll('.choice-btn');
    
    choiceBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => handleAnswer(newBtn));
    });
}

// Handle answer selection
async function handleAnswer(selectedBtn) {
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const isCorrect = selectedBtn.dataset.isCorrect === 'true';
    const answerText = selectedBtn.dataset.originalText;
    
    console.log('🎯 Answer clicked:', answerText);
    console.log('✅ Is correct?', isCorrect);
    
    const allBtns = document.querySelectorAll('.choice-btn');
    allBtns.forEach(btn => btn.disabled = true);
    
    // ✅ NEW: Record detailed answer
    userAnswers[currentQuestionIndex].userAnswer = answerText;
    userAnswers[currentQuestionIndex].isCorrect = isCorrect;
    userAnswers[currentQuestionIndex].answeredAt = new Date().toISOString();
    
    console.log('💾 Recorded answer for question', currentQuestionIndex + 1, ':', {
        question: userAnswers[currentQuestionIndex].question,
        userAnswer: answerText,
        correctAnswer: userAnswers[currentQuestionIndex].correctAnswer,
        isCorrect: isCorrect
    });
    
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        correctAnswers++;
        
        console.log('✅ CORRECT! Total correct:', correctAnswers);
        
        enemyCurrentHP = Math.max(0, enemyCurrentHP - damagePerQuestion);
        updateHealthBar('enemy', enemyCurrentHP, enemyMaxHP);
        updateBattleLog('✅ Critical Hit! Super Effective!');
        
        animateHit('enemy');
        
        if (enemyCurrentHP <= 0) {
            setTimeout(() => {
                enemyDefeated();
            }, 1500);
            return;
        }
        
    } else {
        selectedBtn.classList.add('wrong');
        
        console.log('❌ WRONG!');
        
        allBtns.forEach(btn => {
            if (btn.dataset.isCorrect === 'true') {
                btn.classList.add('correct');
                console.log('✅ Showing correct answer:', btn.dataset.originalText);
            }
        });
        
        playerCurrentHP = Math.max(0, playerCurrentHP - damageToPlayer);
        updateHealthBar('player', playerCurrentHP, playerMaxHP);
        updateBattleLog('❌ Missed! Enemy counterattacks!');
        
        animateHit('player');
        
        if (playerCurrentHP <= 0) {
            setTimeout(() => {
                playerDefeated();
            }, 1500);
            return;
        }
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        
        if (currentQuestionIndex < quizData.questions.length) {
            showQuestion();
        } else {
            endBattle();
        }
    }, 2000);
}

// Player defeated animation
function playerDefeated() {
    console.log('💀 Player defeated!');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const playerSprite = document.getElementById('player-sprite');
    playerSprite.classList.add('defeated');
    
    setTimeout(() => {
        endBattle(true);
    }, 1500);
}

// Enemy defeated animation
function enemyDefeated() {
    console.log('🎉 Enemy defeated! Perfect victory!');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const enemySprite = document.getElementById('enemy-sprite');
    enemySprite.classList.add('defeated');
    
    updateBattleLog('🎯 PERFECT! Enemy defeated!');
    
    setTimeout(() => {
        endBattle(false, true);
    }, 1500);
}

// Update health bar
function updateHealthBar(target, current, max) {
    const percentage = Math.max(0, (current / max) * 100);
    const healthFill = document.getElementById(`${target}-hp-fill`);
    
    healthFill.style.width = percentage + '%';
    
    if (percentage > 50) {
        healthFill.style.background = target === 'player' 
            ? 'linear-gradient(90deg, #00ff88, #00d4ff)'
            : 'linear-gradient(90deg, #ff4b2b, #ff6b6b)';
    } else if (percentage > 25) {
        healthFill.style.background = target === 'player'
            ? 'linear-gradient(90deg, #ffd700, #ffaa00)'
            : 'linear-gradient(90deg, #ff6b00, #ff8800)';
    } else {
        healthFill.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
    }
    
    document.getElementById(`${target}-hp`).textContent = Math.max(0, current);
}

// Animate hit effect
// ✅ UPDATED: Animate hit effect with character-specific attacks
function animateHit(target) {
    const sprite = document.getElementById(`${target}-sprite`);
    sprite.style.animation = 'none';
    
    setTimeout(() => {
        if (target === 'enemy') {
            // ✅ Player attacks enemy - use character-specific animation
            let attackAnimation = 'scholarAttack 0.6s'; // Default
            
            // Choose attack based on equipped avatar
            switch(playerAvatarType) {
                case 'dean':
                    attackAnimation = 'deanAttack 0.7s';
                    console.log('💥 Dean uses POWERFUL SLAM!');
                    break;
                case 'night-owl':
                    attackAnimation = 'nightOwlAttack 0.5s';
                    console.log('⚡ Night Owl uses SWIFT STRIKE!');
                    break;
                case 'tech-whiz':
                    attackAnimation = 'techWizAttack 0.6s';
                    console.log('🔫 Tech Whiz uses LASER BLAST!');
                    break;
                default: // scholar
                    attackAnimation = 'scholarAttack 0.6s';
                    console.log('📚 Scholar uses BOOK SLAM!');
            }
            
            // Animate player attacking
            const playerSprite = document.getElementById('player-sprite');
            playerSprite.style.animation = attackAnimation;
            
            // Then animate enemy getting hit
            setTimeout(() => {
                sprite.style.animation = 'enemyHit 0.7s';
                
                // Return to normal float
                setTimeout(() => {
                    playerSprite.style.animation = 'floatPlayer 3s ease-in-out infinite';
                    sprite.style.animation = 'floatEnemy 3s ease-in-out infinite';
                }, 700);
            }, 300); // Small delay before enemy reacts
            
        } else {
            // ✅ Enemy attacks player (wrong answer)
            const enemySprite = document.getElementById('enemy-sprite');
            
            // Choose attack based on monster type
            let monsterAttackAnimation = 'monster1Attack 0.6s'; // Default
            let attackName = 'CLAW SWIPE';
            
            switch(monsterType) {
                case 1:
                    monsterAttackAnimation = 'monster1Attack 0.6s';
                    attackName = 'CLAW SWIPE';
                    console.log('👹 Monster 1 uses CLAW SWIPE!');
                    break;
                case 2:
                    monsterAttackAnimation = 'monster2Attack 0.7s';
                    attackName = 'CHARGE TACKLE';
                    console.log('👺 Monster 2 uses CHARGE TACKLE!');
                    break;
                case 3:
                    monsterAttackAnimation = 'monster3Attack 0.8s';
                    attackName = 'STOMP SLAM';
                    console.log('👿 Monster 3 uses STOMP SLAM!');
                    break;
            }
            
            // Animate enemy attacking
            enemySprite.style.animation = monsterAttackAnimation;
            
            // Then animate player getting hit
            setTimeout(() => {
                sprite.style.animation = 'playerHit 0.8s';
                
                // Return to normal float
                setTimeout(() => {
                    enemySprite.style.animation = 'floatEnemy 3s ease-in-out infinite';
                    sprite.style.animation = 'floatPlayer 3s ease-in-out infinite';
                }, 800);
            }, 400); // Delay before player reacts to hit
        }
    }, 10);
}

// Update battle log message
function updateBattleLog(message) {
    console.log('📢', message);
}

// End battle and show results
async function endBattle(playerLost = false, enemyDefeated = false) {
    console.log('🏁 BATTLE END!');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const totalQuestions = quizData.questions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    let baseCoins = correctAnswers * 3;
    let bonusCoins = 0;
    
    if (enemyDefeated || correctAnswers === totalQuestions) {
        bonusCoins = 20;
    } else if (correctAnswers > 0) {
        bonusCoins = 5;
    }
    
    const totalCoins = baseCoins + bonusCoins;
    const xpEarned = correctAnswers * 20;
    
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        const currentXp = userData.xp || 0;
        const currentLevel = userData.level || 1;
        const currentMaxXp = userData.maxXp || 100;
        
        let newXp = currentXp + xpEarned;
        let newLevel = currentLevel;
        let newMaxXp = currentMaxXp;
        let levelUpCoins = 0;
        
        while (newXp >= newMaxXp && newLevel < 20) {
            newXp -= newMaxXp;
            newLevel++;
            newMaxXp = Math.floor(100 * Math.pow(1.2, newLevel - 1));
            levelUpCoins += newLevel * 10;
        }
        
        if (newLevel >= 20) {
            newXp = 0;
            newLevel = 20;
        }
        
        const totalCoinsWithBonus = totalCoins + levelUpCoins;
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            coins: increment(totalCoinsWithBonus),
            xp: newXp,
            level: newLevel,
            maxXp: newMaxXp
        });
        
        // ✅ NEW: Save with DETAILED RESULTS for AI analysis
        const now = new Date();
        
        console.log('💾 Saving quiz result with detailed answers...');
        console.log('📊 Detailed Results:', userAnswers);
        
        await addDoc(collection(db, 'quizResults'), {
            userId: currentUser.uid,
            userName: userData.fullName,
            quizId: quizData.id,
            quizTitle: quizData.title,
            quizCode: quizData.code,
            professorId: quizData.professorId,
            score: correctAnswers,
            totalQuestions: totalQuestions,
            percentage: percentage,
            coinsEarned: totalCoinsWithBonus,
            xpEarned: xpEarned,
            levelAfter: newLevel,
            completedAt: now.toISOString(),
            completedAtTimestamp: now.getTime(),
            // ✅ THIS IS THE KEY - AI can now analyze your answers!
            detailedResults: userAnswers
        });
        
        console.log('✅ Quiz result saved with detailed answers!');
        console.log('🤖 AI will now be able to analyze:', {
            totalQuestions: userAnswers.length,
            correctAnswers: correctAnswers,
            wrongAnswers: userAnswers.filter(a => !a.isCorrect).length,
            sampleWrongAnswer: userAnswers.find(a => !a.isCorrect)
        });
        
        await updateDoc(doc(db, 'quizzes', quizData.id), {
            completedBy: arrayUnion(currentUser.uid)
        });
        
        showResults(correctAnswers, totalQuestions, percentage, totalCoinsWithBonus, xpEarned, levelUpCoins > 0, newLevel, playerLost, enemyDefeated);
        
    } catch (error) {
        console.error('❌ Error saving results:', error);
        alert('Failed to save results: ' + error.message);
    }
}

// Show results modal
function showResults(correct, total, percentage, coins, xp, didLevelUp, newLevel, playerLost, enemyDefeated) {
    const modal = document.getElementById('results-modal');
    
    let icon = '🏆';
    let title = 'Battle Complete!';
    let message = '';
    
    if (playerLost) {
        icon = '💀';
        title = 'DEFEATED...';
        message = 'Your character has fallen in battle! Don\'t give up! Study harder and try again!';
    } else if (enemyDefeated || correct === total) {
        icon = '🌟';
        title = 'PERFECT VICTORY!';
        message = 'You answered all questions correctly! The enemy has been completely defeated!';
    } else if (enemyCurrentHP > 0) {
        icon = '🏃';
        title = 'ENEMY ESCAPED!';
        message = `The quiz has ended, but the enemy survived with ${enemyCurrentHP}/${enemyMaxHP} HP and managed to escape! You were so close!`;
    } else if (percentage >= 80) {
        icon = '⚔️';
        title = 'VICTORY!';
        message = 'Outstanding performance! You crushed this battle!';
    } else if (percentage >= 60) {
        icon = '🎖️';
        title = 'WELL DONE!';
        message = 'Good fight! You\'re getting stronger!';
    } else if (playerCurrentHP > 0) {
        icon = '💪';
        title = 'BATTLE WON!';
        message = 'You survived! Keep training to improve!';
    }
    
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-title').textContent = title;
    document.getElementById('final-score').textContent = `${correct}/${total}`;
    document.getElementById('final-accuracy').textContent = `${percentage}%`;
    document.getElementById('coins-earned').textContent = coins;
    document.getElementById('result-message').textContent = message;
    
    const xpGainEl = document.getElementById('xp-gain');
    if (xp > 0) {
        xpGainEl.style.display = 'flex';
        let xpText = `+${xp} XP`;
        if (didLevelUp) {
            xpText += ` 🎉 LEVEL UP! Now Level ${newLevel}!`;
        }
        document.getElementById('xp-text').textContent = xpText;
    }
    
    modal.classList.remove('hidden');
    
    console.log('📊 Results displayed');
}

// Return to dashboard
window.returnToDashboard = function() {
    window.location.href = '../Classes/class-view.html';
};

console.log('✅ Game script loaded');