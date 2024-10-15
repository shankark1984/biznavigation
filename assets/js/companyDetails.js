// Fetch company data from Supabase
async function fetchCompanyData(companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('company_profile')
            .select('*')
            .eq('company_id', companyID)
            .single(); // We expect only one company record

        if (error) {
            console.error('Error fetching company data:', error.message);
        } else {
            populateCompanyForm(data);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Populate the form fields with the company data
function populateCompanyForm(companyData) {
    document.getElementById('CompID').textContent = companyData.company_id || ''; // Show the CompanyID
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

    modifyButton.disabled = !(userType === 1 || userType === 2); // Only users of type 1 and 2 can modify
    newButton.disabled = userType !== 1; // Only user of type 1 can create new entries
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
    document.getElementById('companylogo').src = ''; // Clear logo field
}

// Modify button event listener
document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Update';
});

// New button event listener
document.getElementById('newButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "New" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Save';
    clearForm();  // Clear the form for a new entry
});

// Save or update form data
document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();

    const saveButton = document.getElementById('saveButton');
    const companyNameElement = document.getElementById('companyName');

    if (!companyNameElement || companyNameElement.value.trim() === '') {
        console.error('Company name field not found or empty!');
        alert('Please enter a company name.');
        return; // Exit if the companyName element is not found or is empty
    }

    const companyID = saveButton.textContent === 'Save'
        ? await generateNewCompanyID(companyNameElement.value)
        : localStorage.getItem('CompanyID'); // Use existing Company ID for updates

    const formData = gatherFormData(companyID);

    try {
        const action = saveButton.textContent === 'Save' ? 'insert' : 'update';
        let response;

        if (action === 'insert') {
            response = await supabaseClient
                .from('company_profile')
                .insert([formData]);
        } else {
            response = await supabaseClient
                .from('company_profile')
                .update(formData)
                .eq('company_id', companyID);
        }

        if (response.error) {
            alert(`Failed to ${action === 'insert' ? 'save' : 'update'} company: ${response.error.message}`);
        } else {
            alert(`Company ${action === 'insert' ? 'saved' : 'updated'} successfully!`);
            if (action === 'insert') {
                saveButton.textContent = 'Update';
                document.getElementById('modifyButton').disabled = false;
            }
        }
    } catch (error) {
        console.error('Error saving company:', error);
        alert('Failed to save or update company data.');
    }
});

// Gather form data for submission
function gatherFormData(companyID) {
    return {
        company_id: companyID,
        short_code: document.getElementById('shortCode').value,
        company_name: document.getElementById('companyName').value,
        address: formatAddress(document.getElementById('address').value),
        city: document.getElementById('city').value,
        pin_code: document.getElementById('pinCode').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value,
        phone_no: document.getElementById('phoneNumber').value,
        e_mail: document.getElementById('email').value,
        gst_number: document.getElementById('gstNumber').value.toUpperCase(),
        pan_number: document.getElementById('panNumber').value.toUpperCase(),
        cin_no: document.getElementById('cinNo').value,
        Udyog_aadhaar_no: document.getElementById('uaNo').value,
        web_site: document.getElementById('website').value,
        logo_path: document.getElementById('companylogo').src,
        created_by: localStorage.getItem('UserLoginID') || 'unknown' // You can store the creator info
    };
}

// Format address with proper case
function formatAddress(address) {
    return address ? address.charAt(0).toUpperCase() + address.slice(1).toLowerCase() : '';
}

// Example function to generate new company ID (if required)
async function generateNewCompanyID(companyName) {
    const firstLetter = companyName.charAt(0).toUpperCase();
    const { data, error } = await supabaseClient
        .from('company_profile')
        .select('company_id'); // Get existing IDs

    if (error) {
        console.error('Error fetching existing company IDs:', error.message);
        return `C${firstLetter}0001`; // Fallback ID if error occurs
    }

    const existingCodes = data.map(item => item.company_id);
    const filteredCodes = existingCodes.filter(code => code.startsWith(firstLetter));

    let highestCount = 0;
    filteredCodes.forEach(code => {
        const count = parseInt(code.slice(1), 10); // Get the number part of the code
        if (count > highestCount) {
            highestCount = count;
        }
    });

    const newCount = highestCount + 1;
    return `C${firstLetter}${String(newCount).padStart(4, '0')}`; // Pad with zeros
}

// When the page loads, fetch the company data
document.addEventListener('DOMContentLoaded', function () {
    disableForm();  // Disable all inputs on page load
    const companyID = localStorage.getItem('CompanyID');
    if (companyID) {
        fetchCompanyData(companyID);
    } else {
        console.error('No CompanyID found in localStorage');
    }
});
