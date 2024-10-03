document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger');
    const menuBar = document.querySelector('.menu-bar');
    const menuItems = document.querySelector('.menu-items');
    const userInfo = document.querySelector('.user-info');
    const logoutBtn = document.querySelector('.logout-btn');
    const userLoginIDSpan = document.getElementById('userLoginID');

    if (hamburger && menuBar && menuItems && userInfo) {
        hamburger.addEventListener('click', function () {
            menuBar.classList.toggle('active');
            menuItems.classList.toggle('active');
            userInfo.classList.toggle('active');
        });
    } else {
        console.error('One or more menu elements not found');
    }

    function loadUserInfo() {
        const userLoginID = localStorage.getItem('UserLoginID');
        if (userLoginID && userLoginIDSpan) {
            userLoginIDSpan.textContent = userLoginID;
        } else {
            // If no user is logged in, redirect to login page
            window.location.href = 'index.html';
        }
    }

    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('EmpCode');
        localStorage.removeItem('UserName');
        localStorage.removeItem('UserLoginID');
        localStorage.removeItem('UserType');
        localStorage.removeItem('CompanyID');
        localStorage.removeItem('WorkingBranch');

        window.location.href = 'index.html';
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('Logout button not found');
    }

    // Load user info when the page loads
    loadUserInfo();
});