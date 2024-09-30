// Function to toggle the menu on mobile screens
function toggleMenu() {
    var menu = document.querySelector('.nav-menu');
    menu.classList.toggle('active');
}
// Function to load UserLoginID from localStorage and display it
function loadUserInfo() {
    const userLoginID = localStorage.getItem('UserLoginID');
    if (userLoginID) {
        document.getElementById('userLoginID').textContent = userLoginID;
    } else {
        // If no user is logged in, redirect to login page
        window.location.href = 'login.html';
    }
}

// Function to handle logout
function logout() {
    // Clear user data from localStorage
    localStorage.removeItem('EmpCode');
    localStorage.removeItem('UserName');
    localStorage.removeItem('UserLoginID');
    localStorage.removeItem('UserType');
    localStorage.removeItem('CompanyID');
    localStorage.removeItem('WorkingBranch');

    // Redirect to login page after logging out
    window.location.href = 'login.html';
}

// Load user information when the page is ready
document.addEventListener('DOMContentLoaded', loadUserInfo);