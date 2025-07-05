const maxIdleTime = 5 * 60 * 1000; // 5 minutes in milliseconds

// Update the last activity time in localStorage
function updateLastActivityTime() {
    localStorage.setItem('lastActivityTime', Date.now());
}

// Check if the user is idle for more than the max idle time
function checkIdleTime() {
    const lastActivityTime = localStorage.getItem('lastActivityTime');
    const currentTime = Date.now();
    console.log(lastActivityTime + ' ' + currentTime);
    if (lastActivityTime && currentTime - lastActivityTime >= maxIdleTime) {
        logoutUser();
    }
}

// Function to log out the user
function logoutUser() {
    logoutlocalstorage();
    // alert("You have been logged out due to inactivity.");
    // window.location.href = '/logout'; 
    // Redirect to your logout route

}

// Initialize event listeners and set an interval to check idle time
window.onload = function () {
    // Update the last activity time on user activity
    window.addEventListener('mousemove', updateLastActivityTime);
    window.addEventListener('keydown', updateLastActivityTime);
    window.addEventListener('mousedown', updateLastActivityTime);
    window.addEventListener('touchstart', updateLastActivityTime);
    window.addEventListener('scroll', updateLastActivityTime);

    // Set the initial last activity time
    updateLastActivityTime();

    // Check every minute if the user is idle
    setInterval(checkIdleTime, 60 * 1000); // Check every 1 minute
};
function logoutlocalstorage() {
    // Clear user data from localStorage
    localStorage.removeItem('EmpCode');
    localStorage.removeItem('UserName');
    localStorage.removeItem('UserLoginID');
    localStorage.removeItem('UserType');
    localStorage.removeItem('CompanyID');
    localStorage.removeItem('WorkingBranch');
    localStorage.removeItem('CompanyShortCode');

    window.location.href = 'index.html';
}

function clearPermissionCache(userLoginID) {
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`permissions_${userLoginID}_`)) {
            localStorage.removeItem(key);
        }
    });
}

let notificationTimeout;

function showNotification(message) {
    const taskBar = document.getElementById('taskBar');

    // Clear previous timeout if exists
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    if (message && message.trim() !== '') {
        // Show browser notification
        if (window.Notification && Notification.permission === 'granted') {
            new Notification('Validation Error', { body: message });
        }

        taskBar.textContent = message;
        taskBar.classList.remove('d-none', 'fade'); // Make visible without fade-out
        void taskBar.offsetWidth; // Force reflow for fade-in to work
        taskBar.classList.add('show'); // Bootstrap fade-in
        return; // Exit early if showing a message

        // Auto-hide after 3 seconds
        notificationTimeout = setTimeout(() => {
            taskBar.classList.remove('show'); // Start fade-out

            const hideHandler = () => {
                taskBar.classList.add('d-none'); // Hide after fade-out
                taskBar.textContent = ''; // Clear old message
                taskBar.removeEventListener('transitionend', hideHandler);
            };

            taskBar.addEventListener('transitionend', hideHandler);
        }, 3000);
    } else {
        taskBar.classList.remove('show'); // Start fade-out

        const hideHandler = () => {
            taskBar.classList.add('d-none'); // Hide after fade-out
            taskBar.textContent = ''; // Clear old message
            taskBar.removeEventListener('transitionend', hideHandler);
        };

        taskBar.addEventListener('transitionend', hideHandler);
    }
}

