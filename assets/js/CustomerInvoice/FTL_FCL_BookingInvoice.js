// Helper
function formatAmt(v) {
    return (parseFloat(v) || 0).toFixed(2);
}

// ================================
// GET PENDING INVOICE BOOKINGS
// ================================
async function FTL_FCL_getPendingInvoiceDetails() {

    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const movementType = document.getElementById('movementType').value;

    if (!partyCode) {
        alert("Please select customer");
        return;
    }

    if (!invoiceDate) {
        alert("Select invoice date");
        return;
    }

    if (!movementType) {
        alert("Select movement type");
        return;
    }

    const fetchBtn = document.getElementById('fetchPendingInvoices');
    fetchBtn.disabled = true;

    showSpinner();

    try {

        const department = document.getElementById("department")?.value?.trim();

        let query = supabaseClient
            .from("FullLoadBookingDetails")
            .select("*")
            .eq("company_id", CompanyID)
            .eq("customer_code", partyCode)
            .eq("movement_type", movementType)
            .or('invoice_number.is.null,invoice_number.eq.""')
            .eq("IsLocked", false)
            .order("pickup_date", { ascending: true });

        if (department && department.toLowerCase() !== "all") {
            query = query.eq("Department", department);
        }

        const { data: bookings, error } = await query;

        if (error) throw error;

        if (!bookings || bookings.length === 0) {
            alert("No pending bookings");
            return;
        }

        const bookingIds = bookings.map(b => b.id);
        lockedBookingIds = bookingIds;

        // LOCK BOOKINGS
        await supabaseClient
            .from("FullLoadBookingDetails")
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .in("id", bookingIds);

        startAutoUnlockTimer();

        // ================================
        // FETCH ALL CHARGES IN ONE QUERY
        // ================================
        const { data: chargesData } = await supabaseClient
            .from("FullLoadBookingCharges")
            .select("*")
            .in("booking_id", bookingIds)
            .eq("account_type", "Sale");

        const chargesByBooking = {};

        chargesData.forEach(c => {

            if (!chargesByBooking[c.booking_id])
                chargesByBooking[c.booking_id] = [];

            chargesByBooking[c.booking_id].push(c);

        });

        const tableBody = document
            .getElementById("pendingShipmentTable")
            .querySelector("tbody");

        tableBody.innerHTML = "";

        ftl_createPendingShipmentTableHeaderAndFooter();

        const fragment = document.createDocumentFragment();

        let totals = {
            totalQuantity: 0,
            totalFreight: 0,
            totalOtherAmt: 0,
            totalSGST: 0,
            totalCGST: 0,
            totalIGST: 0,
            totalGST: 0,
            totalGrand: 0
        };

        let mergedChargesMap = {};

        for (const booking of bookings) {

            const charges = processBookingCharges(chargesByBooking[booking.id]);

            if (!charges || charges.grandTotal <= 0) continue;

            totals.totalQuantity += parseFloat(booking.quantity) || 0;
            totals.totalFreight += charges.BasicFrightAmt;
            totals.totalOtherAmt += charges.OtherAmt;
            totals.totalSGST += charges.totalSGST;
            totals.totalCGST += charges.totalCGST;
            totals.totalIGST += charges.totalIGST;
            totals.totalGST += charges.totalGST;
            totals.totalGrand += charges.grandTotal;

            // MERGE CHARGES
            Object.entries(charges.chargesMap).forEach(([type, val]) => {

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

                mergedChargesMap[type].TotalAmount += val.TotalAmount;
                mergedChargesMap[type].SGSTAmt += val.SGSTAmt;
                mergedChargesMap[type].CGSTAmt += val.CGSTAmt;
                mergedChargesMap[type].IGSTAmt += val.IGSTAmt;
                mergedChargesMap[type].TotalGSTAmt += val.TotalGSTAmt;
                mergedChargesMap[type].GrandTotalAmt += val.GrandTotalAmt;

            });

            const row = document.createElement("tr");

            row.setAttribute("data-ship-id", booking.id);

            row.innerHTML = `
            <td>${booking.lr_number || ""}</td>
            <td>${booking.pickup_date || ""}</td>
            <td>${booking.transit_type || ""}</td>
            <td>${booking.mode_type || ""}</td>
            <td>${booking.origin_city || ""}</td>
            <td>${booking.destination_city || ""}</td>
            <td>${booking.quantity || ""}</td>
            <td>${booking.actual_weight || ""}</td>
            <td>${booking.charge_weight || ""}</td>
            <td>${formatAmt(charges.BasicFrightAmt)}</td>
            <td>${formatAmt(charges.OtherAmt)}</td>
            <td>${formatAmt(charges.totalSGST)}</td>
            <td>${formatAmt(charges.totalCGST)}</td>
            <td>${formatAmt(charges.totalIGST)}</td>
            <td>${formatAmt(charges.totalGST)}</td>
            <td>${formatAmt(charges.grandTotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm delete-btn" onclick="d_removeRow(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
            `;

            fragment.appendChild(row);
        }

        tableBody.appendChild(fragment);

        ftl_updateTotals(totals);

        renderChargesTable(mergedChargesMap);

    }
    catch (err) {

        console.error("Error loading invoices:", err);
        alert("Error loading invoices");

    }
    finally {

        hideSpinner();
        fetchBtn.disabled = false;

    }
}


// ================================
// PROCESS CHARGES
// ================================
function processBookingCharges(data) {

    if (!data || data.length === 0) return null;

    let chargesMap = {};

    let BasicFrightAmt = 0;
    let OtherAmt = 0;

    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    data.forEach(charge => {

        const type = (charge.charges_type || "Other").trim();

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

        const amt = parseFloat(charge.amount) || 0;
        const sgst = parseFloat(charge.sgst_amount) || 0;
        const cgst = parseFloat(charge.cgst_amount) || 0;
        const igst = parseFloat(charge.igst_amount) || 0;
        const gst = parseFloat(charge.total_gst_amount) || 0;
        const grand = parseFloat(charge.grand_total_billing) || 0;

        chargesMap[type].TotalAmount += amt;
        chargesMap[type].SGSTAmt += sgst;
        chargesMap[type].CGSTAmt += cgst;
        chargesMap[type].IGSTAmt += igst;
        chargesMap[type].TotalGSTAmt += gst;
        chargesMap[type].GrandTotalAmt += grand;

        if (type.toLowerCase() === "freight amount")
            BasicFrightAmt += amt;
        else
            OtherAmt += amt;

        totalSGST += sgst;
        totalCGST += cgst;
        totalIGST += igst;
        totalGST += gst;
        grandTotal += grand;

    });

    return {
        BasicFrightAmt,
        OtherAmt,
        totalSGST,
        totalCGST,
        totalIGST,
        totalGST,
        grandTotal,
        chargesMap
    };
}


// ================================
// UPDATE TOTALS
// ================================
function ftl_updateTotals(totals) {

    const setVal = (id, val, dec = true) => {

        const el = document.getElementById(id);

        if (!el) return;

        el.textContent = dec ? formatAmt(val) : (parseFloat(val) || 0);
    };

    setVal("totalQuantity", totals.totalQuantity, false);

    setVal("totalFreight", totals.totalFreight);
    setVal("totalOtherAmt", totals.totalOtherAmt);
    setVal("totalSGST", totals.totalSGST);
    setVal("totalCGST", totals.totalCGST);
    setVal("totalIGST", totals.totalIGST);
    setVal("totalGST", totals.totalGST);
    setVal("totalGrand", totals.totalGrand);

    invoiceData.BasicAmount = totals.totalFreight || 0;
    invoiceData.OtherAmount = totals.totalOtherAmt || 0;
    invoiceData.CGSTAmount = totals.totalCGST || 0;
    invoiceData.SGSTAmount = totals.totalSGST || 0;
    invoiceData.IGSTAmount = totals.totalIGST || 0;
    invoiceData.TotalGSTAmount = totals.totalGST || 0;
    invoiceData.GrandTotalAmount = totals.totalGrand || 0;
}

// Function to create table header & footer dynamically
function ftl_createPendingShipmentTableHeaderAndFooter() {

    const headerCols = [
        "Docket No",
        "Booked Date",
        "Transit Type",
        "Mode Type",
        "Origin",
        "Destination",
        "Units",
        "Actual Weight",
        "Charge Weight",
        "Basic Freight",
        "Other Amount",
        "SGST",
        "CGST",
        "IGST",
        "Total GST",
        "Grand Total",
        "Action"
    ];

    const table = document.getElementById("pendingShipmentTable");

    const oldHead = table.querySelector("thead");
    const oldFoot = table.querySelector("tfoot");

    if (oldHead) oldHead.remove();
    if (oldFoot) oldFoot.remove();

    // =========================
    // CREATE HEADER
    // =========================
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    headerCols.forEach(col => {

        const th = document.createElement("th");
        th.textContent = col;

        if (
            col.includes("Freight") ||
            col.includes("Amount") ||
            col.includes("SGST") ||
            col.includes("CGST") ||
            col.includes("IGST") ||
            col.includes("GST") ||
            col.includes("Total")
        ) {
            th.classList.add("text-end");
        }

        headerRow.appendChild(th);

    });

    thead.appendChild(headerRow);
    table.prepend(thead);

    // =========================
    // CREATE FOOTER (TOTAL ROW)
    // =========================
    const tfoot = document.createElement("tfoot");
    const footerRow = document.createElement("tr");

    footerRow.innerHTML = `
        <th colspan="6" class="text-end">TOTAL</th>
        <th id="totalQuantity">0</th>
        <th></th>
        <th></th>
        <th id="totalFreight" class="text-end">0.00</th>
        <th id="totalOtherAmt" class="text-end">0.00</th>
        <th id="totalSGST" class="text-end">0.00</th>
        <th id="totalCGST" class="text-end">0.00</th>
        <th id="totalIGST" class="text-end">0.00</th>
        <th id="totalGST" class="text-end">0.00</th>
        <th id="totalGrand" class="text-end">0.00</th>
        <th></th>
    `;

    tfoot.appendChild(footerRow);
    table.appendChild(tfoot);
}
async function ftl_updateInvoiceNumbers(invNo) {

    if (!invNo) {
        alert("Invalid invoice number");
        return;
    }

    const tableBody = document.querySelector('#pendingShipmentTable tbody');
    const rows = tableBody ? tableBody.querySelectorAll('tr') : [];

    const shipmentIds = [];

    rows.forEach(row => {
        const shipId = row.getAttribute('data-ship-id');
        if (shipId) shipmentIds.push(parseInt(shipId));
    });

    if (shipmentIds.length === 0) {
        console.warn('No shipment IDs found.');
        return;
    }

    try {

        // Step 1: Clear previous assignments
        const { error: clearError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                InvoiceStatus: false,
                invoice_number: null
            })
            .eq('invoice_number', invNo);

        if (clearError) throw clearError;

        // Step 2: Assign invoice to selected shipments
        const { error: updateError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                InvoiceStatus: true,
                invoice_number: invNo
            })
            .in('id', shipmentIds);

        if (updateError) throw updateError;

    } catch (err) {

        console.error('Invoice update error:', err.message);
        alert("Error updating invoice numbers");

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
            .from('FullLoadBookingDetails')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('invoice_number', invoiceNo)
            .order('pickup_date', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No shipments found for this invoice.');
            return;
        }

        const tableBody = document.querySelector('#pendingShipmentTable tbody');
        tableBody.innerHTML = '';

        ftl_createPendingShipmentTableHeaderAndFooter();

        for (const invoice of data) {

            const charges = await ftl_getBookingCharges(invoice.id);

            if (!charges || charges.grandTotal <= 0) continue;

            const freight = parseFloat(charges.BasicFrightAmt) || 0;
            const other = parseFloat(charges.OtherAmt) || 0;
            const sgst = parseFloat(charges.totalSGST) || 0;
            const cgst = parseFloat(charges.totalCGST) || 0;
            const igst = parseFloat(charges.totalIGST) || 0;
            const gst = parseFloat(charges.totalGST) || 0;
            const grand = parseFloat(charges.grandTotal) || 0;

            totals.totalFreight += freight;
            totals.totalOtherAmt += other;
            totals.totalSGST += sgst;
            totals.totalCGST += cgst;
            totals.totalIGST += igst;
            totals.totalGST += gst;
            totals.totalGrand += grand;

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

                mergedChargesMap[normalizedType].TotalAmount += amounts.TotalAmount || 0;
                mergedChargesMap[normalizedType].SGSTAmt += amounts.SGSTAmt || 0;
                mergedChargesMap[normalizedType].CGSTAmt += amounts.CGSTAmt || 0;
                mergedChargesMap[normalizedType].IGSTAmt += amounts.IGSTAmt || 0;
                mergedChargesMap[normalizedType].TotalGSTAmt += amounts.TotalGSTAmt || 0;
                mergedChargesMap[normalizedType].GrandTotalAmt += amounts.GrandTotalAmt || 0;
            }

            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);

            row.innerHTML = `
                <td>${invoice.DocketNo || ''}</td>
                <td>${invoice.BookingDate || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.OriginCity || ''}</td>
                <td>${invoice.DestinationCity || ''}</td>
                <td>${invoice.Quantity || ''}</td>
                <td>${invoice.ActualWeight || ''} ${invoice.UOMType || ''}</td>
                <td>${invoice.ChargeableWeight || ''} ${invoice.UOMType || ''}</td>
                <td>${freight.toFixed(2)}</td>
                <td>${other.toFixed(2)}</td>
                <td>${sgst.toFixed(2)}</td>
                <td>${cgst.toFixed(2)}</td>
                <td>${igst.toFixed(2)}</td>
                <td>${gst.toFixed(2)}</td>
                <td>${grand.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" disabled>
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

async function d_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {

    if (!shipmentNo || !invoiceNo) {
        alert("Enter shipment number and invoice number");
        return;
    }

    showSpinner();

    try {

        // Fetch shipment details
        const { data, error } = await supabaseClient
            .from('DomesticBookingDetails')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('DocketNo', shipmentNo)
            .is('InvoiceNumber', null)
            .eq('IsLocked', false)
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            alert('Shipment not found or already invoiced.');
            return;
        }

        // Prevent duplicate in table
        const existingRow = document.querySelector(`#pendingShipmentTable tbody tr[data-ship-id="${data.id}"]`);
        if (existingRow) {
            alert("Shipment already added to invoice.");
            return;
        }

        const charges = await getBookingCharges(data.id);

        if (!charges || (parseFloat(charges.grandTotal) || 0) <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Lock shipment and assign invoice
        const { error: updateError } = await supabaseClient
            .from('DomesticBookingDetails')
            .update({
                InvoiceStatus: true,
                InvoiceNumber: invoiceNo,
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id);

        if (updateError) throw updateError;

        const tableBody = document.querySelector('#pendingShipmentTable tbody');

        const freight = parseFloat(charges.BasicFrightAmt) || 0;
        const fsc = parseFloat(charges.FSCAmt) || 0;
        const other = parseFloat(charges.OtherAmt) || 0;
        const sgst = parseFloat(charges.totalSGST) || 0;
        const cgst = parseFloat(charges.totalCGST) || 0;
        const igst = parseFloat(charges.totalIGST) || 0;
        const gst = parseFloat(charges.totalGST) || 0;
        const grand = parseFloat(charges.grandTotal) || 0;

        // Add row
        const row = document.createElement('tr');
        row.setAttribute('data-ship-id', data.id);

        row.innerHTML = `
            <td>${data.DocketNo || ''}</td>
            <td>${data.BookingDate || ''}</td>
            <td>${data.TransitType || ''}</td>
            <td>${data.ModeType || ''}</td>
            <td>${data.OriginCity || ''}</td>
            <td>${data.DestinationCity || ''}</td>
            <td>${data.Quantity || ''}</td>
            <td>${data.ActualWeight || ''} ${data.UOMType || ''}</td>
            <td>${data.ChargeableWeight || ''} ${data.UOMType || ''}</td>
            <td>${freight.toFixed(2)}</td>
            <td>${fsc.toFixed(2)}</td>
            <td>${other.toFixed(2)}</td>
            <td>${sgst.toFixed(2)}</td>
            <td>${cgst.toFixed(2)}</td>
            <td>${igst.toFixed(2)}</td>
            <td>${gst.toFixed(2)}</td>
            <td>${grand.toFixed(2)}</td>
            <td>
                <button class="btn btn-danger btn-sm delete-btn" onclick="d_removeRow(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(row);

        // Read footer totals safely
        const getVal = (id) => parseFloat(document.getElementById(id)?.textContent) || 0;

        const totals = {
            totalFreight: getVal('totalFreight') + freight,
            totalFSCAmt: getVal('totalFSCAmt') + fsc,
            totalOtherAmt: getVal('totalOtherAmt') + other,
            totalSGST: getVal('totalSGST') + sgst,
            totalCGST: getVal('totalCGST') + cgst,
            totalIGST: getVal('totalIGST') + igst,
            totalGST: getVal('totalGST') + gst,
            totalGrand: getVal('totalGrand') + grand
        };

        d_updateTotals_db(totals);

        // Update merged charge table
        renderChargesTable({ [data.DocketNo]: charges.chargesMap });

        alert('Shipment added successfully!');

    }
    catch (err) {

        console.error('Error adding shipment:', err.message);
        alert('Error adding shipment: ' + err.message);

    }
    finally {

        hideSpinner();
    }
}