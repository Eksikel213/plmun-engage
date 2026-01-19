import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
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
let allTopics = [];

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
    }
    
    const currentClassId = sessionStorage.getItem('currentClassId');
    
    if (!currentClassId) {
        alert('No class selected');
        window.location.href = 'student-classes.html';
        return;
    }
    
    await loadClassData();
    await loadTopics(); // ✅ ADD THIS - it was missing!
    
    startClassMonitor(db, currentClassId, user.uid);
});

// ✅ NEW: Stop monitoring when leaving page
window.addEventListener('beforeunload', () => {
    stopClassMonitor();
});

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
        
        document.getElementById('className').textContent = currentClassData.name + ' - Topics';
        document.getElementById('classInfo').textContent = `${currentClassData.name} • ${currentClassData.subjectCode} • Section ${currentClassData.section}`;
        
        console.log('✅ Class loaded:', currentClassData.name);
        
    } catch (error) {
        console.error('❌ Error loading class:', error);
        alert('Failed to load class data');
    }
}

// Load topics from Firestore
async function loadTopics() {
    try {
        console.log('📖 Loading topics for class:', currentClassData.id);
        
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('topicsGrid').innerHTML = '';
        
        const topicsRef = collection(db, 'topics');
        const q = query(topicsRef, where('classId', '==', currentClassData.id));
        const snapshot = await getDocs(q);
        
        document.getElementById('loadingState').style.display = 'none';
        
        if (snapshot.empty) {
            console.log('ℹ️ No topics found for this class');
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('topicCount').textContent = '0';
            return;
        }
        
        // ✅ Sort manually in JavaScript after fetching
        allTopics = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            // ✅ FIX: Check for both createdAt and uploadedAt
            const dateA = new Date(a.createdAt || a.uploadedAt || 0).getTime();
            const dateB = new Date(b.createdAt || b.uploadedAt || 0).getTime();
            return dateB - dateA;
        });
        
        console.log('✅ Loaded', allTopics.length, 'topics');
        console.log('📝 Sample topic data:', allTopics[0]); // Debug log
        
        document.getElementById('topicCount').textContent = allTopics.length;
        displayTopics(allTopics);
        
    } catch (error) {
        console.error('❌ Error loading topics:', error);
        document.getElementById('loadingState').style.display = 'none';
        
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').innerHTML = `
            <i class='bx bxs-error' style="font-size: 80px; color: #ff4b2b; margin-bottom: 20px;"></i>
            <h3>Failed to Load Topics</h3>
            <p style="opacity: 0.7; margin-top: 10px;">${error.message}</p>
            <button class="btn-secondary" onclick="location.reload()" style="margin-top: 20px;">
                <i class='bx bx-refresh'></i> Retry
            </button>
        `;
    }
}

// Display topics in grid
function displayTopics(topics) {
    const grid = document.getElementById('topicsGrid');
    
    const topicIcons = {
        'lesson': 'bxs-book',
        'assignment': 'bxs-file-doc',
        'announcement': 'bxs-bell',
        'resource': 'bxs-folder',
        'default': 'bxs-book-content'
    };
    
    grid.innerHTML = topics.map(topic => {
        const icon = topicIcons[topic.type] || topicIcons['default'];
        
        // ✅ FIX: Check for both createdAt and uploadedAt
        let createdDate = 'Invalid Date';
        let createdTime = '';
        
        const dateString = topic.createdAt || topic.uploadedAt;
        
        if (dateString) {
            try {
                const date = new Date(dateString);
                if (!isNaN(date.getTime())) {
                    createdDate = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    createdTime = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {
                console.error('Date parsing error:', e);
            }
        }
        
        return `
            <div class="topic-card glass" onclick="viewTopic('${topic.id}')">
                <div class="topic-card-header">
                    <div class="topic-icon">
                        <i class='bx ${icon}'></i>
                    </div>
                    <div class="topic-info">
                        <div class="topic-title">${topic.title}</div>
                        <div class="topic-meta">
                            <i class='bx bx-user'></i>
                            <span>${topic.professorName || currentClassData.professorName || 'Professor'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="topic-description">
                    ${topic.description || 'No description provided.'}
                </div>
                
                <div class="topic-footer">
                    <div class="topic-date">
                        <i class='bx bx-calendar'></i>
                        <span>${createdDate}${createdTime ? ' • ' + createdTime : ''}</span>
                    </div>
                    <button class="view-btn" onclick="event.stopPropagation(); viewTopic('${topic.id}')">
                        View Details <i class='bx bx-right-arrow-alt'></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// View topic details in modal
window.viewTopic = function(topicId) {
    const topic = allTopics.find(t => t.id === topicId);
    
    if (!topic) {
        alert('❌ Topic not found');
        return;
    }
    
    console.log('👁️ Viewing topic:', topic.title);
    console.log('📎 Topic data:', topic); // Debug log
    
    const topicIcons = {
        'lesson': 'bxs-book',
        'assignment': 'bxs-file-doc',
        'announcement': 'bxs-bell',
        'resource': 'bxs-folder',
        'default': 'bxs-book-content'
    };
    
    const icon = topicIcons[topic.type] || topicIcons['default'];
    
    // ✅ FIX: Check for both createdAt and uploadedAt
    let createdDate = 'Unknown Date';
    let createdTime = '';
    
    const dateString = topic.createdAt || topic.uploadedAt;
    
    if (dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                createdDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                createdTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {
            console.error('Date parsing error:', e);
        }
    }
    
    document.getElementById('modalTopicIcon').innerHTML = `<i class='bx ${icon}'></i>`;
    document.getElementById('modalTopicTitle').textContent = topic.title;
    document.getElementById('modalTopicMeta').textContent = `Posted by ${topic.professorName || currentClassData.professorName || 'Unknown Professor'} • ${createdDate}${createdTime ? ' at ' + createdTime : ''}`;
    document.getElementById('modalTopicDescription').textContent = topic.description || 'No description provided.';
    
    
    // ✅ FIX: Handle attachments - support multiple field names
    const attachmentsDiv = document.getElementById('modalTopicAttachments');
    
    // Check if there's a file attached (your Firestore shows single file fields)
    const hasFile = topic.fileURL || topic.cloudinaryPublicId;
    
    if (hasFile) {
        const fileName = topic.fileName || 'Download File';
        const fileURL = topic.fileURL || '';
        
        // ✅ Get file icon based on type
        let fileIcon = 'bxs-file';
        if (fileName.match(/\.(pdf)$/i)) fileIcon = 'bxs-file-pdf';
        else if (fileName.match(/\.(doc|docx)$/i)) fileIcon = 'bxs-file-doc';
        else if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) fileIcon = 'bxs-image';
        else if (fileName.match(/\.(zip|rar)$/i)) fileIcon = 'bxs-file-archive';
        
        attachmentsDiv.innerHTML = `
            <h4><i class='bx bx-paperclip'></i> Attached File</h4>
            <div class="attachment-item" onclick="downloadFile('${fileURL}', '${fileName}')">
                <i class='bx ${fileIcon}'></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${fileName}</div>
                    <div style="font-size: 12px; opacity: 0.7; margin-top: 3px;">
                        ${topic.fileType || 'Document'} • ${formatFileSize(topic.fileSize)}
                    </div>
                </div>
                <i class='bx bx-download' style="font-size: 24px; color: #00d4ff;"></i>
            </div>
        `;
    } else if (topic.attachments && topic.attachments.length > 0) {
        // Support old format with attachments array
        attachmentsDiv.innerHTML = `
            <h4><i class='bx bx-paperclip'></i> Attachments (${topic.attachments.length})</h4>
            ${topic.attachments.map(att => {
                const fileName = att.name || att.fileName || 'Download File';
                const fileURL = att.url || att.fileURL || '';
                
                let fileIcon = 'bxs-file';
                if (fileName.match(/\.(pdf)$/i)) fileIcon = 'bxs-file-pdf';
                else if (fileName.match(/\.(doc|docx)$/i)) fileIcon = 'bxs-file-doc';
                else if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) fileIcon = 'bxs-image';
                else if (fileName.match(/\.(zip|rar)$/i)) fileIcon = 'bxs-file-archive';
                
                return `
                    <div class="attachment-item" onclick="downloadFile('${fileURL}', '${fileName}')">
                        <i class='bx ${fileIcon}'></i>
                        <span style="flex: 1;">${fileName}</span>
                        <i class='bx bx-download' style="font-size: 24px; color: #00d4ff;"></i>
                    </div>
                `;
            }).join('')}
        `;
    } else {
        attachmentsDiv.innerHTML = '<p style="opacity: 0.7; text-align: center;">No files attached</p>';
    }
    
    document.getElementById('topicModal').classList.add('show');
};

// ✅ Helper function to format file size
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ✅ Download function for Cloudinary files
window.downloadFile = async function(url, fileName) {
    if (!url) {
        alert('❌ File URL not found');
        return;
    }
    
    try {
        console.log('📥 Downloading:', fileName);
        console.log('🔗 URL:', url);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.target = '_blank';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ Download started!');
    } catch (error) {
        console.error('❌ Download error:', error);
        alert('Failed to download file. Opening in new tab instead...');
        window.open(url, '_blank');
    }
};

// Close topic modal
window.closeTopicModal = function() {
    document.getElementById('topicModal').classList.remove('show');
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