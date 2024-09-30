const SCRIPT_ID = 'https://script.google.com/macros/s/AKfycbytVlA8kWLJmYmx1tQORmwNr4uITUvxqM60Zodnw7NjUnLq0BTQuBuaS_6a4NvDs8ES/exec';

function login() {
    const userName = document.getElementById('userName').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.style.display = 'none';  // Hide error message initially

    if (!userName || !password) {
        alert('Please enter both username and password.');
        return;
    }

    // Fetch user details from Google Sheets using Web Apps API
    fetch(`${SCRIPT_ID}?action=login&userName=${encodeURIComponent(userName)}&password=${encodeURIComponent(password)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            return response.json();
        })
        .then(data => {
            console.log(data);
            if (data.success) {
                // Store user details in localStorage
                localStorage.setItem('EmpCode', data.user.EmpCode);
                localStorage.setItem('UserName', data.user.UserName);
                localStorage.setItem('UserLoginID', data.user.UserLoginID);
                localStorage.setItem('UserType', data.user.UserType);
                localStorage.setItem('CompanyID', data.user.CompanyID);
                localStorage.setItem('WorkingBranch', data.user.WorkingBranch);
                
                // Redirect to home.html
                window.location.href = 'home.html';
            } else {
                errorMessage.innerHTML = 'Invalid username or password. Please try again.';
                errorMessage.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred during login. Please try again.');
        });
}

function resetPassword() {
    // Redirect to a reset password page or trigger the reset password process
    alert('Reset password functionality coming soon.');
}
