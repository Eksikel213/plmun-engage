// ==================== GLOBAL DYSLEXIA MODE SYSTEM ====================
// Place this file in: /pages/Student/ folder (same level as Profile, Shop, etc.)
// This will be loaded on EVERY page to apply dyslexia mode globally

let badgeTimeout = null;

// ✅ NEW: Track if badge was already shown in this browser session
const BADGE_SHOWN_KEY = 'dyslexiaBadgeShownThisSession';

// Initialize Dyslexia Mode on Page Load
function initDyslexiaMode() {
    const dyslexiaModeEnabled = localStorage.getItem('dyslexiaMode') === 'true';
    
    if (dyslexiaModeEnabled) {
        // Apply dyslexia mode to body
        document.body.classList.add('dyslexia-mode');
        console.log('✅ Dyslexia mode applied from global settings');
        
        // ✅ UPDATED: Only show badge if NOT shown yet in this session
        const badge = document.getElementById('dyslexiaBadge');
        if (badge) {
            const alreadyShownThisSession = sessionStorage.getItem(BADGE_SHOWN_KEY) === 'true';
            
            if (!alreadyShownThisSession) {
                showBadgeBriefly(badge);
                // Mark as shown in this session
                sessionStorage.setItem(BADGE_SHOWN_KEY, 'true');
                console.log('🔔 First-time badge notification shown');
            } else {
                console.log('✅ Badge already shown this session, skipping notification');
            }
        }
        
        // If toggle switch exists, update its state
        const toggleSwitch = document.getElementById('toggleSwitch');
        const checkbox = document.getElementById('dyslexiaToggle');
        
        if (toggleSwitch) {
            toggleSwitch.classList.add('active');
        }
        if (checkbox) {
            checkbox.checked = true;
        }
    }
}

// Show badge briefly (3 seconds)
function showBadgeBriefly(badge) {
    badge.style.display = 'flex';
    
    // Clear any existing timeout
    if (badgeTimeout) {
        clearTimeout(badgeTimeout);
    }
    
    // Hide badge after 3 seconds with fade out
    badgeTimeout = setTimeout(() => {
        badge.style.opacity = '0';
        setTimeout(() => {
            badge.style.display = 'none';
            badge.style.opacity = '1'; // Reset for next time
        }, 300);
    }, 3000);
}

// Toggle Dyslexia Mode (for Profile page)
window.toggleDyslexiaMode = function() {
    const body = document.body;
    const toggleSwitch = document.getElementById('toggleSwitch');
    const checkbox = document.getElementById('dyslexiaToggle');
    const badge = document.getElementById('dyslexiaBadge');
    
    // Toggle the mode
    body.classList.toggle('dyslexia-mode');
    toggleSwitch.classList.toggle('active');
    checkbox.checked = body.classList.contains('dyslexia-mode');
    
    // Save preference to localStorage (applies to ALL pages)
    const isDyslexiaMode = body.classList.contains('dyslexia-mode');
    localStorage.setItem('dyslexiaMode', isDyslexiaMode);
    
    console.log(isDyslexiaMode ? '✅ Dyslexia mode enabled globally' : '❌ Dyslexia mode disabled globally');
    
    // Handle badge visibility
    if (isDyslexiaMode) {
        // ✅ UPDATED: When enabling, show badge AND mark as shown
        if (badge) {
            showBadgeBriefly(badge);
            sessionStorage.setItem(BADGE_SHOWN_KEY, 'true');
        }
    } else {
        // When disabling, hide badge immediately and clear session flag
        if (badge) {
            badge.style.display = 'none';
        }
        if (badgeTimeout) {
            clearTimeout(badgeTimeout);
        }
        // ✅ NEW: Clear the flag so badge shows again if re-enabled
        sessionStorage.removeItem(BADGE_SHOWN_KEY);
        console.log('🔔 Badge notification flag cleared');
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDyslexiaMode);
} else {
    // DOM is already loaded
    initDyslexiaMode();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDyslexiaMode, toggleDyslexiaMode };
}