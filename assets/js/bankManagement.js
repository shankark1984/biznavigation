const branchBankForm = document.getElementById('bank');
const branchBankAddBtn = document.getElementById('branchBankAddDetails');
const bankTableBody = document.getElementById('branchBankTableBody');

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
