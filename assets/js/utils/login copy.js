

// Show error message
const showError = (message) => {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.innerHTML = message;
    errorMessage.classList.remove('d-none');
};

// Hide error message
const hideError = () => {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.classList.add('d-none');
};

// Store user details locally
const storeUserDetails = (user) => {
    const { emp_code, user_name, user_login_id, user_type, company_id, working_branch } = user;
    localStorage.setItem('EmpCode', emp_code);
    localStorage.setItem('UserName', user_name);
    localStorage.setItem('UserLoginID', user_login_id);
    localStorage.setItem('UserType', user_type);
    localStorage.setItem('CompanyID', company_id);
    localStorage.setItem('WorkingBranch', working_branch || 'default');
};

// Handle login process
async function login() {
    const userName = document.getElementById('userName').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginButton = document.getElementById('loginButton');
    const loginButtonText = document.getElementById('loginButtonText');
    const loginSpinner = document.getElementById('loginSpinner');

    if (!userName || !password) {
        showError('Please enter both username and password.');
        return;
    }

    hideError();

    loginButton.disabled = true;
    loginButtonText.textContent = 'Logging in...';
    loginSpinner.classList.remove('d-none');

    try {
        const { data, error, status } = await supabaseClient
            .from('user_login')
            .select('*')
            .eq('user_login_id', userName)
            .eq('user_password', password)
            .single();

        if (error && status !== 406) {
            showError('Invalid username or password. Please try again.');
        } else if (!data) {
            showError('Invalid username or password. Please try again.');
        } else {
            storeUserDetails(data);
            window.location.href = 'home.html';
        }
    } catch (err) {
        console.error('Login Error:', err);
        showError('An error occurred during login. Please try again.');
    } finally {
        loginButton.disabled = false;
        loginButtonText.textContent = 'Login';
        loginSpinner.classList.add('d-none');
    }
}

// Handle password reset (placeholder)
async function resetPassword() {
    const email = document.getElementById('userName').value.trim();

    if (!email) {
        showError('Please enter your email to reset your password.');
        return;
    }

    alert('Reset password functionality coming soon.');
}

// Handle Enter key to trigger login
function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        login();
    }
}
