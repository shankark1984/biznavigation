/* =========================================================
   CONSTANTS
========================================================= */
const FORWARDING_TYPES = ['Forwarding', 'Import', 'Export'];
const totalFreight = 0;
/* =========================================================
   DOM READY
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await loadBankNameSuggestions();
    await loadDefaultBank();
    await loadInvoiceNoSuggestions();
    await loadDatalist('departmentList', 'Department'); // Static data
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
    const bankID = document.getElementById('bankIDs').value.trim();
    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const invoiceType = document.getElementById('movementType').value;
    const invoiceAddress = document.getElementById('invoiceAddress').value.trim();
    const isInsert = saveBtn.dataset.mode === 'insert';

    if (!partyCode || !invoiceDate || !invoiceType || !invoiceAddress) {
        showToast('Fill all required fields');
        return;
    }
    console.log('Bank ID on Save:', bankID);

    if (!bankID) {
        showToast('Select valid Bank Name');
        return;
    }

    let invoiceNo = document.getElementById('invoiceNo').value.trim();
    if (isInsert) {
        invoiceNo = await generateInvoiceNumber(invoiceDate);
        if (!invoiceNo) return showToast('Invoice number generation failed');
        document.getElementById('invoiceNo').value = invoiceNo;
    }

    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.textContent) || 0 : 0;
    };
    invoiceData = {
        InvoiceNo: invoiceNo,
        InvoiceDate: invoiceDate,
        InvoiceType: invoiceType,
        PartyCode: partyCode,
        InvoiceAddress: invoiceAddress,
        BankID: bankID,
        company_id: CompanyID,

        BasicAmount: parseFloat(totalFreight.textContent) || 0,

        OtherAmount:
            getValue("totalFSCAmt") +
            getValue("totalOtherAmt"),

        SGSTAmount: parseFloat(totalSGSTAmt.textContent) || 0,
        CGSTAmount: parseFloat(totalCGSTAmt.textContent) || 0,
        IGSTAmount: parseFloat(totalIGSTAmt.textContent) || 0,
        TotalGSTAmount: parseFloat(totalGSTAmt.textContent) || 0,
        GrandTotalAmount: parseFloat(totalGrandAmt.textContent) || 0,
        Remarks: document.getElementById('invoiceInformation').value.trim(),
    };

    // spinner.classList.remove('d-none');
    saveBtn.disabled = true;

    try {
        if (isInsert) {
            invoiceData.created_by = UserLoginID;
            invoiceData.created_at = localtimeStamp;
            await supabaseClient.from('InvoiceDetails').insert([invoiceData]);
        } else {
            invoiceData.updated_by = UserLoginID;
            invoiceData.updated_at = localtimeStamp;
            await supabaseClient.from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceNo)
                .eq('company_id', CompanyID);
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
        modifyButton.disabled = false;
        reportButton.disabled = false;
        fetchPendingInvoices.disabled = true;

        saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    } catch (e) {
        showToast(e.message || 'Save failed');
    } finally {
        // spinner.classList.add('d-none');
    }
});

/* =========================================================
   BANK SELECTION
========================================================= */
document.getElementById('inputBankName').addEventListener('input', function () {
    bankID = bankMap[this.value] || null;
});

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
        'modeType'
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
    setValue('totalGrand', totals.totalGrand);

    // ✅ Still update invoiceData (guard with parseFloat defaults)
    invoiceData.BasicAmount = parseFloat(totals.totalFreight) || 0;
    invoiceData.OtherAmount = (parseFloat(totals.totalFSCAmt) || 0) + (parseFloat(totals.totalOtherAmt) || 0);
    invoiceData.CGSTAmount = parseFloat(totals.totalCGST) || 0;
    invoiceData.SGSTAmount = parseFloat(totals.totalSGST) || 0;
    invoiceData.IGSTAmount = parseFloat(totals.totalIGST) || 0;
    invoiceData.TotalGSTAmount = parseFloat(totals.totalGST) || 0;
    invoiceData.GrandTotalAmount = parseFloat(totals.totalGrand) || 0;
}

function renderChargesTable(chargesMap) {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    tbody.innerHTML = '';
    // console.log('Rendering charges table with chargesMap:', chargesMap);
    let totalAmount = 0, totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGSTAmt = 0, totalGrandAmt = 0;

    Object.entries(chargesMap).forEach(([type, amounts]) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${type}</td>
            <td class="text-end">${amounts.TotalAmount}</td>
            <td class="text-end">${amounts.SGSTAmt}</td>
            <td class="text-end">${amounts.CGSTAmt}</td>
            <td class="text-end">${amounts.IGSTAmt}</td>
            <td class="text-end">${amounts.TotalGSTAmt}</td>
            <td class="text-end">${amounts.GrandTotalAmt}</td>
        `;

        tbody.appendChild(row);

        totalAmount += amounts.TotalAmount;
        totalSGST += amounts.SGSTAmt;
        totalCGST += amounts.CGSTAmt;
        totalIGST += amounts.IGSTAmt;
        totalGSTAmt += amounts.TotalGSTAmt;
        totalGrandAmt += amounts.GrandTotalAmt;
    });

    document.getElementById('totalFreightAmt').textContent = totalAmount.toFixed(2);
    document.getElementById('totalSGSTAmt').textContent = totalSGST.toFixed(2);
    document.getElementById('totalCGSTAmt').textContent = totalCGST.toFixed(2);
    document.getElementById('totalIGSTAmt').textContent = totalIGST.toFixed(2);
    document.getElementById('totalGSTAmt').textContent = totalGSTAmt.toFixed(2);
    document.getElementById('totalGrandAmt').textContent = totalGrandAmt.toFixed(2);
}

async function getInvoiceDetails(invoiceNo) {
    showSpinner();

    try {
        const { data, error } = await supabaseClient
            .from('InvoiceDetails')
            .select('*')
            .eq('InvoiceNo', invoiceNo)
            .eq('company_id', CompanyID)
            .single(); // Expecting one invoice per number per company

        if (error) throw error;

        if (!data) {
            alert('Invoice not found.');
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

document.getElementById('invoiceNo').addEventListener('change', async (e) => {
    const invoiceNo = e.target.value.trim();
    if (invoiceNo.length === 0) return;

    const invoiceDetails = await getInvoiceDetails(invoiceNo);


    if (invoiceDetails) {
        // Populate your form fields here
        document.getElementById('partyCode').value = invoiceDetails.PartyCode || '';
        document.getElementById('invoiceDate').value = invoiceDetails.InvoiceDate || '';
        document.getElementById('invoiceAddress').value = invoiceDetails.InvoiceAddress || '';
        document.getElementById('movementType').value = invoiceDetails.InvoiceType || '';
        document.getElementById('bankIDs').value = getBankNameByCode(invoiceDetails.BankID) || '';
        document.getElementById('inputBankName').value = invoiceDetails.id || '';
        document.getElementById('invoiceInformation').value = invoiceDetails.Remarks || '';
        document.getElementById('tempFormID').value = invoiceDetails.id || '';

        // ✅ Fetch and update Party Name
        const partyData = await getPartyDetailsByCode(invoiceDetails.PartyCode);
        if (partyData) {
            document.getElementById('partyName').value = partyData.PartyName || '';
        } else {
            alert('Party not found.');
        }

        const paymentInfo = await paymentDetails(invoiceNo);
        console.log('Payment Invoice No:', paymentInfo);

        if (paymentInfo.rows.length > 0) {
            document.getElementById('modifyButton').disabled = true; // Disable modify button
        } else {
            document.getElementById('modifyButton').disabled = false; // Enable modify button
        }
        // Load international_booking records linked to this invoice
        disableForm(); // Disable form after loading invoice details

        saveButton.disabled = true; // Disable save button
        document.getElementById('deleteButton').disabled = true; // Disable delete button
        document.getElementById('reportButton').disabled = false; // Enable report button
        document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field

        // Check the value and run the relevant function
        if (invoiceDetails.InvoiceType === 'Forwarding' || invoiceDetails.InvoiceType === 'Import' || invoiceDetails.InvoiceType === 'Export') {
            // console.log('Fetching pending invoices for Forwarding/Import/Export');
            await createPendingShipmentTableHeaderAndFooter_ib();
            await loadInvoiceBookings(invoiceNo);
        } else if (invoiceDetails.InvoiceType === 'Customs Clearance') {
            await createPendingShipmentTableHeaderAndFooter();
            await loadInvoiceLineItems_cc(invoiceNo); // Load Customs Clearance bookings if applicable
        } else if (invoiceDetails.InvoiceType === 'Domestic') {
            await d_createPendingShipmentTableHeaderAndFooter_ib();
            await d_loadInvoiceBookings(invoiceNo); // Load Domestic bookings if applicable
        } else if (invoiceDetails.InvoiceType === 'Full Truck Load') {
            await ftl_loadInvoiceBookings();

        } else {
            console.warn('Unknown movement type:', invoiceDetails.InvoiceType);
        }
    }
});

document.getElementById('addShipmentNo').addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipmentNo').value.trim();
    const invoiceNo = document.getElementById('invoiceNo').value.trim();
    const saveSpinner = document.getElementById('saveSpinner');
    const movementType = document.getElementById('movementType').value.trim();

    console.log('Adding Shipment No:', shipmentNo, 'to Invoice No:', invoiceNo, 'for Movement Type:', movementType);
    if (!shipmentNo) {
        alert('Please enter/select a Shipment Number.');
        return;
    }

    if (!invoiceNo) {
        alert('Invoice Number is required.');
        return;
    }

    // Show spinner and disable button
    if (saveSpinner) {
        saveSpinner.classList.remove('d-none');
    }


    // Check the value and run the relevant function
    if (movementType === 'Forwarding' || movementType === 'Import' || movementType === 'Export') {
        console.log('Fetching pending invoices for Forwarding/Import/Export');
        await addSingleShipmentToInvoice(shipmentNo, invoiceNo);
    }
    else if (movementType === 'Customs Clearance') {
        console.log('Adding Shipment No to Customs Clearance Invoice');
        await addSingleShipmentToInvoice_cc(shipmentNo, invoiceNo);
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
    document.getElementById('movementType').disabled = true; // Disable invoice date field
    document.getElementById('partyName').disabled = true; // Disable party code field
    document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.disabled = false;
    });

});

document.getElementById('deleteButton').addEventListener('click', () => {
    // Logic to delete the invoice
    alert('Delete functionality not implemented yet.');
});
// Listen for input selection
document.getElementById('inputBankName').addEventListener('input', function () {
    const selectedValue = this.value;
    if (bankMap[selectedValue]) {
        bankID = bankMap[selectedValue];
        const bankIDInput = document.getElementById('bankIDs');
        bankIDInput.value = bankID;
        console.log('Selected Bank ID:', bankID);
    } else {
        bankID = null; // Reset if not valid selection
    }
});

document.getElementById('reportButton').addEventListener('click', async () => {
    const invoiceNo = document.getElementById('invoiceNo').value.trim();
    if (!invoiceNo) {
        alert('Please enter/select an Invoice Number.');
        return;
    }
    reportType = document.getElementById('reportType').value;
    const invoiceDetails = await getInvoiceDetails(invoiceNo);
    if (!invoiceDetails) return;
    if (FORWARDING_TYPES.includes(invoiceDetails.InvoiceType)) {
        await generate_International_InvoicePDF(invoiceDetails); // Generate PDF for Forwarding/Import/Export
    } else if (invoiceDetails.InvoiceType === 'Customs Clearance') {
        await generate_CustmsClearance_InvoicePDF(invoiceDetails); // Generate PDF for Customs Clearance
    } else if (invoiceDetails.InvoiceType === 'Domestic') {
        await generate_DomesticReports_InvoicePDF(invoiceDetails); // Generate PDF for Domestic
    } else if (invoiceDetails.InvoiceType === 'FTL or FCL') {
        // invoiceDetails.lineItems = await getInvoiceLineItems_export(invoiceNo);
        console.log('FTL or FCL --- Coming Soon');
    } else {
        console.warn('Unknown movement type:', invoiceDetails.InvoiceType);
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
