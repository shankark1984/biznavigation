document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await login();
});

// Cached DOM elements
const el = {
    username: document.getElementById('userName'),
    password: document.getElementById('password'),
    errorMsg: document.getElementById('errorMessage'),
    loginBtn: document.getElementById('loginButton'),
    loginText: document.getElementById('loginButtonText'),
    loginSpinner: document.getElementById('loginSpinner')
};

// Show error message
const showError = (message) => {
    el.errorMsg.textContent = message;
    el.errorMsg.classList.remove('d-none');
};

// Hide error message
const hideError = () => {
    el.errorMsg.classList.add('d-none');
};

// Auto-reload if a new Service Worker takes over
let isRefreshing = false;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
            isRefreshing = true;
            window.location.reload();
        }
    });
}

// Check for updates with a timeout safeguard so login isn't delayed
async function checkUpdateOnLogin() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Race registration.update against a 2-second timeout
        const updateCheck = registration.update();
        const timeout = new Promise(resolve => setTimeout(resolve, 2000));
        await Promise.race([updateCheck, timeout]);
    } catch (err) {
        console.warn('Update check failed on login:', err);
    }
}

// Store user details locally
const storeUserDetails = ({ emp_code, user_name, user_login_id, user_type, company_id, working_branch }) => {
    // Clear old permissions
    Object.keys(localStorage)
        .filter(key => key.startsWith("permissions_"))
        .forEach(key => localStorage.removeItem(key));

    localStorage.setItem('EmpCode', emp_code);
    localStorage.setItem('UserName', user_name);
    localStorage.setItem('UserLoginID', user_login_id);
    localStorage.setItem('UserType', user_type);
    localStorage.setItem('CompanyID', company_id);
    localStorage.setItem('WorkingBranch', working_branch || 'default');
};

// Toggle loading state
const setLoading = (isLoading) => {
    el.loginBtn.disabled = isLoading;
    el.loginText.textContent = isLoading ? 'Logging in...' : 'Login';
    el.loginSpinner.classList.toggle('d-none', !isLoading);
};

// Helper: Safely fetch public IP with fallback
async function getPublicIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        const data = await res.json();
        return data.ip || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// Main login handler
async function login() {
    const username = el.username.value.trim();
    const password = el.password.value.trim();
    const deviceId = getDeviceId();

    if (typeof sessionToken !== 'undefined') {
        localStorage.setItem('session_token', sessionToken);
    }

    if (!username || !password) {
        showError('Please enter both username and password.');
        return;
    }

    hideError();
    setLoading(true);

    try {
        const hashedPassword = sha256(password).toString();

        const { data, error } = await supabaseClient
            .from('user_login')
            .select('*')
            .eq('user_login_id', username)
            .eq('user_password', hashedPassword)
            .maybeSingle();

        if (error || !data) {
            showError('Invalid username or password.');
            return;
        }

        /* ---------- CHECK ACTIVE SESSIONS ---------- */
        const { data: activeSessions, error: sessionErr } = await supabaseClient
            .from('user_sessions')
            .select('*')
            .eq('user_id', username)
            .eq('is_active', true);

        if (sessionErr) {
            console.error(sessionErr);
            showError('Session validation failed.');
            return;
        }

        // Check if logged in from another device
        if (activeSessions?.length > 0 && !activeSessions.some(s => s.device_id === deviceId)) {
            showError('You are already logged in from another device.');
            const logoutBtn = document.getElementById('logoutOtherSessionsBtn');
            if (logoutBtn) logoutBtn.classList.remove('d-none');
            return;
        }

        /* ---------- CREATE / UPDATE SESSION ---------- */
        const clientIP = await getPublicIP();
        const currentTime = typeof localtimeStamp !== 'undefined' ? localtimeStamp : new Date().toISOString();
        const currentToken = typeof sessionToken !== 'undefined' ? sessionToken : crypto.randomUUID();

        await supabaseClient
            .from('user_sessions')
            .upsert({
                user_id: username,
                session_token: currentToken,
                device_id: deviceId,
                device_name: navigator.userAgent,
                ip_address: clientIP,
                user_agent: navigator.userAgent,
                last_active: currentTime,
                is_active: true,
                created_at: currentTime
            });

        /* ---------- STORE USER & CHECK UPDATES ---------- */
        storeUserDetails(data);

        // Check for new service worker code
        await checkUpdateOnLogin();

        if (typeof reSetPass !== 'undefined' && password === reSetPass) {
            localStorage.setItem('ForcePasswordReset', 'true');
            window.location.href = '/pages/auth/new-password.html';
            return;
        }

        window.location.href = '/pages/Tools/home.html';

    } catch (err) {
        console.error(err);
        showError('An error occurred during login.');
    } finally {
        setLoading(false);
    }
}

const logoutOtherSessionsBtn = document.getElementById('logoutOtherSessionsBtn');
if (logoutOtherSessionsBtn) {
    logoutOtherSessionsBtn.addEventListener('click', async () => {
        const username = el.username.value.trim();

        const result = await logoutOtherSessions(username);

        if (!result?.success) {
            alert('Failed to terminate sessions');
            return;
        }

        alert('Other sessions logged out. Please login again.');
        location.reload();
    });
}