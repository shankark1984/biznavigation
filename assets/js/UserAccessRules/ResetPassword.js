document.addEventListener('DOMContentLoaded', () => {
    const loginIDInput = document.getElementById('loginID');
    const phoneInput = document.getElementById('userPhoneNo');
    const otpInput = document.getElementById('userPhoneOTP');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const errorMessage = document.getElementById('errorMessage');
    const form = document.getElementById('userActivationForm');
    const spinner = document.getElementById('resetPasswordSpinner');
    const btnText = document.getElementById('loginButtonText');

    let generatedOTP = null;
    let otpExpiryTime = null;
    let matchedUserID = null;
    let isOTPVerified = false;

    // Initially hide OTP and Password fields
    toggleField(otpInput, false);
    toggleField(newPasswordInput, false);
    toggleField(confirmPasswordInput, false);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const loginID = loginIDInput.value.trim();
        const phone = phoneInput.value.trim();
        const enteredOTP = otpInput.value.trim();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!loginID || !phone) {
            return showError('Please enter both username and phone number.');
        }

        spinner.classList.remove('d-none');

        try {
            if (!generatedOTP) {
                await handleOTPGeneration(loginID, phone);
            } else if (!isOTPVerified) {
                await handleOTPVerification(enteredOTP);
            } else {
                await handlePasswordReset(loginID, newPassword, confirmPassword);
            }
        } catch (err) {
            showError(err.message || 'Something went wrong.');
        } finally {
            spinner.classList.add('d-none');
        }
    });

    async function handleOTPGeneration(loginID, phone) {
        const { data: empMaster, error: empError } = await supabaseClient
            .from('EmployeeMaster')
            .select('id')
            .eq('LoginID', loginID)
            .single();

        if (empError || !empMaster) throw new Error('Invalid Login ID.');

        matchedUserID = empMaster.id;

        const { data: empWorking, error: phoneError } = await supabaseClient
            .from('EmployeeWorkingDetails')
            .select('PhoneNumber')
            .eq('EM_ID', matchedUserID)
            .single();

        if (phoneError || !empWorking || empWorking.PhoneNumber !== phone) {
            throw new Error('Phone number does not match our records.');
        }

        // Generate and simulate sending OTP
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpExpiryTime = Date.now() + 5 * 60 * 1000; // valid for 5 mins
        // console.log("OTP sent to:", phone, "OTP:", generatedOTP); // Replace with actual SMS API
        await sendOTPViaSMS(phone, generatedOTP);

        toggleField(otpInput, true);
        otpInput.focus();
    }

    async function handleOTPVerification(enteredOTP) {
        if (Date.now() > otpExpiryTime) {
            generatedOTP = null;
            toggleField(otpInput, false);
            throw new Error('OTP expired. Please try again.');
        }

        if (enteredOTP !== generatedOTP) {
            throw new Error('Invalid OTP.');
        }

        isOTPVerified = true;
        otpInput.disabled = true;

        toggleField(newPasswordInput, true);
        toggleField(confirmPasswordInput, true);
        newPasswordInput.focus();

        btnText.textContent = 'Reset Password';
    }

    async function handlePasswordReset(loginID, newPassword, confirmPassword) {
        if (!newPassword || !confirmPassword) {
            throw new Error('Please enter and confirm your new password.');
        }

        if (newPassword !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        const hashedPassword = sha256(newPassword);

        const { error: updateError } = await supabaseClient
            .from('user_login')
            .update({ user_password: hashedPassword })
            .eq('user_login_id', loginID);

        if (updateError) throw new Error('Failed to reset password.');

        alert('Password reset successful.');
        form.reset();
        location.href = 'index.html';
    }

    function toggleField(input, show) {
        input.closest('.mb-3').style.display = show ? '' : 'none';
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('d-none');
    }

    function hideError() {
        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';
    }
});

async function sendOTPViaSMS(phone, otp) {
    const response = await fetch('https://qfdrugniulwovfaijgkr.supabase.co/functions/v1/send-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone, otp })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Failed to send OTP');
    }
}
