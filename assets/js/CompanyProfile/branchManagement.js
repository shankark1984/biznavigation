const branchForm = document.getElementById('branch');
const branchAddBtn = document.getElementById('branchAddDetails');
const tableBody = document.getElementById('branchTableBody');

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
            .eq('CompanyID', CompanyID);

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