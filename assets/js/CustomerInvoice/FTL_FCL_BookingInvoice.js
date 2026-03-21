// Helper
function formatAmt(v) {
    return (parseFloat(v) || 0).toFixed(2);
}

// ================================
// GET PENDING INVOICE BOOKINGS
// ================================
async function FTL_FCL_getPendingInvoiceDetails() {
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
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .eq('InvoiceStatus', "Pending")
            .or('IsLocked.eq.false,IsLocked.is.null')
            .order('PickupDate', { ascending: true });

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

        FTL_FCL_createPendingShipmentTableHeaderAndFooter(); // Create header and footer if not already done

        for (const invoice of data) {

            const charges = await FTL_FCL_getBookingCharges(invoice.LRNumber);
            if (!charges || charges.grandTotal <= 0) continue;

            const { error: lockError } = await supabaseClient
                .from('FullLoadBookingDetails')
                .update({
                    IsLocked: true,
                    LockedBy: UserLoginID,
                    LockedAt: new Date().toISOString()
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
                <td>${invoice.LRNumber || ''}</td>
                <td>${invoice.PickupDate || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.RouteDetails || ''}</td>                
                <td>${invoice.OriginCity || ''}</td>
                <td>${invoice.DestinationCity || ''}</td>
                <td>${invoice.VehicleType || ''}</td>
                <td>${invoice.VehicleNumber || ''}</td>
                <td>${invoice.ContainerNumber || ''}</td>
                <td>${invoice.Quantity || ''}</td>
                <td>${invoice.ChargeableWeight || ''}</td>
                <td>${charges.BasicFrightAmt.toFixed(2)}</td>
                <td>${charges.OtherAmt.toFixed(2)}</td>
                <td>${charges.totalSGST.toFixed(2)}</td>
                <td>${charges.totalCGST.toFixed(2)}</td>
                <td>${charges.totalIGST.toFixed(2)}</td>
                <td>${charges.totalGST.toFixed(2)}</td>
                <td>${charges.grandTotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="d_removeRow(this)">
                <i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }

        if (!validDataFound) {
            alert('No pending invoices with grand total greater than 0 found.');
        }

        updateTotals_ib({
            totalFreight,
            totalFSCAmt,
            totalOtherAmt,
            totalSGST,
            totalCGST,
            totalIGST,
            totalGST,
            totalGrand
        });
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error fetching or locking pending invoices:', err.message);
    } finally {
        hideSpinner();
    }
}

async function FTL_FCL_getBookingCharges(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('charges_type, amount, sgst_amount, cgst_amount, igst_amount, total_gst_amount, grand_total_billing')
            .eq('lr_number', bookingID);

        if (error) throw error;

        if (data.length === 0) return null;

        const chargesMap = {};
        let BasicFrightAmt = 0, FSCAmt = 0, OtherAmt = 0;
        let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, grandTotal = 0;

        data.forEach(charge => {
            const type = (charge.charges_type || 'Other').trim();

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

            chargesMap[type].TotalAmount += parseFloat(charge.amount) || 0;
            chargesMap[type].SGSTAmt += parseFloat(charge.sgst_amount) || 0;
            chargesMap[type].CGSTAmt += parseFloat(charge.cgst_amount) || 0;
            chargesMap[type].IGSTAmt += parseFloat(charge.igst_amount) || 0;
            chargesMap[type].TotalGSTAmt += parseFloat(charge.total_gst_amount) || 0;
            chargesMap[type].GrandTotalAmt += parseFloat(charge.grand_total_billing) || 0;

            const typeLower = type.toLowerCase();

            if (typeLower === 'freight amount') {
                BasicFrightAmt += parseFloat(charge.amount) || 0;
            } else if (typeLower === 'fuel surcharge') {
                FSCAmt += parseFloat(charge.amount) || 0;
            } else {
                OtherAmt += parseFloat(charge.amount) || 0;
            }

            totalSGST += parseFloat(charge.sgst_amount) || 0;
            totalCGST += parseFloat(charge.cgst_amount) || 0;
            totalIGST += parseFloat(charge.igst_amount) || 0;
            totalGST += parseFloat(charge.total_gst_amount) || 0;
            grandTotal += parseFloat(charge.grand_total_billing) || 0;
        });

        return { BasicFrightAmt, FSCAmt, OtherAmt, totalSGST, totalCGST, totalIGST, totalGST, grandTotal, chargesMap };

    } catch (err) {
        console.error('Error fetching booking charges:', err.message);
        return null;
    }
}

async function FTL_FCL_createPendingShipmentTableHeaderAndFooter() {
    const headerCols = [
        "Docket<br>No",
        "Booked<br>Date",
        "Transit<br>Type",
        "Mode<br>Type",
        "Origin",
        "Destination",
        "No.<br>of Units",
        "Actual<br>Weight",
        "Chargeable<br>Weight",
        "Basic<br>Freight",
        "FSC<br>Amount",
        "Other<br>Amount",
        "SGST<br>Amount",
        "CGST<br>Amount",
        "IGST<br>Amount",
        "Total GST<br>Amount",
        "Grand Total<br>Amount",
        "Action"
    ];

    const footerTotals = [
        { colspan: 8, label: "Totals:", align: "text-end" },
        { id: "totalQuantity" },
        { id: "totalFreight" },
        { id: "totalFSCAmt" },
        { id: "totalOtherAmt" },
        { id: "totalSGST" },
        { id: "totalCGST" },
        { id: "totalIGST" },
        { id: "totalGST" },
        { id: "totalGrand" },
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

async function ftl_unlockBooking(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("FullLoadBookingDetails")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null }) // Also clear lock metadata
            .eq("LockedBy", userID);

        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            // console.log(`Booking(s) unlocked successfully for user ID: ${userID}`);
        }
    } catch (err) {
        console.error("Unexpected error during unlock:", err);
    }
}

function d_removeRow(button) {
    const row = button.closest('tr');
    if (!row) return;

    // Get the shipment ID
    const shipId = row.getAttribute('data-ship-id');
    console.log('Removing row for Shipment ID:', shipId);
    if (shipId) {
        // Optional: Remove from lockedBookingIds if you maintain this array
        const index = lockedBookingIds.indexOf(parseInt(shipId));
        if (index !== -1) {
            lockedBookingIds.splice(index, 1);
        }
        // Optional: Unlock the record in the database
        unlockShipmentRecord_ftl(shipId);
    }

    // Get the amounts from the row
    const qty = parseFloat(row.cells[9].textContent) || 0;
    const freightAmt = parseFloat(row.cells[10].textContent) || 0;
    const fscAmt = parseFloat(row.cells[11].textContent) || 0;
    const otherAmt = parseFloat(row.cells[12].textContent) || 0;
    const sgstAmt = parseFloat(row.cells[13].textContent) || 0;
    const cgstAmt = parseFloat(row.cells[14].textContent) || 0;
    const igstAmt = parseFloat(row.cells[15].textContent) || 0;
    const gstAmt = parseFloat(row.cells[16].textContent) || 0;
    const grandAmt = parseFloat(row.cells[17].textContent) || 0;

    // Subtract from totals
    document.getElementById('totalQuantity').textContent = (parseFloat(document.getElementById('totalQuantity').textContent) - qty).toFixed(2);
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