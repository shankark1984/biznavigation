const branchBankForm = document.getElementById('bank');
const bankAddBtn = document.getElementById('bankAddDetails');
const bankTableBody = document.getElementById('branchBankTableBody');

bankAddBtn.addEventListener("click", async function () {

    const bankData = {
        BankName: document.getElementById("branchBankName").value.trim(),
        AccountNo: document.getElementById("branchAccountNo").value.trim(),
        BranchName: document.getElementById("branchAcBankName").value.trim(),
        IFSCCode: document.getElementById("branchIFSCCode").value.trim().toUpperCase(),
        MICRCode: document.getElementById("branchMICRCode").value.trim(),
        Address: document.getElementById("branchBankAddress").value.trim(),
        DefaultBank: document.getElementById("branchDefaultBank").value,
        BankStatus: document.getElementById("branchAccountStatus").value,
        CompanyID: document.getElementById("companyCode").value.trim(),
        BranchCode: branchCode,
        created_by: UserLoginID
    };

    if (!bankData.BankName || !bankData.AccountNo || !bankData.IFSCCode) {
        alert("Please fill in Bank Name, Account Number and IFSC Code.");
        return;
    }

    try {

        let data, error;

        if (bankRowIDEdit) {

            ({ data, error } = await supabaseClient
                .from("CompanyBankDetails")
                .update(bankData)
                .eq("id", bankRowIDEdit)
                .select());

            if (error) throw error;

            alert("Branch bank updated successfully.");

        } else {

            ({ data, error } = await supabaseClient
                .from("CompanyBankDetails")
                .insert([bankData])
                .select());

            if (error) throw error;

            alert("Branch bank added successfully.");
        }

        resetBranchBankForm();
        loadBanks();

    } catch (error) {

        console.error("Database Error:", error);

        alert(
            `Error Code : ${error.code || ""}\n\n` +
            `Message : ${error.message || error}\n\n` +
            `${error.details || ""}`
        );
    }

});
// Function to Reset Branch Form
function resetBranchBankForm() {

    // Reset edit mode
    bankRowIDEdit = null;

    // Reset all input fields
    const fields = [
        "branchBankName",
        "branchAccountNo",
        "branchAcBankName",
        "branchIFSCCode",
        "branchMICRCode",
        "branchBankAddress"
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Reset dropdowns
    const defaultBank = document.getElementById("branchDefaultBank");
    if (defaultBank) defaultBank.selectedIndex = 0;

    const bankStatus = document.getElementById("branchAccountStatus");
    if (bankStatus) bankStatus.selectedIndex = 0;

    // Reset heading/button text (if available)
    const bankTitle = document.getElementById("branchBankTitle");
    if (bankTitle) {
        bankTitle.innerText = "Add Bank";
    }

    const bankBtn = document.getElementById("bankAddBtn");
    if (bankBtn) {
        bankBtn.innerText = "Add Bank";
    }

    // Remove validation styles
    document.querySelectorAll(
        "#branchBankName, #branchAccountNo, #branchAcBankName, #branchIFSCCode, #branchMICRCode, #branchBankAddress"
    ).forEach(el => {
        el.classList.remove("is-invalid");
        el.classList.remove("is-valid");
    });
}

// Load bank List
async function loadBanks() {
    try {

        const companyCodeEl = document.getElementById("companyCode");

        if (!companyCodeEl) {
            console.error("companyCode element not found.");
            return;
        }

        const CompanyID = companyCodeEl.value.trim();

        if (!CompanyID || !branchCode) {
            bankTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        No Branch Selected
                    </td>
                </tr>`;
            return;
        }

        const { data, error } = await supabaseClient
            .from("CompanyBankDetails")
            .select("*")
            .eq("CompanyID", CompanyID)
            .eq("BranchCode", branchCode)
            .order("BankName", { ascending: true });

        if (error) throw error;

        if (!bankTableBody) {
            console.error("bankTableBody element not found.");
            return;
        }

        if (!data || data.length === 0) {

            bankTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        No Bank Found
                    </td>
                </tr>`;
            return;
        }

        bankTableBody.innerHTML = "";

        data.forEach(bank => {

            bankTableBody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>
                        <input
                            type="checkbox"
                            class="selectBank"
                            data-id="${bank.id}"
                            data-code="${bank.BankName}">
                    </td>
                    <td>${bank.BankName ?? ""}</td>
                    <td>${bank.AccountNo ?? ""}</td>
                    <td>${bank.IFSCCode ?? ""}</td>
                    <td>${bank.BranchName ?? ""}</td>
                    <td>${bank.MICRCode ?? ""}</td>
                    <td>${bank.DefaultBank ?? ""}</td>
                    <td>${bank.BankStatus ?? ""}</td>
                </tr>
            `);

        });

    } catch (error) {

        console.error("Error loading banks:", error);

        alert(error.message || "Unable to load bank details.");

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
                document.getElementById('bankAddDetails').innerText = 'Edit Bank';
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
