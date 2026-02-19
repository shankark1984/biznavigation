let mergedChargesMap = {};
async function CustomsClearanceInvoiceDetails() {
    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDateElement = document.getElementById('invoiceDate');
    const movementTypeElement = document.getElementById('movementType');
    const movementType = movementTypeElement.value;


    if (!partyCode) {
        alert('Please select a customer first.');
        return;
    }


    if (!invoiceDateElement.value) {
        alert('Please select an invoice date first.');
        invoiceDateElement.focus();
        return;
    }


    if (!movementType) {
        alert('Please select a movement type first.');
        movementTypeElement.focus();
        return;
    }


    document.getElementById('fetchPendingInvoices').disabled = true;
    showSpinner();


    let totalFreight = 0, totalFSCAmt = 0, totalOtherAmt = 0;
    let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, totalGrand = 0;
    let mergedChargesMap = {};
    let validDataFound = false;


    try {
        // Build query
        let query = supabaseClient
            .from('CustomsClearanceView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('PartyCode', partyCode)
            .or('InvoiceNo.is.null,InvoiceNo.eq.""')
            .eq('IsLocked', false)
            .order('JobDate', { ascending: true });


        console.log('Fetching pending invoices for:', CompanyID, partyCode, movementType);


        // Movement type condition
        if (movementType === 'Customs Clearance') {
            console.log('Fetching invoices for Forwarding movement type');
            query = query.in('MovementType', ['Import', 'Export']);
        } else {
            query = query.eq('MovementType', movementType);
            console.log('Fetching invoices for movement type:', movementType);
        }


        const { data, error } = await query;


        if (error) throw error;


        if (!data || data.length === 0) {
            alert('No pending invoices found or all are currently locked.');
            document.getElementById('fetchPendingInvoices').disabled = false;
            return;
        }


        const bookingIds = data.map(item => item.id);
        lockedBookingIds = bookingIds;
        startAutoUnlockTimer();


        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';


        // build dynamic header + footer
        createPendingShipmentTableHeaderAndFooter();


        for (const invoice of data) {
            console.log('Processing invoice:', invoice.id, invoice.JobID);
            const charges = await getBookingCharges_cc(invoice.id);
            if (!charges || charges.grandTotal <= 0) continue;


            const { error: lockError } = await supabaseClient
                .from('CustomsClearance_Details')
                .update({
                    IsLocked: true,
                    LockedBy: UserLoginID,
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
                        TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                        IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
                    };
                }


                const entry = mergedChargesMap[normalizedType];
                entry.TotalAmount += amounts.TotalAmount;
                entry.SGSTAmt += amounts.SGSTAmt;
                entry.CGSTAmt += amounts.CGSTAmt;
                entry.IGSTAmt += amounts.IGSTAmt;
                entry.TotalGSTAmt += amounts.TotalGSTAmt;
                entry.GrandTotalAmt += amounts.GrandTotalAmt;
            }


            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);
            row.innerHTML = `
                <td>${tableBody.children.length + 1}</td>
                <td>${invoice.JobID || ''}</td>
                <td>${invoice.JobDate || ''}</td>
                <td>${invoice.BLAWBNo || ''}</td>
                <td>${invoice.BLAWBDate || ''}</td>
                <td>${invoice.BENo || ''}</td>
                <td>${invoice.BEDate || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.CustomsBroker || ''}</td>
                <td>${invoice.ClearancePort || ''}</td>
                <td>${invoice.ClearanceCountry || ''}</td>
                <td>${invoice.Quantity || ''}</td>
                <td>${invoice.CargoWeight || ''}</td>
                <td>${invoice.TotalAmount.toFixed(2)}</td>
                <td>${invoice.SGSTAmt.toFixed(2)}</td>
                <td>${invoice.CGSTAmt.toFixed(2)}</td>
                <td>${invoice.IGSTAmt.toFixed(2)}</td>
                <td>${invoice.TotalGSTAmt.toFixed(2)}</td>
                <td>${invoice.GrandTotalAmt.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow_cc(this)" disabled><i class="bi bi-trash"></i></button></td>
                <td style="display:none;">${invoice.id}</td>
                `;

            tableBody.appendChild(row);
        }


        if (!validDataFound) {
            alert('No pending invoices with grand total greater than 0 found.');
        }


        updateTotals_cc({ totalFreight, totalSGST, totalCGST, totalIGST, totalGST, totalGrand });
        renderChargesTable(mergedChargesMap);


    } catch (err) {
        console.error('Error fetching or locking pending invoices:', err.message);
    } finally {
        hideSpinner();
    }
}

async function getBookingCharges_cc(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearanceCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_CC', bookingID);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const chargesMap = {};
        let BasicFrightAmt = 0;
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

            const TotalAmount = parseFloat(charge.TotalAmount) || 0;
            const SGSTAmt = parseFloat(charge.SGSTAmt) || 0;
            const CGSTAmt = parseFloat(charge.CGSTAmt) || 0;
            const IGSTAmt = parseFloat(charge.IGSTAmt) || 0;
            const TotalGSTAmt = parseFloat(charge.TotalGSTAmt) || 0;
            const GrandTotalAmt = parseFloat(charge.GrandTotalAmt) || 0;

            chargesMap[type].TotalAmount += TotalAmount;
            chargesMap[type].SGSTAmt += SGSTAmt;
            chargesMap[type].CGSTAmt += CGSTAmt;
            chargesMap[type].IGSTAmt += IGSTAmt;
            chargesMap[type].TotalGSTAmt += TotalGSTAmt;
            chargesMap[type].GrandTotalAmt += GrandTotalAmt;

            BasicFrightAmt += TotalAmount;
            totalSGST += SGSTAmt;
            totalCGST += CGSTAmt;
            totalIGST += IGSTAmt;
            totalGST += TotalGSTAmt;
            grandTotal += GrandTotalAmt;
        });

        return { BasicFrightAmt, totalSGST, totalCGST, totalIGST, totalGST, grandTotal, chargesMap };

    } catch (err) {
        console.error('Error fetching booking charges:', err.message);
        return null;
    }
}

//
async function unlockBooking_cc(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }


    try {
        const { error } = await supabaseClient
            .from("CustomsClearance_Details")
            .update({ IsLocked: false })
            .eq("LockedBy", userID);


        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            // console.log(`Booking unlocked successfully for user ID: ${userID}`);
        }
    } catch (err) {
        console.error("Unexpected error during unlock:", err);
    }
}

// Function to create table header & footer dynamically
async function createPendingShipmentTableHeaderAndFooter() {
    const headerCols = [
        "Sr No.",
        "Job No",
        "Job<br>Date",
        "BL / AWB<br>No",
        "BL / AWB<br>Date",
        "BE No",
        "BE Date",
        "Movement<br>Type",
        "Transit<br>Type",
        "Mode<br>Type",
        "Customs<br>Broker",
        "Clearance<br>Port",
        "Clearance<br>Country",
        "Quantity",
        "Cargo<br>Weight",
        "Total<br>Amount",
        "SGST<br>Amount",
        "CGST<br>Amount",
        "IGST<br>Amount",
        "Total GST<br>Amount",
        "Grand Total<br>Amount",
        "Action",
        "id"
    ];


    const footerTotals = [
        { colspan: 15, label: "Totals:", align: "text-end" },


        { id: "totalFreight_sc" },
        { id: "totalSGST_sc" },
        { id: "totalCGST_sc" },
        { id: "totalIGST_sc" },
        { id: "totalGST_sc" },
        { id: "totalGrand_sc" },
        { empty: true }
    ];


    const table = document.getElementById("pendingShipmentTable");


    // Remove old head/foot if exists
    const oldHead = table.querySelector("thead");
    const oldFoot = table.querySelector("tfoot");
    if (oldHead) oldHead.remove();
    if (oldFoot) oldFoot.remove();


    // Create THEAD
    const thead = document.createElement("thead");
    thead.classList.add("table-light");


    const headRow = document.createElement("tr");
    headerCols.forEach(text => {
        const th = document.createElement("th");
        th.innerHTML = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.prepend(thead);


    // Create TFOOT
    const tfoot = document.createElement("tfoot");
    tfoot.classList.add("table-light");


    const footRow = document.createElement("tr");
    footRow.id = "totalsRow";


    footerTotals.forEach(item => {
        const th = document.createElement("th");
        if (item.colspan) th.colSpan = item.colspan;
        if (item.label) th.textContent = item.label;
        if (item.id) {
            th.id = item.id;
            th.classList.add("text-end");
            th.textContent = "0.00";
        }
        if (item.align) th.classList.add(item.align);
        if (item.empty) th.textContent = "";
        footRow.appendChild(th);
    });


    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
}

function updateTotals_cc() {
    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr');

    let totalFreight = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let totalGrand = 0;

    rows.forEach(r => {
        totalFreight += parseFloat(r.cells[15]?.textContent) || 0;
        totalSGST += parseFloat(r.cells[16]?.textContent) || 0;
        totalCGST += parseFloat(r.cells[17]?.textContent) || 0;
        totalIGST += parseFloat(r.cells[18]?.textContent) || 0;
        totalGST += parseFloat(r.cells[19]?.textContent) || 0;
        totalGrand += parseFloat(r.cells[20]?.textContent) || 0;
    });

    document.getElementById('totalFreight_sc').textContent = totalFreight.toFixed(2);
    document.getElementById('totalSGST_sc').textContent = totalSGST.toFixed(2);
    document.getElementById('totalCGST_sc').textContent = totalCGST.toFixed(2);
    document.getElementById('totalIGST_sc').textContent = totalIGST.toFixed(2);
    document.getElementById('totalGST_sc').textContent = totalGST.toFixed(2);
    document.getElementById('totalGrand_sc').textContent = totalGrand.toFixed(2);
}


async function updateInvoiceNumbers_cc(invNo) {
    const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');
    console.log('Updating invoice numbers for:', invNo);
    const shipmentIds = [];


    // Step 1: Clear existing assignments
    const { error: clearError } = await supabaseClient
        .from('CustomsClearance_Details')
        .update({
            InvoiceNo: null
        })
        .eq('InvoiceNo', invNo); // Corrected: Use eq for a single invoice number


    // Extract IDs from a hidden column or dataset
    rows.forEach(row => {
        const shipId = row.getAttribute('data-ship-id'); // Assuming you store the shipment ID here
        if (shipId) shipmentIds.push(parseInt(shipId));
    });

    if (shipmentIds.length === 0) {
        console.warn('No shipment IDs found for invoice update.');
        return;
    }

    console.log('Clearing previous invoice assignments for:', invNo);
    if (clearError) {
        console.error('Error clearing previous invoice assignments:', clearError.message);
        throw clearError;
    }
    console.log('Previous invoice assignments cleared for:', invNo);

    // Step 2: Update new assignments
    const { error: updateError } = await supabaseClient
        .from('CustomsClearance_Details')
        .update({
            InvoiceNo: invNo
        })
        .in('id', shipmentIds);


    if (updateError) {
        console.error('Error updating invoice numbers:', updateError.message);
        throw updateError;
    }


    console.log('Invoice numbers updated for shipments:', shipmentIds);
}


async function loadInvoiceLineItems_cc(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();

    let totals = {
        totalFreight: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        totalGrand: 0
    };

    let mergedChargesMap = {};

    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearanceView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNo', invoiceNo)
            .order('JobDate', { ascending: true });

        if (error) throw error;


        if (!data || data.length === 0) {
            alert('No shipments found for this invoice.');
            return;
        }

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';


        await createPendingShipmentTableHeaderAndFooter(); // Ensure header/footer is created


        for (const invoice of data) {
            const charges = await getBookingCharges_cc(invoice.id);
            if (!charges || charges.grandTotal <= 0) continue;

            // Update totals
            totals.totalFreight += charges.BasicFrightAmt;
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
                <td>${tableBody.children.length + 1}</td>
                <td>${invoice.JobID || ''}</td>
                <td>${invoice.JobDate || ''}</td>
                <td>${invoice.BLAWBNo || ''}</td>
                <td>${invoice.BLAWBDate || ''}</td>
                <td>${invoice.BENo || ''}</td>
                <td>${invoice.BEDate || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.CustomsBroker || ''}</td>
                <td>${invoice.ClearancePort || ''}</td>
                <td>${invoice.ClearanceCountry || ''}</td>
                <td>${invoice.Quantity || ''}</td>
                <td>${invoice.CargoWeight || ''}</td>
                <td>${invoice.TotalAmount.toFixed(2)}</td>
                <td>${invoice.SGSTAmt.toFixed(2)}</td>
                <td>${invoice.CGSTAmt.toFixed(2)}</td>
                <td>${invoice.IGSTAmt.toFixed(2)}</td>
                <td>${invoice.TotalGSTAmt.toFixed(2)}</td>
                <td>${invoice.GrandTotalAmt.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow_cc(this)" disabled><i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }


        updateTotals_cc(totals);
        renderChargesTable(mergedChargesMap);


    } catch (err) {
        console.error('Error loading linked bookings:', err.message, err);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}


async function addSingleShipmentToInvoice_cc(shipmentNo, invoiceNo) {
    showSpinner();

    const partyCode = document.getElementById('partyCode').value.trim();

    try {
        // Step 1: Fetch shipment details
        const { data, error } = await supabaseClient
            .from('CustomsClearanceView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('JobID', shipmentNo)
            .single();

        if (error || !data) {
            alert(`Shipment ${shipmentNo} not found.`);
            return;
        }

        // Step 2: Already linked check
        if (data.InvoiceNo) {
            alert(`Shipment ${shipmentNo} is already linked to Invoice No: ${data.InvoiceNo}.`);
            return;
        }

        // Step 3: Locked check
        if (data.IsLocked) {
            alert(`Shipment ${shipmentNo} is currently locked by another process/user.`);
            return;
        }

        // Step 4: Get charges
        const charges = await getBookingCharges_cc(data.id);
        if (!charges || charges.grandTotal <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Step 5: Lock and assign invoice number
        const { error: updateError } = await supabaseClient
            .from('CustomsClearance_Details')
            .update({
                InvoiceNo: invoiceNo,
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id)
            .eq('company_id', CompanyID)
            .eq('PartyCode', partyCode);

        if (updateError) throw updateError;

        // Step 6: Add shipment row
        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        const row = document.createElement('tr');
        row.setAttribute('data-ship-id', data.id);
        row.innerHTML = `
            <td>${tableBody.children.length + 1}</td>
            <td>${data.JobID || ''}</td>
            <td>${data.JobDate || ''}</td>
            <td>${data.BLAWBNo || ''}</td>
            <td>${data.BLAWBDate || ''}</td>
            <td>${data.BENo || ''}</td>
            <td>${data.BEDate || ''}</td>
            <td>${data.MovementType || ''}</td>
            <td>${data.TransitType || ''}</td>
            <td>${data.ModeType || ''}</td>
            <td>${data.CustomsBroker || ''}</td>
            <td>${data.ClearancePort || ''}</td>
            <td>${data.ClearanceCountry || ''}</td>
            <td>${data.Quantity || ''}</td>
            <td>${data.CargoWeight || ''}</td>
            <td>${data.TotalAmount.toFixed(2)}</td>
            <td>${data.SGSTAmt.toFixed(2)}</td>
            <td>${data.CGSTAmt.toFixed(2)}</td>
            <td>${data.IGSTAmt.toFixed(2)}</td>
            <td>${data.TotalGSTAmt.toFixed(2)}</td>
            <td>${data.GrandTotalAmt.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow_cc(this)" disabled><i class="bi bi-trash"></i></button></td>
        `;
        tableBody.appendChild(row);

        // ✅ Step 7: Merge charges into global map and re-render charges table
        mergeChargesIntoMap(charges);
        renderChargesTable(window.mergedChargesMap);

        // ✅ Update totals if needed
        updateTotals_cc();

        alert('Shipment added successfully!');

    } catch (err) {
        console.error('Error adding shipment:', err.message, err);
        alert('Error adding shipment: ' + err.message);
    } finally {
        hideSpinner();
    }
}

// Utility to merge charges
function mergeChargesIntoMap(newCharges) {

    if (!window.mergedChargesMap) {
        window.mergedChargesMap = {};
    }

    const chargeMap = newCharges.chargesMap;   // ✅ FIX HERE

    for (const [type, amounts] of Object.entries(chargeMap)) {

        const normalizedType = toProperCase(type.trim().toLowerCase());

        if (!window.mergedChargesMap[normalizedType]) {
            window.mergedChargesMap[normalizedType] = {
                TotalAmount: 0,
                SGSTAmt: 0,
                CGSTAmt: 0,
                IGSTAmt: 0,
                TotalGSTAmt: 0,
                GrandTotalAmt: 0
            };
        }

        window.mergedChargesMap[normalizedType].TotalAmount += amounts.TotalAmount || 0;
        window.mergedChargesMap[normalizedType].SGSTAmt += amounts.SGSTAmt || 0;
        window.mergedChargesMap[normalizedType].CGSTAmt += amounts.CGSTAmt || 0;
        window.mergedChargesMap[normalizedType].IGSTAmt += amounts.IGSTAmt || 0;
        window.mergedChargesMap[normalizedType].TotalGSTAmt += amounts.TotalGSTAmt || 0;
        window.mergedChargesMap[normalizedType].GrandTotalAmt += amounts.GrandTotalAmt || 0;
    }
}

async function removeRow_cc(button) {
    const row = button.closest('tr');
    if (!row) return;

    const shipId = row.getAttribute('data-ship-id');
    if (shipId) unlockShipmentRecord_cc(shipId);

    // Remove the row
    row.remove();

    // Recalculate totals from scratch
    await recalcTotals_cc();
}

async function recalcTotals_cc() {
    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr');

    let totalFreight = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let totalGrand = 0;

    rows.forEach(r => {
        totalFreight += parseFloat(r.cells[15]?.textContent) || 0;
        totalSGST += parseFloat(r.cells[16]?.textContent) || 0;
        totalCGST += parseFloat(r.cells[17]?.textContent) || 0;
        totalIGST += parseFloat(r.cells[18]?.textContent) || 0;
        totalGST += parseFloat(r.cells[19]?.textContent) || 0;
        totalGrand += parseFloat(r.cells[20]?.textContent) || 0;
    });

    document.getElementById('totalFreight_sc').textContent = totalFreight.toFixed(2);
    document.getElementById('totalSGST_sc').textContent = totalSGST.toFixed(2);
    document.getElementById('totalCGST_sc').textContent = totalCGST.toFixed(2);
    document.getElementById('totalIGST_sc').textContent = totalIGST.toFixed(2);
    document.getElementById('totalGST_sc').textContent = totalGST.toFixed(2);
    document.getElementById('totalGrand_sc').textContent = totalGrand.toFixed(2);
}

