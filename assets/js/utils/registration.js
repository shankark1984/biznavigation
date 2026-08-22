/**
 * Registration Module
 * Handles:
 * - PAN/GST validation
 * - PAN/GST duplicate checking
 * - Email OTP
 * - Phone OTP
 * - Registration
 */
// ============================================
// TAX CHECK TIMER
// ============================================

let taxCheckTimer = null;

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    OTP_LENGTH: 6,
    COUNTDOWN_SECONDS: 60,
    PAN_PATTERN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    GST_PATTERN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/,
    // IMPORTANT:
    // Change to false when moving to production
    DEMO_MODE: false,
    ALERT_AUTO_HIDE: 3000,
    SUCCESS_ALERT_HIDE: 2000,
    TAX_CHECK_DELAY: 500
};

// ============================================
// DOM REFERENCES
// ============================================

const DOM = {
    panInput: document.getElementById('panNumber'),
    gstInput: document.getElementById('gstNumber'),
    taxHelper: document.getElementById('taxHelper'),
    sendOtpBtn: document.getElementById('sendOtpBtn'),
    verificationSection: document.getElementById('verificationSection'),
    registerBtn: document.getElementById('registerBtn'),
    resendBtn: document.getElementById('resendOtpBtn'),
    countdownSpan: document.getElementById('countdown'),
    emailStatus: document.getElementById('emailStatus'),
    phoneStatus: document.getElementById('phoneStatus'),
    emailOtpInput: document.getElementById('emailOtp'),
    phoneOtpInput: document.getElementById('phoneOtp'),
    verifyEmailBtn: document.getElementById('verifyEmailBtn'),
    verifyPhoneBtn: document.getElementById('verifyPhoneBtn'),
    emailOtpMsg: document.getElementById('emailOtpMessage'),
    phoneOtpMsg: document.getElementById('phoneOtpMessage'),
    messageBox: document.getElementById('messageBox'),
    form: document.getElementById('registrationForm'),
    userName: document.getElementById('userName'),
    companyName: document.getElementById('companyName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone')
};

// ============================================
// STATE
// ============================================

const state = {
    countdown: CONFIG.COUNTDOWN_SECONDS,
    countdownInterval: null,
    emailVerified: false,
    phoneVerified: false,
    taxValid: false,
    taxAvailable: false,
    isSubmitting: false
};

// ============================================
// ALERT
// ============================================

function showAlert(msg, type = 'danger') {

    const box = DOM.messageBox;

    if (!box) return;

    box.classList.remove(
        'd-none',
        'alert-success',
        'alert-danger',
        'alert-warning',
        'alert-info'
    );

    box.classList.add(`alert-${type}`);

    box.textContent = msg;
}

function hideAlert() {

    if (DOM.messageBox) {
        DOM.messageBox.classList.add('d-none');
    }
}

function autoHideAlert(delay = CONFIG.ALERT_AUTO_HIDE) {

    setTimeout(() => {
        if (
            DOM.messageBox && !DOM.messageBox.classList.contains('d-none')
        ) {
            hideAlert();
        }
    }, delay);
}

// ============================================
// UPDATE REGISTER BUTTON
// ============================================

function updateRegisterBtn() {

    //     const {
    //         emailVerified,
    //         phoneVerified,
    //         taxValid,
    //         taxAvailable
    //     } = state;

    //     if (!DOM.registerBtn) return;

    //     DOM.registerBtn.disabled = !(
    //         emailVerified &&
    //         phoneVerified &&
    //         taxValid &&
    //         taxAvailable
    //     );
}

// ============================================
// VALIDATE PAN / GST FORMAT
// ============================================

function validateTax() {

    const pan = DOM.panInput.value.trim().toUpperCase();
    const gst = DOM.gstInput.value.trim().toUpperCase();
    const panValid = CONFIG.PAN_PATTERN.test(pan);
    const gstValid = CONFIG.GST_PATTERN.test(gst);

    if (panValid || gstValid) {
        state.taxValid = true;
        DOM.taxHelper.textContent = '✓ Valid tax ID provided';
        DOM.taxHelper.className = 'tax-helper valid';
        return true;
    }

    if (pan.length === 0 && gst.length === 0) {
        state.taxValid = false;
        DOM.taxHelper.textContent = 'Enter PAN or GST (at least one required)';
        DOM.taxHelper.className = 'tax-helper';
        return false;
    }

    state.taxValid = false;

    let msg = 'Invalid format. ';

    if (pan.length > 0) {
        msg += 'PAN: 5 letters, 4 digits, 1 letter. ';
    }

    if (gst.length > 0) {
        msg += 'GST: 15 chars (e.g. 22AAAAA0000A1Z5).';
    }

    DOM.taxHelper.textContent = msg;
    DOM.taxHelper.className = 'tax-helper invalid';
    return false;
}

// ============================================
// CHECK PAN / GST IN DATABASE
// ============================================

async function checkCompanyTaxAvailability() {

    const pan = DOM.panInput.value.trim().toUpperCase() || null;
    const gst = DOM.gstInput.value.trim().toUpperCase() || null;

    // if (!pan && !gst) {
    //     throw new Error(
    //         'Please enter PAN or GST number'
    //     );
    // }

    const { data, error } =
        await supabaseClient.rpc(
            'check_company_registration',
            {
                p_pan: pan,
                p_gst: gst
            }
        );

    if (error) {
        console.error('check_company_registration RPC error:', error);
        throw new Error(
            error.message || 'Unable to check company registration'
        );
    }

    console.log('check_company_registration result:', data
    );


    if (
        data?.exists === true
    ) {

        throw new Error(
            data.message ||
            `Company already registered with ${data.duplicate_type ||
            'this tax number'
            }`
        );
    }

    return true;
}

// ============================================
// HANDLE PAN / GST INPUT
// ============================================

function handleTaxInput() {

    // Convert to uppercase
    DOM.panInput.value = DOM.panInput.value.toUpperCase();
    DOM.gstInput.value = DOM.gstInput.value.toUpperCase();

    // Existing availability is no longer valid
    state.taxAvailable = false;

    // Validate format
    const valid = validateTax();
    // updateRegisterBtn();

    // Cancel previous database request timer

    clearTimeout(taxCheckTimer);

    // Don't check database if format invalid

    if (!valid) {
        return;
    }


    // Wait before querying database

    taxCheckTimer = setTimeout(async () => {

        try {
            await checkCompanyTaxAvailability();
            // Available
            state.taxAvailable = true;
            DOM.taxHelper.textContent = '✓ PAN/GST is available for registration';
            DOM.taxHelper.className = 'tax-helper valid';
            // updateRegisterBtn();
        } catch (error) {
            state.taxAvailable = false;
            DOM.taxHelper.textContent = error.message;
            DOM.taxHelper.className = 'tax-helper invalid';
            // updateRegisterBtn();
            console.warn(
                'Tax availability:',
                error.message
            );
        }
    },
        CONFIG.TAX_CHECK_DELAY
    );
}

// ============================================
// OTP
// ============================================

function isValidOtp(otp) {
    return (otp.length === CONFIG.OTP_LENGTH) && /^\d{6}$/.test(otp);
}

function verifyOtp(otp, type, onSuccess, onError) {

    otp = String(otp || '').trim();

    if (!isValidOtp(otp)) {
        onError('Invalid OTP. Enter the 6-digit OTP.');
        return;
    }

    const isEmail = type === 'email';

    const expectedOtp = isEmail
        ? state.emailOtp
        : state.phoneOtp;

    const expiresAt = isEmail
        ? state.emailOtpExpiresAt
        : state.phoneOtpExpiresAt;

    if (!expectedOtp) {
        onError('Please request a new OTP.');
        return;
    }

    if (!expiresAt || Date.now() > expiresAt) {
        onError('OTP has expired. Please request a new OTP.');
        return;
    }

    if (otp !== expectedOtp) {
        onError('Incorrect OTP. Please try again.');
        return;
    }

    // Successful verification
    if (isEmail) {
        state.emailVerified = true;
        state.emailOtp = null;
        state.emailOtpExpiresAt = null;
    } else {
        state.phoneVerified = true;
        state.phoneOtp = null;
        state.phoneOtpExpiresAt = null;
    }

    onSuccess();
}

function sendOtp(email, phone, onSuccess, onError) {

    try {
        // Generate separate OTPs
        const emailOtp = generateOtp();
        const phoneOtp = generateOtp();

        // Store OTPs
        state.emailOtp = emailOtp;
        state.phoneOtp = phoneOtp;

        // OTP validity: 5 minutes
        state.emailOtpExpiresAt = Date.now() + (5 * 60 * 1000);
        state.phoneOtpExpiresAt = Date.now() + (5 * 60 * 1000);

        // Reset verification
        state.emailVerified = false;
        state.phoneVerified = false;

        console.log('Email OTP:', emailOtp);
        console.log('Phone OTP:', phoneOtp);

        if (CONFIG.DEMO_MODE) {

            console.log('=================================');
            console.log('DEMO OTP');
            console.log('Email:', email);
            console.log('Email OTP:', emailOtp);
            console.log('Phone:', phone);
            console.log('Phone OTP:', phoneOtp);
            console.log('=================================');

            onSuccess();
            return;
        }

        /*
         * PRODUCTION:
         *
         * Do NOT send OTP from browser JavaScript.
         *
         * Call your secure backend / Supabase Edge Function here:
         *
         * await sendOtpFromServer(...)
         *
         * The server should:
         * 1. Generate OTP
         * 2. Hash OTP
         * 3. Store hash in registration_otp
         * 4. Send email OTP
         * 5. Send SMS OTP
         */

        onSuccess();

    } catch (error) {

        console.error('OTP generation error:', error);

        onError(
            error.message ||
            'Unable to generate OTP'
        );
    }
}


// ============================================
// COUNTDOWN
// ============================================

function startCountdown() {

    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
    }

    state.countdown = CONFIG.COUNTDOWN_SECONDS;
    DOM.countdownSpan.textContent = state.countdown;
    DOM.resendBtn.disabled = true;


    state.countdownInterval = setInterval(() => {
        state.countdown--;
        DOM.countdownSpan.textContent = state.countdown;

        if (state.countdown <= 0) {
            clearInterval(state.countdownInterval
            );

            state.countdownInterval = null;
            DOM.resendBtn.disabled = false;
            DOM.countdownSpan.textContent = '0';
        }

    }, 1000);
}

// ============================================
// SEND OTP
// ============================================

function handleSendOtp(e) {

    e.preventDefault();

    const email = DOM.email.value.trim();
    const phone = DOM.phone.value.trim();

    if (!email || !phone) {
        showAlert('Please fill in email and phone before sending OTP.', 'warning');
        autoHideAlert();
        return;
    }

    // if (!validateTax()) {
    //     showAlert('Please provide a valid PAN or GST number.', 'warning');
    //     autoHideAlert();
    //     return;
    // }

    // Important:
    // Tax must already be confirmed available

    if (!state.taxAvailable) {
        showAlert('Please wait until PAN/GST availability is confirmed.', 'warning');
        autoHideAlert();
        return;
    }

    hideAlert();

    DOM.verificationSection.classList.remove('d-none');
    state.emailVerified = false;
    state.phoneVerified = false;

    DOM.emailStatus.innerHTML = '<i class="bi bi-clock"></i> Email not verified';
    DOM.phoneStatus.innerHTML = '<i class="bi bi-clock"></i> Phone not verified';
    DOM.emailOtpMsg.textContent = '';
    DOM.phoneOtpMsg.textContent = '';
    DOM.emailOtpInput.value = '';
    DOM.phoneOtpInput.value = '';

    // updateRegisterBtn();

    sendOtp(email, phone, () => {

        startCountdown();
        showAlert('OTP sent to your email and phone.', 'success');
        autoHideAlert();
    },

        error => {
            showAlert(error || 'Failed to send OTP. Please try again.', 'danger');
        }
    );
}

// ============================================
// RESEND OTP
// ============================================

function handleResendOtp() {

    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }


    const email = DOM.email.value.trim();
    const phone = DOM.phone.value.trim();

    sendOtp(email, phone, () => {

        startCountdown();
        showAlert('OTP resent successfully.', 'success');
        autoHideAlert(CONFIG.SUCCESS_ALERT_HIDE);
    },

        error => {
            showAlert(error || 'Failed to resend OTP. Please try again.', 'danger');
        }
    );
}

// ============================================
// VERIFY EMAIL OTP
// ============================================

function handleVerifyEmail() {

    const otp = DOM.emailOtpInput.value.trim();

    verifyOtp(otp, 'email', () => {
        state.emailVerified = true;
        DOM.emailStatus.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#2e7d32;"></i> Email verified';
        DOM.emailOtpMsg.textContent = '✅ Verified';
        DOM.emailOtpMsg.style.color = '#2e7d32';
        // updateRegisterBtn();
        showAlert('Email OTP verified!', 'success');
        autoHideAlert(CONFIG.SUCCESS_ALERT_HIDE);
    },

        error => {
            DOM.emailOtpMsg.textContent = `❌ ${error}`;
            DOM.emailOtpMsg.style.color = '#dc3545';
        }
    );
}

// ============================================
// VERIFY PHONE OTP
// ============================================

function handleVerifyPhone() {

    const otp = DOM.phoneOtpInput.value.trim();
    verifyOtp(otp, 'phone', () => {

        state.phoneVerified = true;
        DOM.phoneStatus.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#2e7d32;"></i> Phone verified';
        DOM.phoneOtpMsg.textContent = '✅ Verified';
        DOM.phoneOtpMsg.style.color = '#2e7d32';
        // updateRegisterBtn();
        showAlert('Phone OTP verified!', 'success');
        autoHideAlert(CONFIG.SUCCESS_ALERT_HIDE);
    },

        error => {
            DOM.phoneOtpMsg.textContent = `❌ ${error}`;
            DOM.phoneOtpMsg.style.color = '#dc3545';
        }
    );
}

// ============================================
// SUBMIT REGISTRATION
// ============================================

function submitRegistration(data, onSuccess, onError) {

    if (CONFIG.DEMO_MODE) {
        console.log('Registration data:', data);
        onSuccess();
        return;
    }

    console.log('Registration data:', data);
    onSuccess();
}

// ============================================
// FORM SUBMIT
// ============================================

async function handleFormSubmit(e) {

    e.preventDefault();
    if (state.isSubmitting) {
        return;
    }

    // Email / phone

    // if (!state.emailVerified || !state.phoneVerified) {
    //     showAlert('Please verify both email and phone.', 'warning');
    //     autoHideAlert();
    //     return;
    // }

    // Tax format

    // if (!validateTax()) {
    //     showAlert('Please provide a valid PAN or GST number.', 'warning');
    //     autoHideAlert();
    //     return;
    // }

    // IMPORTANT:
    // Check database again before registration

    try {
        await checkCompanyTaxAvailability();
        state.taxAvailable = true;
    } catch (error) {
        state.taxAvailable = false;
        showAlert(error.message, 'danger');
        // updateRegisterBtn();
        return;
    }

    const userName = DOM.userName.value.trim();
    const company = DOM.companyName.value.trim();
    const email = DOM.email.value.trim();
    const phone = DOM.phone.value.trim();
    const pan = DOM.panInput.value.trim().toUpperCase();
    const gst = DOM.gstInput.value.trim().toUpperCase();

    if (!userName || !company) {
        showAlert('User name and company are required.', 'warning');
        autoHideAlert();
        return;
    }

    state.isSubmitting = true;
    DOM.registerBtn.disabled = false;
    DOM.registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Registering...';
    const registrationData = {
        userName, companyName: company, email, phone, pan: pan || null, gst: gst || null, emailVerified: state.emailVerified,
        phoneVerified: state.phoneVerified
    };

    submitRegistration(registrationData, () => {
        state.isSubmitting = false;
        DOM.registerBtn.innerHTML = '<i class="bi bi-check-circle"></i> Complete Registration';
        DOM.registerBtn.disabled = false;

        showAlert('🎉 Registration complete!', 'success');
    },

        error => {
            state.isSubmitting = false;
            DOM.registerBtn.innerHTML = '<i class="bi bi-check-circle"></i> Complete Registration';

            // updateRegisterBtn();

            showAlert(error || 'Registration failed. Please try again.', 'danger');
        }
    );
}

// ============================================
// CLEAR OTP MESSAGES
// ============================================

function clearOtpMessages() {
    DOM.emailOtpMsg.textContent = '';
    DOM.phoneOtpMsg.textContent = '';
}


// ============================================
// INITIALIZATION
// ============================================

function init() {

    validateTax();
    state.taxAvailable = false;
    // updateRegisterBtn();
    if (CONFIG.DEMO_MODE) {
        DOM.userName.value = '';
        DOM.companyName.value = '';
        DOM.email.value = '';
        DOM.phone.value = '';
        DOM.panInput.value = '';
        DOM.gstInput.value = '';
        validateTax();
        // updateRegisterBtn();
    }

    // IMPORTANT:
    // Only ONE listener for PAN

    DOM.panInput.addEventListener('input', handleTaxInput);


    // IMPORTANT:
    // Only ONE listener for GST

    DOM.gstInput.addEventListener('input', handleTaxInput);
    DOM.sendOtpBtn.addEventListener('click', handleSendOtp);
    DOM.resendBtn.addEventListener('click', handleResendOtp);
    DOM.verifyEmailBtn.addEventListener('click', handleVerifyEmail);
    DOM.verifyPhoneBtn.addEventListener('click', handleVerifyPhone);
    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.emailOtpInput.addEventListener('input', clearOtpMessages);
    DOM.phoneOtpInput.addEventListener('input', clearOtpMessages);
    console.log('Registration module initialized.');
}

// ============================================
// PUBLIC API
// ============================================

window.RegistrationModule = {

    validateTax,
    // updateRegisterBtn,
    showAlert,
    hideAlert,
    startCountdown,
    sendOtp,
    verifyOtp,
    submitRegistration,
    checkCompanyTaxAvailability,
    getState: () => ({ ...state }),
    CONFIG,
    reinit: newConfig => {
        Object.assign(CONFIG, newConfig);
        init();
    }
};

// ============================================
// START
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function generateOtp() {
    return String(
        Math.floor(100000 + Math.random() * 900000)
    );
}

