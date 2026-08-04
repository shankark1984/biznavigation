let empID = null;

document.addEventListener('DOMContentLoaded', async () => {

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("dateOfJoining").max = today;
    document.getElementById("dateOfBirth").max = today;
    await loadEmployeeList();
    await loadUserTypes();
    loadDatalist('bloodGroupList', 'BloodGroup');
});

document.getElementById('employeeName')
    .addEventListener('change', onEmployeeSelect);

document.getElementById('saveButton')
    .addEventListener('click', saveEmployee);

document.getElementById('newButton')
    .addEventListener('click', resetEmployeeForm);

document.getElementById('modifyButton')
    .addEventListener('click', enableModifyMode);

document.getElementById('setUserID')
    .addEventListener('click', saveUpdateUserCredentials);

document.getElementById('resetPassword')
    .addEventListener('click', resetUserPassword);

async function loadEmployeeList() {
    try {
        const { data, error } = await supabaseClient
            .from('EmployeeMaster')
            .select('EmployeeCode, EmployeeName')
            .eq('company_id', CompanyID)
            .order('EmployeeName', { ascending: true });

        if (error) throw error;

        const datalist = document.getElementById('employeeList');
        datalist.innerHTML = '';

        data.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.EmployeeName;      // ✅ FIX
            option.dataset.code = emp.EmployeeCode; // ✅ FIX
            datalist.appendChild(option);
        });


    } catch (err) {
        console.error('Error loading employee list:', err);
        alert("Failed to load employee list");
    }
}

async function onEmployeeSelect() {
    const input = document.getElementById('employeeName');
    const selectedName = input.value.trim();
    if (!selectedName) return;

    const option = [...document.getElementById('employeeList').options]
        .find(opt => opt.value === selectedName);

    if (!option) {
        console.warn("Typed name not in list");
        return;
    }

    const employeeCode = option.dataset.code;
    document.getElementById('employeeCode').value = employeeCode;

    await loadEmployeeDetails(employeeCode);
}
async function loadEmployeeDetails(employeeCode) {
    try {
        const { data, error } = await supabaseClient
            .from('EmployeeMaster')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('EmployeeCode', employeeCode)
            .single();

        if (error) throw error;
        empID = data.id;
        await populateEmployeeForm(data);
        setModifyMode();

    } catch (err) {
        console.error('Failed to load employee details:', err);
        alert("Unable to load employee details");
    }
}

async function populateEmployeeForm(emp) {

    document.getElementById('employeeCode').disabled = true;
    document.getElementById('employeeCode').value = emp.EmployeeCode || '';
    document.getElementById('employeeName').value = emp.EmployeeName || '';
    document.getElementById('employeeType').value = emp.EmployeeType || '';
    document.getElementById('dateOfJoining').value = emp.DateofJoining || '';
    document.getElementById('gender').value = emp.Gender || '';
    document.getElementById('maritalStatus').value = emp.MaritalStatus || '';
    document.getElementById('dateOfBirth').value = emp.DateofBirth || '';
    document.getElementById('bloodGroup').value = emp.BloodGroup || '';
    document.getElementById('panNumber').value = emp.PanNumber || '';
    document.getElementById('passportNumber').value = emp.PassportNumber || '';
    document.getElementById('aadharNumber').value = emp.AadharNumber || '';
    document.getElementById('uanNumber').value = emp.UANNumber || '';
    document.getElementById('personalContactNo').value = emp.PersonalContactNo || '';
    document.getElementById('personalEmail').value = emp.PersonalEmailID || '';
    document.getElementById('permanentAddress').value = emp.PermanentAddress || '';
    document.getElementById('currentAddress').value = emp.CurrentAddress || '';
    document.getElementById('employeeStatus').value = emp.EmployeeStatus || '';
    document.getElementById('statusDate').value = emp.StatusDate || '';
    document.getElementById('leavingReason').value = emp.LeavingReason || '';
    document.getElementById('loginID').value = emp.LoginID || '';
    document.getElementById('userType').value = emp.LoginType || '';
    document.getElementById('setUserID').disabled = true
    if (emp.EmployeeCode === emp.LoginID) {
        document.getElementById('resetPassword').disabled = true;
    } else {
        document.getElementById('resetPassword').disabled = false;
    }
}

function setModifyMode() {
    document.getElementById('saveButton').dataset.mode = 'update';
    document.getElementById('modifyButton').disabled = false;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;

    document.getElementById('status').value = 'Modify';
    document.getElementById('saveButton').disabled = true;
    document.getElementById('saveButton').innerHTML = '<i class="bi bi-save"></i> Update';
    disableForm();
}

function getEmployeeFormData() {
    return {
        company_id: CompanyID,
        EmployeeCode: document.getElementById('employeeCode').value.trim(),
        EmployeeName: document.getElementById('employeeName').value.trim(),
        EmployeeType: document.getElementById('employeeType').value,
        DateofJoining: document.getElementById('dateOfJoining').value || null,
        Gender: document.getElementById('gender').value,
        MaritalStatus: document.getElementById('maritalStatus').value,
        DateofBirth: document.getElementById('dateOfBirth').value || null,
        BloodGroup: document.getElementById('bloodGroup').value,
        PanNumber: document.getElementById('panNumber').value,
        PassportNumber: document.getElementById('passportNumber').value,
        AadharNumber: document.getElementById('aadharNumber').value,
        UANNumber: document.getElementById('uanNumber').value,
        PersonalContactNo: document.getElementById('personalContactNo').value,
        PersonalEmailID: document.getElementById('personalEmail').value,
        PermanentAddress: document.getElementById('permanentAddress').value,
        CurrentAddress: document.getElementById('currentAddress').value,
        EmployeeStatus: document.getElementById('employeeStatus').value,
        StatusDate: document.getElementById('statusDate').value || null,
        LeavingReason: document.getElementById('leavingReason').value,
    };
}

function validateEmployee(data) {

    if (!data.EmployeeName) return "Employee Name is required";
    if (!data.PanNumber) return "PAN Number is required";
    if (!data.PersonalEmailID) return "Personal Email is required";
    return null;
}

async function saveEmployee() {
    const btn = document.getElementById('saveButton');
    const spinner = document.getElementById('saveSpinnerBtn');
    const mode = btn.dataset.mode; // insert | update

    const employeeData = getEmployeeFormData();
    const validationError = validateEmployee(employeeData);

    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        btn.disabled = true;

        if (spinner) spinner.classList.remove('d-none');

        if (mode === 'insert') {
            await insertEmployee(employeeData);
        } else {
            await updateEmployee(employeeData);
        }

        alert(`Employee ${mode === 'insert' ? 'saved' : 'updated'} successfully`);
        await loadEmployeeList();
        setModifyMode();

    } catch (err) {
        console.error('Save failed:', err);
        alert(err.message || "Failed to save employee");
    } finally {
        btn.disabled = false;
        if (spinner) spinner.classList.add('d-none');
    }
}

async function insertEmployee(data) {

    data.created_by = UserLoginID;
    data.created_at = localtimeStamp;
    await generateEmployeeCode();
    data.EmployeeCode = document.getElementById('employeeCode').value;
    data.LoginID = data.EmployeeCode;


    const { error } = await supabaseClient
        .from('EmployeeMaster')
        .insert([data]);

    if (error) {
        if (error.code === '23505') {
            throw new Error("Employee Code already exists");
        }
        throw error;
    }
}

async function updateEmployee(data) {
    const employeeCode = document.getElementById('employeeCode').value;

    if (!employeeCode) {
        throw new Error("No employee selected for update");
    }

    data.updated_by = UserLoginID;
    data.updated_at = localtimeStamp;

    const { error } = await supabaseClient
        .from('EmployeeMaster')
        .update(data)
        .eq('company_id', CompanyID)
        .eq('EmployeeCode', employeeCode);

    if (error) throw error;
}

function resetEmployeeForm() {

    document.querySelector('form').reset();

    document.getElementById('saveButton').dataset.mode = 'insert';
    document.getElementById('saveButton').disabled = false;
    document.getElementById('saveButton').innerHTML = '<i class="bi bi-save"></i> Save';
    document.getElementById('employeeCode').value = '';
    document.getElementById('status').value = 'New';

    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    enableForm();
    document.getElementById('employeeCode').disabled = true;

}

function enableModifyMode() {
    const saveBtn = document.getElementById('saveButton');

    // Switch to update mode
    saveBtn.dataset.mode = 'update';
    saveBtn.disabled = false;

    // Lock employee code (never editable)
    document.getElementById('employeeCode').disabled = true;

    // Enable form fields
    enableForm();

    // Disable reset password if loginID matches employeeCode
    if (document.getElementById('employeeCode').value === (document.getElementById('loginID').value)) {
        document.getElementById('resetPassword').disabled = true;
        document.getElementById('setUserID').disabled = false;
    } else {
        document.getElementById('resetPassword').disabled = false;
        document.getElementById('setUserID').disabled = false;
        document.getElementById('setUserID').textContent = 'Update User Type';
        document.getElementById('loginID').disabled = true;
    }

    // Enable buttons
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = false;
    document.getElementById('reportButton').disabled = false;

    // UI state
    document.getElementById('status').value = 'Editing';
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
}

document.getElementById('employeeStatus').addEventListener('change', function () {
    const status = this.value;
    const statusDateInput = document.getElementById('statusDate');
    const leavingReasonInput = document.getElementById('leavingReason');

    if (status === 'Active') {
        statusDateInput.value = '';
        statusDateInput.disabled = true;
        leavingReasonInput.value = '';
        leavingReasonInput.disabled = true;
    } else {
        statusDateInput.disabled = false;
        leavingReasonInput.disabled = false;
    }
});


/* ==============================
   AUTO GENERATE EMPLOYEE CODE
============================== */

async function generateEmployeeCode() {
    try {

        const { data, error } = await supabaseClient.rpc(
            "generate_employee_code",
            {
                p_company_id: CompanyID
            }
        );

        if (error) throw error;

        $("#employeeCode")
            .val(data)
            .prop("readonly", true);

    } catch (err) {
        console.error(err);
        showAlert("Unable to generate Employee Code", "danger");
    }
}
/* ==============================
   END AUTO GENERATE EMPLOYEE CODE
============================== */

async function saveUpdateUserCredentials() {
    try {
        const userID = document.getElementById('loginID').value.trim();
        const userType = document.getElementById('userType').value; // Role ID
        const employeeCode = document.getElementById('employeeCode').value;
        const employeeName = document.getElementById('employeeName').value.trim();
        const tempPassword = await bcrypt.hash(reSetPass, 12);//sha256(reSetPass); // Default password
        const workingBranch = await getUserWorkingBranch(empID);

        /* ==============================
           VALIDATION
        ============================== */
        if (!userID) {
            showToast("Login ID cannot be empty");
            return;
        }

        if (!userType) {
            showToast("Please select User Type");
            return;
        }

        if (employeeCode === userID) {
            showToast("Login ID cannot be the same as Employee Code");
            return;
        }

        /* ==============================
           CHECK DUPLICATE LOGIN ID
        ============================== */
        const { data: dupUser, error: dupError } = await supabaseClient
            .from('user_login')
            .select('emp_code')
            .eq('user_login_id', userID)
            .neq('emp_code', employeeCode)
            .maybeSingle();

        if (dupError) throw dupError;

        if (dupUser) {
            showToast("Login ID already exists");
            return;
        }

        /* ==============================
           UPDATE EMPLOYEE MASTER
        ============================== */
        const { error: empError } = await supabaseClient
            .from('EmployeeMaster')
            .update({
                LoginID: userID,
                LoginType: userType,
                updated_by: UserLoginID,
                updated_at: new Date()
            })
            .eq('company_id', CompanyID)
            .eq('EmployeeCode', employeeCode);

        if (empError) throw empError;

        /* ==============================
           UPSERT USER LOGIN (SAFE)
        ============================== */
        const { data: existingLogin } = await supabaseClient
            .from('user_login')
            .select('emp_code')
            .eq('emp_code', employeeCode)
            .maybeSingle();

        const loginPayload = {
            emp_code: employeeCode,
            user_login_id: userID,
            user_name: employeeName,
            user_type: userType,
            company_id: CompanyID,
            working_branch: workingBranch,
            created_by: UserLoginID,
            created_at: localtimeStamp,
        };

        // Only set password on FIRST INSERT
        if (!existingLogin) {
            loginPayload.user_password = tempPassword; // default (hash later!)
        }

        const { error: loginError } = await supabaseClient
            .from('user_login')
            .upsert(loginPayload, {
                onConflict: 'user_login_id'
            });

        if (loginError) throw loginError;

        showToast("User credentials saved successfully");
        document.getElementById('setUserID').disabled = true;

    } catch (err) {
        console.error("Failed to save/update user credentials:", err);
        showToast(err.message || "Error saving/updating user credentials");
    }
}

async function resetUserPassword() {
    try {
        const userID = document.getElementById('loginID').value.trim();
        const employeeCode = document.getElementById('employeeCode').value;

        if (!userID) {
            showToast("Login ID cannot be empty");
            return;
        }

        if (employeeCode === userID) {
            showToast("Login ID cannot be the same as Employee Code");
            return;
        }
        console.log(typeof bcrypt);
        const tempPassword = sha256(reSetPass); // Default password
        const { error } = await supabaseClient
            .from('user_login')
            .update({
                user_password: tempPassword
            })
            .eq('emp_code', employeeCode)
            .eq('user_login_id', userID);
        if (error) throw error;

        showToast("Password reset successfully to default");
    } catch (err) {
        console.error("Failed to reset user password:", err);
        showToast(err.message || "Error resetting user password");
    }
}
