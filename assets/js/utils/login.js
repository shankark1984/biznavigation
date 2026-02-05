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

// Store user details locally
const storeUserDetails = ({ emp_code, user_name, user_login_id, user_type, company_id, working_branch }) => {
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

// Main login handler

async function login() {
    const username = el.username.value.trim();
    const password = el.password.value.trim();
    const deviceId = getDeviceId();

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

        // If logged in from another device
        if (activeSessions.length > 0 &&
            !activeSessions.some(s => s.device_id === deviceId)) {

            showError('You are already logged in from another device.');
            return;
        }

        /* ---------- CREATE / UPDATE SESSION ---------- */
        const sessionToken = crypto.randomUUID();

        await supabaseClient
            .from('user_sessions')
            .upsert({
                user_id: username,
                session_token: sessionToken,
                device_id: deviceId,
                device_name: navigator.userAgent,
                ip_address: '' + (await fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => data.ip)) + '',
                user_agent: navigator.userAgent,
                last_active: localtimeStamp,
                is_active: true,
                created_at: localtimeStamp
            });

        /* ---------- STORE USER ---------- */
        storeUserDetails(data);

        if (password === reSetPass) {
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


function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}
