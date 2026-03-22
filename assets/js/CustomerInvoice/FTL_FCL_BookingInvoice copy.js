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

    const fetchBtn = document.getElementById('fetchPendingInvoices');
    if (fetchBtn.disabled) return;

    fetchBtn.disabled = true;
    showSpinner();

    let totalQuantity = 0;
    let totalChargeableWeight = 0;

    let totalFreight = 0, totalFSCAmt = 0, totalOtherAmt = 0;
    let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, totalGrand = 0;
    let mergedChargesMap = {};
    let validDataFound = false;

    try {
        // 🔹 STEP 1: Fetch pending records
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
            alert('No pending invoices found or all are locked.');
            return;
        }

        const bookingIds = data.map(item => item.id);
        lockedBookingIds = bookingIds;
        startAutoUnlockTimer();



        // 🔹 STEP 2: BULK LOCK (ONLY ONCE)
        const { error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: ISODateTimeNow
            })
            .in('id', bookingIds)
            .or('IsLocked.eq.false,IsLocked.is.null');

        if (lockError) throw lockError;

        // 🔹 STEP 3: Re-fetch ONLY locked by current user
        const { data: lockedData, error: lockedError } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .in('id', bookingIds)
            .eq('LockedBy', UserLoginID);

        if (lockedError) throw lockedError;

        if (!lockedData || lockedData.length === 0) {
            alert("Records locked by another user. Try again.");
            return;
        }

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        FTL_FCL_createPendingShipmentTableHeaderAndFooter();

        // 🔹 STEP 4: LOOP THROUGH LOCKED DATA ONLY
        for (const invoice of lockedData) {

            const charges = await FTL_FCL_getBookingCharges(invoice.LRNumber);
            if (!charges || charges.grandTotal <= 0) continue;

            validDataFound = true;

            totalQuantity += parseFloat(invoice.Quantity) || 0;
            totalChargeableWeight += parseFloat(invoice.ChargeableWeight) || 0;

            totalFreight += charges.BasicFrightAmt;
            totalFSCAmt += charges.FSCAmt;
            totalOtherAmt += charges.OtherAmt;
            totalSGST += charges.totalSGST;
            totalCGST += charges.totalCGST;
            totalIGST += charges.totalIGST;
            totalGST += charges.totalGST;
            totalGrand += charges.grandTotal;



            // Merge charges
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

            // Render row
            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);

            row.innerHTML = `
                <td>${invoice.LRNumber || ''}</td>
                <td>${invoice.PickupDate || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.RouteDetails || ''}</td>
                <td>${invoice.OriginCity || ''}</td>
                <td>${invoice.DestinationCity || ''}</td>
                <td>${invoice.VehicleType || ''}</td>
                <td>${invoice.VehicleNumber || ''}</td>
                <td>${invoice.ContainerNumber || ''}</td>
                <td cass="text-end">${invoice.Quantity || ''}</td>
                <td cass="text-end">${invoice.ChargeableWeight || ''}</td>
                <td cass="text-end">${charges.BasicFrightAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.OtherAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.totalSGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalCGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalIGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalGST.toFixed(2)}</td>
                <td cass="text-end">${charges.grandTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" onclick="ftl_removeRow(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        }

        if (!validDataFound) {
            alert('All selected invoices have zero charges or invalid data.');
        }

        updateTotals_ib({
            totalQuantity,
            totalChargeableWeight,
            totalFreight,
            totalOtherAmt,
            totalSGST,
            totalCGST,
            totalIGST,
            totalGST,
            totalGrand
        });

        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        hideSpinner();
        fetchBtn.disabled = false;
    }
}

async function FTL_FCL_getBookingCharges(bookingID) {
    try {
        console.log('Fetching charges for booking ID:', bookingID);
        const { data, error } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .eq('lr_number', bookingID)
            .eq('account_type', 'Sale');

        if (error) throw error;
        if (!data || data.length === 0) return null;

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

            chargesMap[type].TotalAmount += +charge.amount || 0;
            chargesMap[type].SGSTAmt += +charge.sgst_amount || 0;
            chargesMap[type].CGSTAmt += +charge.cgst_amount || 0;
            chargesMap[type].IGSTAmt += +charge.igst_amount || 0;
            chargesMap[type].TotalGSTAmt += +charge.total_gst_amount || 0;
            chargesMap[type].GrandTotalAmt += +charge.grand_total_billing || 0;

            const typeLower = type.toLowerCase();

            if (typeLower === 'freight amount') BasicFrightAmt += +charge.amount || 0;
            else if (typeLower === 'fuel surcharge') FSCAmt += +charge.amount || 0;
            else OtherAmt += +charge.amount || 0;

            totalSGST += +charge.sgst_amount || 0;
            totalCGST += +charge.cgst_amount || 0;
            totalIGST += +charge.igst_amount || 0;
            totalGST += +charge.total_gst_amount || 0;
            grandTotal += +charge.grand_total_billing || 0;
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
        "Route Details",
        "Origin",
        "Destination",
        "Vehicle Type",
        "Vehicle No",
        "Container Number",
        "Quantity",
        "Chargeable<br>Weight",
        "Basic<br>Freight",
        "Other<br>Amount",
        "SGST<br>Amount",
        "CGST<br>Amount",
        "IGST<br>Amount",
        "Total GST<br>Amount",
        "Grand Total<br>Amount",
        "Action"
    ];

    const footerTotals = [
        { colspan: 10, label: "Totals:", align: "text-end" },
        { id: "totalQuantity" },
        { id: "totalChargeableWeight" },
        { id: "totalFreight" },
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

function ftl_removeRow(button) {
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
    const qty = parseFloat(row.cells[10].textContent) || 0;
    const chargeableWeight = parseFloat(row.cells[11].textContent) || 0;
    const freightAmt = parseFloat(row.cells[12].textContent) || 0;
    const otherAmt = parseFloat(row.cells[13].textContent) || 0;
    const sgstAmt = parseFloat(row.cells[14].textContent) || 0;
    const cgstAmt = parseFloat(row.cells[15].textContent) || 0;
    const igstAmt = parseFloat(row.cells[16].textContent) || 0;
    const gstAmt = parseFloat(row.cells[17].textContent) || 0;
    const grandAmt = parseFloat(row.cells[18].textContent) || 0;

    // Subtract from totals
    document.getElementById('totalQuantity').textContent = (parseFloat(document.getElementById('totalQuantity').textContent) - qty).toFixed(2);
    document.getElementById('totalChargeableWeight').textContent = (parseFloat(document.getElementById('totalChargeableWeight').textContent) - chargeableWeight).toFixed(2);
    document.getElementById('totalFreight').textContent = (parseFloat(document.getElementById('totalFreight').textContent) - freightAmt).toFixed(2);
    document.getElementById('totalOtherAmt').textContent = (parseFloat(document.getElementById('totalOtherAmt').textContent) - otherAmt).toFixed(2);
    document.getElementById('totalSGST').textContent = (parseFloat(document.getElementById('totalSGST').textContent) - sgstAmt).toFixed(2);
    document.getElementById('totalCGST').textContent = (parseFloat(document.getElementById('totalCGST').textContent) - cgstAmt).toFixed(2);
    document.getElementById('totalIGST').textContent = (parseFloat(document.getElementById('totalIGST').textContent) - igstAmt).toFixed(2);
    document.getElementById('totalGST').textContent = (parseFloat(document.getElementById('totalGST').textContent) - gstAmt).toFixed(2);
    document.getElementById('totalGrand').textContent = (parseFloat(document.getElementById('totalGrand').textContent) - grandAmt).toFixed(2);

    // Remove row from table
    row.remove();
}

async function unlockShipmentRecord_ftl(id) {
    try {
        await supabaseClient
            .from("FullLoadBookingDetails")
            .update({
                IsLocked: false,
                LockedBy: null,
                LockedAt: null
            })
            .eq("id", id);
    } catch (err) {
        console.error("Unlock failed:", err.message);
    }
}

async function ftl_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    showSpinner();

    try {
        // Fetch shipment details
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('LRNumber', shipmentNo)
            .is('InvoiceNumber', null)
            .eq('IsLocked', false)
            .single();

        if (error || !data) {
            alert('Shipment not found or already locked.');
            return;
        }

        const charges = await FTL_FCL_getBookingCharges(shipmentNo);
        if (!charges || charges.grandTotal <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Lock the shipment and assign invoice number
        const { error: updateError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                InvoiceStatus: true,
                invoice_number: invoiceNo,
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: ISODateTimeNow
            })
            .eq('id', data.id);

        if (updateError) throw updateError;

        // Add to table
        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        const row = document.createElement('tr');
        row.setAttribute('data-ship-id', data.id);
        row.innerHTML = `
                <td>${data.LRNumber || ''}</td>
                <td>${data.PickupDate || ''}</td>
                <td>${data.TransitType || ''}</td>
                <td>${data.ModeType || ''}</td>
                <td>${data.RouteDetails || ''}</td>
                <td>${data.OriginCity || ''}</td>
                <td>${data.DestinationCity || ''}</td>
                <td>${data.VehicleType || ''}</td>
                <td>${data.VehicleNumber || ''}</td>
                <td>${data.ContainerNumber || ''}</td>
                <td cass="text-end">${data.Quantity || ''}</td>
                <td cass="text-end">${data.ChargeableWeight || ''}</td>
                <td cass="text-end">${charges.BasicFrightAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.OtherAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.totalSGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalCGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalIGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalGST.toFixed(2)}</td>
                <td cass="text-end">${charges.grandTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" onclick="ftl_removeRow(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
        tableBody.appendChild(row);

        // ✅ Update totals from footer before adding new values
        updateTotals_ib({
            totalQuantity,
            totalChargeableWeight,
            totalFreight,
            totalOtherAmt,
            totalSGST,
            totalCGST,
            totalIGST,
            totalGST,
            totalGrand
        });

        renderChargesTable(mergedChargesMap);


        alert('Shipment added successfully!');

    } catch (err) {
        console.error('Error adding shipment:', err.message);
        alert('Error adding shipment: ' + err.message);
    } finally {
        hideSpinner();
    }
}

async function ftl_loadInvoiceBookings(invoiceNo) {
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
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('PickupDate', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No shipments found for this invoice.');
            reportButton.disabled = true;
            hideSpinner();
            return;
        }

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        FTL_FCL_createPendingShipmentTableHeaderAndFooter();// Create header and footer if not already done

        for (const invoice of data) {
            const charges = await FTL_FCL_getBookingCharges(invoice.LRNumber);;
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
                <td>${invoice.LRNumber || ''}</td>
                <td>${invoice.PickupDate || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.RouteDetails || ''}</td>
                <td>${invoice.OriginCity || ''}</td>
                <td>${invoice.DestinationCity || ''}</td>
                <td>${invoice.VehicleType || ''}</td>
                <td>${invoice.VehicleNumber || ''}</td>
                <td>${invoice.ContainerNumber || ''}</td>
                <td cass="text-end">${invoice.Quantity || ''}</td>
                <td cass="text-end">${invoice.ChargeableWeight || ''}</td>
                <td cass="text-end">${charges.BasicFrightAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.OtherAmt.toFixed(2)}</td>
                <td cass="text-end">${charges.totalSGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalCGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalIGST.toFixed(2)}</td>
                <td cass="text-end">${charges.totalGST.toFixed(2)}</td>
                <td cass="text-end">${charges.grandTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" onclick="ftl_removeRow(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        }

        d_updateTotals_db(totals);
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error loading linked bookings:', err.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

async function ftl_updateInvoiceNumbers(invNo) {
    const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');

    const shipmentIds = [];

    // Step 1: Clear existing assignments
    const { error: clearError } = await supabaseClient
        .from('fullLoadBookingDetails')
        .update({
            InvoiceStatus: false,
            InvoiceNumber: null
        })
        .eq('InvoiceNumber', invNo); // Corrected: Use eq for a single invoice number

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

    console.log('Clearing previous invoice assignments for:', invNo);
    if (clearError) {
        console.error('Error clearing previous invoice assignments:', clearError.message);
        throw clearError;
    }
    console.log('Previous invoice assignments cleared for:', invNo);

    // Step 2: Update new assignments
    const { error: updateError } = await supabaseClient
        .from('fullLoadBookingDetails')
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