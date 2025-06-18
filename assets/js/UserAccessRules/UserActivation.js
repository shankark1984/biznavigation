document.addEventListener("DOMContentLoaded", () => {
    const employeeCodeInput = document.getElementById('employeeCode');
    const loginIDInput = document.getElementById('loginID');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const form = document.getElementById('userActivationForm');
    const errorMessage = document.getElementById('errorMessage');
    const activateBtn = form.querySelector('button[type="submit"]');
    const spinner = document.getElementById('userActivationSpinner');
    const activateText = document.getElementById('loginButtonText');

    let isValidEmployee = false;

    // Enforce uppercase input for employee code
    employeeCodeInput.addEventListener('input', () => {
        employeeCodeInput.value = employeeCodeInput.value.toUpperCase();
    });

    function togglePasswordFields(show) {
        const display = show ? '' : 'none';
        newPasswordInput.closest('.mb-3').style.display = display;
        confirmPasswordInput.closest('.mb-3').style.display = display;

        if (show) {
            newPasswordInput.focus();
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }

    function hideError() {
        errorMessage.classList.add('d-none');
    }

    async function checkEmployeeExists() {
        const employeeCode = employeeCodeInput.value.trim();
        const loginID = loginIDInput.value.trim();

        if (!employeeCode || !loginID) return;

        // Check for existing login
        const { data: loginData, error: loginError } = await supabaseClient
            .from('user_login')
            .select('id')
            .eq('emp_code', employeeCode)
            .eq('user_login_id', loginID)
            .maybeSingle();

        if (loginError) {
            console.error('Error checking user_login:', loginError);
            showError('Error checking user existence.');
            return;
        }

        if (loginData) {
            isValidEmployee = false;
            togglePasswordFields(false);
            activateBtn.disabled = true;
            showError('Employee already exists. Please reset password.');
            return;
        }

        // Validate employee from EmployeeMaster
        const { data: empData, error: empError } = await supabaseClient
            .from('EmployeeMaster')
            .select('id')
            .eq('EmployeeCode', employeeCode)
            .eq('LoginID', loginID)
            .maybeSingle();

        if (empError) {
            console.error('Error checking EmployeeMaster:', empError);
            showError('Error checking employee record.');
            isValidEmployee = false;
            return;
        }

        if (empData) {
            isValidEmployee = true;
            togglePasswordFields(true);
            hideError();
        } else {
            isValidEmployee = false;
            togglePasswordFields(false);
            activateBtn.disabled = true;
            showError('Invalid employee code or username.');
        }
    }

    function validatePasswords() {
        const pwd = newPasswordInput.value;
        const confirmPwd = confirmPasswordInput.value;

        if (pwd && confirmPwd && pwd !== confirmPwd) {
            showError('Confirm password not matching.');
            activateBtn.disabled = true;
        } else if (isValidEmployee && pwd && confirmPwd) {
            hideError();
            activateBtn.disabled = false;
        } else {
            activateBtn.disabled = true;
        }
    }

    async function UserActivation(event) {
        const employeeCode = employeeCodeInput.value.trim().toUpperCase();
        const loginID = loginIDInput.value.trim();
        const password = newPasswordInput.value;

        if (!isValidEmployee || !password) return;

        spinner.classList.remove('d-none');
        activateText.textContent = 'Activating...';
        activateBtn.disabled = true;

        try {
            const hashedPassword = sha256(password);

            // Get LoginType from EmployeeMaster
            const { data: employeeData, error: employeeError } = await supabaseClient
                .from('EmployeeMaster')
                .select('id, EmployeeName,company_ID, LoginType')
                .eq('LoginID', loginID)
                .maybeSingle();

            if (employeeError || !employeeData) {
                throw new Error('Unable to fetch employee type.');
            }

            const employeeID = employeeData.id;
            const userType = employeeData.LoginType;
            const employeeName = employeeData.EmployeeName;
            const employeeCompanyID = employeeData.company_ID;

            // Get latest working branch
            const { data: branchData, error: branchError } = await supabaseClient
                .from('EmployeeWorkingDetails')
                .select('WorkLocation')
                .eq('EM_ID', employeeID)
                .order('EffectiveDate', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (branchError || !branchData) {
                throw new Error('Unable to fetch working branch.');
            }

            const workingBranch = branchData.WorkLocation || 'All';

            // Insert new login record
            const { error: insertError } = await supabaseClient
                .from('user_login')
                .insert([{
                    emp_code: employeeCode,
                    user_name: employeeName,
                    user_login_id: loginID,
                    user_password: hashedPassword,
                    user_type: userType,
                    company_id: employeeCompanyID,
                    working_branch: workingBranch,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);

            if (insertError) {
                console.error('Activation failed:', insertError);
                showError('Activation failed. Try again.');
                return;
            }

            alert('User activated successfully! Redirecting to login...');
            window.location.href = 'index.html';

        } catch (err) {
            console.error('Unexpected error:', err);
            showError(err.message || 'Unexpected error occurred.');
        } finally {
            spinner.classList.add('d-none');
            activateText.textContent = 'Activate';
            activateBtn.disabled = false;
        }
    }

    // Bind Events
    employeeCodeInput.addEventListener('blur', checkEmployeeExists);
    loginIDInput.addEventListener('blur', checkEmployeeExists);
    newPasswordInput.addEventListener('input', validatePasswords);
    confirmPasswordInput.addEventListener('input', validatePasswords);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await UserActivation(e);
    });

    // Init hidden state
    togglePasswordFields(false);
    activateBtn.disabled = true;
});
