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

// Fetch pending invoice details
async function getPendingInvoiceDetails() {
    const partyCode = document.getElementById('partyCode').value.trim();

    let totalFreight = 0, totalFSCAmt = 0, totalOtherAmt = 0;
    let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, totalGrand = 0;

    let mergedChargesMap = {};

    showSpinner();

    try {
        // Step 1: Fetch only unlocked records
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .is('InvoiceNumber', null)
            .eq('IsLocked', false)
            .order('BookedDate', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            alert('No pending invoices found or all are currently locked.');
            hideSpinner();
            return;
        }

        // Step 2: Lock the fetched records immediately
        const bookingIds = data.map(item => item.id);
        lockedBookingIds = bookingIds; // Store locked IDs

        startAutoUnlockTimer();
        // Step 3: Continue your existing logic to process these records
        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        let validDataFound = false;

        for (const invoice of data) {
            const charges = await getBookingCharges(invoice.id);

            if (!charges || charges.grandTotal <= 0) continue;

            const { error: lockError } = await supabaseClient
                .from('international_booking')
                .update({
                    IsLocked: true,
                    LockedBy: UserLoginID, // You should set this from your login/session
                    LockedAt: localtimeStamp
                })
                .eq('id', invoice.id);
            if (lockError) throw lockError;

            validDataFound = true;

            totalFreight += charges.BasicFrightAmt;
            totalFSCAmt += charges.FSCAmt;
            totalOtherAmt += charges.OtherAmt;
            totalSGST += charges.totalSGST;
            totalCGST += charges.totalCGST;
            totalIGST += charges.totalIGST;
            totalGST += charges.totalGST;
            totalGrand += charges.grandTotal;

            for (const [type, amounts] of Object.entries(charges.chargesMap)) {
                const normalizedType = toProperCase(type.trim().toLowerCase());

                if (!mergedChargesMap[normalizedType]) {
                    mergedChargesMap[normalizedType] = {
                        TotalAmount: 0,
                        SGSTAmt: 0,
                        CGSTAmt: 0,
                        IGSTAmt: 0,
                        TotalGSTAmt: 0,
                        GrandTotalAmt: 0
                    };
                }

                mergedChargesMap[normalizedType].TotalAmount += amounts.TotalAmount;
                mergedChargesMap[normalizedType].SGSTAmt += amounts.SGSTAmt;
                mergedChargesMap[normalizedType].CGSTAmt += amounts.CGSTAmt;
                mergedChargesMap[normalizedType].IGSTAmt += amounts.IGSTAmt;
                mergedChargesMap[normalizedType].TotalGSTAmt += amounts.TotalGSTAmt;
                mergedChargesMap[normalizedType].GrandTotalAmt += amounts.GrandTotalAmt;
            }

            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);
            row.innerHTML = `
                <td>${invoice.DocketNo || ''}</td>
                <td>${invoice.BookedDate || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.Origin || ''}</td>
                <td>${invoice.Destination || ''}</td>
                <td>${invoice.NoofUnit || ''} ${invoice.UOMType || ''}</td>
                <td>${invoice.AcutalWeight || ''}</td>
                <td>${invoice.ChargableWeight || ''}</td>
                <td>${charges.BasicFrightAmt.toFixed(2)}</td>
                <td>${charges.FSCAmt.toFixed(2)}</td>
                <td>${charges.OtherAmt.toFixed(2)}</td>
                <td>${charges.totalSGST.toFixed(2)}</td>
                <td>${charges.totalCGST.toFixed(2)}</td>
                <td>${charges.totalIGST.toFixed(2)}</td>
                <td>${charges.totalGST.toFixed(2)}</td>
                <td>${charges.grandTotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)"><i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }

        if (!validDataFound) {
            alert('No pending invoices with grand total greater than 0 found.');
        }

        updateTotals({ totalFreight, totalFSCAmt, totalOtherAmt, totalSGST, totalCGST, totalIGST, totalGST, totalGrand });

        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error fetching or locking pending invoices:', err.message);
    } finally {
        hideSpinner();
    }
}

async function getBookingCharges(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_IB', bookingID);

        if (error) throw error;

        if (data.length === 0) return null;

        const chargesMap = {};
        let BasicFrightAmt = 0, FSCAmt = 0, OtherAmt = 0;
        let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, grandTotal = 0;

        data.forEach(charge => {
            const type = (charge.ChargesType || 'Other').trim();

            if (!chargesMap[type]) {
                chargesMap[type] = {
                    TotalAmount: 0,
                    SGSTAmt: 0,
                    CGSTAmt: 0,
                    IGSTAmt: 0,
                    TotalGSTAmt: 0,
                    GrandTotalAmt: 0
                };
            }

            chargesMap[type].TotalAmount += parseFloat(charge.TotalAmount) || 0;
            chargesMap[type].SGSTAmt += parseFloat(charge.SGSTAmt) || 0;
            chargesMap[type].CGSTAmt += parseFloat(charge.CGSTAmt) || 0;
            chargesMap[type].IGSTAmt += parseFloat(charge.IGSTAmt) || 0;
            chargesMap[type].TotalGSTAmt += parseFloat(charge.TotalGSTAmt) || 0;
            chargesMap[type].GrandTotalAmt += parseFloat(charge.GrandTotalAmt) || 0;

            // Summing category-wise
            const typeLower = type.trim().toLowerCase();
            if (typeLower === 'freight amount') {
                BasicFrightAmt += parseFloat(charge.TotalAmount) || 0;
            } else if (typeLower === 'fuel surcharge') {
                FSCAmt += parseFloat(charge.TotalAmount) || 0;
            } else {
                OtherAmt += parseFloat(charge.TotalAmount) || 0;
            }

            totalSGST += parseFloat(charge.SGSTAmt) || 0;
            totalCGST += parseFloat(charge.CGSTAmt) || 0;
            totalIGST += parseFloat(charge.IGSTAmt) || 0;
            totalGST += parseFloat(charge.TotalGSTAmt) || 0;
            grandTotal += parseFloat(charge.GrandTotalAmt) || 0;
        });

        return { BasicFrightAmt, FSCAmt, OtherAmt, totalSGST, totalCGST, totalIGST, totalGST, grandTotal, chargesMap };

    } catch (err) {
        console.error('Error fetching booking charges:', err.message);
        return null;
    }
}

function renderChargesTable(chargesMap) {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    tbody.innerHTML = '';

    let totalAmount = 0, totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGSTAmt = 0, totalGrandAmt = 0;

    Object.entries(chargesMap).forEach(([type, amounts]) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${type}</td>
            <td class="text-end">${amounts.TotalAmount.toFixed(2)}</td>
            <td class="text-end">${amounts.SGSTAmt.toFixed(2)}</td>
            <td class="text-end">${amounts.CGSTAmt.toFixed(2)}</td>
            <td class="text-end">${amounts.IGSTAmt.toFixed(2)}</td>
            <td class="text-end">${amounts.TotalGSTAmt.toFixed(2)}</td>
            <td class="text-end">${amounts.GrandTotalAmt.toFixed(2)}</td>
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

function updateTotals(totals) {
    // Display formatted totals in the UI
    document.getElementById('totalFreight').textContent = totals.totalFreight.toFixed(2);
    document.getElementById('totalFSCAmt').textContent = totals.totalFSCAmt.toFixed(2);
    document.getElementById('totalOtherAmt').textContent = totals.totalOtherAmt.toFixed(2);
    document.getElementById('totalSGST').textContent = totals.totalSGST.toFixed(2);
    document.getElementById('totalCGST').textContent = totals.totalCGST.toFixed(2);
    document.getElementById('totalIGST').textContent = totals.totalIGST.toFixed(2);
    document.getElementById('totalGST').textContent = totals.totalGST.toFixed(2);
    document.getElementById('totalGrand').textContent = totals.totalGrand.toFixed(2);

    // ✅ Update global invoiceData with numeric values (not formatted strings)
    invoiceData.BasicAmount = parseFloat(totals.totalFreight);
    invoiceData.OtherAmount = parseFloat(totals.totalFSCAmt) + parseFloat(totals.totalOtherAmt);
    invoiceData.CGSTAmount = parseFloat(totals.totalCGST);
    invoiceData.SGSTAmount = parseFloat(totals.totalSGST);
    invoiceData.IGSTAmount = parseFloat(totals.totalIGST);
    invoiceData.TotalGSTAmount = parseFloat(totals.totalGST);
    invoiceData.GrandTotalAmount = parseFloat(totals.totalGrand);

    // console.log('Updated invoiceData:', invoiceData);
}

// Fetch pending invoices on button click
document.getElementById('fetchPendingInvoices').addEventListener('click', getPendingInvoiceDetails);

function removeRow(button) {
    const row = button.closest('tr');
    if (!row) return;

    // Get the shipment ID
    const shipId = row.getAttribute('data-ship-id');
    if (shipId) {
        // Optional: Remove from lockedBookingIds if you maintain this array
        const index = lockedBookingIds.indexOf(parseInt(shipId));
        if (index !== -1) {
            lockedBookingIds.splice(index, 1);
        }

        // Optional: Unlock the record in the database
        unlockShipmentRecord(shipId);
    }

    // Get the amounts from the row
    const freightAmt = parseFloat(row.cells[10].textContent) || 0;
    const fscAmt = parseFloat(row.cells[11].textContent) || 0;
    const otherAmt = parseFloat(row.cells[12].textContent) || 0;
    const sgstAmt = parseFloat(row.cells[13].textContent) || 0;
    const cgstAmt = parseFloat(row.cells[14].textContent) || 0;
    const igstAmt = parseFloat(row.cells[15].textContent) || 0;
    const gstAmt = parseFloat(row.cells[16].textContent) || 0;
    const grandAmt = parseFloat(row.cells[17].textContent) || 0;

    // Subtract from totals
    document.getElementById('totalFreight').textContent = (parseFloat(document.getElementById('totalFreight').textContent) - freightAmt).toFixed(2);
    document.getElementById('totalFSCAmt').textContent = (parseFloat(document.getElementById('totalFSCAmt').textContent) - fscAmt).toFixed(2);
    document.getElementById('totalOtherAmt').textContent = (parseFloat(document.getElementById('totalOtherAmt').textContent) - otherAmt).toFixed(2);
    document.getElementById('totalSGST').textContent = (parseFloat(document.getElementById('totalSGST').textContent) - sgstAmt).toFixed(2);
    document.getElementById('totalCGST').textContent = (parseFloat(document.getElementById('totalCGST').textContent) - cgstAmt).toFixed(2);
    document.getElementById('totalIGST').textContent = (parseFloat(document.getElementById('totalIGST').textContent) - igstAmt).toFixed(2);
    document.getElementById('totalGST').textContent = (parseFloat(document.getElementById('totalGST').textContent) - gstAmt).toFixed(2);
    document.getElementById('totalGrand').textContent = (parseFloat(document.getElementById('totalGrand').textContent) - grandAmt).toFixed(2);

    // Remove row from table
    row.remove();
}

function showSpinner() {
    document.getElementById('loadingSpinner').classList.remove('d-none');
}

function hideSpinner() {
    document.getElementById('loadingSpinner').classList.add('d-none');
}

document.getElementById('newButton').addEventListener('click', () => {
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

    // Reset all totals
    updateTotals({
        totalFreight: 0,
        totalFSCAmt: 0,
        totalOtherAmt: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        totalGrand: 0
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
    testUnlock();

});

document.getElementById('modifyButton').addEventListener('click', () => {
    // Enable all delete buttons
    saveButton.disabled = false; // Enable save button
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
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
document.getElementById('reportButton').addEventListener('click', () => {
    const invoiceNo = document.getElementById('invoiceNo').value;
    const partyName = document.getElementById('partyName').value;
    const url = `rep_Invoice_Forwarding_Main.html?invoiceNo=${encodeURIComponent(invoiceNo)}&partyName=${encodeURIComponent(partyName)}`;

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

document.getElementById('saveButton').addEventListener('click', async () => {
    const saveButton = document.getElementById('saveButton');
    const saveSpinner = document.getElementById('saveSpinner');

    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value.trim();
    const invoiceAddress = document.getElementById('invoiceAddress').value.trim();
    const invoiceType = document.getElementById('movementType').value;

    console.log('Selected Bank ID:', bankID);

    // ✅ Determine button mode
    const isInsertMode = saveButton.innerHTML.trim() === '<i class="bi bi-save"></i> Save';
    const invoiceNumber = document.getElementById('invoiceNo').value.trim();

    if (isInsertMode) {
        // Insert mode: Generate invoice number
        const generatedInvoiceNumber = await generateInvoiceNumber(invoiceDate);
        if (generatedInvoiceNumber) {
            document.getElementById('invoiceNo').value = generatedInvoiceNumber;
            invoiceData.InvoiceNo = generatedInvoiceNumber;
        } else {
            alert('Failed to generate Invoice Number.');
            return;
        }
    } else {
        // Update mode: Use the existing invoice number
        if (!invoiceNumber) {
            alert('Invoice Number is required for update.');
            return;
        }
        invoiceData.InvoiceNo = invoiceNumber;
    }

    // ✅ Validation AFTER invoice number is handled
    if (!partyCode || !invoiceDate || !invoiceNumber || !invoiceAddress) {
        alert('Please fill all required fields.');
        return;
    }

    // Show spinner and disable button
    saveSpinner.classList.remove('d-none');
    saveButton.disabled = true;

    // Prepare invoiceData
    invoiceData.InvoiceDate = invoiceDate;
    invoiceData.InvoiceType = invoiceType;
    invoiceData.PartyCode = partyCode;
    invoiceData.InvoiceAddress = invoiceAddress;
    invoiceData.BankID = bankID;
    invoiceData.company_id = CompanyID;

    if (isInsertMode) {
        invoiceData.created_by = UserLoginID;
        invoiceData.created_at = localtimeStamp;
    } else {
        invoiceData.updated_by = UserLoginID;
        invoiceData.updated_at = localtimeStamp;
    }

    try {
        if (isInsertMode) {
            // ✅ INSERT
            const { data, error } = await supabaseClient
                .from('InvoiceDetails')
                .insert([invoiceData]);

            if (error) throw error;

            alert('Invoice saved successfully!');
        } else {
            // ✅ UPDATE
            const { data, error } = await supabaseClient
                .from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceData.InvoiceNo)
                .eq('company_id', CompanyID);

            if (error) throw error;

            disableForm();
            alert('Invoice updated successfully!');
        }

    } catch (err) {
        console.error('Error processing invoice:', err?.message || JSON.stringify(err));
        alert('Failed to process invoice: ' + (err?.message || JSON.stringify(err)));
    } finally {
        disableForm(); // Disable form after saving
        await updateInvoiceNumbers(invoiceData.InvoiceNo); // Update linked bookings
        resetInvoiceData();
        await autoUnlockRecords(); // Unlock records
        saveSpinner.classList.add('d-none');
        saveButton.disabled = true;
        modifyButton.disabled = false; // Disable modify button
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

async function updateInvoiceNumbers(invNo) {
    const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');

    const shipmentIds = [];

    // Extract IDs from a hidden column or dataset
    rows.forEach(row => {
        const shipId = row.getAttribute('data-ship-id'); // Assuming you store the shipment ID here
        if (shipId) shipmentIds.push(parseInt(shipId));
    });
    console.log('Shipment IDs to update:', shipmentIds);
    if (shipmentIds.length === 0) {
        console.warn('No shipment IDs found for invoice update.');
        return;
    }

    // Step 1: Clear existing assignments
    const { error: clearError } = await supabaseClient
        .from('international_booking')
        .update({
            InvoiceStatus: false,
            InvoiceNumber: null
        })
        .eq('InvoiceNumber', invNo); // Corrected: Use eq for a single invoice number

    console.log('Clearing previous invoice assignments for:', invNo);
    if (clearError) {
        console.error('Error clearing previous invoice assignments:', clearError.message);
        throw clearError;
    }
    console.log('Previous invoice assignments cleared for:', invNo);

    // Step 2: Update new assignments
    const { error: updateError } = await supabaseClient
        .from('international_booking')
        .update({
            InvoiceStatus: true,
            InvoiceNumber: invNo
        })
        .in('id', shipmentIds);

    if (updateError) {
        console.error('Error updating invoice numbers:', updateError.message);
        throw updateError;
    }

    console.log('Invoice numbers updated for shipments:', shipmentIds);
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

        await loadInvoiceBookings(invoiceNo);


    }
});

async function loadInvoiceBookings(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();

    let totals = {
        totalFreight: 0,
        totalFSCAmt: 0,
        totalOtherAmt: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        totalGrand: 0
    };

    let mergedChargesMap = {};

    try {
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('BookedDate', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No shipments found for this invoice.');
            return;
        }

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        for (const invoice of data) {
            const charges = await getBookingCharges(invoice.id);
            if (!charges || charges.grandTotal <= 0) continue;

            // Update totals
            totals.totalFreight += charges.BasicFrightAmt;
            totals.totalFSCAmt += charges.FSCAmt;
            totals.totalOtherAmt += charges.OtherAmt;
            totals.totalSGST += charges.totalSGST;
            totals.totalCGST += charges.totalCGST;
            totals.totalIGST += charges.totalIGST;
            totals.totalGST += charges.totalGST;
            totals.totalGrand += charges.grandTotal;

            // Merge charge types
            for (const [type, amounts] of Object.entries(charges.chargesMap)) {
                const normalizedType = toProperCase(type.trim().toLowerCase());

                if (!mergedChargesMap[normalizedType]) {
                    mergedChargesMap[normalizedType] = {
                        TotalAmount: 0,
                        SGSTAmt: 0,
                        CGSTAmt: 0,
                        IGSTAmt: 0,
                        TotalGSTAmt: 0,
                        GrandTotalAmt: 0
                    };
                }

                mergedChargesMap[normalizedType].TotalAmount += amounts.TotalAmount;
                mergedChargesMap[normalizedType].SGSTAmt += amounts.SGSTAmt;
                mergedChargesMap[normalizedType].CGSTAmt += amounts.CGSTAmt;
                mergedChargesMap[normalizedType].IGSTAmt += amounts.IGSTAmt;
                mergedChargesMap[normalizedType].TotalGSTAmt += amounts.TotalGSTAmt;
                mergedChargesMap[normalizedType].GrandTotalAmt += amounts.GrandTotalAmt;
            }

            // Render row
            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);
            row.innerHTML = `
                <td>${invoice.DocketNo || ''}</td>
                <td>${invoice.BookedDate || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.Origin || ''}</td>
                <td>${invoice.Destination || ''}</td>
                <td>${invoice.NoofUnit || ''} ${invoice.UOMType || ''}</td>
                <td>${invoice.AcutalWeight || ''}</td>
                <td>${invoice.ChargableWeight || ''}</td>
                <td>${charges.BasicFrightAmt.toFixed(2)}</td>
                <td>${charges.FSCAmt.toFixed(2)}</td>
                <td>${charges.OtherAmt.toFixed(2)}</td>
                <td>${charges.totalSGST.toFixed(2)}</td>
                <td>${charges.totalCGST.toFixed(2)}</td>
                <td>${charges.totalIGST.toFixed(2)}</td>
                <td>${charges.totalGST.toFixed(2)}</td>
                <td>${charges.grandTotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)" disabled><i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }

        updateTotals(totals);
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error loading linked bookings:', err.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

document.getElementById('addShipmentNo').addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipmentNo').value.trim();
    const invoiceNo = document.getElementById('invoiceNo').value.trim();
    const saveSpinner = document.getElementById('saveSpinner');

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

    await addSingleShipmentToInvoice(shipmentNo, invoiceNo);
});

async function addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    showSpinner();

    try {
        // Fetch shipment details
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('DocketNo', shipmentNo)
            .is('InvoiceNumber', null)
            .eq('IsLocked', false)
            .single();

        if (error || !data) {
            alert('Shipment not found or already locked.');
            return;
        }

        const charges = await getBookingCharges(data.id);
        if (!charges || charges.grandTotal <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Lock the shipment and assign invoice number
        const { error: updateError } = await supabaseClient
            .from('international_booking')
            .update({
                InvoiceStatus: true,
                InvoiceNumber: invoiceNo,
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id);

        if (updateError) throw updateError;

        // Add to table
        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        const row = document.createElement('tr');
        row.setAttribute('data-ship-id', data.id);
        row.innerHTML = `
            <td>${data.DocketNo || ''}</td>
            <td>${data.BookedDate || ''}</td>
            <td>${data.MovementType || ''}</td>
            <td>${data.TransitType || ''}</td>
            <td>${data.ModeType || ''}</td>
            <td>${data.Origin || ''}</td>
            <td>${data.Destination || ''}</td>
            <td>${data.NoofUnit || ''} ${data.UOMType || ''}</td>
            <td>${data.AcutalWeight || ''}</td>
            <td>${data.ChargableWeight || ''}</td>
            <td>${charges.BasicFrightAmt.toFixed(2)}</td>
            <td>${charges.FSCAmt.toFixed(2)}</td>
            <td>${charges.OtherAmt.toFixed(2)}</td>
            <td>${charges.totalSGST.toFixed(2)}</td>
            <td>${charges.totalCGST.toFixed(2)}</td>
            <td>${charges.totalIGST.toFixed(2)}</td>
            <td>${charges.totalGST.toFixed(2)}</td>
            <td>${charges.grandTotal.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)"><i class="bi bi-trash"></i></button></td>
        `;
        tableBody.appendChild(row);

        // Optionally update your totals here (if required)
        alert('Shipment added successfully!');

    } catch (err) {
        console.error('Error adding shipment:', err.message);
        alert('Error adding shipment: ' + err.message);
    } finally {
        hideSpinner();
    }
}

// window.addEventListener('beforeunload', () => {
//     if (!UserLoginID) return;

//     const url = 'https://qfdrugniulwovfaijgkr.supabase.co/functions/v1/unlock-booking';
//     const data = JSON.stringify({ userId: UserLoginID });
//     const blob = new Blob([data], { type: 'application/json' }); // Still good practice
//     navigator.sendBeacon(url, blob);
// });

window.addEventListener('beforeunload', () => {
    const url = 'https://qfdrugniulwovfaijgkr.supabase.co/functions/v1/unlock-booking';
    const payload = JSON.stringify({ user_id: UserLoginID });

    const blob = new Blob([payload], { type: 'application/json' });

    navigator.sendBeacon(url, blob);
});







