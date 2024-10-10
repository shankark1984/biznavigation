// Helper functions
const showError = (message) => {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.innerHTML = message;
    errorMessage.style.display = 'block';
};

const hideError = () => {
    document.getElementById('errorMessage').style.display = 'none';
};

const storeUserDetails = (user) => {
    const { EmpCode, UserName, UserLoginID, UserType, CompanyID, WorkingBranch } = user;
    localStorage.setItem('EmpCode', EmpCode);
    localStorage.setItem('UserName', UserName);
    localStorage.setItem('UserLoginID', UserLoginID);
    localStorage.setItem('UserType', UserType);
    localStorage.setItem('CompanyID', CompanyID);
    localStorage.setItem('WorkingBranch', WorkingBranch);
};

function login() {
    const userName = document.getElementById('userName').value;
    const password = document.getElementById('password').value;

    if (!userName || !password) {
        showError('Please enter both username and password.');
        return;
    }

    hideError();  // Hide error message initially

    // Fetch user details from Google Sheets using Web Apps API
    const url = `${UserLogin_SCRIPT_ID}?action=login&userName=${encodeURIComponent(userName)}&password=${encodeURIComponent(password)}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok.');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                storeUserDetails(data.user);
                window.location.href = 'home.html';  // Redirect to home page
            } else {
                showError('Invalid username or password. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('An error occurred during login. Please try again.');
        });
}

function resetPassword() {
    alert('Reset password functionality coming soon.');
}
