import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let allStudents = [];
let selectedStudentForKick = null;

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
    
    await loadClassData();
});

// Load class data and students
async function loadClassData() {
    try {
        console.log('📚 Loading class data for:', currentClassId);
        
        const classDoc = await getDoc(doc(db, 'classes', currentClassId));
        
        if (!classDoc.exists()) {
            alert('Class not found');
            window.location.href = '../professor.html';
            return;
        }
        
        currentClassData = { id: classDoc.id, ...classDoc.data() };
        
        // Update UI
        document.getElementById('className').textContent = currentClassData.name;
        document.getElementById('displayClassCode').textContent = currentClassData.classCode;
        
        // Load students
        await loadStudents();
        
    } catch (error) {
        console.error('❌ Error loading class:', error);
        alert('Failed to load class data');
    }
}

// Load all students in the class
async function loadStudents() {
    try {
        console.log('👥 Loading students...');
        
        const loadingState = document.getElementById('loadingState');
        const studentsTable = document.getElementById('studentsTable');
        const emptyState = document.getElementById('emptyState');
        
        loadingState.style.display = 'block';
        studentsTable.style.display = 'none';
        emptyState.style.display = 'none';
        
        const studentIds = currentClassData.students || [];
        
        if (studentIds.length === 0) {
            console.log('⚠️ No students enrolled');
            loadingState.style.display = 'none';
            emptyState.style.display = 'block';
            document.getElementById('studentCount').textContent = '0';
            return;
        }
        
        console.log('📝 Found', studentIds.length, 'student IDs');
        
        // Fetch each student's data
        allStudents = [];
        for (const studentId of studentIds) {
            try {
                const studentDoc = await getDoc(doc(db, 'users', studentId));
                if (studentDoc.exists()) {
                    const studentData = studentDoc.data();
                    allStudents.push({
                        id: studentId,
                        ...studentData
                    });
                }
            } catch (error) {
                console.error('❌ Error loading student:', studentId, error);
            }
        }
        
        console.log('✅ Loaded', allStudents.length, 'students');
        
        // Update count
        document.getElementById('studentCount').textContent = allStudents.length;
        
        // Display students
        displayStudents(allStudents);
        
        loadingState.style.display = 'none';
        studentsTable.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading students:', error);
        document.getElementById('loadingState').innerHTML = `
            <div style="color: #ff4b2b;">
                <i class='bx bx-error-circle' style="font-size: 60px;"></i>
                <p>Failed to load students</p>
                <p style="font-size: 14px; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// Display students in table
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    
    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; opacity: 0.6;">
                    <i class='bx bx-search' style="font-size: 40px; display: block; margin-bottom: 10px;"></i>
                    No students found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = students.map(student => {
        const joinedDate = student.createdAt 
            ? new Date(student.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : 'Unknown';
        
        // Determine avatar display
        let avatarHTML = '';
        if (student.customAvatarURL) {
            avatarHTML = `<img src="${student.customAvatarURL}" alt="${student.fullName}">`;
        } else {
            // Default avatar based on equippedAvatar
            const equippedAvatar = student.equippedAvatar || 'scholar';
            const avatarIcons = {
                'scholar': { icon: 'bxs-face', color: '#ffcc00' },
                'dean': { icon: 'bxs-graduation', color: '#ff7675' },
                'night-owl': { icon: 'bxs-ghost', color: '#a29bfe' },
                'tech-whiz': { icon: 'bxs-cool', color: '#00d4ff' }
            };
            const avatar = avatarIcons[equippedAvatar] || avatarIcons['scholar'];
            avatarHTML = `<i class='bx ${avatar.icon}' style="color: ${avatar.color};"></i>`;
        }
        
        return `
            <tr>
                <td>
                    <div class="student-avatar">
                        ${avatarHTML}
                    </div>
                </td>
                <td>
                    <div class="student-name">${student.fullName || 'Unknown Student'}</div>
                </td>
                <td>
                    <div class="student-id">${student.studentId || 'N/A'}</div>
                </td>
                <td>
                    <div class="student-email">${student.email || 'N/A'}</div>
                </td>
                <td>
                    <div class="date-joined">
                        <i class='bx bx-calendar'></i>
                        ${joinedDate}
                    </div>
                </td>
                <td>
                    <button class="btn-kick-student" onclick="showKickModal('${student.id}', '${student.fullName}', '${student.studentId || 'N/A'}')">
                        <i class='bx bx-user-x'></i> Remove
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayStudents(allStudents);
        return;
    }
    
    const filtered = allStudents.filter(student => {
        const name = (student.fullName || '').toLowerCase();
        const studentId = (student.studentId || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               studentId.includes(searchTerm) || 
               email.includes(searchTerm);
    });
    
    displayStudents(filtered);
});

// Show kick confirmation modal
window.showKickModal = function(studentId, studentName, studentIdNumber) {
    console.log('⚠️ Show kick modal for:', studentName);
    
    selectedStudentForKick = {
        id: studentId,
        name: studentName,
        studentId: studentIdNumber
    };
    
    document.getElementById('kickStudentInfo').innerHTML = `
        <p><strong>Name:</strong> ${studentName}</p>
        <p><strong>Student ID:</strong> ${studentIdNumber}</p>
    `;
    
    document.getElementById('kickModal').classList.add('show');
};

// Close kick modal
window.closeKickModal = function() {
    document.getElementById('kickModal').classList.remove('show');
    selectedStudentForKick = null;
};

// Confirm kick student
document.getElementById('confirmKickBtn').addEventListener('click', async () => {
    if (!selectedStudentForKick) return;
    
    const confirmBtn = document.getElementById('confirmKickBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Removing...';
    
    try {
        console.log('🗑️ Removing student:', selectedStudentForKick.name);
        
        // Remove student from class
        await updateDoc(doc(db, 'classes', currentClassId), {
            students: arrayRemove(selectedStudentForKick.id)
        });
        
        console.log('✅ Student removed successfully');
        
        alert(`✅ ${selectedStudentForKick.name} has been removed from the class.`);
        
        closeKickModal();
        
        // Reload students
        await loadClassData();
        
    } catch (error) {
        console.error('❌ Error removing student:', error);
        alert('Failed to remove student: ' + error.message);
        
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
    
});