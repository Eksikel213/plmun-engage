import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
let userData = null;
let originalData = {};
let newAvatarFile = null;
let isUploading = false;

// ✅ NEW: Store original dyslexia state when entering edit mode
let originalDyslexiaState = false;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log('❌ No user logged in, redirecting...');
        window.location.href = '../../../index.html';
        return;
    }
    
    console.log('✅ User logged in:', user.uid);
    currentUser = user;
    await loadUserData();
    await loadStatistics();
});

async function loadUserData() {
    try {
        console.log('📊 Loading user data for:', currentUser.uid);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            userData = userDoc.data();
            console.log('✅ User data loaded:', userData);
            console.log('🖼️ Avatar URL from Firestore:', userData.customAvatarURL);
            
            document.getElementById('coin-count').textContent = userData.coins || 100;
            document.getElementById('level').textContent = userData.level || 1;
            
            document.getElementById('displayName').textContent = userData.fullName || 'Student';
            document.getElementById('displayEmail').textContent = userData.email || currentUser.email;
            document.getElementById('displayLevel').textContent = userData.level || 1;
            
            originalData = {
                fullName: userData.fullName || '',
                username: userData.username || '',
                studentId: userData.studentId || '',
                course: userData.course || '',
                yearLevel: userData.yearLevel || ''
            };
            
            document.getElementById('fullName').value = originalData.fullName;
            document.getElementById('username').value = originalData.username;
            document.getElementById('email').value = userData.email || currentUser.email;
            document.getElementById('studentId').value = originalData.studentId;
            document.getElementById('course').value = originalData.course;
            document.getElementById('yearLevel').value = originalData.yearLevel;
            
            if (userData.createdAt) {
                const date = new Date(userData.createdAt);
                document.getElementById('memberSince').textContent = date.getFullYear();
            }
            
            displayAvatar(userData);
        } else {
            console.error('❌ User document does not exist in Firestore!');
            alert('Profile data not found. Please contact support.');
        }
    } catch (error) {
        console.error('❌ Error loading user data:', error);
        alert('Failed to load profile: ' + error.message);
    }
}

function displayAvatar(userData) {
    const customImg = document.getElementById('customAvatarImg');
    const iconEl = document.getElementById('profileAvatar');
    
    console.log('🎨 displayAvatar called');
    console.log('🖼️ customAvatarURL:', userData.customAvatarURL);
    
    customImg.onload = null;
    customImg.onerror = null;
    
    if (userData.customAvatarURL && userData.customAvatarURL.trim().length > 0) {
        console.log('✅ Custom avatar URL exists, loading...');
        
        customImg.src = userData.customAvatarURL;
        customImg.crossOrigin = 'anonymous';
        customImg.style.display = 'block';
        iconEl.style.display = 'none';
        
        customImg.onload = function() {
            console.log('✅ Avatar loaded successfully!');
        };
        
        customImg.onerror = function() {
            console.error('❌ Failed to load avatar, retrying...');
            if (!customImg.src.includes('?retry=')) {
                customImg.src = userData.customAvatarURL + '?retry=' + Date.now();
            } else {
                console.log('⚠️ Retry failed, showing default');
                customImg.style.display = 'none';
                iconEl.style.display = 'block';
                showDefaultAvatar(userData, iconEl);
            }
        };
    } else {
        console.log('ℹ️ No custom avatar, showing default');
        customImg.style.display = 'none';
        iconEl.style.display = 'block';
        showDefaultAvatar(userData, iconEl);
    }
}

function showDefaultAvatar(userData, iconEl) {
    const equippedAvatar = userData.equippedAvatar || 'scholar';
    const avatarIcons = {
        'scholar': { icon: 'bxs-face', color: '#ffcc00' },
        'dean': { icon: 'bxs-graduation', color: '#ff7675' },
        'night-owl': { icon: 'bxs-ghost', color: '#a29bfe' },
        'tech-whiz': { icon: 'bxs-cool', color: '#00d4ff' }
    };
    const avatar = avatarIcons[equippedAvatar] || avatarIcons['scholar'];
    iconEl.className = `bx ${avatar.icon}`;
    iconEl.style.color = avatar.color;
    iconEl.style.display = 'block';
}

async function loadStatistics() {
    try {
        const resultsRef = collection(db, 'quizResults');
        const q = query(resultsRef, where('userId', '==', currentUser.uid));
        const resultsSnapshot = await getDocs(q);
        
        if (!resultsSnapshot.empty) {
            const results = resultsSnapshot.docs.map(doc => doc.data());
            
            const totalQuizzes = results.length;
            const totalScore = results.reduce((sum, r) => sum + r.score, 0);
            const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
            const avgPercentage = Math.round((totalScore / totalQuestions) * 100);
            const totalCoins = results.reduce((sum, r) => sum + (r.coinsEarned || 0), 0);
            
            document.getElementById('totalQuizzes').textContent = totalQuizzes;
            document.getElementById('avgScore').textContent = avgPercentage + '%';
            document.getElementById('totalCoinsEarned').textContent = totalCoins;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

window.enableEditMode = function() {
    console.log('🔓 Enabling edit mode');
    
    // ✅ SAVE ORIGINAL DYSLEXIA STATE BEFORE ALLOWING CHANGES
    originalDyslexiaState = document.body.classList.contains('dyslexia-mode');
    console.log('💾 Saved original dyslexia state:', originalDyslexiaState);
    
    document.getElementById('fullName').disabled = false;
    document.getElementById('username').disabled = false;
    document.getElementById('studentId').disabled = false;
    document.getElementById('course').disabled = false;
    document.getElementById('yearLevel').disabled = false;
    
    document.getElementById('modeIndicator').textContent = 'Editing your profile';
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('formActions').style.display = 'flex';
    document.getElementById('avatarUploadBtn').style.display = 'flex';
    
    // ✅ Sync toggle switch with CURRENT dyslexia state
    setTimeout(() => {
        const isDyslexiaMode = document.body.classList.contains('dyslexia-mode');
        const toggleSwitch = document.getElementById('toggleSwitch');
        const checkbox = document.getElementById('dyslexiaToggle');
        
        if (isDyslexiaMode && toggleSwitch) {
            toggleSwitch.classList.add('active');
        }
        if (isDyslexiaMode && checkbox) {
            checkbox.checked = true;
        }
    }, 100);
    
    document.querySelectorAll('.form-group input:not([disabled]), .form-group select:not([disabled])').forEach(el => {
        el.style.borderColor = '#00d4ff';
        el.style.background = 'rgba(0, 212, 255, 0.1)';
    });
};

window.triggerAvatarUpload = function() {
    document.getElementById('avatarInput').click();
};

window.handleAvatarUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📷 File selected:', file.name, `(${(file.size / 1024).toFixed(0)}KB)`);
    
    if (!file.type.startsWith('image/')) {
        alert('❌ Please upload an image file (JPG, PNG, etc.)');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('❌ Image size must be less than 10MB');
        return;
    }
    
    console.log('📸 Compressing image...');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const maxSize = 800;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        console.error('❌ Failed to compress image');
                        alert('Failed to process image. Please try another file.');
                        return;
                    }
                    
                    newAvatarFile = blob;
                    
                    console.log('✅ Compressed:', `${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB`);
                    
                    const customImg = document.getElementById('customAvatarImg');
                    const iconEl = document.getElementById('profileAvatar');
                    
                    customImg.src = canvas.toDataURL('image/jpeg', 0.8);
                    customImg.style.display = 'block';
                    iconEl.style.display = 'none';
                    
                    console.log('✅ Preview updated');
                }, 'image/jpeg', 0.8);
            } catch (error) {
                console.error('❌ Image processing error:', error);
                alert('Failed to process image: ' + error.message);
            }
        };
        
        img.onerror = function() {
            console.error('❌ Failed to load image');
            alert('Failed to load image. Please try another file.');
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        console.error('❌ Failed to read file');
        alert('Failed to read file. Please try again.');
    };
    
    reader.readAsDataURL(file);
};

// ✅ FIXED: Cancel Edit - Revert EVERYTHING including dyslexia mode
window.cancelEdit = function() {
    console.log('❌ Cancelling edit mode');
    
    // ✅ 1. REVERT FORM DATA
    document.getElementById('fullName').value = originalData.fullName;
    document.getElementById('username').value = originalData.username;
    document.getElementById('studentId').value = originalData.studentId;
    document.getElementById('course').value = originalData.course;
    document.getElementById('yearLevel').value = originalData.yearLevel;
    
    // ✅ 2. REVERT DYSLEXIA MODE TO ORIGINAL STATE
    const currentDyslexiaState = document.body.classList.contains('dyslexia-mode');
    
    if (currentDyslexiaState !== originalDyslexiaState) {
        console.log('🔄 Reverting dyslexia mode from', currentDyslexiaState, 'to', originalDyslexiaState);
        
        if (originalDyslexiaState) {
            // Should be ON, but currently OFF → Turn it back ON
            document.body.classList.add('dyslexia-mode');
            localStorage.setItem('dyslexiaMode', 'true');
        } else {
            // Should be OFF, but currently ON → Turn it back OFF
            document.body.classList.remove('dyslexia-mode');
            localStorage.setItem('dyslexiaMode', 'false');
            
            // Hide badge if turning off
            const badge = document.getElementById('dyslexiaBadge');
            if (badge) {
                badge.style.display = 'none';
            }
        }
        
        console.log('✅ Dyslexia mode reverted to original state');
    } else {
        console.log('ℹ️ Dyslexia mode unchanged, no revert needed');
    }
    
    // ✅ 3. UPDATE TOGGLE SWITCH TO MATCH REVERTED STATE
    const toggleSwitch = document.getElementById('toggleSwitch');
    const checkbox = document.getElementById('dyslexiaToggle');
    
    if (originalDyslexiaState) {
        if (toggleSwitch) toggleSwitch.classList.add('active');
        if (checkbox) checkbox.checked = true;
    } else {
        if (toggleSwitch) toggleSwitch.classList.remove('active');
        if (checkbox) checkbox.checked = false;
    }
    
    // ✅ 4. DISABLE FORM FIELDS
    document.getElementById('fullName').disabled = true;
    document.getElementById('username').disabled = true;
    document.getElementById('studentId').disabled = true;
    document.getElementById('course').disabled = true;
    document.getElementById('yearLevel').disabled = true;
    
    // ✅ 5. RESET UI STATE
    document.getElementById('modeIndicator').textContent = 'Viewing your profile details';
    document.getElementById('editBtn').style.display = 'inline-flex';
    document.getElementById('formActions').style.display = 'none';
    document.getElementById('avatarUploadBtn').style.display = 'none';
    
    const submitBtn = document.querySelector('.btn-primary');
    submitBtn.innerHTML = '<i class="bx bx-save"></i> Save Changes';
    submitBtn.disabled = false;
    
    // ✅ 6. RESET AVATAR PREVIEW
    newAvatarFile = null;
    isUploading = false;
    displayAvatar(userData);
    
    // ✅ 7. RESET FIELD STYLING
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
        el.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        el.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    
    console.log('✅ All changes cancelled and reverted');
};

async function uploadToCloudinary(imageBlob) {
    console.log('📤 Uploading to Cloudinary...');
    
    try {
        const formData = new FormData();
        formData.append('file', imageBlob);
        formData.append('upload_preset', 'ml_default');
        
        const response = await fetch('https://api.cloudinary.com/v1_1/dkrjfwkwx/image/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Cloudinary error:', errorData);
            throw new Error(`Cloudinary error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        console.log('✅ Cloudinary upload success!');
        console.log('📷 Image URL:', data.secure_url);
        return data.secure_url;
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        throw error;
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isUploading) {
        console.log('⚠️ Upload already in progress');
        return;
    }
    
    isUploading = true;
    
    const submitBtn = e.target.querySelector('.btn-primary');
    const originalText = submitBtn.innerHTML;
    
    try {
        let avatarURL = userData.customAvatarURL || null;
        
        if (newAvatarFile) {
            submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Uploading image...';
            submitBtn.disabled = true;
            
            console.log('📤 Uploading avatar...');
            avatarURL = await uploadToCloudinary(newAvatarFile);
            console.log('✅ Avatar uploaded:', avatarURL);
        }
        
        submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving profile...';
        
        const updatedData = {
            fullName: document.getElementById('fullName').value.trim(),
            username: document.getElementById('username').value.trim(),
            studentId: document.getElementById('studentId').value.trim(),
            course: document.getElementById('course').value,
            yearLevel: document.getElementById('yearLevel').value,
            updatedAt: new Date().toISOString()
        };
        
        if (avatarURL) {
            updatedData.customAvatarURL = avatarURL;
            console.log('💾 Saving avatar URL to Firestore:', avatarURL);
        }

        console.log('💾 Updating Firestore with data:', updatedData);
        await updateDoc(doc(db, 'users', currentUser.uid), updatedData);
        console.log('✅ Firestore updated successfully!');

        // ✅ UPDATE: Save current dyslexia state as the NEW original state after successful save
        originalDyslexiaState = document.body.classList.contains('dyslexia-mode');
        console.log('💾 Updated original dyslexia state to:', originalDyslexiaState);

        userData.customAvatarURL = avatarURL;
        userData = { ...userData, ...updatedData };
        
        originalData = {
            fullName: updatedData.fullName,
            username: updatedData.username,
            studentId: updatedData.studentId,
            course: updatedData.course,
            yearLevel: updatedData.yearLevel
        };
        
        newAvatarFile = null;
        isUploading = false;
        
        document.getElementById('successModal').classList.add('show');
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        displayAvatar(userData);
        document.getElementById('displayName').textContent = updatedData.fullName;
        
        setTimeout(() => {
            cancelEdit();
        }, 800);
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        isUploading = false;
    }
});

// DELETE ACCOUNT FUNCTIONS
window.showDeleteModal = function() {
    document.getElementById('deleteModal').classList.add('show');
};

window.closeDeleteModal = function() {
    document.getElementById('deleteModal').classList.remove('show');
};

window.confirmDeleteAccount = async function() {
    console.log('🗑️ User confirmed account deletion');
    
    closeDeleteModal();
    document.getElementById('deletingModal').classList.add('show');
    
    try {
        const userId = currentUser.uid;
        
        console.log('🗑️ Deleting quiz results...');
        const resultsRef = collection(db, 'quizResults');
        const resultsQuery = query(resultsRef, where('userId', '==', userId));
        const resultsSnapshot = await getDocs(resultsQuery);
        
        const deletePromises = [];
        resultsSnapshot.forEach((docSnapshot) => {
            deletePromises.push(deleteDoc(doc(db, 'quizResults', docSnapshot.id)));
        });
        
        await Promise.all(deletePromises);
        console.log('✅ Quiz results deleted');
        
        console.log('🗑️ Deleting user document...');
        await deleteDoc(doc(db, 'users', userId));
        console.log('✅ User document deleted');
        
        console.log('🗑️ Deleting Firebase Auth account...');
        await deleteUser(currentUser);
        console.log('✅ Auth account deleted');
        
        document.getElementById('deletingModal').classList.remove('show');
        alert('Your account has been successfully deleted. You will now be redirected to the homepage.');
        window.location.href = '../../../index.html';
        
    } catch (error) {
        console.error('❌ Error deleting account:', error);
        document.getElementById('deletingModal').classList.remove('show');
        
        if (error.code === 'auth/requires-recent-login') {
            alert('For security reasons, you need to log in again before deleting your account. Please log out and log back in, then try deleting again.');
        } else {
            alert('Failed to delete account: ' + error.message + '\n\nPlease contact support if this issue persists.');
        }
    }
};

window.closeModal = function() {
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