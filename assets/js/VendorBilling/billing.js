document.getElementById('chargesType').addEventListener('change', onChargeTypeOrPartyChange);

document.addEventListener('DOMContentLoaded', async function () {
    document.getElementById('accountedDate').value =
        new Date().toISOString().split('T')[0];

    setTimeout(() => {
        bindBillSearch();
    }, 500); // important for sidebar/layout injection

    await loadExpenseTypeDropdown();
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);

    loadTaxData();
})


document.getElementById("saveButton").addEventListener("click", async function () {
    const mode = document.getElementById("mode").value;

    if (mode === "insert") {
        await saveVendorBilling();
    } else {
        await updateVendorBilling();
    }
    disableForm();
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    modifyButton.disabled = false;
});

// Validate datalist input
function validateDatalist(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);

    const validOptions = Array.from(datalist.options).map(
        option => option.value
    );

    if (!validOptions.includes(input.value.trim())) {
        input.value = '';
    }
}

// Expense Type Load
async function loadExpenseTypeDropdown() {
    const expenseTypeList = document.getElementById('expenseTypeList');

    expenseTypeList.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('description')
        .eq('type_of_value', 'expenseType')
        .order('description', { ascending: true });

    if (error) {
        console.error('Error loading expense types:', error);
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.description;
        expenseTypeList.appendChild(option);
    });
}

// Expense For Load
async function loadExpenseForDropdown() {

    const expenseType = document.getElementById('expenseType').value.trim();

    const expenseForList = document.getElementById('expenseForList');
    const expenseForInput = document.getElementById('expenseFor');

    expenseForList.innerHTML = '';
    expenseForInput.value = '';

    if (!expenseType) return;

    // Convert:
    // "Administrative Expenses" => "administrativeExpenses"
    const typeOfValue = expenseType
        .split(/\s+/)
        .map((word, index) =>
            index === 0
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('description')
        .eq('type_of_value', typeOfValue)
        .order('description', { ascending: true });

    if (error) {
        console.error('Error loading expense for list:', error);
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.description;
        expenseForList.appendChild(option);
    });
}

// Event Listeners
document.getElementById('expenseType').addEventListener('change', loadExpenseForDropdown);

document.getElementById('expenseFor').addEventListener('blur', () => {
    validateDatalist('expenseFor', 'expenseForList');
});

document.getElementById('billDate').addEventListener('change', function () {

    const billDateValue = this.value;

    if (!billDateValue) return;

    const dueDate = new Date(billDateValue);

    // Add 30 days
    dueDate.setDate(dueDate.getDate() + 30);

    document.getElementById('dueDate').value =
        dueDate.toISOString().split('T')[0];

});
function updateTotals() {

    let totalNonTaxable = 0;
    let totalTaxable = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    document.querySelectorAll("#pendingShipmentTable tbody tr").forEach(row => {

        // Ignore hidden/deleted rows
        if (row.style.display === "none") return;

        totalNonTaxable += parseFloat(row.cells[4].innerText || 0);
        totalTaxable += parseFloat(row.cells[5].innerText || 0);
        totalSGST += parseFloat(row.cells[6].innerText || 0);
        totalCGST += parseFloat(row.cells[7].innerText || 0);
        totalIGST += parseFloat(row.cells[8].innerText || 0);
        totalGST += parseFloat(row.cells[9].innerText || 0);
        grandTotal += parseFloat(row.cells[10].innerText || 0);
    });

    document.getElementById("totalNonTaxableAmount").innerText = totalNonTaxable.toFixed(2);
    document.getElementById("totalTaxableAmount").innerText = totalTaxable.toFixed(2);
    document.getElementById("totalSGSTAmount").innerText = totalSGST.toFixed(2);
    document.getElementById("totalCGSTAmount").innerText = totalCGST.toFixed(2);
    document.getElementById("totalIGSTAmount").innerText = totalIGST.toFixed(2);
    document.getElementById("totalGSTAmount").innerText = totalGST.toFixed(2);
    document.getElementById("grandTotalAmount").innerText = grandTotal.toFixed(2);
}

document.getElementById("addChargesDetails").addEventListener("click", async function () {

    const chargesType = document.getElementById("chargesType").value;
    const shipmentNo = document.getElementById("shipmentNo").value;

    const nonTaxable = parseFloat(document.getElementById("nonTaxableAmount").value || 0);
    const taxableAmt = parseFloat(document.getElementById("taxableAmount").value || 0);

    const taxID = parseFloat(document.getElementById("partyDefaultTax").value || 0);

    if (!chargesType || !shipmentNo) {
        alert("Please select Charges Type and Shipment No");
        return;
    }


    // GST calculation
    const taxes = await getTaxRatesById(taxID);;
    const taxCalculations = calculateTaxes(taxableAmt, taxes);

    const sgst = taxCalculations.sgstAmt;
    const cgst = taxCalculations.cgstAmt;
    const igst = taxCalculations.igstAmt; // adjust if needed
    const gstAmount = taxCalculations.totalGstAmt;
    const taxRate = taxCalculations.totalRate;

    const totalAmount = nonTaxable + taxableAmt + gstAmount;

    const table = document.querySelector("#pendingShipmentTable tbody");

    const rowCount = table.rows.length + 1;

    const row = table.insertRow();

    row.dataset.chargeId = "";

    row.innerHTML = `
<td>${rowCount}</td>
<td>${chargesType}</td>
<td>${shipmentNo}</td>
<td>${taxRate}%</td>
<td class="text-end">${nonTaxable.toFixed(2)}</td>
<td class="text-end">${taxableAmt.toFixed(2)}</td>
<td class="text-end">${sgst.toFixed(2)}</td>
<td class="text-end">${cgst.toFixed(2)}</td>
<td class="text-end">${igst.toFixed(2)}</td>
<td class="text-end">${gstAmount.toFixed(2)}</td>
<td class="text-end fw-bold">${totalAmount.toFixed(2)}</td>

<td>
    <button class="btn btn-danger btn-sm delete-row">
        <i class="bi bi-trash"></i>
    </button>
</td>

<td class="tax-id d-none">${taxID}</td>
<td class="status text-center text-success d-none">New</td>
`;

    updateTotals();
    clearChargesInputs();
});

// Delete row
document.addEventListener("click", function (e) {

    const btn = e.target.closest(".delete-row");

    if (!btn) return;

    const row = btn.closest("tr");
    const statusCell = row.querySelector(".status");

    if (statusCell.innerText.trim() === "Old") {

        statusCell.innerText = "Deleted";

        row.style.display = "none";
    }
    else {
        row.remove();
    }

    updateTotals();
});
function clearChargesInputs() {
    document.getElementById("chargesType").value = "";
    document.getElementById("shipmentNo").value = "";
    document.getElementById("nonTaxableAmount").value = "";
    document.getElementById("taxableAmount").value = "";
    document.getElementById("partyDefaultTax").value = "";
}

// New Generate Bill Reference No
async function generateBillReferenceNo() {
    const accountedDate = document.getElementById('accountedDate').value;
    // Financial Year
    const today = accountedDate ? new Date(accountedDate) : new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const startYear = month >= 4 ? year : year - 1;
    const endYear = (startYear + 1).toString().slice(-2);

    const fy = `${startYear.toString().slice(-2)}-${endYear}`;

    // Get last bill reference for this company
    const { data, error } = await supabaseClient
        .from('VendorBillingDetails')
        .select('BillReferenceNo')
        .eq('company_id', CompanyID)
        .like('BillReferenceNo', `BRN/${fy}/%`)
        .order('BillReferenceNo', { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    let nextNumber = 1;

    if (data && data.length > 0) {
        const lastRef = data[0].BillReferenceNo;

        const lastSequence = parseInt(
            lastRef.split('/').pop(),
            10
        );

        nextNumber = lastSequence + 1;
    }

    const billReferenceNo =
        `BRN/${fy}/${String(nextNumber).padStart(4, '0')}`;

    document.getElementById('billReferenceNo').value =
        billReferenceNo;
}

async function getVendorBillingFormData() {

    let billReferenceNo =
        document.getElementById("billReferenceNo").value.trim();

    if (!billReferenceNo) {
        await generateBillReferenceNo();

        billReferenceNo =
            document.getElementById("billReferenceNo").value.trim();
    }

    return {
        BillReferenceNo: billReferenceNo,
        AccountedDate: document.getElementById("accountedDate").value || null,
        ExpenseType: document.getElementById("expenseType").value.trim(),
        ExpenseFor: document.getElementById("expenseFor").value.trim(),
        PartyCode: document.getElementById("partyCode").value || null,
        PartyName: document.getElementById("partyName").value.trim(),
        BillNo: document.getElementById("billNo").value.trim(),
        BillDate: document.getElementById("billDate").value || null,
        BilledAmount: parseFloat(document.getElementById("billedAmount").value || 0),
        DueDate: document.getElementById("dueDate").value || null,
        Information: document.getElementById("invoiceInformation").value.trim(),
        company_id: CompanyID,
        created_by: UserLoginID,
        created_at: localtimeStamp,
        Status: "Pending"
    };
}

async function saveVendorBilling() {
    try {
        const payload = await getVendorBillingFormData();

        // basic validation
        if (!payload.BillReferenceNo || !payload.PartyCode) {
            alert("Bill Reference No and Party are required");
            return;
        }

        const { data, error } = await supabaseClient
            .from("VendorBillingDetails")
            .insert([payload]);

        if (error) throw error;

        await saveVendorBillingCharges();

        alert("Vendor Billing Saved Successfully");
        console.log("Inserted:", data);

        return data;

    } catch (err) {
        console.error(err);
        alert("Error saving billing");
    }
}

async function updateVendorBilling() {
    try {
        const id = document.getElementById("vendorBillingID").value;
        const payload = getVendorBillingFormData();
        console.log("hi", payload);

        const { data, error } = await supabaseClient
            .from("VendorBillingDetails")
            .update(payload)
            .eq("BillReferenceNo", payload.BillReferenceNo);

        if (error) throw error;
        await saveVendorBillingCharges();
        alert("Updated Successfully");
        return data;

    } catch (err) {
        console.error(err);
        alert("Update Failed");
    }
}

document.getElementById("billReferenceNo")
    .addEventListener("change", async function () {

        const refNo = this.value.trim();

        if (!refNo) return;

        await loadVendorBillingByReferenceNo(refNo);
    });

document.getElementById("billNo")
    .addEventListener("change", async function () {

        const billNo = this.value.trim();

        if (!billNo) return;

        const { data, error } = await supabaseClient
            .from("VendorBillingDetails")
            .select("BillReferenceNo")
            .eq("company_id", CompanyID)
            .eq("BillNo", billNo)
            .single();

        if (error || !data) {
            console.error(error);
            return;
        }

        document.getElementById("billReferenceNo").value = data.BillReferenceNo;
        await loadVendorBillingByReferenceNo(
            data.BillReferenceNo
        );
    });
// Search Bill Reference No & Vendor Bill No
function bindBillSearch() {

    const billRefInput =
        document.getElementById("billReferenceNo");

    const billNoInput =
        document.getElementById("billNo");

    billRefInput?.addEventListener("input", function () {

        const value = this.value.trim();

        if (value.length >= 2) {
            searchBillReferenceNo(value);
        }
    });

    billNoInput?.addEventListener("input", function () {

        const value = this.value.trim();

        if (value.length >= 2) {
            searchBillNo(value);
        }
    });
}
// Search Bill Reference 
async function searchBillReferenceNo(keyword) {

    const datalist =
        document.getElementById("billReferenceNoSuggestions");

    if (!datalist) return;

    const { data, error } = await supabaseClient
        .from("VendorBillingDetails")
        .select("BillReferenceNo")
        .eq("company_id", CompanyID)
        .ilike("BillReferenceNo", `%${keyword}%`)
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    datalist.innerHTML = "";

    data.forEach(item => {

        const option = document.createElement("option");
        option.value = item.BillReferenceNo;

        datalist.appendChild(option);
    });
}

async function searchBillNo(keyword) {

    const datalist =
        document.getElementById("billNoSuggestions");

    if (!datalist) return;

    const { data, error } = await supabaseClient
        .from("VendorBillingDetails")
        .select("BillNo")
        .eq("company_id", CompanyID)
        .ilike("BillNo", `%${keyword}%`)
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    datalist.innerHTML = "";

    data.forEach(item => {

        const option = document.createElement("option");
        option.value = item.BillNo;

        datalist.appendChild(option);
    });
}

async function loadVendorBillingByReferenceNo(billReferenceNo) {
    try {

        const { data, error } = await supabaseClient
            .from("VendorBillingDetails")
            .select("*")
            .eq("company_id", CompanyID)
            .eq("BillReferenceNo", billReferenceNo)
            .single();

        if (error) throw error;

        if (!data) {
            alert("Record not found");
            return;
        }
        disableForm();
        modifyButton.disabled = false;
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

        // Store ID for update
        document.getElementById("vendorBillingID").value = data.id;

        // Header Details
        document.getElementById("accountedDate").value =
            data.AccountedDate || "";

        document.getElementById("expenseType").value =
            data.ExpenseType || "";

        await loadExpenseForDropdown();

        document.getElementById("expenseFor").value =
            data.ExpenseFor || "";

        document.getElementById("partyCode").value =
            data.PartyCode || "";

        document.getElementById("partyName").value =
            data.PartyName || "";

        document.getElementById("billNo").value =
            data.BillNo || "";

        document.getElementById("billDate").value =
            data.BillDate || "";

        document.getElementById("billedAmount").value =
            data.BilledAmount || 0;

        document.getElementById("dueDate").value =
            data.DueDate || "";

        document.getElementById("invoiceInformation").value =
            data.Information || "";

        // Change mode to Update
        document.getElementById("mode").value = "update";

        // Load charge details table
        await loadVendorBillingCharges(billReferenceNo);

    } catch (err) {
        console.error(err);
        alert("Error loading bill details");
    }
}

async function loadVendorBillingCharges(billReferenceNo) {

    const tbody =
        document.querySelector("#pendingShipmentTable tbody");

    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("VendorBillingCharges")
        .select("*")
        .eq("company_id", CompanyID)
        .eq("BillReferenceNo", billReferenceNo);

    if (error) {
        console.error(error);
        return;
    }

    data.forEach((item, index) => {

        const row = tbody.insertRow();

        row.dataset.chargeId = item.id;

        row.innerHTML = `
<td>${index + 1}</td>
<td>${item.ChargesType}</td>
<td>${item.ShipmentNo}</td>
<td>${item.TaxPercent}</td>
<td class="text-end">${item.NonTaxableAmount}</td>
<td class="text-end">${item.TaxableAmount}</td>
<td class="text-end">${item.SGSTAmount}</td>
<td class="text-end">${item.CGSTAmount}</td>
<td class="text-end">${item.IGSTAmount}</td>
<td class="text-end">${item.TotalGSTAmount}</td>
<td class="text-end">${item.TotalAmount}</td>

<td>
    <button class="btn btn-danger btn-sm delete-row">
        <i class="bi bi-trash"></i>
    </button>
</td>

<td class="tax-id d-none">${item.TaxID}</td>
<td class="status text-center d-none">Old</td>
`;
    });

    updateTotals();
}

async function saveVendorBillingCharges() {

    try {
        const billReferenceNo = document.getElementById("billReferenceNo").value.trim();
        const rows =
            document.querySelectorAll("#pendingShipmentTable tbody tr");

        const insertRows = [];
        const deleteIds = [];

        rows.forEach(row => {

            const status = row.querySelector(".status")?.innerText?.trim();

            const chargeId = row.dataset.chargeId || null;

            // INSERT NEW ROWS
            if (status === "New") {

                insertRows.push({

                    BillReferenceNo: billReferenceNo,

                    ChargesType: row.cells[1].innerText.trim(),
                    ShipmentNo: row.cells[2].innerText.trim(),
                    TaxPercent: parseFloat(row.cells[3].innerText.replace("%", "")) || 0,
                    NonTaxableAmount: parseFloat(row.cells[4].innerText) || 0,
                    TaxableAmount: parseFloat(row.cells[5].innerText) || 0,
                    SGSTAmount: parseFloat(row.cells[6].innerText) || 0,
                    CGSTAmount: parseFloat(row.cells[7].innerText) || 0,
                    IGSTAmount: parseFloat(row.cells[8].innerText) || 0,
                    TotalGSTAmount: parseFloat(row.cells[9].innerText) || 0,
                    TotalAmount: parseFloat(row.cells[10].innerText) || 0,
                    TaxID: row.querySelector(".tax-id")?.innerText || null,
                    company_id: CompanyID,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                });
            }

            // DELETE OLD ROWS
            if (status === "Deleted" && chargeId) {
                deleteIds.push(Number(chargeId));
            }

        });

        // INSERT
        if (insertRows.length > 0) {

            const { error } = await supabaseClient
                .from("VendorBillingCharges")
                .insert(insertRows);

            if (error) throw error;
        }

        // DELETE
        if (deleteIds.length > 0) {

            const { error } = await supabaseClient
                .from("VendorBillingCharges")
                .delete()
                .in("id", deleteIds);

            if (error) throw error;
        }

    } catch (err) {

        console.error("saveVendorBillingCharges Error:", err);
        throw err;
    }
}

document.getElementById("newButton").addEventListener("click", () => {

    clearForm();
    document.getElementById("accountedDate").value = new Date().toISOString().split('T')[0];
    // Clear charges table
    pendingShipmentTable.tBodies[0].innerHTML = "";

    // Reset summary totals
    [
        "totalNonTaxableAmount",
        "totalTaxableAmount",
        "totalSGSTAmount",
        "totalCGSTAmount",
        "totalIGSTAmount",
        "totalGSTAmount",
        "grandTotalAmount"
    ].forEach(id => {
        document.getElementById(id).innerText = "0.00";
    });

    // Reset buttons
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.dataset.mode = "insert";

    modifyButton.disabled = true;

    // Enable form controls
    enableForm();
});

modifyButton.addEventListener('click', () => {
    enableForm();
    document.getElementById('billReferenceNo').disabled = true;
    saveButton.disabled = false;
    modifyButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.dataset.mode = 'update';
})

