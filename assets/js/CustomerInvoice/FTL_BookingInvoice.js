// ================================
// HELPERS
// ================================
function formatAmt(v) {
    return (parseFloat(v) || 0).toFixed(2);
}

function initChargesObject() {
    return {
        BasicFrightAmt: 0,
        FSCAmt: 0,
        OtherAmt: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        grandTotal: 0,
        chargesMap: {}
    };
}

function processCharge(obj, charge) {
    const type = (charge.ChargesType || 'Other').trim();
    const typeLower = type.toLowerCase();

    if (!obj.chargesMap[type]) {
        obj.chargesMap[type] = {
            TotalAmount: 0,
            SGSTAmt: 0,
            CGSTAmt: 0,
            IGSTAmt: 0,
            TotalGSTAmt: 0,
            GrandTotalAmt: 0
        };
    }

    const entry = obj.chargesMap[type];

    entry.TotalAmount += +charge.TotalAmount || 0;
    entry.SGSTAmt += +charge.SGSTAmt || 0;
    entry.CGSTAmt += +charge.CGSTAmt || 0;
    entry.IGSTAmt += +charge.IGSTAmt || 0;
    entry.TotalGSTAmt += +charge.TotalGSTAmt || 0;
    entry.GrandTotalAmt += +charge.GrandTotalAmt || 0;

    if (typeLower === 'freight amount') obj.BasicFrightAmt += +charge.TotalAmount || 0;
    else obj.OtherAmt += +charge.TotalAmount || 0;

    obj.totalSGST += +charge.SGSTAmt || 0;
    obj.totalCGST += +charge.CGSTAmt || 0;
    obj.totalIGST += +charge.IGSTAmt || 0;
    obj.totalGST += +charge.TotalGSTAmt || 0;
    obj.grandTotal += +charge.GrandTotalAmt || 0;
}

function createRow(invoice, charges) {
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
        <td class="text-end">${invoice.Quantity || ''}</td>
        <td class="text-end">${invoice.ChargeableWeight || ''}</td>
        <td class="text-end">${formatAmt(charges.BasicFrightAmt)}</td>
        <td class="text-end">${formatAmt(charges.OtherAmt)}</td>
        <td class="text-end">${formatAmt(charges.totalSGST)}</td>
        <td class="text-end">${formatAmt(charges.totalCGST)}</td>
        <td class="text-end">${formatAmt(charges.totalIGST)}</td>
        <td class="text-end">${formatAmt(charges.totalGST)}</td>
        <td class="text-end">${formatAmt(charges.grandTotal)}</td>
        <td>
            <button class="btn btn-danger btn-sm delete-btn" onclick="ftl_removeRow(this)">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    return row;
}

// ================================
// MAIN FUNCTION (OPTIMIZED)
// ================================
async function FTL_FCL_getPendingInvoiceDetails() {

    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const movementType = document.getElementById('movementType').value;

    if (!partyCode) return alert('Select customer');
    if (!invoiceDate) return alert('Select invoice date');
    if (!movementType) return alert('Select movement type');

    const btn = document.getElementById('fetchPendingInvoices');
    if (btn.disabled) return;

    btn.disabled = true;
    showSpinner();

    try {
        // ========================
        // STEP 1: FETCH BOOKINGS
        // ========================
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .eq('InvoiceStatus', "Pending")
            .eq('IsLocked', false)
            .order('PickupDate', { ascending: true });

        if (error) throw error;
        if (!data?.length) {
            alert('No pending invoices');
            return;
        }

        const bookingIds = data.map(d => d.id);
        const lrNumbers = data.map(d => d.LRNumber);

        lockedBookingIds = bookingIds;

        // ========================
        // STEP 2: LOCK BOOKINGS
        // ========================
        const { data: lockedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: new Date().toISOString()
            })
            .in('id', bookingIds)
            .eq('IsLocked', false)
            .select('id');

        if (lockError) throw lockError;

        // Validate locking
        const lockedIds = lockedRows.map(r => r.id);

        if (lockedIds.length !== bookingIds.length) {
            console.warn("⚠ Some records already locked by another user");
        }
        // ========================
        // STEP 3: BULK FETCH CHARGES
        // ========================
        const { data: chargesData, error: chargeError } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .in('LRNumber', lrNumbers)
            .eq('AccountType', 'Sale')
            .order('id', { ascending: true });


        if (chargeError) throw chargeError;

        const chargesByLR = {};

        for (const charge of chargesData || []) {
            const lr = charge.LRNumber;

            if (!chargesByLR[lr]) {
                chargesByLR[lr] = initChargesObject();
            }

            processCharge(chargesByLR[lr], charge);
        }

        // ========================
        // STEP 4: RENDER TABLE
        // ========================
        const tbody = document.querySelector('#pendingShipmentTable tbody');
        tbody.innerHTML = '';

        FTL_FCL_createPendingShipmentTableHeaderAndFooter();

        const fragment = document.createDocumentFragment();

        const totals = {
            qty: 0,
            weight: 0,
            freight: 0,
            other: 0,
            sgst: 0,
            cgst: 0,
            igst: 0,
            gst: 0,
            grand: 0
        };

        let mergedChargesMap = {};

        data.forEach(inv => {
            const charges = chargesByLR[inv.LRNumber];
            if (!charges || charges.grandTotal <= 0) return;

            totals.qty += +inv.Quantity || 0;
            totals.weight += +inv.ChargeableWeight || 0;
            totals.freight += charges.BasicFrightAmt;
            totals.other += charges.OtherAmt;
            totals.sgst += charges.totalSGST;
            totals.cgst += charges.totalCGST;
            totals.igst += charges.totalIGST;
            totals.gst += charges.totalGST;
            totals.grand += charges.grandTotal;

            // Merge charges
            Object.entries(charges.chargesMap).forEach(([type, amt]) => {
                if (!mergedChargesMap[type]) {
                    mergedChargesMap[type] = {
                        TotalAmount: 0,
                        SGSTAmt: 0,
                        CGSTAmt: 0,
                        IGSTAmt: 0,
                        TotalGSTAmt: 0,
                        GrandTotalAmt: 0
                    };
                }

                mergedChargesMap[type].TotalAmount += amt.TotalAmount;
                mergedChargesMap[type].SGSTAmt += amt.SGSTAmt;
                mergedChargesMap[type].CGSTAmt += amt.CGSTAmt;
                mergedChargesMap[type].IGSTAmt += amt.IGSTAmt;
                mergedChargesMap[type].TotalGSTAmt += amt.TotalGSTAmt;
                mergedChargesMap[type].GrandTotalAmt += amt.GrandTotalAmt;
            });

            fragment.appendChild(createRow(inv, charges));
        });

        tbody.appendChild(fragment);

        // ========================
        // STEP 5: UPDATE TOTALS
        // ========================
        document.getElementById('totalQuantity').textContent = formatAmt(totals.qty);
        document.getElementById('totalChargeableWeight').textContent = formatAmt(totals.weight);
        document.getElementById('totalFreight').textContent = formatAmt(totals.freight);
        document.getElementById('totalOtherAmt').textContent = formatAmt(totals.other);
        document.getElementById('totalSGST').textContent = formatAmt(totals.sgst);
        document.getElementById('totalCGST').textContent = formatAmt(totals.cgst);
        document.getElementById('totalIGST').textContent = formatAmt(totals.igst);
        document.getElementById('totalGST').textContent = formatAmt(totals.gst);
        document.getElementById('totalGrand').textContent = formatAmt(totals.grand);

        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error(err);
        alert('Error loading invoices');
    } finally {
        hideSpinner();
        btn.disabled = false;
    }
}

async function FTL_FCL_createPendingShipmentTableHeaderAndFooter() {

    const table = document.getElementById("pendingShipmentTable");

    // 🔹 Remove existing THEAD & TFOOT (safe reset)
    table.querySelector("thead")?.remove();
    table.querySelector("tfoot")?.remove();

    // ============================
    // 🔹 CREATE HEADER
    // ============================
    const headers = [
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

    const thead = document.createElement("thead");
    thead.classList.add("table-light");

    const headRow = document.createElement("tr");

    headers.forEach(text => {
        const th = document.createElement("th");
        th.innerHTML = text;
        headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.prepend(thead);

    // ============================
    // 🔹 CREATE FOOTER (TOTALS)
    // ============================
    const tfoot = document.createElement("tfoot");
    tfoot.classList.add("table-light");

    const footRow = document.createElement("tr");
    footRow.id = "totalsRow";

    // Helper to create cell
    const createCell = ({ colspan, text, id, align }) => {
        const th = document.createElement("th");

        if (colspan) th.colSpan = colspan;
        if (text) th.textContent = text;
        if (id) {
            th.id = id;
            th.textContent = "0.00";
            th.classList.add("text-end");
        }
        if (align) th.classList.add(align);

        return th;
    };

    // Build footer structure
    const footerConfig = [
        { colspan: 10, text: "Totals:", align: "text-end" },
        { id: "totalQuantity" },
        { id: "totalChargeableWeight" },
        { id: "totalFreight" },
        { id: "totalOtherAmt" },
        { id: "totalSGST" },
        { id: "totalCGST" },
        { id: "totalIGST" },
        { id: "totalGST" },
        { id: "totalGrand" },
        { text: "" } // empty cell for Action column
    ];

    footerConfig.forEach(cfg => {
        footRow.appendChild(createCell(cfg));
    });

    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
}

async function ftl_loadInvoiceBookings(invoiceNo) {

    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();

    try {
        // ========================
        // STEP 1: FETCH BOOKINGS
        // ========================
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('PickupDate', { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            showToast('No shipments found for this invoice.', 'warning');
            hideSpinner();
            return;
        }

        const lrNumbers = data.map(d => d.LRNumber);
        // console.log("LR Number " + lrNumbers);

        // ========================
        // STEP 2: BULK FETCH CHARGES
        // ========================
        const { data: chargesData, error: chargeError } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .in('LRNumber', lrNumbers)
            .eq('AccountType', 'Sale');

        if (chargeError) throw chargeError;

        // ========================
        // STEP 3: GROUP CHARGES
        // ========================
        const chargesByLR = {};

        for (const charge of chargesData || []) {
            const lr = charge.LRNumber;

            if (!chargesByLR[lr]) {
                chargesByLR[lr] = initChargesObject();
            }

            processCharge(chargesByLR[lr], charge);
        }

        // ========================
        // STEP 4: PREPARE TABLE
        // ========================
        const tbody = document.querySelector('#pendingShipmentTable tbody');
        tbody.innerHTML = '';

        FTL_FCL_createPendingShipmentTableHeaderAndFooter();

        const fragment = document.createDocumentFragment();

        const totals = {
            qty: 0,
            weight: 0,
            freight: 0,
            other: 0,
            sgst: 0,
            cgst: 0,
            igst: 0,
            gst: 0,
            grand: 0
        };

        let mergedChargesMap = {};

        // ========================
        // STEP 5: LOOP DATA
        // ========================
        data.forEach(inv => {

            const charges = chargesByLR[inv.LRNumber];
            if (!charges || charges.grandTotal <= 0) return;

            // Totals
            totals.qty += +inv.Quantity || 0;
            totals.weight += +inv.ChargeableWeight || 0;
            totals.freight += charges.BasicFrightAmt;
            totals.other += charges.OtherAmt;
            totals.sgst += charges.totalSGST;
            totals.cgst += charges.totalCGST;
            totals.igst += charges.totalIGST;
            totals.gst += charges.totalGST;
            totals.grand += charges.grandTotal;

            // Merge charge types
            Object.entries(charges.chargesMap).forEach(([type, amt]) => {

                if (!mergedChargesMap[type]) {
                    mergedChargesMap[type] = {
                        TotalAmount: 0,
                        SGSTAmt: 0,
                        CGSTAmt: 0,
                        IGSTAmt: 0,
                        TotalGSTAmt: 0,
                        GrandTotalAmt: 0
                    };
                }

                mergedChargesMap[type].TotalAmount += amt.TotalAmount;
                mergedChargesMap[type].SGSTAmt += amt.SGSTAmt;
                mergedChargesMap[type].CGSTAmt += amt.CGSTAmt;
                mergedChargesMap[type].IGSTAmt += amt.IGSTAmt;
                mergedChargesMap[type].TotalGSTAmt += amt.TotalGSTAmt;
                mergedChargesMap[type].GrandTotalAmt += amt.GrandTotalAmt;
            });

            // Render row
            fragment.appendChild(createRow(inv, charges));
        });

        tbody.appendChild(fragment);

        // ========================
        // STEP 6: UPDATE TOTALS
        // ========================
        document.getElementById('totalQuantity').textContent = formatAmt(totals.qty);
        document.getElementById('totalChargeableWeight').textContent = formatAmt(totals.weight);
        document.getElementById('totalFreight').textContent = formatAmt(totals.freight);
        document.getElementById('totalOtherAmt').textContent = formatAmt(totals.other);
        document.getElementById('totalSGST').textContent = formatAmt(totals.sgst);
        document.getElementById('totalCGST').textContent = formatAmt(totals.cgst);
        document.getElementById('totalIGST').textContent = formatAmt(totals.igst);
        document.getElementById('totalGST').textContent = formatAmt(totals.gst);
        document.getElementById('totalGrand').textContent = formatAmt(totals.grand);

        // ========================
        // STEP 7: RENDER CHARGES TABLE
        // ========================
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error loading invoice bookings:', err.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

function ftl_removeRow(button) {

    const row = button.closest('tr');
    if (!row) return;

    const shipId = parseInt(row.getAttribute('data-ship-id'));

    // ============================
    // 🔹 REMOVE FROM LOCK ARRAY
    // ============================
    if (shipId && Array.isArray(lockedBookingIds)) {
        lockedBookingIds = lockedBookingIds.filter(id => id !== shipId);
    }

    // ============================
    // 🔹 UPDATE TOTALS (SAFE WAY)
    // ============================
    const getVal = (index) => parseFloat(row.cells[index]?.textContent) || 0;

    const values = {
        qty: getVal(10),
        weight: getVal(11),
        freight: getVal(12),
        other: getVal(13),
        sgst: getVal(14),
        cgst: getVal(15),
        igst: getVal(16),
        gst: getVal(17),
        grand: getVal(18)
    };

    const updateCell = (id, subtractVal) => {
        const el = document.getElementById(id);
        if (!el) return;

        const current = parseFloat(el.textContent) || 0;
        el.textContent = formatAmt(current - subtractVal);
    };

    updateCell('totalQuantity', values.qty);
    updateCell('totalChargeableWeight', values.weight);
    updateCell('totalFreight', values.freight);
    updateCell('totalOtherAmt', values.other);
    updateCell('totalSGST', values.sgst);
    updateCell('totalCGST', values.cgst);
    updateCell('totalIGST', values.igst);
    updateCell('totalGST', values.gst);
    updateCell('totalGrand', values.grand);

    // ============================
    // 🔹 UNLOCK RECORD (ASYNC - NON BLOCKING)
    // ============================
    if (shipId) {
        unlockShipmentRecord_ftl(shipId); // fire & forget
    }

    // ============================
    // 🔹 REMOVE ROW FROM UI
    // ============================
    row.remove();
}

async function ftl_updateInvoiceNumbers(invoiceNo) {

    if (!invoiceNo) {
        alert('Invalid invoice number.');
        return;
    }

    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr');

    const shipmentIds = Array.from(rows)
        .map(row => parseInt(row.getAttribute('data-ship-id')))
        .filter(id => !isNaN(id));

    showSpinner();

    try {
        // ============================
        // 🔹 STEP 1: CLEAR OLD ASSIGNMENTS (ALWAYS)
        // ============================
        const { error: clearError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                InvoiceStatus: false,
                invoice_number: null
            })
            .eq('invoice_number', invoiceNo);

        if (clearError) throw clearError;

        // ============================
        // 🔹 STEP 2: RE-ASSIGN ONLY IF EXISTS
        // ============================
        if (shipmentIds.length > 0) {

            const { error: updateError } = await supabaseClient
                .from('FullLoadBookingDetails')
                .update({
                    InvoiceStatus: true,
                    invoice_number: invoiceNo,
                    IsLocked: false,
                    LockedBy: null,
                    LockedAt: null
                })
                .in('id', shipmentIds);

            if (updateError) throw updateError;

            console.log('✅ Invoice updated:', shipmentIds);

        } else {
            console.log('⚠ All shipments removed → invoice cleared');
        }

    } catch (err) {
        console.error('❌ Error updating invoice:', err.message);
        alert('Error updating invoice numbers.');
    } finally {
        hideSpinner();
    }
}

async function ftl_unlockBooking(userID) {

    if (!userID) {
        console.warn("❌ No user ID provided. Cannot unlock bookings.");
        return;
    }

    try {
        showSpinner();

        // ============================
        // 🔹 UNLOCK ALL RECORDS FOR USER
        // ============================
        const { data, error } = await supabaseClient
            .from("FullLoadBookingDetails")
            .update({
                IsLocked: false,
                LockedBy: null,
                LockedAt: null
            })
            .eq("LockedBy", userID)
            .select('id'); // optional: get unlocked IDs

        if (error) throw error;

        // ============================
        // 🔹 CLEAN LOCAL STATE
        // ============================
        if (Array.isArray(lockedBookingIds)) {
            lockedBookingIds = [];
        }

        console.log(`✅ Unlocked ${data?.length || 0} bookings for user: ${userID}`);

    } catch (err) {
        console.error("❌ Unlock failed:", err.message);
        alert("Error unlocking bookings. Please try again.");
    } finally {
        hideSpinner();
    }
}

async function ftl_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {

    if (!shipmentNo) {
        alert('Please enter shipment number');
        return;
    }

    if (!invoiceNo) {
        alert('Invalid invoice number');
        return;
    }

    try {
        showSpinner();

        // ============================
        // 🔹 STEP 1: PREVENT UI DUPLICATE
        // ============================
        const exists = Array.from(document.querySelectorAll('#pendingShipmentTable tbody tr'))
            .some(row => row.cells[0]?.textContent.trim() === shipmentNo);

        if (exists) {
            alert('Shipment already added');
            return;
        }

        // ============================
        // 🔹 STEP 2: FETCH SHIPMENT
        // ============================
        const { data: shipment, error: fetchError } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('company_id', CompanyID)
            .single();

        if (fetchError) throw fetchError;

        if (!shipment) {
            alert('Shipment not found');
            return;
        }

        // ============================
        // 🔹 STEP 3: VALIDATION
        // ============================
        if (shipment.InvoiceNumber && shipment.InvoiceNumber !== invoiceNo) {
            alert('Already assigned to another invoice');
            return;
        }

        if (shipment.IsLocked) {
            alert('Shipment is locked by another user');
            return;
        }

        // ============================
        // 🔹 STEP 4: LOCK + ASSIGN
        // ============================
        const { data: updatedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: new Date().toISOString(),
            })
            .eq('id', shipment.id)
            .eq('IsLocked', false)
            .select('id');

        if (lockError) throw lockError;

        if (!updatedRows || updatedRows.length === 0) {
            alert('Shipment already locked by another user');
            return;
        }

        // ============================
        // 🔹 STEP 5: FETCH CHARGES
        // ============================
        const { data: chargesData, error: chargeError } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('AccountType', 'Sale');

        if (chargeError) throw chargeError;

        // ============================
        // 🔹 STEP 6: PROCESS CHARGES
        // ============================
        const chargesObj = initChargesObject();

        for (const charge of chargesData || []) {
            processCharge(chargesObj, charge);
        }

        if (chargesObj.grandTotal <= 0) {
            alert('No billable amount found');
            return;
        }

        // ============================
        // 🔹 STEP 7: ADD ROW TO TABLE
        // ============================
        const tbody = document.querySelector('#pendingShipmentTable tbody');

        const row = createRow(shipment, chargesObj);
        tbody.appendChild(row);

        // ============================
        // 🔹 STEP 8: UPDATE TOTALS
        // ============================
        const updateCell = (id, val) => {
            const el = document.getElementById(id);
            const current = parseFloat(el.textContent) || 0;
            el.textContent = formatAmt(current + val);
        };

        updateCell('totalQuantity', +shipment.Quantity || 0);
        updateCell('totalChargeableWeight', +shipment.ChargeableWeight || 0);
        updateCell('totalFreight', chargesObj.BasicFrightAmt);
        updateCell('totalOtherAmt', chargesObj.OtherAmt);
        updateCell('totalSGST', chargesObj.totalSGST);
        updateCell('totalCGST', chargesObj.totalCGST);
        updateCell('totalIGST', chargesObj.totalIGST);
        updateCell('totalGST', chargesObj.totalGST);
        updateCell('totalGrand', chargesObj.grandTotal);

        // ============================
        // 🔹 STEP 9: UPDATE CHARGES TABLE
        // ============================
        if (typeof renderChargesTable === "function") {
            // Optional: rebuild full summary (safe way)
            await ftl_loadInvoiceBookings(invoiceNo);
        }

        console.log(`✅ Shipment ${shipmentNo} added`);

    } catch (err) {
        console.error('❌ Error:', err.message);
        alert('Error adding shipment');

    } finally {
        hideSpinner();
    }
}
