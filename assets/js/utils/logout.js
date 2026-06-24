const maxIdleTime = 5 * 60 * 1000; // 5 minutes
let idleInterval = null;
let sessionInterval = null;
let isLoggingOut = false;

/* ------------------ Activity Tracking ------------------ */

function updateLastActivityTime() {
    localStorage.setItem('lastActivityTime', Date.now());
}

function checkIdleTime() {
    if (isLoggingOut) return;

    const lastActivityTime = Number(localStorage.getItem('lastActivityTime') || 0);
    const currentTime = Date.now();

    if (lastActivityTime && (currentTime - lastActivityTime >= maxIdleTime)) {
        logoutUser();
    }
}

/* ------------------ Session Validation ------------------ */

function startSessionValidation() {
    if (sessionInterval) clearInterval(sessionInterval);

    sessionInterval = setInterval(async () => {
        if (isLoggingOut) return;

        try {
            await checkSessionToken();
        } catch (err) {
            console.error("Session token check failed:", err);
            // optional: logoutUser();
        }
    }, 30000);
}

/* ------------------ Idle Monitor ------------------ */

function startIdleMonitor() {
    if (idleInterval) clearInterval(idleInterval);
    idleInterval = setInterval(checkIdleTime, 30000);
}

function stopSessionWatchers() {
    if (idleInterval) {
        clearInterval(idleInterval);
        idleInterval = null;
    }

    if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
}

/* ------------------ Logout ------------------ */

async function logoutUser() {
    if (isLoggingOut) return;
    isLoggingOut = true;

    stopSessionWatchers();

    // notify other tabs first
    localStorage.setItem('logout-event', Date.now());

    await logoutlocalstorage();
}

async function logoutlocalstorage() {
    const userLoginID = localStorage.getItem('UserLoginID');

    try {
        if (userLoginID) {
            await logoutOtherSessions(userLoginID);
        }
    } catch (error) {
        console.error("Logout session cleanup failed:", error);
    } finally {
        if (userLoginID) {
            clearPermissionCache(userLoginID);
        }

        localStorage.removeItem('EmpCode');
        localStorage.removeItem('UserName');
        localStorage.removeItem('UserLoginID');
        localStorage.removeItem('UserType');
        localStorage.removeItem('CompanyID');
        localStorage.removeItem('WorkingBranch');
        localStorage.removeItem('CompanyShortCode');
        localStorage.removeItem('lastActivityTime');

        sessionStorage.removeItem('session_token');

        window.location.href = '../../index.html';
    }
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
    if (event.key === 'logout-event' && localStorage.getItem('UserLoginID')) {
        window.location.href = '../../index.html';
    }
});

/* ------------------ Initialize ------------------ */

document.addEventListener("DOMContentLoaded", async () => {
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
        .forEach(evt =>
            window.addEventListener(evt, updateLastActivityTime, { passive: true })
        );

    updateLastActivityTime();

    startIdleMonitor();
    startSessionValidation();

    if (localStorage.getItem('UserLoginID')) {
        await autoUnlockMultipleTables();
    }
});