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

let modifyButton = document.getElementById('modifyButton');
let branchBankAddDetails = document.getElementById("branchBankAddDetails");

document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
    let modifyButton = document.getElementById('modifyButton');
    if (modifyButton.disabled) {
        document.getElementById("branchAddDetails").disabled = !this.value;
        document.getElementById("branchBankAddDetails").disabled = !this.value;
    }
});
document.getElementById("modifyButton").addEventListener("click", function () {
    this.disabled = true; // Disable modifyButton
    document.getElementById("branchAddDetails").disabled = false; // Enable branchAddDetails
});

document.getElementById('website').addEventListener('blur', function () {
    let url = this.value.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        this.value = 'https://' + url; // Default to HTTPS for security
    }
});


const branchForm = document.getElementById('branch');
const branchAddBtn = document.getElementById('branchAddDetails');
const tableBody = document.getElementById('branchTableBody');

const branchBankForm = document.getElementById('bank');
const branchBankAddBtn = document.getElementById('branchBankAddDetails');
const bankTableBody = document.getElementById('branchBankTableBody');

// Add/Edit Branch
branchAddBtn.addEventListener('click', async function () {
    const branchStatus = document.getElementById('branchStatus').value.trim();
    const branchInactiveDate = document.getElementById('branchInactiveDate').value.trim();

    // Check if branchStatus is "Inactive" and InactiveDate is empty
    if (branchStatus.toLowerCase() === "inactive" && !branchInactiveDate) {
        alert('Inactive Date is mandatory when branch status is Inactive.');
        return;
    }

    const branchData = {
        BranchCode: document.getElementById('branchCode').value.trim(),
        Address: document.getElementById('branchAddress').value.trim(),
        PinCode: document.getElementById('branchPinCode').value.trim(),
        City: document.getElementById('branchCity').value.trim(),
        State: document.getElementById('branchState').value.trim(),
        Country: document.getElementById('branchCountry').value.trim(),
        PhoneNo: document.getElementById('branchPhoneNo').value.trim(),
        EmailID: document.getElementById('branchEmailID').value.trim(),
        GSTNo: document.getElementById('branchGSTNo').value.trim(),
        PANNo: document.getElementById('branchPANNo').value.trim(),
        InvYN: document.getElementById('branchInvYN').checked ? 1 : 0,
        BranchScope: document.getElementById('branchScope').value.trim(),
        Status: branchStatus,
        InactiveDate: branchInactiveDate,
        CompanyID: companyID,
        created_by: userLoginID
    };

    // Validate required fields
    if (!branchData.BranchCode || !branchData.GSTNo || !branchData.Address) {
        alert('Please fill in required fields: Branch Code, GST No, and Address.');
        return;
    }

    try {
        let response
        if (rowIDEdit) {
            // Update existing record
            response = await supabaseClient
                .from('CompanyBranchDetails')
                .update(branchData)
                .eq('id', rowIDEdit);

            alert('Branch details updated successfully!');
        } else {
            // Insert new record
            response = await supabaseClient
                .from('CompanyBranchDetails')
                .insert([branchData]);

            alert('Branch added successfully!');
        }

        resetBranchForm();
        loadBranches();
        loadBanks();
    } catch (error) {
        console.error('Database Error:', error);
        alert('Failed to save branch details. Check console for errors.');
    }
});

// Load Branch List
async function loadBranches() {
    try {
        const { data, error } = await supabaseClient
            .from('CompanyBranchDetails')
            .select('*')
            .eq('CompanyID', companyID);

        if (error) throw error;

        tableBody.innerHTML = data.length
            ? data.map(branch => `
                <tr>
                    <td><input type="checkbox" class="selectBranch" data-id="${branch.id}" data-code="${branch.BranchCode}"></td>
                    <td>${branch.BranchCode}</td>
                    <td>${branch.Address}</td>
                    <td>${branch.City}</td>
                    <td>${branch.State}</td>
                    <td>${branch.Country}</td>
                    <td>${branch.PhoneNo}</td>
                    <td>${branch.EmailID}</td>
                    <td>${branch.Status}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="9" class="text-center">No branches created</td></tr>';
    } catch (error) {
        console.error('Error loading branches:', error);
        alert('Failed to load branch details.');
    }
}

// Select and Load Branch Details into the Form
document.addEventListener('change', async function (event) {
    if (event.target.classList.contains('selectBranch')) {
        // Allow only one checkbox selection
        document.querySelectorAll('.selectBranch').forEach(cb => cb.checked = cb === event.target);

        if (event.target.checked) {
            rowIDEdit = parseInt(event.target.getAttribute('data-id'), 10) || null;


            try {
                const { data, error } = await supabaseClient
                    .from('CompanyBranchDetails')
                    .select('*')
                    .eq('id', rowIDEdit)
                    .single();

                if (error) throw error;

                if (!data) {
                    console.error('No branch data found for ID:', rowIDEdit);
                    alert('No branch details found.');
                    return;
                }

                // Populate the form with selected branch data
                document.getElementById('branchCode').value = data.BranchCode || '';
                document.getElementById('branchAddress').value = data.Address || '';
                document.getElementById('branchPinCode').value = data.PinCode || '';
                document.getElementById('branchCity').value = data.City || '';
                document.getElementById('branchState').value = data.State || '';
                document.getElementById('branchCountry').value = data.Country || '';
                document.getElementById('branchPhoneNo').value = data.PhoneNo || '';
                document.getElementById('branchEmailID').value = data.EmailID || '';
                document.getElementById('branchGSTNo').value = data.GSTNo || '';
                document.getElementById('branchPANNo').value = data.PANNo || '';
                document.getElementById('branchInvYN').checked = data.InvYN === true;
                document.getElementById('branchStatus').value = data.Status || '';
                document.getElementById('branchScope').value = data.BranchScope || '';
                branchCode = data.BranchCode || '';

                // Check if modifyButton is disabled and branchCode is selected (not empty)
                if (modifyButton && modifyButton.disabled && branchCode.trim() !== '') {
                    branchBankAddDetails.disabled = false; // Enable the button
                } else {
                    branchBankAddDetails.disabled = true;  // Keep it disabled if conditions are not met
                }

                // Change button text
                branchAddBtn.innerText = 'Edit Branch';

                // Scroll to form smoothly
                branchForm.scrollIntoView({ behavior: 'smooth' });
                // fetchAndDisplayBankDetails();
                loadBanks();

            } catch (error) {
                console.error('Error loading branch details:', error);
                alert('Failed to load branch details.');
            }
        } else {
            // Reset form when no branch is selected
            resetBranchForm();
        }
    }
});

// Function to Reset Branch Form
function resetBranchForm() {
    document.getElementById('branchCode').value = '';
    document.getElementById('branchAddress').value = '';
    document.getElementById('branchPinCode').value = '';
    document.getElementById('branchCity').value = '';
    document.getElementById('branchState').value = '';
    document.getElementById('branchCountry').value = '';
    document.getElementById('branchPhoneNo').value = '';
    document.getElementById('branchEmailID').value = '';
    document.getElementById('branchGSTNo').value = '';
    document.getElementById('branchPANNo').value = '';
    document.getElementById('branchInvYN').checked = false;
    document.getElementById('branchStatus').value = '';
    document.getElementById('branchScope').value = '';
    // Reset UI elements
    rowIDEdit = null;
    document.getElementById('branchAddDetails').innerText = 'Add Branch';
    branchCode = null;
}

branchBankAddBtn.addEventListener('click', async function () {
    const bankData = {
        BankName: document.getElementById('branchBankName').value.trim(),
        AccountNo: document.getElementById('branchAccountNo').value.trim(),
        BranchName: document.getElementById('branchAcBankName').value.trim(),
        IFSCCode: document.getElementById('branchIFSCCode').value.trim(),
        MICRCode: document.getElementById('branchMICRCode').value.trim(),
        Address: document.getElementById('branchBankAddress').value.trim(),
        DefaultBank: document.getElementById('branchDefaultBank').value, // No trim() for dropdown
        BankStatus: document.getElementById('branchAccountStatus').value, // No trim() for dropdown
        CompanyID: companyID,
        BranchCode: branchCode,
        created_by: userLoginID
    };

    // Validate required fields
    if (!bankData.BankName || !bankData.AccountNo || !bankData.IFSCCode) {
        alert('Please fill in required fields: Bank Name, Account Number, and IFSC Code.');
        return;
    }

    try {
        let response;
        if (bankRowIDEdit) {
            // Update existing record
            response = await supabaseClient
                .from('CompanyBankDetails')
                .update(bankData)
                .eq('id', bankRowIDEdit);

            if (response.error) throw response.error;
            alert('Branch bank details updated successfully!');
            bankRowIDEdit = null; // Reset after update
        } else {
            // Insert new record
            response = await supabaseClient
                .from('CompanyBankDetails')
                .insert([bankData]);

            if (response.error) throw response.error;
            alert('Branch bank added successfully!');
        }
        loadBanks();
        resetBranchBankForm();

    } catch (error) {
        console.error('Database Error:', error);
        alert('Failed to save branch details. Please try again.');
    }
});

// Function to Reset Branch Form
function resetBranchBankForm() {
    document.getElementById('branchAccountNo').value = '';
    document.getElementById('branchIFSCCode').value = '';
    document.getElementById('branchBankName').value = '';
    document.getElementById('branchAcBankName').value = '';
    document.getElementById('branchMICRCode').value = '';
    document.getElementById('branchBankAddress').value = '';
    document.getElementById('branchDefaultBank').value = '';
    document.getElementById('branchAccountStatus').value = '';
    // Reset UI elements
    rowIDEdit = null;
    bankRowIDEdit = null;
    document.getElementById('branchBankAddDetails').innerText = 'Add Bank';
    branchCode = null;
}

// Load bank List
async function loadBanks() {
    try {
        const { data, error } = await supabaseClient
            .from('CompanyBankDetails')
            .select('*')
            .eq('CompanyID', companyID)
            .eq('BranchCode', branchCode);

        if (error) throw error;
        if (!data) {
            console.warn('No data returned from Supabase.');
            return;
        }

        if (!bankTableBody) {
            console.error('bankTableBody element not found.');
            return;
        }
        bankTableBody.innerHTML = data.length
            ? data.map(bank => `
                <tr>
                    <td><input type="checkbox" class="selectBank" data-id="${bank.id}" data-code="${bank.BankName}"></td>
                    <td>${bank.BankName}</td>
                    <td>${bank.AccountNo}</td>
                    <td>${bank.IFSCCode}</td>
                    <td>${bank.BranchName}</td>
                    <td>${bank.MICRCode}</td>
                    <td>${bank.DefaultBank}</td>
                    <td>${bank.BankStatus}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="9" class="text-center">No bank created</td></tr>';
    } catch (error) {
        console.error('Error loading bank list:', error.message || error);
        alert('Failed to load bank details. Please try again.');
    }
}

// Select and Load Branch Bank Details into the Form
document.addEventListener('change', async function (event) {
    if (event.target.classList.contains('selectBank')) {
        // Allow only one checkbox selection
        document.querySelectorAll('.selectBank').forEach(cb => cb.checked = cb === event.target);

        if (event.target.checked) {
            bankRowIDEdit = parseInt(event.target.getAttribute('data-id'), 10) || null;


            try {
                const { data, error } = await supabaseClient
                    .from('CompanyBankDetails')
                    .select('*')
                    .eq('id', bankRowIDEdit)
                    .single();

                if (error) throw error;

                if (!data) {
                    console.error('No bank data found for ID:', bankRowIDEdit);
                    alert('No bank details found.');
                    return;
                }

                // Populate the form with selected branch data

                document.getElementById('branchAccountNo').value = data.AccountNo || '';
                document.getElementById('branchIFSCCode').value = data.IFSCCode || '';
                document.getElementById('branchBankName').value = data.BankName || '';
                document.getElementById('branchAcBankName').value = data.BranchName || '';
                document.getElementById('branchMICRCode').value = data.MICRCode || '';
                document.getElementById('branchBankAddress').value = data.Address || '';
                document.getElementById('branchDefaultBank').value = data.DefaultBank || '';
                document.getElementById('branchAccountStatus').value = data.BankStatus || '';
                document.getElementById('branchBankAddDetails').innerText = 'Edit Bank';
                // Scroll to form smoothly
                branchForm.scrollIntoView({ behavior: 'smooth' });


            } catch (error) {
                console.error('Error loading bank details:', error);
                alert('Failed to load bank details.');
            }
        } else {
            // Reset form when no branch is selected
            resetBranchForm();
            loadBanks()
        }
    }
});
