/* =========================================================
   CONSTANTS
========================================================= */
const FORWARDING_TYPES = ['Forwarding', 'Import', 'Export'];
const totalFreight = 0;
/* =========================================================
   DOM READY
========================================================= */

// document.addEventListener('DOMContentLoaded', async () => {
//     await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
//     await loadBankNameSuggestions();
//     await loadDefaultBank();
//     await loadInvoiceNoSuggestions();
//     await loadDatalist('departmentList', 'Department');

//     // Attach event after suggestions are loaded
//     const bankInput = document.getElementById('inputBankName');
//     const bankIDInput = document.getElementById('bankIDs');

//     bankInput.addEventListener('input', function () {
//         const selectedValue = this.value.trim();

//         if (bankMap[selectedValue]) {
//             bankID = bankMap[selectedValue];
//             bankIDInput.value = bankID;
//             console.log('Selected Bank ID:', bankID);
//         } else {
//             bankID = null;
//             bankIDInput.value = '';
//         }
//     });
// });

document.addEventListener('DOMContentLoaded', async () => {

    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await loadBankNameSuggestions();
    await loadDefaultBank();
    await loadInvoiceNoSuggestions();
    await loadDatalist('departmentList', 'Department');

    // Bank selection
    const bankInput = document.getElementById('inputBankName');
    const bankIDInput = document.getElementById('bankIDs');

    bankInput.addEventListener('input', function () {
        const selectedValue = this.value.trim();

        if (bankMap[selectedValue]) {
            bankID = bankMap[selectedValue];
            bankIDInput.value = bankID;
            console.log('Selected Bank ID:', bankID);
        } else {
            bankID = null;
            bankIDInput.value = '';
        }
    });

    // ==========================
    // Open Invoice from Report
    // ==========================
    const params = new URLSearchParams(window.location.search);
    const invoiceNo = params.get("invoiceNo");

    if (invoiceNo) {
        const invoiceInput = document.getElementById("invoiceNo");

        invoiceInput.value = invoiceNo;

        // Trigger your existing change event
        invoiceInput.dispatchEvent(new Event("change"));
        await loadInvoice(invoiceNo);
    }

});

/* =========================================================
   CUSTOMER SELECTION
========================================================= */
document.getElementById('partyName').addEventListener('change', async function () {
    const selectedPartyName = this.value.trim();
    const options = Array.from(document.getElementById('partySuggestions').options);
    const option = options.find(opt => opt.value === selectedPartyName);

    if (!option) {
        alert('Invalid customer selection.');
        return;
    }

    const partyCode = document.getElementById('partyCode').value;
    console.log('Selected PartyCode:', partyCode);

    try {
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .select('*')
            .eq('PartyCode', partyCode)
            .eq('Status', 'Active');

        if (error) throw error;

        if (!data.length) {
            alert('No active billing address found.');
            return;
        }

        data.length === 1
            ? (fillInvoiceAddress(data[0]), document.getElementById('invoiceDate').focus())
            : showAddressSelectionModal(data);

    } catch (err) {
        console.error(err);
    }
});

document.getElementById('partyName').addEventListener('input', function () {
    const partyValue = this.value.trim();
    const btn = document.getElementById('addShipmentNo');

    if (partyValue) {
        btn.disabled = false;  // ✅ enable
    } else {
        btn.disabled = true;   // ❌ disable
    }
});

function fillInvoiceAddress(addr) {
    document.getElementById('invoiceAddress').value = formatAddress(addr);
}

function formatAddress(a) {
    return `${a.Address}, ${a.City}, ${a.PinCode}, ${a.State}, ${a.Country}`;
}

/* =========================================================
   INVOICE NUMBER GENERATION
========================================================= */
async function generateInvoiceNumber(invoiceDateValue) {
    if (!invoiceDateValue) return '';

    try {
        const { data: company } = await supabaseClient
            .from('company_profile')
            .select('short_code')
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (!company) return '';

        const d = new Date(invoiceDateValue);
        const fyStart = d.getMonth() >= 3 ? d.getFullYear() % 100 : (d.getFullYear() - 1) % 100;
        const fyEnd = (fyStart + 1) % 100;
        const fy = `${fyStart.toString().padStart(2, '0')}-${fyEnd.toString().padStart(2, '0')}`;

        const { data: last } = await supabaseClient
            .from('InvoiceDetails')
            .select('InvoiceNo')
            .like('InvoiceNo', `${company.short_code}/${fy}/%`)
            .eq('company_id', CompanyID)
            .order('InvoiceNo', { ascending: false })
            .limit(1)
            .maybeSingle();

        const next = last ? parseInt(last.InvoiceNo.split('/').pop()) + 1 : 1;
        return `${company.short_code}/${fy}/${next.toString().padStart(4, '0')}`;
    } catch {
        return '';
    }
}

/* =========================================================
   GLOBAL DATA
========================================================= */
let invoiceData = {};
let invoiceChargesData = {};
// let bankID = null;

/* =========================================================
   FETCH PENDING INVOICES
========================================================= */
document.getElementById('fetchPendingInvoices').addEventListener('click', async () => {
    const type = document.getElementById('movementType').value;

    try {
        if (FORWARDING_TYPES.includes(type)) {
            await getPendingInvoiceDetails();
        } else if (type === 'Customs Clearance') {
            await CustomsClearanceInvoiceDetails();
        } else if (type === 'Domestic') {
            await d_getPendingInvoiceDetails();
        } else if (type === 'Full Truck Load') {
            await FTL_FCL_getPendingInvoiceDetails();
        } else {
            alert('Select valid Movement Type');
        }
    } catch (e) {
        alert('Failed to fetch invoices');
    }
});

/* =========================================================
   SAVE INVOICE
========================================================= */
document.getElementById('saveButton').addEventListener('click', async () => {

    const saveBtn = document.getElementById('saveButton');
    const spinner = document.getElementById('saveSpinnerBtn');

    // Prevent double click
    if (saveBtn.disabled) return;

    // Disable button and show processing
    saveBtn.disabled = true;

    if (spinner) {
        spinner.classList.remove('d-none');
    }

    saveBtn.innerHTML = `
        <span id="saveSpinnerBtn" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Processing...
    `;

    const bankID = document.getElementById('bankIDs').value.trim();
    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const invoiceType = document.getElementById('movementType').value;
    const invoiceAddress = document.getElementById('invoiceAddress').value.trim();
    const isInsert = saveBtn.dataset.mode === 'insert';

    let basicfreight = 0;

    // Validation
    if (!partyCode || !invoiceDate || !invoiceType || !invoiceAddress) {
        showToast('Fill all required fields');

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        return;
    }

    // console.log('Bank ID on Save:', bankID);

    if (!bankID) {
        showToast('Select valid Bank Name');

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        return;
    }

    let invoiceNo = document.getElementById('invoiceNo').value.trim();

    if (isInsert) {
        invoiceNo = await generateInvoiceNumber(invoiceDate);

        if (!invoiceNo) {
            showToast('Invoice number generation failed');

            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
            return;
        }

        document.getElementById('invoiceNo').value = invoiceNo;
    }

    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.textContent) || 0 : 0;
    };

    const isCustoms = invoiceType === 'Customs Clearance';

    if (invoiceType === 'Customs Clearance') {
        basicfreight = getValue('totalFreight_sc');
    } else if (invoiceType === 'Domestic') {
        basicfreight = getValue('totalFreight_d');
    } else if (invoiceType === 'Full Truck Load') {
        basicfreight = getValue('totalFreight');
    } else if (
        invoiceType === 'Import' ||
        invoiceType === 'Export' ||
        invoiceType === 'Forwarding'
    ) {
        basicfreight = getValue('totalFreight');
    } else {
        basicfreight = getValue('totalFreight');
    }

    const totals = {
        freight: basicfreight,
        fsc: isCustoms ? 0 : getTextValue('totalFSCAmt'),
        other: isCustoms ? 0 : getTextValue('totalOtherAmt'),
        sgst: getTextValue('totalSGSTAmt'),
        cgst: getTextValue('totalCGSTAmt'),
        igst: getTextValue('totalIGSTAmt'),
        gst: getTextValue('totalGSTAmt'),
        grand: getTextValue('totalGrandAmt')
    };

    // console.log(totals);

    const invoiceData = {
        InvoiceNo: invoiceNo,
        InvoiceDate: invoiceDate,
        InvoiceType: invoiceType,
        PartyCode: partyCode,
        InvoiceAddress: invoiceAddress,
        BankID: bankID,
        company_id: CompanyID,

        BasicAmount: totals.freight,
        OtherAmount: totals.fsc + totals.other,

        SGSTAmount: totals.sgst,
        CGSTAmount: totals.cgst,
        IGSTAmount: totals.igst,
        TotalGSTAmount: totals.gst,
        GrandTotalAmount: Math.round(totals.grand),

        Remarks: document.getElementById('invoiceInformation').value.trim()
    };

    try {

        if (isInsert) {

            invoiceData.created_by = UserLoginID;
            invoiceData.created_at = localtimeStamp;

            const { error } = await supabaseClient
                .from('InvoiceDetails')
                .insert([invoiceData]);

            if (error) throw error;

        } else {

            invoiceData.updated_by = UserLoginID;
            invoiceData.updated_at = localtimeStamp;

            const { error } = await supabaseClient
                .from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceNo)
                .eq('company_id', CompanyID);

            if (error) throw error;
        }

        showToast(`Invoice ${isInsert ? 'Saved' : 'Updated'} Successfully`);

        if (FORWARDING_TYPES.includes(invoiceType)) {
            await updateInvoiceNumbers(invoiceNo);
        } else if (invoiceType === 'Customs Clearance') {
            await updateInvoiceNumbers_cc(invoiceNo);
        } else if (invoiceType === 'Domestic') {
            await d_updateInvoiceNumbers(invoiceNo);
        } else if (invoiceType === 'Full Truck Load') {
            await ftl_updateInvoiceNumbers(invoiceNo);
        }

        disableForm();

        // Disable all row delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });

        // Keep Save disabled after successful save
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Updated';

        modifyButton.disabled = false;
        reportButton.disabled = false;
        fetchPendingInvoices.disabled = true;

    } catch (e) {

        console.error(e);
        showToast(e.message || 'Save failed');

    } finally {

        // Only restore Save button if save/update failed
        if (!modifyButton.disabled) {
            // Save was successful, keep it disabled
            return;
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
    }

});

/* =========================================================
   BANK SELECTION
========================================================= */
// document.getElementById('inputBankName').addEventListener('input', function () {
//     bankID = bankMap[this.value] || null;
// });

/* =========================================================
   SAFE UNLOCK ON EXIT
========================================================= */
window.addEventListener('beforeunload', async () => {
    try {
        await autoUnlockRecords("FullLoadBookingDetails");
        await autoUnlockRecords("international_booking");
        await unlockBooking_ib(UserLoginID);
        await unlockBooking_cc(UserLoginID);
        console.log('Unlocking records for user:', UserLoginID);
    } catch (e) {
        console.error('Unlock failed:', e);
    }
});

document.getElementById('newButton').addEventListener('click', newInvoice);

async function newInvoice() {
    // 1️⃣ Unlock previous records (STRICT)
    try {
        const singleShipmentbtn = document.getElementById('addShipmentNo');

        await autoUnlockRecords("FullLoadBookingDetails");
        await autoUnlockRecords("international_booking");
        await unlockBooking_ib(UserLoginID);
        await unlockBooking_cc(UserLoginID);
        await d_unlockBooking_db(UserLoginID); // Domestic();
        await ftl_unlockBooking(UserLoginID); // FTL/FCL();
        document.getElementById('addShipmentNo').disabled = true; // Disable add shipment button until movement type is selected
        document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field until movement type is selected
        document.getElementById('movementType').value = ''; // Reset movement type
        document.getElementById('pendingShipmentTable').tBodies[0].innerHTML = ''; // Clear pending shipments table
        document.getElementById('invoiceInformation').value = ''; // Clear invoice information/remark
        singleShipmentbtn.disabled = false;

    } catch (e) {
        console.error('Unlock failed:', e);
    }



    // 2️⃣ Reset form
    const form = document.getElementById('container');
    if (form) form.reset();

    // 3️⃣ Insert mode
    const saveBtn = document.getElementById('saveButton');
    saveBtn.dataset.mode = 'insert';
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('fetchPendingInvoices').disabled = false; // Disable party code field
    document.getElementById('addShipmentNo').disabled = true;

    document.getElementById('newButton').disabled = false;

    // 4️⃣ Clear fields
    [
        'invoiceNo',
        'partyName',
        'partyCode',
        'invoiceAddress',
        'movementType',
        'transitType',
        'department',
        'modeType',
        'shipmentNo',
        'reportType'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // 5️⃣ Default date
    document.getElementById('invoiceDate').value =
        new Date().toISOString().split('T')[0];

    // 6️⃣ Reset globals
    invoiceData = {};
    invoiceChargesData = {};
    bankID = null;

    // 7️⃣ Totals
    clearInvoiceTotals();
    clearChargesTable();

    // 8️⃣ Load async data FIRST
    await loadInvoiceNoSuggestions();

    // 9️⃣ Enable form LAST (IMPORTANT)
    enableForm();

    // 🔟 Focus + toast
    document.getElementById('partyName').focus();
    showToast('🚀 New Invoice Ready');
}

function clearInvoiceTotals() {

    const table = document.getElementById('pendingShipmentTable');
    if (table?.tBodies?.[0]) {
        table.tBodies[0].innerHTML = '';
    }

    const totalIds = [
        'totalFreight',
        'totalFSCAmt',
        'totalOtherAmt',
        'totalSGST',
        'totalCGST',
        'totalIGST',
        'totalGST',
        'totalGrand'
    ];

    totalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '0.00';
        }
    });
}

function clearChargesTable() {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    if (tbody) tbody.innerHTML = '';
    totalFreightAmt.textContent = '0.00';
    totalSGSTAmt.textContent = '0.00';
    totalCGSTAmt.textContent = '0.00';
    totalIGSTAmt.textContent = '0.00';
    totalGSTAmt.textContent = '0.00';
    totalGrandAmt.textContent = '0.00';
}

function updateTotals(totals) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    };

    setValue('totalFreight', totals.totalFreight);
    setValue('totalFSCAmt', totals.totalFSCAmt);
    setValue('totalOtherAmt', totals.totalOtherAmt);
    setValue('totalSGST', totals.totalSGST);
    setValue('totalCGST', totals.totalCGST);
    setValue('totalIGST', totals.totalIGST);
    setValue('totalGST', totals.totalGST);
    setValue('totalGrand', Math.round(totals.totalGrand));

    // ✅ Still update invoiceData (guard with parseFloat defaults)
    invoiceData.BasicAmount = formatAmount(totals.totalFreight) || 0;
    invoiceData.OtherAmount = (formatAmount(totals.totalFSCAmt) || 0) + (formatAmount(totals.totalOtherAmt) || 0);
    invoiceData.CGSTAmount = formatAmount(totals.totalCGST) || 0;
    invoiceData.SGSTAmount = formatAmount(totals.totalSGST) || 0;
    invoiceData.IGSTAmount = formatAmount(totals.totalIGST) || 0;
    invoiceData.TotalGSTAmount = formatAmount(totals.totalGST) || 0;
    invoiceData.GrandTotalAmount = formatAmount(Math.round(totals.totalGrand)) || 0;
}

function renderChargesTable(chargesMap) {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    tbody.innerHTML = '';

    let totalAmount = 0,
        totalSGST = 0,
        totalCGST = 0,
        totalIGST = 0,
        totalGSTAmt = 0,
        totalGrandAmt = 0;

    // Priority order
    const chargeOrder = [
        'Freight Amount',
        'Custom Clearance Charges',
        'Duty'
    ];

    // Sort entries based on the order above
    const sortedEntries = Object.entries(chargesMap).sort(([a], [b]) => {
        const indexA = chargeOrder.indexOf(a);
        const indexB = chargeOrder.indexOf(b);

        // Both found in priority list
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }

        // One found, one not
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // Remaining charge types keep alphabetical order
        return a.localeCompare(b);
    });

    sortedEntries.forEach(([type, amounts]) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${type}</td>
            <td class="text-end">${formatAmount(amounts.TotalAmount)}</td>
            <td class="text-end">${formatAmount(amounts.SGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.CGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.IGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.TotalGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.GrandTotalAmt)}</td>
        `;

        tbody.appendChild(row);

        totalAmount += amounts.TotalAmount;
        totalSGST += amounts.SGSTAmt;
        totalCGST += amounts.CGSTAmt;
        totalIGST += amounts.IGSTAmt;
        totalGSTAmt += amounts.TotalGSTAmt;
        totalGrandAmt += amounts.GrandTotalAmt;
    });

    document.getElementById('totalFreightAmt').textContent = formatAmount(totalAmount);
    document.getElementById('totalSGSTAmt').textContent = formatAmount(totalSGST);
    document.getElementById('totalCGSTAmt').textContent = formatAmount(totalCGST);
    document.getElementById('totalIGSTAmt').textContent = formatAmount(totalIGST);
    document.getElementById('totalGSTAmt').textContent = formatAmount(totalGSTAmt);
    document.getElementById('totalGrandAmt').textContent = formatAmount(Math.round(totalGrandAmt));
}

async function getInvoiceDetails(invoiceNo) {
    showSpinner();

    try {
        const { data, error } = await supabaseClient
            .from('InvoiceDetails')
            .select('*')
            .eq('InvoiceNo', invoiceNo)
            .eq('company_id', CompanyID)
            .maybeSingle();// Expecting one invoice per number per company
        if (error) throw error;

        if (!data) {
            showToast('Invoice not found');
            return null;
        }


        // console.log('Fetched Invoice Details:', data);
        return data;

    } catch (err) {
        console.error('Error fetching invoice details:', err.message);
        alert('Error loading invoice: ' + err.message);
        return null;
    } finally {
        hideSpinner();
    }
}
document.getElementById('movementType').addEventListener('change', async (e) => {

    const movementType = e.target.value.trim();
    if (
        movementType === 'Forwarding' ||
        movementType === 'Import' ||
        movementType === 'Export'
    ) {
        await createPendingShipmentTableHeaderAndFooter_ib();

    } else if (movementType === 'Customs Clearance') {
        await createPendingShipmentTableHeaderAndFooter();

    } else if (movementType === 'Domestic') {
        await d_createPendingShipmentTableHeaderAndFooter_ib();

    } else if (movementType === 'Full Truck Load') {
        await FTL_FCL_createPendingShipmentTableHeaderAndFooter();

    } else {
        console.warn('Unknown movement type:', movementType);
    }
});

// document.getElementById('invoiceNo').addEventListener('change', async (e) => {
//     const invoiceNo = e.target.value.trim();
//     if (invoiceNo.length === 0) return;

//     const invoiceDetails = await getInvoiceDetails(invoiceNo);


//     if (invoiceDetails) {
//         // Populate your form fields here
//         document.getElementById('partyCode').value = invoiceDetails.PartyCode || '';
//         document.getElementById('invoiceDate').value = invoiceDetails.InvoiceDate || '';
//         document.getElementById('invoiceAddress').value = invoiceDetails.InvoiceAddress || '';
//         document.getElementById('movementType').value = invoiceDetails.InvoiceType || '';
//         document.getElementById('bankIDs').value = getBankNameByCode(invoiceDetails.BankID) || '';
//         document.getElementById('inputBankName').value = invoiceDetails.id || '';
//         document.getElementById('invoiceInformation').value = invoiceDetails.Remarks || '';
//         document.getElementById('tempFormID').value = invoiceDetails.id || '';

//         // ✅ Fetch and update Party Name
//         const partyData = await getPartyDetailsByCode(invoiceDetails.PartyCode);
//         if (partyData) {
//             document.getElementById('partyName').value = partyData.PartyName || '';
//         } else {
//             alert('Party not found.');
//         }

//         const paymentInfo = await paymentDetails(invoiceNo);

//         if (paymentInfo.rows.length > 0) {
//             document.getElementById('modifyButton').disabled = true; // Disable modify button
//         } else {
//             document.getElementById('modifyButton').disabled = false; // Enable modify button
//         }
//         // Load international_booking records linked to this invoice
//         disableForm(); // Disable form after loading invoice details

//         saveButton.disabled = true; // Disable save button
//         document.getElementById('deleteButton').disabled = true; // Disable delete button
//         document.getElementById('reportButton').disabled = false; // Enable report button
//         document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field

//         // Check the value and run the relevant function
//         if (invoiceDetails.InvoiceType === 'Forwarding' || invoiceDetails.InvoiceType === 'Import' || invoiceDetails.InvoiceType === 'Export') {
//             // console.log('Fetching pending invoices for Forwarding/Import/Export');
//             await createPendingShipmentTableHeaderAndFooter_ib();
//             await loadInvoiceBookings(invoiceNo);
//         } else if (invoiceDetails.InvoiceType === 'Customs Clearance') {
//             await createPendingShipmentTableHeaderAndFooter();
//             await loadInvoiceLineItems_cc(invoiceNo); // Load Customs Clearance bookings if applicable
//         } else if (invoiceDetails.InvoiceType === 'Domestic') {
//             await d_createPendingShipmentTableHeaderAndFooter_ib();
//             await d_loadInvoiceBookings(invoiceNo); // Load Domestic bookings if applicable
//         } else if (invoiceDetails.InvoiceType === 'Full Truck Load') {
//             await FTL_FCL_createPendingShipmentTableHeaderAndFooter();
//             await ftl_loadInvoiceBookings(invoiceNo);

//         } else {
//             console.warn('Unknown movement type:', invoiceDetails.InvoiceType);
//         }

//         document.querySelectorAll('.delete-btn').forEach(btn => {
//             btn.disabled = true; // Disable delete buttons when loading existing invoice
//         });
//     }
// });

document.getElementById("invoiceNo").addEventListener("change", async (e) => {
    await loadInvoice(e.target.value);
});
// ===============================
// Reusable Invoice Loader
// ===============================
async function loadInvoice(invoiceNo) {
    if (!invoiceNo || invoiceNo.trim() === "") return;

    invoiceNo = invoiceNo.trim();

    const invoiceDetails = await getInvoiceDetails(invoiceNo);
    if (!invoiceDetails) {
        alert("Invoice not found.");
        return;
    }

    // -----------------------------
    // Populate Form
    // -----------------------------
    document.getElementById("invoiceNo").value = invoiceNo;
    document.getElementById("partyCode").value = invoiceDetails.PartyCode || "";
    document.getElementById("invoiceDate").value = invoiceDetails.InvoiceDate || "";
    document.getElementById("invoiceAddress").value = invoiceDetails.InvoiceAddress || "";
    document.getElementById("movementType").value = invoiceDetails.InvoiceType || "";
    document.getElementById("bankIDs").value = getBankNameByCode(invoiceDetails.BankID) || "";
    document.getElementById("inputBankName").value = invoiceDetails.id || "";
    document.getElementById("invoiceInformation").value = invoiceDetails.Remarks || "";
    document.getElementById("tempFormID").value = invoiceDetails.id || "";

    // -----------------------------
    // Party Details
    // -----------------------------
    const partyData = await getPartyDetailsByCode(invoiceDetails.PartyCode);

    if (partyData) {
        document.getElementById("partyName").value = partyData.PartyName || "";
    } else {
        alert("Party not found.");
    }

    // -----------------------------
    // Payment Check
    // -----------------------------
    const paymentInfo = await paymentDetails(invoiceNo);

    document.getElementById("modifyButton").disabled =
        paymentInfo.rows.length > 0;

    // -----------------------------
    // Disable/Enable Controls
    // -----------------------------
    disableForm();

    saveButton.disabled = true;
    document.getElementById("deleteButton").disabled = true;
    document.getElementById("reportButton").disabled = false;
    document.getElementById("fetchPendingInvoices").disabled = true;

    // -----------------------------
    // Load Shipment Details
    // -----------------------------
    switch (invoiceDetails.InvoiceType) {
        case "Forwarding":
        case "Import":
        case "Export":
            await createPendingShipmentTableHeaderAndFooter_ib();
            await loadInvoiceBookings(invoiceNo);
            break;

        case "Customs Clearance":
            await createPendingShipmentTableHeaderAndFooter();
            await loadInvoiceLineItems_cc(invoiceNo);
            break;

        case "Domestic":
            await d_createPendingShipmentTableHeaderAndFooter_ib();
            await d_loadInvoiceBookings(invoiceNo);
            break;

        case "Full Truck Load":
            await FTL_FCL_createPendingShipmentTableHeaderAndFooter();
            await ftl_loadInvoiceBookings(invoiceNo);
            break;

        default:
            console.warn("Unknown Invoice Type:", invoiceDetails.InvoiceType);
    }

    // -----------------------------
    // Disable Delete Buttons
    // -----------------------------
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.disabled = true;
    });
}
document.getElementById('addShipmentNo').addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipmentNo').value.trim();
    const invoiceNo = document.getElementById('invoiceNo').value.trim();
    const saveSpinner = document.getElementById('saveSpinner');
    const movementType = document.getElementById('movementType').value.trim();

    // console.log('Adding Shipment No:', shipmentNo, 'to Invoice No:', invoiceNo, 'for Movement Type:', movementType);
    if (!shipmentNo) {
        alert('Please enter/select a Shipment Number.');
        return;
    }

    // Show spinner and disable button
    if (saveSpinner) {
        saveSpinner.classList.remove('d-none');
    }

    // Check the value and run the relevant function
    if (movementType === 'Forwarding' || movementType === 'Import' || movementType === 'Export') {
        // console.log('Fetching pending invoices for Forwarding/Import/Export');
        await addSingleShipmentToInvoice(shipmentNo, invoiceNo);
    }
    else if (movementType === 'Customs Clearance') {
        // console.log('Adding Shipment No to Customs Clearance Invoice');
        await addSingleShipmentToInvoice_cc(shipmentNo, invoiceNo);
    }
    else if (movementType === 'Domestic') {
        // console.log('Adding Shipment No to Domestic Invoice');
        await d_addSingleShipmentToInvoice(shipmentNo, invoiceNo);
    } else if (movementType === 'Full Truck Load') {
        // console.log('Adding Shipment No to FTL/FCL Invoice');
        await ftl_addSingleShipmentToInvoice(shipmentNo, invoiceNo);
    }
    else {
        console.warn('Unknown movement type:', type);
    }

    hideSpinner();
});

document.getElementById('modifyButton').addEventListener('click', () => {
    // Enable all delete buttons
    saveButton.disabled = false; // Enable save button
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.dataset.mode = 'update';
    document.getElementById('modifyButton').disabled = true; // Disable modify button
    document.getElementById('deleteButton').disabled = true; // Enable delete button
    document.getElementById('reportButton').disabled = true; // Enable report button
    enableForm(); // Enable form for modification
    document.getElementById('invoiceNo').disabled = true; // Disable invoice number field
    document.getElementById('movementType').disabled = false; // Disable invoice date field
    document.getElementById('partyName').disabled = false; // Disable party code field
    document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.disabled = false;
    });
    document.getElementById('addShipmentNo').disabled = false; // Enable add shipment button
    document.getElementById('fetchPendingInvoices').disabled = false; // Enable shipment number field
});

document.getElementById('deleteButton').addEventListener('click', () => {
    // Logic to delete the invoice
    alert('Delete functionality not implemented yet.');
});
// Listen for input selection
// document.getElementById('inputBankName').addEventListener('input', function () {
//     const selectedValue = this.value;
//     if (bankMap[selectedValue]) {
//         bankID = bankMap[selectedValue];
//         const bankIDInput = document.getElementById('bankIDs');
//         bankIDInput.value = bankID;
//         console.log('Selected Bank ID:', bankID);
//     } else {
//         bankID = null; // Reset if not valid selection
//     }
// });

document.getElementById('reportButton').addEventListener('click', async function () {

    const btn = this;
    const originalText = btn.innerHTML;

    try {
        const invoiceNo = document.getElementById('invoiceNo').value.trim();

        if (!invoiceNo) {
            alert('Please enter/select an Invoice Number.');
            return;
        }

        // Show processing state
        btn.disabled = true;
        btn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Processing...
        `;

        reportType = document.getElementById('reportType').value;

        // console.log(
        //     'Generating report for Invoice No:',
        //     invoiceNo,
        //     'with Report Type:',
        //     reportType
        // );

        const invoiceDetails = await getInvoiceDetails(invoiceNo);

        if (!invoiceDetails) return;

        if (FORWARDING_TYPES.includes(invoiceDetails.InvoiceType)) {

            if (reportType === 'Main') {
                await generate_International_InvoicePDF_Main(invoiceDetails);
            } else if (reportType === 'Print Annexure') {
                await generate_International_InvoicePDF_Annexure(invoiceDetails);
            }

        } else if (invoiceDetails.InvoiceType === 'Customs Clearance') {

            await generate_Clear_InvoicePDF_Main(invoiceDetails);

        } else if (invoiceDetails.InvoiceType === 'Domestic') {

            await generate_DomesticReports_InvoicePDF(invoiceDetails);

        } else if (invoiceDetails.InvoiceType === 'Full Truck Load') {

            await generate_FullTruckReports_InvoicePDF(invoiceDetails);

        } else {

            console.warn('Unknown movement type:', invoiceDetails.InvoiceType);

        }

    } catch (error) {

        console.error('Report generation failed:', error);
        alert('Failed to generate report.');

    } finally {

        // Restore button
        btn.disabled = false;
        btn.innerHTML = originalText;

    }
});

function showAddressSelectionModal(addresses) {
    const container = document.getElementById('addressListContainer');
    const modalEl = document.getElementById('addressSelectionModal');
    const invoiceAddressInput = document.getElementById('invoiceAddress');

    container.innerHTML = '';

    // Create or get existing modal instance (prevents duplicates)
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Ensure focus is handled properly when modal closes
    modalEl.addEventListener('hide.bs.modal', function () {
        if (modalEl.contains(document.activeElement)) {
            document.activeElement.blur();   // remove focus inside modal
        }
    }, { once: true });

    modalEl.addEventListener('hidden.bs.modal', function () {
        invoiceAddressInput?.focus();       // return focus safely
    }, { once: true });

    addresses.forEach((address) => {
        const formattedAddress = formatAddress(address);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-primary w-100 mb-2';
        button.textContent = formattedAddress;

        button.addEventListener('click', () => {
            invoiceAddressInput.value = formattedAddress;

            // Blur first to prevent aria-hidden warning
            button.blur();

            modal.hide();
        });

        container.appendChild(button);
    });

    modal.show();
}

function getTextValue(id) {
    const text = document.getElementById(id)?.textContent || '0';

    return parseFloat(
        text.replace(/,/g, '')
    ) || 0;
}