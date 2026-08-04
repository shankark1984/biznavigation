// 🔐 Block direct access
if (localStorage.getItem('ForcePasswordReset') !== 'true') {
    window.location.href = '/login.html';
}

// DOM elements
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const alertBox = document.getElementById('alertBox');
const strengthText = document.getElementById('strengthText');
const resetForm = document.getElementById('resetForm');

// Alert helpers
function showAlert(message, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
}

function hideAlert() {
    alertBox.classList.add('d-none');
}

// Password strength indicator
newPassword.addEventListener('input', () => {
    const value = newPassword.value;

    if (value.length < 8) {
        strengthText.textContent = '❌ At least 8 characters required';
        strengthText.className = 'text-danger';
    } else {
        strengthText.textContent = '✅ Strong enough';
        strengthText.className = 'text-success';
    }
});

// Form submit
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const pwd = newPassword.value.trim();
    const confirmPwd = confirmPassword.value.trim();

    if (pwd.length < 8) {
        showAlert('Password must be at least 8 characters long.');
        return;
    }

    if (pwd !== confirmPwd) {
        showAlert('Passwords do not match.');
        return;
    }

    // 🔐 TODO: Supabase password update logic
    // const hashPassword = await bcrypt.hash(pwd, 12);

    const { data, error } = await supabaseClient
        .from('user_login')
        .update({
            // user_password: hashPassword,
            user_password: sha256(pwd).toString(),
        })
        .eq('user_login_id', localStorage.getItem('UserLoginID'));

    if (error) {
        console.error(error);
        showAlert('Failed to update password.');
        return;
    }

    showAlert('Password updated successfully!', 'success');

    localStorage.removeItem('ForcePasswordReset');

    setTimeout(() => {
        window.location.href = '../../pages/Tools/home.html';
    }, 1500);
});
