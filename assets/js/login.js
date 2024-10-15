const showError = (message) => {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.innerHTML = message;
    errorMessage.style.display = 'block';
};

const hideError = () => {
    document.getElementById('errorMessage').style.display = 'none';
};

const storeUserDetails = (user) => {
    const { emp_code, user_name, user_login_id, user_type, company_id, working_branch } = user;
    localStorage.setItem('EmpCode', emp_code);
    localStorage.setItem('UserName', user_name);
    localStorage.setItem('UserLoginID', user_login_id);
    localStorage.setItem('UserType', user_type);
    localStorage.setItem('CompanyID', company_id);
    localStorage.setItem('WorkingBranch', working_branch || 'default'); // Set a default working branch if not provided
};

async function login() {
    const userName = document.getElementById('userName').value;
    const password = document.getElementById('password').value;

    if (!userName || !password) {
        showError('Please enter both username and password.');
        return;
    }

    hideError(); // Hide error message initially

    try {
        // Query the user_login table to authenticate user
        const { data, error, status } = await supabaseClient
            .from('user_login')
            .select('*')
            .eq('user_login_id', userName) // Assuming `user_login_id` is the field for username/email
            .eq('user_password', password) // Assuming passwords are stored in plain text (not recommended)
            .single(); // We expect one user at most

        if (error && status !== 406) { // Check for errors except for no data found
            showError('Invalid username or password. Please try again.');
        } else {
            // User logged in successfully
            storeUserDetails(data);
            window.location.href = 'home.html'; // Redirect to home page
        }
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred during login. Please try again.');
    }
}

async function resetPassword() {
    const email = document.getElementById('userName').value; // Assume the email is the same as username

    if (!email) {
        showError('Please enter your email to reset your password.');
        return;
    }

    // Here you might want to implement a method to reset the password 
    // via Supabase (not covered in this example as it's outside scope)
    alert('Reset password functionality coming soon.');
}
