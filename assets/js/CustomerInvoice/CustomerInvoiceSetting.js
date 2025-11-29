
document.addEventListener('DOMContentLoaded', async () => {
    if (!await checkAccess(UserLoginID, 'ApplicationSettings')) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await loadBankNameSuggestions();
    await loadDefaultBank();
    await loadInvoiceNoSuggestions();

});

// Customer selection
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
            .eq('Status', 'True');

        if (error) throw error;

        if (data.length === 0) {
            alert('No active billing address found.');
            return;
        }

        if (data.length === 1) {
            fillInvoiceAddress(data[0]);
            document.getElementById('invoiceDate').focus();
        } else {
            showAddressSelectionModal(data);
        }
    } catch (err) {
        console.error('Error fetching billing addresses:', err.message);
    }
});

function fillInvoiceAddress(addressObj) {
    document.getElementById('invoiceAddress').value = formatAddress(addressObj);
}

function formatAddress(addressObj) {
    return `${addressObj.Address}, ${addressObj.City}, ${addressObj.PinCode}, ${addressObj.State}, ${addressObj.Country}`;
}

function showAddressSelectionModal(addresses) {
    const container = document.getElementById('addressListContainer');
    container.innerHTML = '';

    addresses.forEach(address => {
        const formattedAddress = formatAddress(address);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-primary w-100 mb-2';
        button.textContent = formattedAddress;

        button.addEventListener('click', () => {
            document.getElementById('invoiceAddress').value = formattedAddress;
            bootstrap.Modal.getInstance(document.getElementById('addressSelectionModal')).hide();
            document.getElementById('invoiceDate').focus();
        });

        container.appendChild(button);
    });

    new bootstrap.Modal(document.getElementById('addressSelectionModal')).show();
}
async function generateInvoiceNumber(invoiceDateValue) {
    try {
        const { data: companyData, error: companyError } = await supabaseClient
            .from('company_profile')
            .select('short_code')
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (companyError || !companyData) throw new Error('Company short code not found.');

        const companyShortCode = companyData.short_code;
        const invoiceDate = new Date(invoiceDateValue);

        const fyStart = (invoiceDate.getMonth() + 1) >= 4 ? invoiceDate.getFullYear() % 100 : (invoiceDate.getFullYear() - 1) % 100;
        const fyEnd = (fyStart + 1) % 100;
        const financialYear = `${fyStart.toString().padStart(2, '0')}-${fyEnd.toString().padStart(2, '0')}`;

        const { data: invoiceData, error: invoiceError } = await supabaseClient
            .from('InvoiceDetails')
            .select('InvoiceNo')
            .like('InvoiceNo', `${companyShortCode}/${financialYear}/%`)
            .eq('company_id', CompanyID)
            .order('InvoiceNo', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextSerial = 1;

        if (invoiceData && invoiceData.InvoiceNo) {
            const lastSerial = parseInt(invoiceData.InvoiceNo.split('/').pop(), 10);
            if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
        }

        return `${companyShortCode}/${financialYear}/${nextSerial.toString().padStart(4, '0')}`;
    } catch (err) {
        console.error('Error generating invoice number:', err.message);
        return '';
    }
}

function renderChargesTable(chargesMap) {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    tbody.innerHTML = '';
    console.log('Rendering charges table with chargesMap:', chargesMap);
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

document.getElementById('fetchPendingInvoices').addEventListener('click', async () => {

    const movementTypeEl = document.getElementById('movementType');
    const type = movementTypeEl.value.trim();

    const forwardingTypes = ['Forwarding', 'Import', 'Export'];

    try {
        if (forwardingTypes.includes(type)) {
            console.log('Fetching pending invoices for Forwarding/Import/Export');
            await getPendingInvoiceDetails();
        }
        else if (type === 'Customs Clearance') {
            await CustomsClearanceInvoiceDetails();
        }
        else {
            alert('Unknown movement type selected. Please select a valid type.');
            movementTypeEl.focus();   // ✅ FIXED: setfocus → focus()
            console.warn('Unknown movement type:', type);
        }
    } catch (error) {
        console.error("Error fetching invoices:", error);
        alert("Something went wrong while fetching invoices.");
    }
});

function showSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('d-none');
}

function hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('d-none');
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

function updateTotalInvoiceCharges(totals) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    };
    setValue('totalFreightAmt', totals.totalFreightAmt);
    setValue('totalSGSTAmt', totals.totalSGSTAmt);
    setValue('totalCGSTAmt', totals.totalCGSTAmt);
    setValue('totalIGSTAmt', totals.totalIGSTAmt);
    setValue('totalGSTAmt', totals.totalGSTAmt);
    setValue('totalGrandAmt', totals.totalGrandAmt);

    invoiceChargesData.totalFreightAmt = parseFloat(totals.totalFreightAmt) || 0;
    invoiceChargesData.totalSGSTAmt = parseFloat(totals.totalSGSTAmt) || 0;
    invoiceChargesData.totalCGSTAmt = parseFloat(totals.totalCGSTAmt) || 0;
    invoiceChargesData.totalIGSTAmt = parseFloat(totals.totalIGSTAmt) || 0;
    invoiceChargesData.totalGSTAmt = parseFloat(totals.totalGSTAmt) || 0;
    invoiceChargesData.totalGrandAmt = parseFloat(totals.totalGrandAmt) || 0;
}

document.getElementById('newButton').addEventListener('click', async () => {
    // Reset form fields
    document.querySelector('form').reset();

    // Clear invoice address
    document.getElementById('invoiceAddress').value = '';

    // Reset hidden fields
    document.getElementById('partyCode').value = '';
    document.getElementById('tempFormID').value = '';
    document.getElementById('bankIDs').value = '';

    // Reset status to New
    document.getElementById('status').value = 'New';

    // Clear table body
    const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
    tableBody.innerHTML = '';
    const tableBody2 = document.getElementById('pendingShipmentCharges').querySelector('tbody');
    tableBody2.innerHTML = '';

    // Reset all totals
    updateTotals({
        totalFreight: 0,
        totalFSCAmt: 0,
        totalOtherAmt: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        totalGrand: 0,
    });
    updateTotalInvoiceCharges({
        totalFreightAmt: 0,
        totalSGSTAmt: 0,
        totalCGSTAmt: 0,
        totalIGSTAmt: 0,
        totalGSTAmt: 0,
        totalGrandAmt: 0,
    });

    enableForm(); // Enable form for new entry
    // Enable/Disable Buttons
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('fetchPendingInvoices').disabled = false; // Disable party code field
    saveButton.disabled = false; // Enable save button
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    // Optional: Reset focus
    document.getElementById('partyName').focus();
    await loadInvoiceNoSuggestions();
    await unlockBooking_ib(UserLoginID); // Unlock booking for the current user
    await unlockBooking_cc(UserLoginID); // Unlock booking for the current user in Customs Clearance

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

document.getElementById('reportButton').addEventListener('click', async () => {
    const invoiceNo = document.getElementById('invoiceNo').value;
    const partyName = document.getElementById('partyName').value;
    const invoiceType = document.getElementById('movementType').value;
    const reportType = document.getElementById('reportType').value;
    let url = null;
    console.log('Generating report for Invoice No:', invoiceNo, 'Party Name:', partyName, 'Invoice Type:', invoiceType);
    // Check the value and run the relevant function
    if (invoiceType === 'Forwarding' || invoiceType === 'Import' || invoiceType === 'Export') {
        if (reportType === '') {
            url = `../../pages/Print_Reports/rep_Invoice_Forwarding_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
        } else if (reportType === 'Latter Head') {
            url = `rep_Invoice_Forwarding_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for International Booking Invoice');
        } else if (reportType === 'Print Annexure') {
            url = `rep_Invoice_Forwarding_Annexure.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for International Booking Invoice Annexure');
        }
    }
    else if (invoiceType === 'Customs Clearance') {
        if (reportType === '') {
            url = `rep_Invoice_CustomsClearance_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Customs Clearance Invoice');
        } else if (reportType === 'Latter Head') {
            url = `rep_Invoice_CustomsClearance_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Customs Clearance Invoice');
        } else if (reportType === 'Print Annexure') {
            url = `rep_Invoice_CustomsClearance_Annexure.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Customs Clearance Invoice Annexure');
        }
    }
    else if (invoiceType === 'Domestic') {
        if (reportType === '') {
            url = `rep_Invoice_Domestic_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Domestic Booking Invoice');
        } else if (reportType === 'Latter Head') {
            url = `rep_Invoice_Domestic_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Domestic Booking Invoice');
        } else if (reportType === 'Print Annexure') {
            url = `rep_Invoice_Domestic_Annexure.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for Domestic Booking Invoice Annexure');
        }
    }
    else if (invoiceType === 'FTL or FCL') {
        if (reportType === '') {
            url = `rep_Invoice_FTLFCL_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for FTL or FCL Booking Invoice');
        } else if (reportType === 'Latter Head') {
            url = `rep_Invoice_FTLFCL_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for FTL or FCL Booking Invoice');
        } else if (reportType === 'Print Annexure') {
            url = `rep_Invoice_FTLFCL_Annexure.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;
            console.log('Generating report for FTL or FCL Booking Invoice Annexure');
        }
    } else {
        alert('Unknown invoice type selected. Please select a valid invoice type.');
        return;
    }
    // Open the report in a new window
    if (!url) {
        alert('Please select a valid invoice type to generate report.');
        return;
    }
    window.open(
        url,
        'InvoiceReportPopup',
        'width=1000,height=800,resizable=yes,scrollbars=yes'
    );
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

// Declare invoiceData globally so it can be updated by updateTotals
let invoiceData = {
    InvoiceNo: '',
    InvoiceDate: '',
    InvoiceType: '',
    PartyCode: '',
    InvoiceAddress: '',
    BasicAmount: 0,
    OtherAmount: 0,
    CGSTAmount: 0,
    SGSTAmount: 0,
    IGSTAmount: 0,
    TotalGSTAmount: 0,
    GrandTotalAmount: 0,
    CashReceiptName: 0,
    CashReceiptGSTNo: 0,
    PONoDt: null,
    Remarks: null,
    BankID: bankID,
};
let invoiceChargesData = {
    totalFreightAmt: 0,
    totalSGSTAmt: 0,
    totalCGSTAmt: 0,
    totalIGSTAmt: 0,
    totalGSTAmt: 0,
    totalGrandAmt: 0,
}

document.getElementById('saveButton').addEventListener('click', async () => {
    const saveButton = document.getElementById('saveButton');
    const saveSpinner = document.getElementById('saveSpinner');

    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value.trim();
    const invoiceAddress = document.getElementById('invoiceAddress').value.trim();
    const invoiceType = document.getElementById('movementType').value;
    const invoiceNumberInput = document.getElementById('invoiceNo');

    const isInsertMode = saveButton.dataset.mode === 'insert';
    let invoiceNumber = invoiceNumberInput.value.trim();

    console.log('Selected Bank ID:', bankID);
    console.log('Invoice Number:', invoiceNumber, 'isInsertMode:', isInsertMode);
    console.log('saveButton.innerHTML:', saveButton.innerHTML.trim());

    try {
        // 🚀 Generate invoice number if in insert mode
        if (isInsertMode) {
            console.log('ok')
            const generatedInvoiceNumber = await generateInvoiceNumber(invoiceDate);
            if (!generatedInvoiceNumber) {
                alert('Failed to generate Invoice Number.');
                return;
            }
            invoiceNumber = generatedInvoiceNumber;
            invoiceNumberInput.value = generatedInvoiceNumber;
        } else {
            if (!invoiceNumber) {
                alert('Invoice Number is required for update.');
                return;
            }
        }


        // ✅ Basic validation after invoice number handling
        if (!partyCode || !invoiceDate || !invoiceNumber || !invoiceAddress) {
            alert('Please fill all required fields.');
            return;
        }

        // 🧾 Prepare invoiceData
        const invoiceData = {
            InvoiceNo: invoiceNumber,
            InvoiceDate: invoiceDate,
            InvoiceType: invoiceType,
            PartyCode: partyCode,
            InvoiceAddress: invoiceAddress,
            BankID: bankID,
            company_id: CompanyID,

            // 💰 Totals — directly from DOM
            BasicAmount: parseFloat(document.getElementById('totalFreight').textContent) || 0,
            OtherAmount: parseFloat(document.getElementById('totalFSCAmt').textContent) || 0 + parseFloat(document.getElementById('totalOtherAmt').textContent) || 0,
            SGSTAmount: parseFloat(document.getElementById('totalSGST').textContent) || 0,
            CGSTAmount: parseFloat(document.getElementById('totalCGST').textContent) || 0,
            IGSTAmount: parseFloat(document.getElementById('totalIGST').textContent) || 0,
            TotalGSTAmount: parseFloat(document.getElementById('totalGST').textContent) || 0,
            GrandTotalAmount: parseFloat(document.getElementById('totalGrand').textContent) || 0
        };



        if (isInsertMode) {
            invoiceData.created_by = UserLoginID;
            invoiceData.created_at = localtimeStamp;
        } else {
            invoiceData.updated_by = UserLoginID;
            invoiceData.updated_at = localtimeStamp;
        }

        // ⏳ Show spinner and disable buttons
        saveSpinner.classList.remove('d-none');
        saveButton.disabled = true;

        let result;
        if (isInsertMode) {
            // 🟢 INSERT
            result = await supabaseClient
                .from('InvoiceDetails')
                .insert([invoiceData]);
        } else {
            // 🔵 UPDATE
            result = await supabaseClient
                .from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceData.InvoiceNo)
                .eq('company_id', CompanyID);
        }

        if (result.error) throw result.error;

        alert(`Invoice ${isInsertMode ? 'saved' : 'updated'} successfully!`);
        disableForm();
    } catch (err) {
        console.error('Error processing invoice:', err?.message || err);
        alert('Failed to process invoice: ' + (err?.message || err));
    } finally {
        try {

            // Check the value and run the relevant function
            if (invoiceType === 'Forwarding' || invoiceType === 'Import' || invoiceType === 'Export') {
                console.log('Fetching pending invoices for Forwarding/Import/Export');
                await updateInvoiceNumbers(invoiceNumber);
            }
            else if (invoiceType === 'Customs Clearance') {
                await updateInvoiceNumbers_cc(invoiceNumber);
            }
            else {
                console.warn('Unknown movement type:', type);
            }



            await autoUnlockRecords();
        } catch (unlockErr) {
            console.warn('Post-save operations failed:', unlockErr.message);
        }

        resetInvoiceData();
        saveSpinner.classList.add('d-none');
        saveButton.disabled = true;
        modifyButton.disabled = false;
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.disabled = true;
        });
    }
});

// Optional: Reset invoiceData after form reset
function resetInvoiceData() {
    invoiceData = {
        InvoiceNo: '',
        InvoiceDate: '',
        InvoiceType: '',
        PartyCode: '',
        InvoiceAddress: '',
        BasicAmount: 0,
        OtherAmount: 0,
        CGSTAmount: 0,
        SGSTAmount: 0,
        IGSTAmount: 0,
        TotalGSTAmount: 0,
        GrandTotalAmount: 0,
        CashReceiptName: 0,
        CashReceiptGSTNo: 0,
        PONoDt: null,
        Remarks: null,
        BankID: null,
        company_id: CompanyID,
        created_at: null,
        created_by: null,
        updated_at: null,
        updated_by: null
    };
}

window.addEventListener('beforeunload', async (event) => {
    if (lockedBookingIds.length > 0) {
        await autoUnlockRecords();
    }
});

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

        // ✅ Fetch and update Party Name
        const partyData = await getPartyDetailsByCode(invoiceDetails.PartyCode);
        if (partyData) {
            document.getElementById('partyName').value = partyData.PartyName || '';
        } else {
            alert('Party not found.');
        }

        // Load international_booking records linked to this invoice
        disableForm(); // Disable form after loading invoice details

        saveButton.disabled = true; // Disable save button
        document.getElementById('modifyButton').disabled = false; // Enable modify button
        document.getElementById('deleteButton').disabled = true; // Enable delete button
        document.getElementById('reportButton').disabled = false; // Enable report button
        document.getElementById('fetchPendingInvoices').disabled = true; // Disable party code field

        // Check the value and run the relevant function
        if (invoiceDetails.InvoiceType === 'Forwarding' || invoiceDetails.InvoiceType === 'Import' || invoiceDetails.InvoiceType === 'Export') {
            console.log('Fetching pending invoices for Forwarding/Import/Export');
            await createPendingShipmentTableHeaderAndFooter_ib();
            await loadInvoiceBookings(invoiceNo);
        }
        else if (invoiceDetails.InvoiceType === 'Customs Clearance') {
            await createPendingShipmentTableHeaderAndFooter();
            await loadInvoiceLineItems_cc(invoiceNo); // Load Customs Clearance bookings if applicable
        }
        else {
            console.warn('Unknown movement type:', type);
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
    saveSpinner.classList.remove('d-none');

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

window.addEventListener('beforeunload', async (event) => {
    showSpinner();
    // Your logic here, like unlocking a row in Supabase
    // WARNING: async operations are not guaranteed to finish before the unload

    await unlockBooking_ib(UserLoginID); // Unlock booking for the current user
    await unlockBooking_cc(UserLoginID); // Unlock booking for the current user in Customs Clearance

    // Optionally show a confirmation dialog (some browsers ignore it now)
    event.preventDefault();
    event.returnValue = '';
    hideSpinner();
});

