import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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

// Global State
let allStudents = [];
let allProfessors = [];
let allClasses = [];
let allQuizzes = [];
let allQuizResults = [];
let pendingAction = null;

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        // Verify admin access
        if (!userData || userData.username !== 'admin') {
            showToast('❌ Access Denied! Admin only.', 'error');
            await signOut(auth);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        console.log('✅ Admin access granted');
        document.getElementById('adminName').textContent = userData.fullName || 'Administrator';
        
        // Load all data
        await loadAllData();
        
    } catch (error) {
        console.error('❌ Auth error:', error);
        showToast('Failed to verify admin access', 'error');
    }
});

// Load All Data
async function loadAllData() {
    try {
        showToast('Loading system data...', 'info');
        
        // Load users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        allStudents = users.filter(u => u.role === 'student');
        allProfessors = users.filter(u => u.role === 'professor');
        
        // Load classes
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        allClasses = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Load quizzes
        const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
        allQuizzes = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Load quiz results
        const resultsSnapshot = await getDocs(collection(db, 'quizResults'));
        allQuizResults = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Update UI
        updateOverviewStats();
        displayStudents(allStudents);
        displayProfessors(allProfessors);
        displayClasses(allClasses);
        displayRecentActivity();
        
        showToast('✅ System data loaded successfully');
        
        console.log('📊 Data loaded:', {
            students: allStudents.length,
            professors: allProfessors.length,
            classes: allClasses.length,
            quizzes: allQuizzes.length,
            results: allQuizResults.length
        });
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast('Failed to load system data: ' + error.message, 'error');
    }
}

// Update Overview Statistics
function updateOverviewStats() {
    const activeStudents = allStudents.filter(s => s.isActive !== false && s.isDeleted !== true).length;
    const activeProfessors = allProfessors.filter(p => p.isActive !== false && p.isDeleted !== true).length;
    const totalUsers = allStudents.length + allProfessors.length;
    
    // Calculate average score
    let avgScore = 0;
    if (allQuizResults.length > 0) {
        const totalPercentage = allQuizResults.reduce((sum, r) => sum + (r.percentage || 0), 0);
        avgScore = Math.round(totalPercentage / allQuizResults.length);
    }
    
    // Update DOM
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('userBreakdown').textContent = `${allStudents.length} Students • ${allProfessors.length} Professors`;
    
    document.getElementById('totalStudents').textContent = allStudents.length;
    document.getElementById('activeStudents').textContent = `${activeStudents} Active`;
    
    document.getElementById('totalProfessors').textContent = allProfessors.length;
    document.getElementById('activeProfessors').textContent = `${activeProfessors} Active`;
    
    document.getElementById('totalClasses').textContent = allClasses.length;
    document.getElementById('activeClasses').textContent = `${allClasses.length} Active`;
    
    document.getElementById('totalQuizzes').textContent = allQuizzes.length;
    document.getElementById('completedQuizzes').textContent = `${allQuizResults.length} Attempts`;
    
    document.getElementById('totalQuizResults').textContent = allQuizResults.length;
    document.getElementById('avgScore').textContent = `Avg: ${avgScore}%`;
    
    // Update counts in other sections
    document.getElementById('studentCount').textContent = allStudents.length;
    document.getElementById('professorCount').textContent = allProfessors.length;
    document.getElementById('classCount').textContent = allClasses.length;
}

// ✅ Display Students with Toggle Button - FIXED TITLES
function displayStudents(students) {
    const container = document.getElementById('studentsList');
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-user-x'></i>
                <p>No students found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = students.map(student => {
        const isActive = student.isActive !== false && student.isDeleted !== true;
        
        return `
            <div class="user-card">
                <div class="user-header">
                    <div class="user-info">
                        <h4>${student.fullName || 'N/A'}</h4>
                        <p><i class='bx bx-envelope'></i> ${student.email}</p>
                        <p><i class='bx bx-user'></i> @${student.username || 'N/A'}</p>
                        <p><i class='bx bx-id-card'></i> ${student.studentId || 'N/A'}</p>
                        <span class="user-status ${isActive ? 'active' : 'inactive'}">
                            <i class='bx ${isActive ? 'bx-check-circle' : 'bx-x-circle'}'></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="user-actions">
                        <button class="action-btn toggle-btn ${isActive ? 'will-disable' : ''}" 
                                data-action="toggle" 
                                data-userid="${student.id}" 
                                data-name="${student.fullName}"
                                data-currentstatus="${isActive}"
                                title="${isActive ? 'Disable Account' : 'Enable Account'}">
                            <i class='bx ${isActive ? 'bx-user-x' : 'bx-user-check'}'></i>
                        </button>
                    </div>
                </div>
                <div class="user-meta">
                    <div class="meta-item">
                        <i class='bx bx-book'></i>
                        ${student.course || 'N/A'}
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-coin-stack' style="color: gold;"></i>
                        ${student.coins || 0} coins
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-star' style="color: cyan;"></i>
                        Level ${student.level || 1}
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-calendar'></i>
                        Joined ${student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ✅ Display Professors with Toggle Button - FIXED TITLES
function displayProfessors(professors) {
    const container = document.getElementById('professorsList');
    
    if (professors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-user-x'></i>
                <p>No professors found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = professors.map(prof => {
        const isActive = prof.isActive !== false && prof.isDeleted !== true;
        const classCount = allClasses.filter(c => c.professorId === prof.id).length;
        
        return `
            <div class="user-card">
                <div class="user-header">
                    <div class="user-info">
                        <h4>${prof.fullName || 'N/A'}</h4>
                        <p><i class='bx bx-envelope'></i> ${prof.email}</p>
                        <p><i class='bx bx-user'></i> @${prof.username || 'N/A'}</p>
                        <span class="user-status ${isActive ? 'active' : 'inactive'}">
                            <i class='bx ${isActive ? 'bx-check-circle' : 'bx-x-circle'}'></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="user-actions">
                        <button class="action-btn toggle-btn ${isActive ? 'will-disable' : ''}" 
                                data-action="toggle" 
                                data-userid="${prof.id}" 
                                data-name="${prof.fullName}"
                                data-currentstatus="${isActive}"
                                title="${isActive ? 'Disable Account' : 'Enable Account'}">
                            <i class='bx ${isActive ? 'bx-user-x' : 'bx-user-check'}'></i>
                        </button>
                    </div>
                </div>
                <div class="user-meta">
                    <div class="meta-item">
                        <i class='bx bx-book-bookmark'></i>
                        ${classCount} class${classCount !== 1 ? 'es' : ''}
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-calendar'></i>
                        Joined ${prof.createdAt ? new Date(prof.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display Classes
function displayClasses(classes) {
    const container = document.getElementById('classesList');
    
    if (classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-book-x'></i>
                <p>No classes found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = classes.map(cls => {
        const professor = allProfessors.find(p => p.id === cls.professorId);
        const studentCount = cls.students?.length || 0;
        const quizCount = allQuizzes.filter(q => q.classId === cls.id).length;
        
        return `
            <div class="class-card">
                <div class="class-header">
                    <div class="class-info">
                        <h4>${cls.name || cls.className || 'Unnamed Class'}</h4>
                        <p><i class='bx bx-code-alt'></i> Code: <strong>${cls.classCode}</strong></p>
                        <p><i class='bx bx-user'></i> Professor: ${professor?.fullName || 'Unknown'}</p>
                        <p><i class='bx bx-book'></i> ${cls.courseCode || 'N/A'} - ${cls.section || 'N/A'}</p>
                    </div>
                    <div class="user-actions">
                        <button class="action-btn view-btn" 
                                data-action="viewclass" 
                                data-classid="${cls.id}"
                                title="View Details">
                            <i class='bx bx-show'></i>
                        </button>
                        <button class="action-btn delete-btn" 
                                data-action="deleteclass" 
                                data-classid="${cls.id}" 
                                data-classname="${(cls.name || cls.className || 'Unnamed Class').replace(/"/g, '&quot;')}" 
                                data-classcode="${cls.classCode}"
                                title="Delete Class">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>
                <div class="class-stats">
                    <div class="stat-item-small">
                        <div class="value">${studentCount}</div>
                        <div class="label">Students</div>
                    </div>
                    <div class="stat-item-small">
                        <div class="value">${quizCount}</div>
                        <div class="label">Quizzes</div>
                    </div>
                    <div class="stat-item-small">
                        <div class="value">${cls.semester || 'N/A'}</div>
                        <div class="label">Semester</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display Recent Activity
function displayRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    const activities = [];
    
    const recentUsers = [...allStudents, ...allProfessors]
        .filter(u => u.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    recentUsers.forEach(user => {
        activities.push({
            icon: user.role === 'student' ? 'bxs-graduation' : 'bxs-briefcase-alt-2',
            text: `<strong>${user.fullName}</strong> registered as ${user.role}`,
            time: new Date(user.createdAt),
            type: 'user'
        });
    });
    
    const recentResults = allQuizResults
        .filter(r => r.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5);
    
    recentResults.forEach(result => {
        activities.push({
            icon: 'bxs-file-doc',
            text: `<strong>${result.userName}</strong> completed quiz "${result.quizTitle}" (${result.percentage}%)`,
            time: new Date(result.completedAt),
            type: 'quiz'
        });
    });
    
    activities.sort((a, b) => b.time - a.time);
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-time'></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class='bx ${activity.icon}'></i>
            </div>
            <div class="activity-content">
                <p>${activity.text}</p>
                <small>${formatTimeAgo(activity.time)}</small>
            </div>
        </div>
    `).join('');
}

// ✅ UPDATED: Toggle Account Status Modal with proper messaging
function showToggleModal(userId, name, currentStatus) {
    const isActive = currentStatus === 'true';
    pendingAction = { type: 'toggle', userId, name, willDisable: isActive };
    
    document.getElementById('modalIcon').style.display = 'block';
    document.getElementById('modalTitle').style.display = 'block';
    document.getElementById('modalIcon').textContent = isActive ? '🚫' : '✅';
    document.getElementById('modalTitle').textContent = isActive ? 'Disable Account' : 'Enable Account';
    document.getElementById('modalMessage').innerHTML = `
        ${isActive ? 'Disable' : 'Enable'} account for <strong>${name}</strong>?<br><br>
        <small style="opacity: 0.7;">
            ${isActive 
                ? '⚠️ User will not be able to login until re-enabled.' 
                : '✅ User will regain full access to the system.'}
        </small>
    `;
    document.querySelector('.modal-actions').innerHTML = `
        <button class="modal-btn cancel" id="modalCancelBtn">Cancel</button>
        <button class="modal-btn confirm" id="modalConfirmBtn" style="background: ${isActive ? '#ff4b2b' : '#00ff88'};">${isActive ? 'Disable' : 'Enable'}</button>
    `;
    document.getElementById('confirmModal').classList.add('show');
}

// ✅ COMPLETELY FIXED: View Class Details Modal
function viewClassDetails(classId) {
    const classData = allClasses.find(c => c.id === classId);
    if (!classData) return;
    
    const professor = allProfessors.find(p => p.id === classData.professorId);
    const classQuizzes = allQuizzes.filter(q => q.classId === classId);
    const classStudents = classData.students || [];
    const className = classData.name || classData.className || classData.title || 'Unnamed Class';
    
    // ✅ Build the modal content
    let modalContent = `
        <div style="text-align: left; max-height: 70vh; overflow-y: auto; padding-right: 10px;" class="modal-scroll-section">
            <!-- Header -->
            <div style="margin-bottom: 25px; padding: 20px; background: rgba(0,212,255,0.1); border-radius: 12px; border-left: 4px solid #00d4ff;">
                <h3 style="color: #00d4ff; margin: 0 0 12px 0; font-size: 24px; font-weight: 700;">${className}</h3>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <p style="opacity: 0.9; margin: 0; font-size: 13px;"><i class='bx bx-code-alt'></i> <strong>Code:</strong> ${classData.classCode}</p>
                    <p style="opacity: 0.9; margin: 0; font-size: 13px;"><i class='bx bx-book'></i> <strong>Course:</strong> ${classData.courseCode || 'N/A'}</p>
                    <p style="opacity: 0.9; margin: 0; font-size: 13px;"><i class='bx bx-section'></i> <strong>Section:</strong> ${classData.section || 'N/A'}</p>
                    <p style="opacity: 0.9; margin: 0; font-size: 13px;"><i class='bx bx-calendar'></i> <strong>Semester:</strong> ${classData.semester || 'N/A'}</p>
                </div>
            </div>
            
            <!-- Professor Section -->
            <div style="margin-bottom: 25px;">
                <h4 style="color: #00d4ff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                    <i class='bx bxs-briefcase-alt-2'></i> Professor
                </h4>
    `;
    
    if (professor) {
        const profActive = professor.isActive !== false && professor.isDeleted !== true;
        modalContent += `
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 10px;">
                    <p style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${professor.fullName}</p>
                    <p style="font-size: 12px; opacity: 0.7; margin-bottom: 6px;">${professor.email}</p>
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; background: ${profActive ? 'rgba(0,255,136,0.2)' : 'rgba(255,75,43,0.2)'}; color: ${profActive ? '#00ff88' : '#ff4b2b'};">
                        ${profActive ? '✓ Active' : '✗ Disabled'}
                    </span>
                </div>
        `;
    } else {
        modalContent += `<p style="opacity: 0.6; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; text-align: center; font-size: 13px;">No professor assigned</p>`;
    }
    
    modalContent += `
            </div>
            
            <!-- Students Section with Max 3 Rows (6 students visible) -->
            <div style="margin-bottom: 25px;">
                <h4 style="color: #00d4ff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                    <i class='bx bxs-graduation'></i> Students (${classStudents.length})
                </h4>
    `;
    
    if (classStudents.length > 0) {
        // ✅ Scrollable container - shows ~3 rows (6 students) then scrolls
        modalContent += `<div style="max-height: 240px; overflow-y: auto; padding-right: 6px;" class="modal-scroll-section">
                           <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">`;
        
        classStudents.forEach(studentId => {
            const student = allStudents.find(s => s.id === studentId);
            if (student) {
                const studActive = student.isActive !== false && student.isDeleted !== true;
                modalContent += `
    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
        <p style="font-weight: 600; margin-bottom: 3px; font-size: 13px;">${student.fullName}</p>
        <p style="font-size: 11px; opacity: 0.7; margin-bottom: 3px;">${student.email}</p>
        <p style="font-size: 11px; opacity: 0.6; margin-bottom: 6px;"><i class='bx bx-id-card' style="font-size: 12px;"></i> ${student.studentId || 'N/A'}</p>
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; background: ${studActive ? 'rgba(0,255,136,0.2)' : 'rgba(255,75,43,0.2)'}; color: ${studActive ? '#00ff88' : '#ff4b2b'};">
                            ${studActive ? '✓ Active' : '✗ Disabled'}
                        </span>
                    </div>
                `;
            }
        });
        
        modalContent += `</div></div>`;
    } else {
        modalContent += `<p style="opacity: 0.6; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; text-align: center; font-size: 13px;">No students enrolled</p>`;
    }
    
    modalContent += `
            </div>
            
            <!-- Quizzes Section with Max 3 Quizzes Visible -->
            <div>
                <h4 style="color: #00d4ff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                    <i class='bx bxs-file-doc'></i> Quizzes (${classQuizzes.length})
                </h4>
                <!-- ✅ Scrollable container - shows ~3 quizzes then scrolls -->
                <div style="max-height: 230px; overflow-y: auto; padding-right: 6px;" class="modal-scroll-section">
    `;
    
    if (classQuizzes.length > 0) {
        classQuizzes.forEach(quiz => {
            const completedCount = allQuizResults.filter(r => r.quizId === quiz.id).length;
            modalContent += `
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 10px; margin-bottom: 10px; border-left: 3px solid #9c27b0;">
                    <p style="font-weight: 600; margin-bottom: 6px; font-size: 14px; color: #00d4ff;">${quiz.title}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; opacity: 0.8;">
                        <span><i class='bx bx-code-alt'></i> ${quiz.code}</span>
                        <span><i class='bx bx-question-mark'></i> ${quiz.questions?.length || 0} questions</span>
                        <span><i class='bx bx-check-circle' style="color: #00ff88;"></i> ${completedCount} completions</span>
                    </div>
                </div>
            `;
        });
    } else {
        modalContent += `<p style="opacity: 0.6; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; text-align: center; font-size: 13px;">No quizzes created yet</p>`;
    }
    
    modalContent += `
                </div>
            </div>
        </div>
    `;
    
    // ✅ Hide default modal icon/title
    document.getElementById('modalIcon').style.display = 'none';
    document.getElementById('modalTitle').style.display = 'none';
    
    // ✅ Set the modal message content
    document.getElementById('modalMessage').innerHTML = modalContent;
    
    // ✅ Create ONLY the X button in modal actions
    document.querySelector('.modal-actions').innerHTML = `
        <button onclick="closeModal()" style="width: 45px; height: 45px; border-radius: 50%; background: rgba(255,75,43,0.2); border: 2px solid #ff4b2b; color: #ff4b2b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: 0.3s; margin: 0 auto;" onmouseover="this.style.background='#ff4b2b'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,75,43,0.2)'; this.style.color='#ff4b2b';">
            <i class='bx bx-x'></i>
        </button>
    `;
    
    // ✅ Show modal
    document.getElementById('confirmModal').classList.add('show');
}

// ✅ Global close function
window.closeModal = function() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
};

// ✅ Global close function
window.closeModal = function() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
};

// ✅ Make closeModal globally accessible
window.closeModal = function() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
};

// ✅ Show Delete Class Modal with compact design
function showDeleteClassModal(classId, className, classCode) {
    const quizCount = allQuizzes.filter(q => q.classId === classId).length;
    const studentCount = allClasses.find(c => c.id === classId)?.students?.length || 0;
    
    // Count quiz results that will be deleted
    const classQuizIds = allQuizzes.filter(q => q.classId === classId).map(q => q.id);
    const resultCount = allQuizResults.filter(r => classQuizIds.includes(r.quizId)).length;
    
    pendingAction = { type: 'deleteClass', classId, className, classCode };
    
    document.getElementById('modalIcon').style.display = 'block';
    document.getElementById('modalTitle').style.display = 'block';
    document.getElementById('modalIcon').textContent = '⚠️';
    document.getElementById('modalTitle').textContent = 'Delete Class Permanently';
    document.getElementById('modalMessage').innerHTML = `
        <p style="margin-bottom: 12px; font-size: 13px;">Are you sure you want to <strong style="color: #ff4b2b;">permanently delete</strong> this class?</p>
        
        <div style="background: rgba(255,75,43,0.1); padding: 12px; border-radius: 10px; border-left: 3px solid #ff4b2b; text-align: left; margin: 15px 0;">
            <p style="margin-bottom: 5px; font-weight: 600; font-size: 14px;">📚 Class: <strong>"${className}"</strong></p>
            <p style="margin: 0; font-size: 13px;">🔑 Code: <strong>${classCode}</strong></p>
        </div>
        
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 10px; text-align: left; margin: 15px 0;">
            <p style="color: #ff4b2b; font-weight: 600; margin-bottom: 8px; font-size: 13px;">⚠️ This will permanently delete:</p>
            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 4px 0; font-size: 13px;">📝 <strong>${quizCount}</strong> quiz${quizCount !== 1 ? 'zes' : ''}</li>
                <li style="padding: 4px 0; font-size: 13px;">📊 <strong>${resultCount}</strong> quiz result${resultCount !== 1 ? 's' : ''}</li>
                <li style="padding: 4px 0; font-size: 13px;">👥 <strong>${studentCount}</strong> student enrollment${studentCount !== 1 ? 's' : ''}</li>
            </ul>
        </div>
        
        <p style="color: #ff4b2b; font-weight: 600; font-size: 12px; margin: 12px 0 0 0;">
            ⚠️ This action cannot be undone!
        </p>
    `;
    document.querySelector('.modal-actions').innerHTML = `
        <button class="modal-btn cancel" id="modalCancelBtn">Cancel</button>
        <button class="modal-btn confirm" id="modalConfirmBtn" style="background: #ff4b2b;">Delete Permanently</button>
    `;
    document.getElementById('confirmModal').classList.add('show');
}

// Close Modal
function closeModal() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
}

// ✅ FIXED: Confirm Action with Toggle Support
async function confirmAction() {
    if (!pendingAction) return;
    
    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (!confirmBtn) return;
    
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processing...';
    
    try {
        if (pendingAction.type === 'toggle') {
            // Toggle account active/disabled status
            const willDisable = pendingAction.willDisable;
            
            await updateDoc(doc(db, 'users', pendingAction.userId), {
                isActive: !willDisable,
                isDeleted: willDisable,
                [willDisable ? 'disabledAt' : 'enabledAt']: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedBy: 'admin'
            });
            
            showToast(`✅ Account ${willDisable ? 'disabled' : 'enabled'}: ${pendingAction.name}`);
            
        } else if (pendingAction.type === 'deleteClass') {
            // ✅ COMPLETE CLASS DELETION PROCESS
            console.log('🗑️ Starting class deletion:', pendingAction.classId);
            
            // Step 1: Delete the class document
            await deleteDoc(doc(db, 'classes', pendingAction.classId));
            console.log('✅ Class document deleted');
            
            // Step 2: Delete all quizzes associated with this class
            const classQuizzes = allQuizzes.filter(q => q.classId === pendingAction.classId);
            console.log(`📝 Found ${classQuizzes.length} quizzes to delete`);
            
            for (const quiz of classQuizzes) {
                await deleteDoc(doc(db, 'quizzes', quiz.id));
                console.log(`✅ Deleted quiz: ${quiz.title}`);
            }
            
            // Step 3: Delete all quiz results for these quizzes
            const quizIds = classQuizzes.map(q => q.id);
            const resultsToDelete = allQuizResults.filter(r => quizIds.includes(r.quizId));
            console.log(`📊 Found ${resultsToDelete.length} quiz results to delete`);
            
            for (const result of resultsToDelete) {
                await deleteDoc(doc(db, 'quizResults', result.id));
                console.log(`✅ Deleted quiz result for: ${result.userName}`);
            }
            
            showToast(`✅ Class deleted: ${pendingAction.className} (including ${classQuizzes.length} quizzes and ${resultsToDelete.length} results)`);
        }
        
        closeModal();
        await loadAllData();
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('❌ Failed: ' + error.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm';
    }
}

// ✅ Event delegation for all button clicks
document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.dataset.action;
    
    if (action === 'toggle') {
        e.preventDefault();
        showToggleModal(btn.dataset.userid, btn.dataset.name, btn.dataset.currentstatus);
    } else if (action === 'viewclass') {
        e.preventDefault();
        viewClassDetails(btn.dataset.classid);
    } else if (action === 'deleteclass') {
        e.preventDefault();
        showDeleteClassModal(btn.dataset.classid, btn.dataset.classname, btn.dataset.classcode);
    }
    
    if (btn.id === 'modalCancelBtn' || btn.id === 'modalCloseBtn') {
        e.preventDefault();
        closeModal();
    } else if (btn.id === 'modalConfirmBtn') {
        e.preventDefault();
        confirmAction();
    }
});

// Search Functions
document.getElementById('studentSearch').addEventListener('keyup', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = allStudents.filter(s => 
        s.fullName?.toLowerCase().includes(searchTerm) ||
        s.email?.toLowerCase().includes(searchTerm) ||
        s.username?.toLowerCase().includes(searchTerm) ||
        s.studentId?.toLowerCase().includes(searchTerm)
    );
    displayStudents(filtered);
});

document.getElementById('professorSearch').addEventListener('keyup', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = allProfessors.filter(p => 
        p.fullName?.toLowerCase().includes(searchTerm) ||
        p.email?.toLowerCase().includes(searchTerm) ||
        p.username?.toLowerCase().includes(searchTerm)
    );
    displayProfessors(filtered);
});

document.getElementById('classSearch').addEventListener('keyup', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = allClasses.filter(c => {
        const professor = allProfessors.find(p => p.id === c.professorId);
        return c.className?.toLowerCase().includes(searchTerm) ||
               c.classCode?.toLowerCase().includes(searchTerm) ||
               professor?.fullName?.toLowerCase().includes(searchTerm);
    });
    displayClasses(filtered);
});

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        
        this.classList.add('active');
        const sectionId = this.dataset.section + '-section';
        document.getElementById(sectionId).classList.add('active');
    });
});

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        this.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async function() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Failed to logout', 'error');
    }
});

// Utility Functions
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    if (type === 'error') {
        toast.style.background = 'rgba(255, 75, 43, 0.95)';
    } else if (type === 'info') {
        toast.style.background = 'rgba(255, 193, 7, 0.95)';
    } else {
        toast.style.background = 'rgba(0, 212, 255, 0.95)';
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    
    return date.toLocaleDateString();
}

console.log('✅ Admin dashboard initialized with toggle functionality');