const maxIdleTime = 5 * 60 * 1000; // 5 minutes
let idleInterval = null;
let sessionInterval = null;

/* ------------------ Activity Tracking ------------------ */

// Update last activity time
function updateLastActivityTime() {
    localStorage.setItem('lastActivityTime', Date.now());
}

// Check idle logout
function checkIdleTime() {
    const lastActivityTime = Number(localStorage.getItem('lastActivityTime') || 0);
    const currentTime = Date.now();
    // console.log("Checking idle time:", {
    //     lastActivityTime: new Date(lastActivityTime).toLocaleTimeString(),
    //     currentTime: new Date(currentTime).toLocaleTimeString()
    // });
    if (lastActivityTime && (currentTime - lastActivityTime >= maxIdleTime)) {
        logoutUser();
    }
}

/* ------------------ Session Validation ------------------ */

// Run session validation every 30 seconds
function startSessionValidation() {
    if (sessionInterval) clearInterval(sessionInterval);

    sessionInterval = setInterval(() => {
        checkSessionToken().catch(err =>
            console.error("Session token check failed:", err)
        );
    }, 30000);
}

/* ------------------ Idle Monitor ------------------ */

function startIdleMonitor() {
    if (idleInterval) clearInterval(idleInterval);

    idleInterval = setInterval(checkIdleTime, 30000);
}

/* ------------------ Logout ------------------ */

async function logoutUser() {
    await logoutlocalstorage();

    // notify other tabs
    localStorage.setItem('logout-event', Date.now());
}

async function logoutlocalstorage() {

    await logoutOtherSessions(UserLoginID);

    clearPermissionCache(localStorage.getItem('UserLoginID'));

    localStorage.removeItem('EmpCode');
    localStorage.removeItem('UserName');
    localStorage.removeItem('UserLoginID');
    localStorage.removeItem('UserType');
    localStorage.removeItem('CompanyID');
    localStorage.removeItem('WorkingBranch');
    localStorage.removeItem('CompanyShortCode');

    sessionStorage.removeItem('session_token');

    window.location.href = '../../index.html';
}

function clearPermissionCache(userLoginID) {
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`permissions_${userLoginID}_`)) {
            localStorage.removeItem(key);
        }
    });
}

/* ------------------ Multi-Tab Logout Sync ------------------ */

window.addEventListener('storage', function (event) {
    if (event.key === 'logout-event') {
        window.location.href = '../../index.html';
    }
});

/* ------------------ Initialize ------------------ */

document.addEventListener("DOMContentLoaded", async () => {

    // activity listeners
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
        .forEach(evt =>
            window.addEventListener(evt, updateLastActivityTime, { passive: true })
        );

    updateLastActivityTime();

    startIdleMonitor();        // idle logout checker
    startSessionValidation();  // session token checker
    await autoUnlockMultipleTables(); // Unlock any records that might be locked from previous sessions
});
