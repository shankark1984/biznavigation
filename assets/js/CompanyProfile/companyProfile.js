// On DOM ready
document.addEventListener("DOMContentLoaded", async () => {
    disableForm();

    const accessGranted = await checkAccess(UserLoginID, 'PartyRegistration');
    if (!accessGranted) {
        alert("You do not have permission to view this form.");
        return;
    }

    if (perWrite) document.getElementById('saveButton').disabled = false;

    const companyID = localStorage.getItem('CompanyID');
    if (companyID) await fetchCompanyData(companyID);
    else console.warn('No CompanyID found in localStorage');

    handleUserTypePermissions();
    enableForm();

    updateCompanyLogo(companyID);
    if (typeof loadBranches === 'function') loadBranches();

    ['branchAddDetails', 'branchBankAddDetails'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = document.getElementById('modifyButton').disabled;
    });
});

async function checkAccess(userLoginID, formID) {
    try {
        const { data, error } = await supabaseClient
            .from('UserAccessRules')
            .select('CanRead, CanWrite, CanDelete, CanUpdate')
            .eq('UserLoginID', userLoginID)
            .eq('FormID', formID)
            .maybeSingle();

        if (error || !data) throw new Error('Permission denied or fetch error');

        perRead = data.CanRead ?? false;
        perWrite = data.CanWrite ?? false;
        perDelete = data.CanDelete ?? false;
        perUpdate = data.CanUpdate ?? false;

        return !!perRead;
    } catch (err) {
        console.error(err);
        return false;
    }
}

async function fetchCompanyData(companyID) {
    try {
        const { data, error } = await SupabaseService.client
            .from('company_profile')
            .select('*')
            .eq('company_id', companyID)
            .single();

        if (error) throw error;
        if (data) populateCompanyForm(data);
    } catch (error) {
        console.error('Error fetching company data:', error.message);
        alert('Failed to load company data.');
    }
}

function populateCompanyForm(data) {
    const map = {
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
    for (let id in map) document.getElementById(id).value = map[id] || '';
    document.getElementById('companylogo').src = data.logo_path || '';
}

function handleUserTypePermissions() {
    const userType = parseInt(localStorage.getItem('UserType'), 10);
    document.getElementById('modifyButton').disabled = !(userType === 1 || userType === 2);
    document.getElementById('newButton').disabled = userType !== 1;
}

function enableForm() {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = false);
}

function disableForm() {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
}

function clearForm() {
    document.querySelectorAll('input, textarea').forEach(el => el.value = '');
    document.getElementById('companylogo').src = '';
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    document.getElementById('CompID').textContent = '';
}

document.getElementById('modifyButton').addEventListener('click', () => {
    enableForm();
    const saveBtn = document.getElementById('saveButton');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
    saveBtn.setAttribute('data-mode', 'update');
    userRoleType();
});

document.getElementById('newButton')?.addEventListener('click', () => {
    enableForm();
    clearForm();
    const saveBtn = document.getElementById('saveButton');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
    saveBtn.setAttribute('data-mode', 'insert');
    document.getElementById('companylogo').src = 'assets/img/logo/default.png';
    setEmptyTableMessage('branchTableBody', 'No branches created');
    setEmptyTableMessage('branchBankTableBody', 'No bank created');
});

document.getElementById('saveButton').addEventListener('click', async e => {
    e.preventDefault();

    const saveBtn = e.currentTarget;
    const mode = saveBtn.getAttribute('data-mode') || 'insert';
    const isInsert = mode === 'insert';
    const companyName = document.getElementById('companyName').value.trim();
    if (!companyName) return alert('Please enter a company name.');

    const companyID = isInsert ? await generateNewCompanyID(companyName) : localStorage.getItem('CompanyID');
    const formData = gatherFormData(companyID);

    try {
        const { error } = isInsert
            ? await supabaseClient.from('company_profile').insert([formData])
            : await supabaseClient.from('company_profile').update(formData).eq('company_id', companyID);

        if (error) throw error;

        alert(`Company ${isInsert ? 'saved' : 'updated'} successfully!`);
        saveBtn.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveBtn.setAttribute('data-mode', 'update');
        saveBtn.disabled = true;
        document.getElementById('modifyButton').disabled = false;
        disableForm();

        ['branchAddDetails', 'branchBankAddDetails'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });

    } catch (error) {
        console.error('Error saving company:', error);
        alert('Unexpected error occurred. Please try again.');
    }
});

function gatherFormData(companyID) {
    return {
        company_id: companyID,
        short_code: document.getElementById('shortCode').value.trim().toUpperCase(),
        company_name: document.getElementById('companyName').value.trim(),
        address: formatAddress(document.getElementById('address').value.trim()),
        city: document.getElementById('city').value.trim(),
        pin_code: document.getElementById('pinCode').value.trim(),
        state: document.getElementById('state').value.trim(),
        country: document.getElementById('country').value.trim(),
        phone_no: document.getElementById('phoneNumber').value.trim(),
        e_mail: document.getElementById('email').value.trim(),
        gst_number: document.getElementById('gstNumber').value.trim().toUpperCase(),
        pan_number: document.getElementById('panNumber').value.trim().toUpperCase(),
        cin_no: document.getElementById('cinNo').value.trim().toUpperCase(),
        Udyog_aadhaar_no: document.getElementById('uaNo').value.trim().toUpperCase(),
        web_site: document.getElementById('website').value.trim(),
        logo_path: document.getElementById('companylogo').src || '',
        created_by: localStorage.getItem('UserLoginID') || 'unknown'
    };
}

function formatAddress(address) {
    return address ? address.charAt(0).toUpperCase() + address.slice(1).toLowerCase() : '';
}

async function generateNewCompanyID(companyName) {
    const prefix = `C${companyName.charAt(0).toUpperCase()}`;
    const { data, error } = await supabaseClient.from('company_profile').select('company_id');

    if (error) return `${prefix}0001`;

    const maxCount = data
        .map(item => item.company_id)
        .filter(id => id.startsWith(prefix))
        .reduce((max, id) => Math.max(max, parseInt(id.slice(2), 10) || 0), 0);

    return `${prefix}${String(maxCount + 1).padStart(4, '0')}`;
}

function userRoleType() {
    const editable = parseInt(localStorage.getItem('UserType'), 10) === 1;
    ['shortCode', 'companyName', 'panNumber', 'gstNumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !editable;
    });
}

document.getElementById('website').addEventListener('blur', function () {
    const val = this.value.trim();
    if (val && !/^https?:\/\//i.test(val)) this.value = 'https://' + val;
});

document.getElementById('gstNumber').addEventListener('blur', async () => {
    await validateGSTInput('gstNumber', 'gstFeedback', 'company_profile', 'gst_number');
});
document.getElementById('panNumber').addEventListener('blur', async () => {
    await validatePANInput('panNumber', 'panFeedback', 'company_profile', 'pan_number');
});
document.getElementById('branchGSTNo').addEventListener('blur', async () => {
    await validateGSTInput('branchGSTNo', 'branchGSTFeedback', 'CompanyBranchDetails', 'GSTNo');
});
document.getElementById('branchPANNo').addEventListener('blur', async () => {
    await validatePANInput('branchPANNo', 'branchPANFeedback', 'CompanyBranchDetails', 'PANNo');
});

function updateCompanyLogo(companyID) {
    const logo = document.getElementById('companylogo');
    const fallback = '../../assets/img/logo/default.png';
    const path = `../../assets/img/logo/${companyID}.png`;

    if (!logo) return;

    const img = new Image();
    img.onload = () => {
        logo.src = path;
        logo.alt = `Logo for ${companyID}`;
    };
    img.onerror = () => {
        logo.src = fallback;
        logo.alt = 'Default Logo';
    };
    img.src = path;
}
