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

    if (!username || !password) {
        showError('Please enter both username and password.');
        return;
    }

    hideError();
    setLoading(true);

    try {
        const hashedPassword = sha256(password).toString();

        const { data, error, status } = await supabaseClient
            .from('user_login')
            .select('*')
            .eq('user_login_id', username)
            .eq('user_password', hashedPassword)
            .maybeSingle();

        if (error && status !== 406) {
            showError('Login failed. Please check your credentials.');
            return;
        }

        if (!data) {
            showError('Invalid username or password.');
            return;
        }

        storeUserDetails(data);

        // 🔐 FORCE PASSWORD RESET
        if (password === reSetPass) {
            localStorage.setItem('ForcePasswordReset', 'true');
            window.location.href = '/pages/auth/new-password.html';
            return;
        }

        window.location.href = '/pages/Tools/home.html';

    } catch (err) {
        console.error('Login Error:', err);
        showError('An error occurred during login. Please try again.');
    } finally {
        setLoading(false);
    }
}

