// Fetch company data from Supabase
async function fetchCompanyData() {
    try {
        console.log('Fetching company data...' + CompanyID);
        // const CompanyID = localStorage.getItem('CompanyID');
        const { data, error } = await SupabaseService.client
            .from('company_profile')
            .select('*')
            .eq('company_id', CompanyID)
            .single();

        if (error) {
            console.error('Error fetching company data:', error.message);
            alert('Failed to load company data.');
        } else if (data) {
            populateCompanyForm(data);
        }
    } catch (error) {
        console.error('Unexpected error fetching data:', error);
        alert('An unexpected error occurred while fetching company data.');
    }
}

// Populate form fields with the company data
function populateCompanyForm(companyData) {
    document.getElementById('CompID').textContent = companyData.company_id || '';
    document.getElementById('shortCode').value = companyData.short_code || '';
    document.getElementById('companyName').value = companyData.company_name || '';
    document.getElementById('address').value = companyData.address || '';
    document.getElementById('city').value = companyData.city || '';
    document.getElementById('pinCode').value = companyData.pin_code || '';
    document.getElementById('state').value = companyData.state || '';
    document.getElementById('country').value = companyData.country || '';
    document.getElementById('phoneNumber').value = companyData.phone_no || '';
    document.getElementById('email').value = companyData.e_mail || '';
    document.getElementById('gstNumber').value = companyData.gst_number || '';
    document.getElementById('panNumber').value = companyData.pan_number || '';
    document.getElementById('cinNo').value = companyData.cin_no || '';
    document.getElementById('uaNo').value = companyData.Udyog_aadhaar_no || '';
    document.getElementById('website').value = companyData.web_site || '';
    document.getElementById('companylogo').src = companyData.logo_path || '';

    handleUserTypePermissions();
}

// Handle form field permissions based on user type
function handleUserTypePermissions() {
    const userType = parseInt(localStorage.getItem('UserType'), 10);
    const modifyButton = document.getElementById('modifyButton');
    const newButton = document.getElementById('newButton');

    modifyButton.disabled = !(userType === 1 || userType === 2);
    newButton.disabled = userType !== 1;
}

// Enable form inputs
function enableForm() {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = false);
}

// Disable form inputs
function disableForm() {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
}

// Clear form fields
function clearForm() {
    document.querySelectorAll('input, textarea').forEach(el => el.value = '');
    document.getElementById('companylogo').src = '';
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    document.getElementById('CompID').textContent = '';
}

// Modify button event listener
const modifyButton = document.getElementById('modifyButton');
modifyButton.addEventListener('click', () => {
    enableForm();
    document.getElementById('saveButton').disabled = false;
    modifyButton.disabled = true;
    const saveButton = document.getElementById('saveButton');
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.setAttribute('data-mode', 'update');
    // Enable specific fields based on user role (call function later)
    userRoleType();
});

// New button event listener
if (newButton) {
    newButton.addEventListener('click', () => {
        enableForm();

        const saveButton = document.getElementById('saveButton');
        const modifyButton = document.getElementById('modifyButton');
        const companyLogo = document.getElementById('companylogo');

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
            saveButton.setAttribute('data-mode', 'insert');
        }

        if (modifyButton) modifyButton.disabled = true;

        if (companyLogo) {
            companyLogo.src = 'assets/img/logo/default.png';
            companyLogo.alt = 'Default Logo';
        }

        clearForm();

        setEmptyTableMessage('branchTableBody', 'No branches created'); // utils.js function
        setEmptyTableMessage('branchBankTableBody', 'No bank created'); // utils.js function
    });
}

// Save or update form data
document.getElementById('saveButton').addEventListener('click', async event => {
    event.preventDefault();

    const saveButton = event.currentTarget;
    const companyNameElement = document.getElementById('companyName');
    const mode = saveButton.getAttribute('data-mode') || 'insert';

    if (!companyNameElement || companyNameElement.value.trim() === '') {
        alert('Please enter a company name.');
        return;
    }

    const isInsert = mode === 'insert';

    const companyID = isInsert
        ? await generateNewCompanyID(companyNameElement.value)
        : localStorage.getItem('CompanyID');

    const formData = gatherFormData(companyID);

    try {
        const { error } = isInsert
            ? await supabaseClient.from('company_profile').insert([formData])
            : await supabaseClient.from('company_profile').update(formData).eq('company_id', companyID);

        if (error) {
            alert(`❌ Failed to ${isInsert ? 'save' : 'update'} company: ${error.message}`);
            return;
        }

        alert(`✅ Company ${isInsert ? 'saved' : 'updated'} successfully!`);

        // Update UI
        saveButton.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveButton.setAttribute('data-mode', 'update');
        saveButton.disabled = true;

        const modifyButton = document.getElementById('modifyButton');
        if (modifyButton) modifyButton.disabled = false;

        disableForm();

        // Disable branch buttons
        ['branchAddDetails', 'branchBankAddDetails'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });

    } catch (error) {
        console.error('❌ Error saving company:', error);
        alert('Unexpected error occurred. Please try again.');
    }
});


// Gather form data for submission
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

// Format address with proper case
function formatAddress(address) {
    return address ? address.charAt(0).toUpperCase() + address.slice(1).toLowerCase() : '';
}

// Generate new company ID
async function generateNewCompanyID(companyName) {
    const firstLetter = companyName.charAt(0).toUpperCase();

    const { data, error } = await supabaseClient
        .from('company_profile')
        .select('company_id');

    if (error) {
        console.error('Error fetching existing company IDs:', error.message);
        return `C${firstLetter}0001`;
    }

    const existingCodes = data.map(item => item.company_id);
    const filteredCodes = existingCodes.filter(code => code.startsWith(`C${firstLetter}`));

    let highestCount = 0;
    filteredCodes.forEach(code => {
        const count = parseInt(code.slice(2), 10); // Corrected to slice(2) because prefix is C + firstLetter
        if (count > highestCount) highestCount = count;
    });

    const newCount = highestCount + 1;
    return `C${firstLetter}${String(newCount).padStart(4, '0')}`;
}

// User role based field enabling/disabling
function userRoleType() {
    const userType = parseInt(localStorage.getItem('UserType'), 10);
    const isEditable = userType === 1;

    ['shortCode', 'companyName', 'panNumber', 'gstNumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isEditable;
    });
}

// Disable form inputs on page load and fetch company data
document.addEventListener('DOMContentLoaded', () => {
    disableForm();

    const companyID = localStorage.getItem('CompanyID');
    if (companyID) {
        fetchCompanyData(companyID);
    } else {
        console.warn('No CompanyID found in localStorage');
    }

    // Initial button states
    document.getElementById('saveButton').disabled = true;

    // Load branches here if you have the function
    if (typeof loadBranches === 'function') loadBranches();

    // Handle branch buttons enable/disable based on modifyButton state
    const branchAddDetails = document.getElementById('branchAddDetails');
    const branchBankAddDetails = document.getElementById('branchBankAddDetails');
    if (branchAddDetails && branchBankAddDetails) {
        const isModifyDisabled = modifyButton.disabled;
        branchAddDetails.disabled = isModifyDisabled;
        branchBankAddDetails.disabled = isModifyDisabled;
    }
});

// Website URL formatting on blur
document.getElementById('website').addEventListener('blur', function () {
    let url = this.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
        this.value = 'https://' + url;
    }
});

function updateCompanyLogo(companyID) {
    const logoImg = document.getElementById('companylogo');
    const compIDText = document.getElementById('CompID');
    const logoPath = `assets/img/logo/${companyID}.png`;
    const fallbackLogo = 'assets/img/logo/default.png';

    if (!logoImg || !compIDText) return;

    compIDText.textContent = companyID || '...';

    const testImage = new Image();
    testImage.onload = () => {
        console.log(`✅ Logo found: ${logoPath}`);
        logoImg.src = logoPath;
        logoImg.alt = `Logo for ${companyID}`;
    };
    testImage.onerror = () => {
        console.warn(`❌ Logo not found, using fallback: ${fallbackLogo}`);
        logoImg.src = fallbackLogo;
        logoImg.alt = 'Default Logo';
    };

    testImage.src = logoPath;
}

// Update logo on page load
document.addEventListener('DOMContentLoaded', () => {
    // const companyID = 'CA0001'; // Or get dynamically
    updateCompanyLogo(CompanyID);
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
