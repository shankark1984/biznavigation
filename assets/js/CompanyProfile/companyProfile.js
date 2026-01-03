// 🌐 Company Registration Initialization
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initCompanyRegistration();
    } catch (err) {
        console.error("Initialization error:", err);
        alert("Error initializing the page.");
    }
});

async function initCompanyRegistration() {
    const companyID = localStorage.getItem('CompanyID');
    const userLoginID = localStorage.getItem('UserLoginID');
    const userType = parseInt(localStorage.getItem('UserType'), 10) || 0;

    // Initial UI setup
    setFormState(false);
    setButtonState(['branchAddDetails', 'branchBankAddDetails'], false);
    handleUserTypePermissions(userType);

    // Permission check
    const accessGranted = await checkAccess(userLoginID, 'companyProfile');
    if (!accessGranted) {
        alert("You do not have permission to view this form.");
        return;
    }

    // Fetch company data if exists
    if (companyID) await fetchCompanyData(companyID);
    else console.warn("⚠️ No CompanyID found in localStorage");

    // Update logo
    updateCompanyLogo(companyID);

    // Bind Events
    bindEvents(userType);
}

/* ---------------------- 🔧 Utility Functions ---------------------- */
function setFormState(enabled) {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = !enabled);
}

function setButtonState(buttonIDs, enabled) {
    buttonIDs.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });
}

/* ---------------------- 🔐 Access Check ---------------------- */
// async function checkAccess(userLoginID, formID) {
//     if (!userLoginID) return false;
//     try {
//         const { data, error } = await supabaseClient
//             .from('UserAccessRules')
//             .select('CanRead, CanWrite, CanDelete, CanUpdate')
//             .eq('UserLoginID', userLoginID)
//             .eq('FormID', formID)
//             .maybeSingle();

//         if (error || !data) throw error;

//         window.perRead = !!data.CanRead;
//         window.perWrite = !!data.CanWrite;
//         window.perDelete = !!data.CanDelete;
//         window.perUpdate = !!data.CanUpdate;

//         return window.perRead;
//     } catch (err) {
//         console.error("Access check failed:", err);
//         return false;
//     }
// }

/* ---------------------- 🏢 Company Data Handling ---------------------- */
async function fetchCompanyData(companyID) {
    try {
        const { data, error } = await SupabaseService.client
            .from('company_profile')
            .select('*')
            .eq('company_id', companyID)
            .single();

        if (error) throw error;
        if (data) populateCompanyForm(data);
    } catch (err) {
        console.error("Error fetching company data:", err.message);
        alert("Failed to load company data.");
    }
}

function populateCompanyForm(data) {
    const fieldMap = {
        CompID: data.company_id,
        shortCode: data.short_code,
        companyName: data.company_name,
        address: data.address,
        city: data.city,
        pinCode: data.pin_code,
        state: data.state,
        country: data.country,
        phoneNumber: data.phone_no,
        email: data.e_mail,
        gstNumber: data.gst_number,
        panNumber: data.pan_number,
        cinNo: data.cin_no,
        uaNo: data.Udyog_aadhaar_no,
        website: data.web_site
    };
    Object.entries(fieldMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    });
    const logo = document.getElementById('companylogo');
    if (logo) logo.src = data.logo_path || '../../assets/img/logo/default.png';
}

/* ---------------------- 👤 User Permission ---------------------- */
function handleUserTypePermissions(userType) {
    const modifyBtn = document.getElementById('modifyButton');
    const newBtn = document.getElementById('newButton');
    if (modifyBtn) modifyBtn.disabled = !(userType === 1 || userType === 2);
    if (newBtn) newBtn.disabled = userType !== 1;
}

function userRoleType() {
    const editable = parseInt(localStorage.getItem('UserType'), 10) === 1;
    enableEditFields(['shortCode', 'companyName', 'panNumber', 'gstNumber'], editable);
}

function enableEditFields(fields, editable) {
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !editable;
    });
}

/* ---------------------- 🧼 Form Management ---------------------- */
function clearForm() {
    document.querySelectorAll('input, textarea').forEach(el => el.value = '');
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    const logo = document.getElementById('companylogo');
    if (logo) logo.src = '../../assets/img/logo/default.png';
    const compID = document.getElementById('CompID');
    if (compID) compID.textContent = '';
}

/* ---------------------- 🎛️ Event Handlers ---------------------- */
function bindEvents(userType) {
    const modifyBtn = document.getElementById("modifyButton");
    const newBtn = document.getElementById("newButton");
    const saveBtn = document.getElementById("saveButton");

    modifyBtn?.addEventListener("click", onModifyClick);
    newBtn?.addEventListener("click", onNewClick);
    saveBtn?.addEventListener("click", onSaveClick);

    document.getElementById("website")?.addEventListener("blur", enforceURLProtocol);

    // Validation bindings
    const validators = [
        ['gstNumber', 'gstFeedback', 'company_profile', 'gst_number', validateGSTInput],
        ['panNumber', 'panFeedback', 'company_profile', 'pan_number', validatePANInput],
        ['branchGSTNo', 'branchGSTFeedback', 'CompanyBranchDetails', 'GSTNo', validateGSTInput],
        ['branchPANNo', 'branchPANFeedback', 'CompanyBranchDetails', 'PANNo', validatePANInput]
    ];
    validators.forEach(([input, feedback, table, column, validator]) => bindValidation(input, feedback, table, column, validator));

    if (typeof loadBranches === "function") loadBranches();
}

function onModifyClick() {
    setFormState(true);

    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
        saveBtn.dataset.mode = 'update';
    }

    const modifyBtn = document.getElementById('modifyButton');
    if (modifyBtn) modifyBtn.disabled = true;

    userRoleType(); // this might re-enable fields based on role

    // 🔹 Now disable GST and PAN after all enabling logic
    const gstNumber = document.getElementById('gstNumber');
    const panNumber = document.getElementById('panNumber');
    if (gstNumber) gstNumber.disabled = true;
    if (panNumber) panNumber.disabled = true;

    setButtonState(['branchAddDetails', 'branchBankAddDetails'], true);
}


function onNewClick() {
    setFormState(true);
    clearForm();
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        saveBtn.dataset.mode = 'insert';
    }
    setEmptyTableMessage('branchTableBody', 'No branches created');
    setEmptyTableMessage('branchBankTableBody', 'No bank created');
    setButtonState(['branchAddDetails', 'branchBankAddDetails'], false);
}

/* ---------------------- 💾 Save / Update ---------------------- */
async function onSaveClick(e) {
    e.preventDefault();
    const saveBtn = e.currentTarget;
    const mode = saveBtn.dataset.mode || 'insert';
    const isInsert = mode === 'insert';

    const companyName = document.getElementById('companyName')?.value.trim();
    if (!companyName) return alert('Please enter a company name.');

    const companyID = isInsert
        ? await generateNewCompanyID(companyName)
        : localStorage.getItem('CompanyID');

    const formData = gatherFormData(companyID);

    try {
        const { error } = isInsert
            ? await supabaseClient.from('company_profile').insert([formData])
            : await supabaseClient.from('company_profile').update(formData).eq('company_id', companyID);

        if (error) throw error;

        alert(`Company ${isInsert ? 'saved' : 'updated'} successfully!`);
        saveBtn.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveBtn.dataset.mode = 'update';
        saveBtn.disabled = true;
        document.getElementById('modifyButton').disabled = false;
        setFormState(false);
        setButtonState(['branchAddDetails', 'branchBankAddDetails'], false);
        modifyButton.disabled = false;

    } catch (err) {
        console.error("Error saving company:", err);
        alert("Unexpected error occurred. Please try again.");
    }
}

/* ---------------------- 🧩 Form Data Builder ---------------------- */
function gatherFormData(companyID) {
    const getVal = id => document.getElementById(id)?.value.trim() || '';
    return {
        company_id: companyID,
        short_code: getVal('shortCode').toUpperCase(),
        company_name: getVal('companyName'),
        address: formatAddress(getVal('address')),
        city: getVal('city'),
        pin_code: getVal('pinCode'),
        state: getVal('state'),
        country: getVal('country'),
        phone_no: getVal('phoneNumber'),
        e_mail: getVal('email'),
        gst_number: getVal('gstNumber').toUpperCase(),
        pan_number: getVal('panNumber').toUpperCase(),
        cin_no: getVal('cinNo').toUpperCase(),
        Udyog_aadhaar_no: getVal('uaNo').toUpperCase(),
        web_site: getVal('website'),
        logo_path: document.getElementById('companylogo')?.src || '',
        created_by: localStorage.getItem('UserLoginID') || 'unknown'
    };
}

function formatAddress(address) {
    return address ? address.charAt(0).toUpperCase() + address.slice(1).toLowerCase() : '';
}

/* ---------------------- 🆔 Company ID Generation ---------------------- */
async function generateNewCompanyID(companyName) {
    const prefix = `C${companyName.charAt(0).toUpperCase()}`;
    try {
        const { data, error } = await supabaseClient.from('company_profile').select('company_id');
        if (error || !data?.length) return `${prefix}0001`;

        const maxNum = data
            .filter(r => r.company_id?.startsWith(prefix))
            .map(r => parseInt(r.company_id.slice(2), 10) || 0)
            .reduce((max, n) => Math.max(max, n), 0);

        return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
    } catch {
        return `${prefix}0001`;
    }
}

/* ---------------------- 🌐 Misc Utilities ---------------------- */
function enforceURLProtocol() {
    if (!this.value.trim()) return;
    if (!/^https?:\/\//i.test(this.value.trim())) {
        this.value = 'https://' + this.value.trim();
    }
}

function bindValidation(inputID, feedbackID, table, column, validator) {
    const input = document.getElementById(inputID);
    if (input) input.addEventListener('blur', () => validator(inputID, feedbackID, table, column));
}

/* ---------------------- 🖼️ Logo Update ---------------------- */
function updateCompanyLogo(companyID) {
    const logo = document.getElementById('companylogo');
    if (!logo) return;
    const fallback = '../../assets/img/logo/default.png';
    const path = `../../assets/img/logo/${companyID}.png`;
    logo.onerror = () => { logo.src = fallback; logo.alt = 'Default Logo'; };
    logo.onload = () => { logo.alt = `Logo for ${companyID}`; };
    logo.src = companyID ? path : fallback;
}
