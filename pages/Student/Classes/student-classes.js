import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let userClasses = []; // ✅ Store all classes globally for search

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
    
    await loadStudentClasses();
});

async function loadStudentClasses() {
    try {
        console.log('📚 Loading student classes for:', currentUser.uid);
        
        document.getElementById('loadingState').style.display = 'block';
        
        const classesRef = collection(db, 'classes');
        const q = query(classesRef, where('students', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        
        document.getElementById('loadingState').style.display = 'none';
        
        if (snapshot.empty) {
            console.log('⚠️ No classes found');
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('classesGrid').innerHTML = '';
            return;
        }
        
        console.log('✅ Found', snapshot.size, 'classes');
        
        // ✅ Store classes globally for search
        userClasses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayClasses(userClasses);
        document.getElementById('emptyState').style.display = 'none';
        
    } catch (error) {
        console.error('❌ Error loading classes:', error);
        document.getElementById('loadingState').innerHTML = `
            <div style="color: #ff4b2b;">
                <i class='bx bx-error-circle' style="font-size: 60px;"></i>
                <p>Failed to load classes</p>
                <p style="font-size: 14px; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// ✅ NEW: Search function
window.searchClasses = function() {
    const searchInput = document.getElementById('classSearchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    const noResultsDiv = document.getElementById('noSearchResults');
    const classesGrid = document.getElementById('classesGrid');
    
    // Show/hide clear button
    if (searchTerm.length > 0) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }
    
    // If search is empty, show all classes
    if (searchTerm === '') {
        displayClasses(userClasses);
        noResultsDiv.style.display = 'none';
        classesGrid.style.display = 'grid';
        return;
    }
    
    // Filter classes by name or class code
    const filteredClasses = userClasses.filter(classData => {
        const className = (classData.name || '').toLowerCase();
        const classCode = (classData.classCode || '').toLowerCase();
        const subjectCode = (classData.subjectCode || '').toLowerCase();
        const section = (classData.section || '').toLowerCase();
        
        return className.includes(searchTerm) || 
               classCode.includes(searchTerm) ||
               subjectCode.includes(searchTerm) ||
               section.includes(searchTerm);
    });
    
    console.log('🔍 Search term:', searchTerm);
    console.log('📊 Found', filteredClasses.length, 'matching classes');
    
    if (filteredClasses.length === 0) {
        classesGrid.style.display = 'none';
        noResultsDiv.style.display = 'block';
    } else {
        classesGrid.style.display = 'grid';
        noResultsDiv.style.display = 'none';
        displayClasses(filteredClasses, searchTerm);
    }
};

// ✅ NEW: Clear search
window.clearSearch = function() {
    const searchInput = document.getElementById('classSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const noResultsDiv = document.getElementById('noSearchResults');
    const classesGrid = document.getElementById('classesGrid');
    
    searchInput.value = '';
    clearBtn.style.display = 'none';
    noResultsDiv.style.display = 'none';
    classesGrid.style.display = 'grid';
    
    displayClasses(userClasses);
};

// ✅ UPDATED: Display classes with optional highlighting
function displayClasses(classes, searchTerm = '') {
    const grid = document.getElementById('classesGrid');
    
    grid.innerHTML = classes.map(classData => {
        const createdDate = new Date(classData.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const studentCount = classData.students ? classData.students.length : 0;
        
        // ✅ Highlight matching text
        const highlightText = (text, term) => {
            if (!term) return text;
            const regex = new RegExp(`(${term})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        };
        
        const displayName = highlightText(classData.name, searchTerm);
        const displayCode = highlightText(classData.classCode, searchTerm);
        const displaySubjectCode = highlightText(classData.subjectCode, searchTerm);
        const displaySection = highlightText(classData.section, searchTerm);
        
        return `
            <div class="class-card" onclick="viewClass('${classData.id}')">
                <div class="class-header">
                    <div>
                        <div class="class-title">${displayName}</div>
                    </div>
                    <div class="class-code-badge">
                        <i class='bx bx-key'></i> ${displayCode}
                    </div>
                </div>
                
                <div class="class-details">
                    <p><i class='bx bx-book'></i> ${displaySubjectCode}</p>
                    <p><i class='bx bx-group'></i> Section: ${displaySection}</p>
                    <p><i class='bx bx-user'></i> ${studentCount} student${studentCount !== 1 ? 's' : ''}</p>
                    <p><i class='bx bx-calendar'></i> Joined: ${createdDate}</p>
                </div>
                
                <div class="class-footer">
                    <button class="btn-view-class" onclick="event.stopPropagation(); viewClass('${classData.id}')">
                        <i class='bx bx-right-arrow-alt'></i> View Class
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Join class with code
window.joinClass = async function() {
    const codeInput = document.getElementById('classCodeInput');
    const code = codeInput.value.trim().toUpperCase();
    const errorDiv = document.getElementById('joinError');
    
    errorDiv.style.display = 'none';
    
    if (!code) {
        errorDiv.textContent = '⚠️ Please enter a class code';
        errorDiv.style.display = 'block';
        return;
    }
    
    const joinBtn = document.querySelector('.btn-join');
    const originalText = joinBtn.innerHTML;
    joinBtn.disabled = true;
    joinBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Joining...';
    
    try {
        console.log('🔍 Searching for class with code:', code);
        
        const classesRef = collection(db, 'classes');
        const q = query(classesRef, where('classCode', '==', code));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            errorDiv.textContent = '❌ Invalid class code. Please check and try again.';
            errorDiv.style.display = 'block';
            throw new Error('Class not found');
        }
        
        const classDoc = snapshot.docs[0];
        const classData = classDoc.data();
        const classId = classDoc.id;
        
        console.log('✅ Found class:', classData.name);
        
        if (classData.students && classData.students.includes(currentUser.uid)) {
            errorDiv.textContent = 'ℹ️ You are already enrolled in this class!';
            errorDiv.style.display = 'block';
            errorDiv.style.color = '#ffd700';
            throw new Error('Already enrolled');
        }
        
        await updateDoc(doc(db, 'classes', classId), {
            students: arrayUnion(currentUser.uid)
        });
        
        console.log('✅ Successfully joined class');
        
        document.getElementById('successMessage').innerHTML = `
            You've been enrolled in:<br>
            <strong style="color: #00d4ff; font-size: 20px;">${classData.name}</strong><br>
            <span style="opacity: 0.8;">${classData.subjectCode} - ${classData.section}</span>
        `;
        document.getElementById('successModal').classList.add('show');
        
        codeInput.value = '';
        
        setTimeout(() => {
            loadStudentClasses();
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error joining class:', error);
        if (error.message !== 'Class not found' && error.message !== 'Already enrolled') {
            errorDiv.textContent = '❌ Failed to join class. Please try again.';
            errorDiv.style.display = 'block';
        }
    } finally {
        joinBtn.disabled = false;
        joinBtn.innerHTML = originalText;
    }
};

window.viewClass = function(classId) {
    console.log('👁️ Viewing class:', classId);
    sessionStorage.setItem('currentClassId', classId);
    window.location.href = 'class-view.html';
};

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.remove('show');
};

window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = '../../../index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};