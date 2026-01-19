import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let allClasses = []; // ✅ Store all classes globally for search

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../index.html';
        return;
    }
    
    currentUser = user;
    
    // Get user data
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('profName').textContent = userData.fullName || 'Professor';
        
        if (userData.role !== 'professor') {
            alert('Access denied. This page is for professors only.');
            window.location.href = '../student/student.html';
            return;
        }
    }
    
    await loadClasses();
});

// Load professor's classes
async function loadClasses() {
    try {
        console.log('📚 Loading classes for professor:', currentUser.uid);
        
        const classesRef = collection(db, 'classes');
        const q = query(classesRef, where('professorId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        document.getElementById('loadingState').style.display = 'none';
        
        if (snapshot.empty) {
            console.log('⚠️ No classes found');
            document.getElementById('noClassesState').style.display = 'block';
            document.getElementById('classesGrid').style.display = 'none';
            allClasses = [];
            return;
        }
        
        console.log('✅ Found', snapshot.size, 'classes');
        
        // ✅ Store all classes globally for search
        allClasses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        document.getElementById('noClassesState').style.display = 'none';
        displayClasses(allClasses);
        
    } catch (error) {
        console.error('❌ Error loading classes:', error);
        document.getElementById('loadingState').innerHTML = 
            '<p style="color: #ff4b2b;">Failed to load classes. Please refresh.</p>';
    }
}

// ✅ Display classes with optional highlighting
function displayClasses(classes, searchTerm = '') {
    const classesGrid = document.getElementById('classesGrid');
    const noResultsDiv = document.getElementById('noSearchResults');
    
    if (classes.length === 0) {
        classesGrid.style.display = 'none';
        noResultsDiv.style.display = 'block';
        return;
    }
    
    classesGrid.style.display = 'grid';
    noResultsDiv.style.display = 'none';
    
    // ✅ Highlight matching text
    const highlightText = (text, term) => {
        if (!term || !text) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    };
    
    classesGrid.innerHTML = classes.map(classData => {
        const createdDate = new Date(classData.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const displayName = highlightText(classData.name, searchTerm);
        const displaySubjectCode = highlightText(classData.subjectCode, searchTerm);
        const displaySection = highlightText(classData.section, searchTerm);
        const displayClassCode = highlightText(classData.classCode, searchTerm);
        const displayDescription = highlightText(classData.description || 'No description', searchTerm);
        
        return `
            <div class="class-card" onclick="openClass('${classData.id}')">
                <div class="class-header">
                    <div class="class-icon">
                        <i class='bx bxs-book-open'></i>
                    </div>
                    <div class="class-info">
                        <h3>${displayName}</h3>
                        <p class="subject-code">${displaySubjectCode} - ${displaySection}</p>
                    </div>
                </div>
                
                <div class="class-body">
                    <p class="class-description">${displayDescription}</p>
                </div>
                
                <div class="class-footer">
                    <div class="class-code">
                        <i class='bx bx-key'></i> ${displayClassCode}
                    </div>
                    <div class="student-count">
                        <i class='bx bxs-user'></i> ${classData.students ? classData.students.length : 0}
                    </div>
                </div>
                
                <div class="class-meta">
                    <small>Created: ${createdDate}</small>
                </div>
            </div>
        `;
    }).join('');
}

// ✅ Search function
window.searchClasses = function() {
    const searchInput = document.getElementById('classSearchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    
    console.log('🔍 Searching for:', searchTerm);
    
    // Show/hide clear button
    if (searchTerm.length > 0) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }
    
    // If search is empty, show all classes
    if (searchTerm === '') {
        displayClasses(allClasses);
        return;
    }
    
    // Filter classes
    const filteredClasses = allClasses.filter(classData => {
        const className = (classData.name || '').toLowerCase();
        const classCode = (classData.classCode || '').toLowerCase();
        const subjectCode = (classData.subjectCode || '').toLowerCase();
        const section = (classData.section || '').toLowerCase();
        const description = (classData.description || '').toLowerCase();
        
        return className.includes(searchTerm) || 
               classCode.includes(searchTerm) ||
               subjectCode.includes(searchTerm) ||
               section.includes(searchTerm) ||
               description.includes(searchTerm);
    });
    
    console.log('📊 Found', filteredClasses.length, 'matching classes');
    
    displayClasses(filteredClasses, searchTerm);
};

// ✅ Clear search
window.clearSearch = function() {
    const searchInput = document.getElementById('classSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    searchInput.value = '';
    clearBtn.style.display = 'none';
    
    displayClasses(allClasses);
};

// Generate unique class code
function generateClassCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PLM-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Show create class modal
window.showCreateClassModal = function() {
    document.getElementById('createClassModal').classList.add('show');
};

// Close create class modal
window.closeCreateClassModal = function() {
    document.getElementById('createClassModal').classList.remove('show');
    document.getElementById('createClassForm').reset();
};

// Handle create class form
document.getElementById('createClassForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-create');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Creating...';
    
    try {
        const classCode = generateClassCode();
        
        const classData = {
            name: document.getElementById('className').value.trim(),
            subjectCode: document.getElementById('subjectCode').value.trim(),
            section: document.getElementById('section').value.trim(),
            description: document.getElementById('description').value.trim(),
            classCode: classCode,
            professorId: currentUser.uid,
            professorName: document.getElementById('profName').textContent,
            createdAt: new Date().toISOString(),
            students: [],
            isActive: true
        };
        
        await addDoc(collection(db, 'classes'), classData);
        
        alert(`✅ Class created successfully!\nClass Code: ${classCode}`);
        closeCreateClassModal();
        await loadClasses();
        
    } catch (error) {
        console.error('Error creating class:', error);
        alert('Failed to create class. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bx bx-check"></i> Create Class';
    }
});

// Open class detail page
window.openClass = function(classId) {
    sessionStorage.setItem('currentClassId', classId);
    window.location.href = 'ClassDetail/class-detail.html';
};

// Logout
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = '../../index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};