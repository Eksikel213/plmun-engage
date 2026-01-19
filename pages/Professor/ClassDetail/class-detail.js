import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// ✅ Import AI modules
import { analyzeClassWithGemini, displayClassAIInsights, displayStudentPerformance } from './professor-report-ai.js';
import { initProfessorChatbot, sendTeachingMessage, getProfessorSuggestedQuestions, clearProfessorChat } from './professor-chatbot.js';

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = 'dkrjfwkwx';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

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
let currentClassData = null;
let allQuizzes = [];
let showingAllQuizzes = false;
let cachedAnalysis = null; // ✅ Cache AI analysis
let professorProfilePic = null; // ✅ For chatbot avatar

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../../index.html';
        return;
    }
    
    currentUser = user;
    currentClassId = sessionStorage.getItem('currentClassId');
    
    if (!currentClassId) {
        alert('No class selected');
        window.location.href = '../professor.html';
        return;
    }

    const openTab = sessionStorage.getItem('openTab');
    if (openTab) {
        showSection(openTab);
        sessionStorage.removeItem('openTab');
    }
    
    // ✅ Load professor profile pic for chatbot
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        professorProfilePic = userData.customAvatarURL || null;
        console.log('✅ Professor profile pic loaded:', professorProfilePic);
    }
    
    await loadClassData();
});

// Load class data
async function loadClassData() {
    try {
        const classDoc = await getDoc(doc(db, 'classes', currentClassId));
        
        if (!classDoc.exists()) {
            alert('Class not found');
            window.location.href = '../professor.html';
            return;
        }
        
        currentClassData = { id: classDoc.id, ...classDoc.data() };
        
        document.getElementById('className').textContent = currentClassData.name;
        document.getElementById('classCodeDisplay').textContent = currentClassData.classCode;
        document.getElementById('subjectCode').textContent = currentClassData.subjectCode;
        document.getElementById('section').textContent = currentClassData.section;
        document.getElementById('classDescription').textContent = currentClassData.description || 'No description';
        
        const createdDate = new Date(currentClassData.createdAt).toLocaleDateString();
        document.getElementById('createdDate').textContent = createdDate;
        
        document.getElementById('totalStudents').textContent = currentClassData.students ? currentClassData.students.length : 0;
        
        await loadTopics();
        await loadQuizzes();
        
    } catch (error) {
        console.error('Error loading class:', error);
        alert('Failed to load class data');
    }
}

// Show/Hide sections
window.showSection = async function(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(sectionName + 'Section').classList.add('active');
    
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) activeLink.classList.add('active');
    
    // ✅ Load AI reports when Reports tab is clicked
    if (sectionName === 'reports') {
        await loadAIReports();
    }
};

// ✅ LOAD AI REPORTS FUNCTION
async function loadAIReports() {
    try {
        console.log('🤖 Loading AI reports...');
        
        document.getElementById('loadingReportState').style.display = 'block';
        document.getElementById('noReportResultsState').style.display = 'none';
        document.getElementById('aiReportAnalysis').style.display = 'none';
        
        // Analyze class with Gemini AI
        const analysis = await analyzeClassWithGemini(db, currentClassId);
        
        document.getElementById('loadingReportState').style.display = 'none';
        
        if (!analysis.hasResults) {
            document.getElementById('noReportResultsState').style.display = 'block';
            return;
        }
        
        // Cache analysis for chatbot
        cachedAnalysis = analysis;
        
        // Display AI insights
        document.getElementById('aiReportAnalysis').style.display = 'block';
        displayClassAIInsights(analysis.aiInsights, analysis.stats);
        displayStudentPerformance(analysis.stats.studentList);
        
        // Initialize chatbot
        initProfessorChatbot(analysis);
        
        console.log('✅ AI reports loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading AI reports:', error);
        document.getElementById('loadingReportState').innerHTML = `
            <div style="color: #ff4b2b; text-align: center;">
                <i class='bx bx-error-circle' style="font-size: 60px; margin-bottom: 15px;"></i>
                <h3>Analysis Failed</h3>
                <p style="margin-top: 10px; font-size: 14px;">${error.message}</p>
                <button class="ai-btn-primary" onclick="window.location.reload()" style="margin-top: 20px;">
                    <i class='bx bx-refresh'></i> Retry
                </button>
            </div>
        `;
    }
}

// ✅ SHOW DETAILED FEEDBACK
window.showReportFeedback = function() {
    const feedback = document.getElementById('aiReportFeedback');
    if (feedback.style.display === 'none' || feedback.style.display === '') {
        feedback.style.display = 'grid';
        window.scrollTo({ 
            top: feedback.offsetTop - 100, 
            behavior: 'smooth' 
        });
    } else {
        feedback.style.display = 'none';
    }
};

// ✅ OPEN AI CHATBOT (Slide in from right)
window.openProfessorChat = function() {
    const chatbot = document.getElementById('professorChatbot');
    const overlay = document.getElementById('chatbotOverlay');
    
    chatbot.classList.add('open');
    overlay.classList.add('active');
    
    // Populate suggested questions
    const suggestions = getProfessorSuggestedQuestions();
    const suggestionsDiv = document.getElementById('professorSuggestedQuestions');
    
    if (suggestions.length > 0) {
        suggestionsDiv.style.display = 'flex';
        suggestionsDiv.innerHTML = suggestions.map(q => 
            `<button class="suggested-question" onclick="askProfessorSuggestedQuestion('${q.replace(/'/g, "\\'")}')">${q}</button>`
        ).join('');
    } else {
        suggestionsDiv.style.display = 'none';
    }
    
    setTimeout(() => {
        document.getElementById('professorChatInput').focus();
    }, 300);
};

// ✅ CLOSE AI CHATBOT
window.closeProfessorChat = function() {
    const chatbot = document.getElementById('professorChatbot');
    const overlay = document.getElementById('chatbotOverlay');
    
    chatbot.classList.remove('open');
    overlay.classList.remove('active');
};

// ✅ SEND CHAT MESSAGE
window.sendProfessorChatMessage = async function() {
    const input = document.getElementById('professorChatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    
    // Add user message to UI
    addProfessorMessageToUI(message, 'user');
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message ai-message';
    typingIndicator.id = 'typingIndicator';
    typingIndicator.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    document.getElementById('professorChatMessages').appendChild(typingIndicator);
    scrollProfessorChatToBottom();
    
    // Get AI response
    const response = await sendTeachingMessage(message);
    
    // Remove typing indicator
    typingIndicator.remove();
    
    // Add AI response
    if (response.success) {
        addProfessorMessageToUI(response.message, 'ai');
    } else {
        addProfessorMessageToUI(response.message, 'ai', true);
    }
};

// ✅ ASK SUGGESTED QUESTION
window.askProfessorSuggestedQuestion = function(question) {
    document.getElementById('professorChatInput').value = question;
    sendProfessorChatMessage();
    
    document.getElementById('professorSuggestedQuestions').style.display = 'none';
};

// ✅ ADD MESSAGE TO CHAT UI
function addProfessorMessageToUI(message, sender, isError = false) {
    const messagesDiv = document.getElementById('professorChatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    let avatarHTML;
    if (sender === 'user' && professorProfilePic) {
        avatarHTML = `<img src="${professorProfilePic}" class="user-avatar-img" alt="You" onerror="this.outerHTML='<div class=\\'message-avatar\\'>👤</div>'">`;
    } else if (sender === 'user') {
        avatarHTML = '<div class="message-avatar">👤</div>';
    } else {
        avatarHTML = '<div class="message-avatar">🤖</div>';
    }
    
    messageDiv.innerHTML = `
        ${avatarHTML}
        <div class="message-content" ${isError ? 'style="border-color: #ff4b2b;"' : ''}>
            <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    scrollProfessorChatToBottom();
}

// ✅ SCROLL CHAT TO BOTTOM
function scrollProfessorChatToBottom() {
    const messagesDiv = document.getElementById('professorChatMessages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ✅ HANDLE ENTER KEY IN CHAT INPUT
window.handleProfessorChatKeyPress = function(event) {
    if (event.key === 'Enter') {
        sendProfessorChatMessage();
    }
};

// LOAD TOPICS FUNCTION
async function loadTopics() {
    try {
        console.log('📚 Loading topics for class:', currentClassId);
        
        const topicsRef = collection(db, 'topics');
        const q = query(
            topicsRef, 
            where('classId', '==', currentClassId)
        );
        const snapshot = await getDocs(q);
        
        const topicsList = document.getElementById('topicsList');
        
        if (snapshot.empty) {
            console.log('⚠️ No topics found');
            topicsList.innerHTML = `
                <div class="empty-state">
                    <i class='bx bxs-book'></i>
                    <p>No topics uploaded yet</p>
                </div>
            `;
            document.getElementById('totalTopics').textContent = '0';
            return;
        }
        
        console.log('✅ Found', snapshot.size, 'topics');
        document.getElementById('totalTopics').textContent = snapshot.size;
        
        const topics = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        
        topicsList.innerHTML = topics.map(topic => {
            const uploadDate = new Date(topic.uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const fileName = topic.fileName || '';
            const ext = fileName.split('.').pop().toLowerCase();
            let fileIcon = 'bx-file';
            let fileColor = '#00d4ff';
            
            if (ext === 'pdf') {
                fileIcon = 'bxs-file-pdf';
                fileColor = '#ff4b2b';
            } else if (ext === 'doc' || ext === 'docx') {
                fileIcon = 'bxs-file-doc';
                fileColor = '#2b7de9';
            } else if (ext === 'ppt' || ext === 'pptx') {
                fileIcon = 'bxs-file-pdf';
                fileColor = '#ff8e2b';
            }
            
            return `
                <div class="topic-item">
                    <div class="item-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class='bx ${fileIcon}' style="font-size: 28px; color: ${fileColor};"></i>
                            <div>
                                <div class="item-title">${topic.title}</div>
                                <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 3px;">
                                    ${fileName}
                                </div>
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="action-btn btn-download" onclick="downloadTopic('${topic.fileURL}', '${fileName}')" title="Download">
                                <i class='bx bx-download'></i>
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteTopic('${topic.id}', '${topic.cloudinaryPublicId || ''}')" title="Delete">
                                <i class='bx bx-trash'></i>
                            </button>
                        </div>
                    </div>
                    <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 12px 0 8px 0; line-height: 1.5;">
                        ${topic.description || 'No description'}
                    </p>
                    <p style="color: rgba(255,255,255,0.4); font-size: 12px;">
                        <i class='bx bx-calendar' style="font-size: 14px;"></i> Uploaded: ${uploadDate}
                    </p>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Error loading topics:', error);
        document.getElementById('topicsList').innerHTML = `
            <div class="empty-state">
                <i class='bx bx-error-circle' style="color: #ff4b2b;"></i>
                <p style="color: #ff4b2b;">Error loading topics</p>
                <p style="font-size: 13px; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// LOAD QUIZZES
async function loadQuizzes() {
    try {
        const quizzesRef = collection(db, 'quizzes');
        const q = query(quizzesRef, where('classId', '==', currentClassId));
        const snapshot = await getDocs(q);
        
        const quizzesList = document.getElementById('quizzesList');
        
        if (snapshot.empty) {
            quizzesList.innerHTML = `
                <div class="empty-state">
                    <i class='bx bxs-edit-alt'></i>
                    <p>No quizzes created yet</p>
                </div>
            `;
            document.getElementById('totalQuizzes').textContent = '0';
            return;
        }
        
        allQuizzes = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('✅ Loaded', allQuizzes.length, 'quizzes');
        document.getElementById('totalQuizzes').textContent = allQuizzes.length;
        
        displayQuizzes(false);
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        document.getElementById('quizzesList').innerHTML = `
            <div class="empty-state">
                <i class='bx bx-error-circle' style="color: #ff4b2b;"></i>
                <p style="color: #ff4b2b;">Error loading quizzes</p>
            </div>
        `;
    }
}

// DISPLAY QUIZZES
function displayQuizzes(showAll = false) {
    const quizzesList = document.getElementById('quizzesList');
    showingAllQuizzes = showAll;
    
    const quizzesToShow = showAll ? allQuizzes : allQuizzes.slice(0, 3);
    
    quizzesList.innerHTML = quizzesToShow.map(quiz => {
        const createdDate = new Date(quiz.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const createdTime = new Date(quiz.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="quiz-item">
                <div class="item-header">
                    <span class="item-title">${quiz.title}</span>
                    <div class="item-actions">
                        <button class="action-btn btn-download" onclick="viewQuizResults('${quiz.id}')" title="View Results">
                            <i class='bx bx-bar-chart-alt-2'></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteQuiz('${quiz.id}')" title="Delete">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>
                <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 8px;">
                    Code: <strong style="color: #00d4ff;">${quiz.code}</strong> | 
                    Questions: ${quiz.questions.length}
                </p>
                <p style="color: rgba(255,255,255,0.5); font-size: 12px;">
                    <i class='bx bx-calendar' style="font-size: 14px;"></i> Created: ${createdDate} • ${createdTime}
                </p>
            </div>
        `;
    }).join('');
    
    if (allQuizzes.length > 3) {
        const toggleBtn = document.createElement('div');
        toggleBtn.style.cssText = 'text-align: center; margin-top: 20px;';
        toggleBtn.innerHTML = `
            <button class="btn-see-more" onclick="toggleQuizDisplay()">
                <i class='bx ${showAll ? 'bx-chevron-up' : 'bx-chevron-down'}'></i>
                ${showAll ? 'Show Less' : `See More (${allQuizzes.length - 3} more)`}
            </button>
        `;
        quizzesList.appendChild(toggleBtn);
    }
}

window.toggleQuizDisplay = function() {
    displayQuizzes(!showingAllQuizzes);
};

window.showUploadTopicModal = function() {
    console.log('📤 Opening upload modal');
    document.getElementById('uploadTopicModal').classList.add('show');
};

window.closeUploadTopicModal = function() {
    console.log('❌ Closing upload modal');
    document.getElementById('uploadTopicModal').classList.remove('show');
    document.getElementById('uploadTopicForm').reset();
};

// UPLOAD TO CLOUDINARY
async function uploadToCloudinary(file, onProgress) {
    console.log('☁️ Uploading to Cloudinary:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'auto');
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                console.log('✅ Cloudinary upload success:', response.secure_url);
                resolve({
                    url: response.secure_url,
                    publicId: response.public_id,
                    format: response.format,
                    size: response.bytes
                });
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
        xhr.send(formData);
    });
}

async function deleteFromCloudinary(publicId) {
    console.log('🗑️ Note: Cloudinary file deletion requires server-side API call');
    console.log('Public ID:', publicId);
}

// UPLOAD TOPIC FORM
document.getElementById('uploadTopicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-create');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Uploading...';
    
    try {
        const title = document.getElementById('topicTitle').value.trim();
        const description = document.getElementById('topicDescription').value.trim();
        const fileInput = document.getElementById('topicFile');
        const file = fileInput.files[0];
        
        console.log('📤 Starting upload:', { title, description, fileName: file?.name });
        
        if (!file) {
            alert('❌ Please select a file');
            throw new Error('No file selected');
        }
        
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            alert('❌ Invalid file type. Please upload PDF, DOC, DOCX, PPT, or PPTX files only.');
            throw new Error('Invalid file type');
        }
        
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('❌ File size must be less than 10MB');
            throw new Error('File too large');
        }
        
        console.log('✅ File validation passed');
        
        const uploadResult = await uploadToCloudinary(file, (percent) => {
            submitBtn.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> Uploading... ${percent}%`;
        });
        
        console.log('✅ File uploaded to Cloudinary');
        
        const topicData = {
            classId: currentClassId,
            className: currentClassData.name,
            professorId: currentUser.uid,
            professorName: currentClassData.createdBy || 'Professor',
            title: title,
            description: description,
            fileName: file.name,
            fileURL: uploadResult.url,
            cloudinaryPublicId: uploadResult.publicId,
            fileSize: uploadResult.size,
            fileType: file.type,
            uploadedAt: new Date().toISOString()
        };
        
        console.log('💾 Saving to Firestore:', topicData);
        
        await addDoc(collection(db, 'topics'), topicData);
        console.log('✅ Topic saved to Firestore');
        
        alert('✅ Topic uploaded successfully!');
        window.closeUploadTopicModal();
        
        await loadTopics();
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        alert('Failed to upload topic: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

window.downloadTopic = function(fileURL, fileName) {
    console.log('⬇️ Downloading:', fileName);
    const link = document.createElement('a');
    link.href = fileURL;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.deleteTopic = async function(topicId, cloudinaryPublicId) {
    if (!confirm('⚠️ Are you sure you want to delete this topic? This cannot be undone.')) return;
    
    try {
        console.log('🗑️ Deleting topic:', topicId);
        
        if (cloudinaryPublicId) {
            await deleteFromCloudinary(cloudinaryPublicId);
        }
        
        await deleteDoc(doc(db, 'topics', topicId));
        console.log('✅ Topic deleted from Firestore');
        
        alert('✅ Topic deleted successfully');
        await loadTopics();
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        alert('Failed to delete topic: ' + error.message);
    }
};

window.createQuiz = function() {
    sessionStorage.setItem('currentClassId', currentClassId);
    sessionStorage.setItem('currentClassName', currentClassData.name);
    window.location.href = 'create-quiz.html';
};

window.deleteQuiz = async function(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
        await deleteDoc(doc(db, 'quizzes', quizId));
        alert('✅ Quiz deleted successfully');
        await loadQuizzes();
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('Failed to delete quiz');
    }
};

window.viewQuizResults = function(quizId) {
    sessionStorage.setItem('viewQuizId', quizId);
    window.location.href = 'quiz-results.html';
};

window.redirectToStudents = function() {
    window.location.href = 'students.html';
};

window.showDeleteClassModal = function() {
    document.getElementById('deleteClassName').textContent = currentClassData.name;
    document.getElementById('deleteClassModal').classList.add('show');
};

window.closeDeleteClassModal = function() {
    document.getElementById('deleteClassModal').classList.remove('show');
};

window.confirmDeleteClass = async function() {
    const deleteBtn = document.querySelector('.btn-confirm-delete');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Deleting...';
    
    try {
        console.log('🗑️ Deleting class:', currentClassId);
        
        const topicsRef = collection(db, 'topics');
        const topicsQuery = query(topicsRef, where('classId', '==', currentClassId));
        const topicsSnapshot = await getDocs(topicsQuery);
        
        console.log(`📚 Found ${topicsSnapshot.size} topics to delete`);
        
        for (const topicDoc of topicsSnapshot.docs) {
            await deleteDoc(doc(db, 'topics', topicDoc.id));
        }
        
        const quizzesRef = collection(db, 'quizzes');
        const quizzesQuery = query(quizzesRef, where('classId', '==', currentClassId));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        console.log(`📝 Found ${quizzesSnapshot.size} quizzes to delete`);
        
        for (const quizDoc of quizzesSnapshot.docs) {
            const quizId = quizDoc.id;
            
            const resultsRef = collection(db, 'quizResults');
            const resultsQuery = query(resultsRef, where('quizId', '==', quizId));
            const resultsSnapshot = await getDocs(resultsQuery);
            
            for (const resultDoc of resultsSnapshot.docs) {
                await deleteDoc(doc(db, 'quizResults', resultDoc.id));
            }
            
            await deleteDoc(doc(db, 'quizzes', quizId));}

            await deleteDoc(doc(db, 'classes', currentClassId));
    
    console.log('✅ Class and all related data deleted');
    
    closeDeleteClassModal();
    
    document.getElementById('successDeleteModal').classList.add('show');
    
    setTimeout(() => {
        window.location.href = '../professor.html';
    }, 2000);
    
} catch (error) {
    console.error('❌ Error deleting class:', error);
    alert('Failed to delete class: ' + error.message);
    deleteBtn.disabled = false;
    deleteBtn.innerHTML = originalText;
}
};