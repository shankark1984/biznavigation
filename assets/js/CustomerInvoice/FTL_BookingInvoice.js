// FTL_FCL_Invoice.js
// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const TABLE_CONFIG_FTL = {
    HEADER_COLS: [
        "Docket<br>No", "Booked<br>Date", "Transit<br>Type", "Mode<br>Type",
        "Route Details", "Origin", "Destination", "Vehicle Type", "Vehicle No",
        "Container Number", "Quantity", "Chargeable<br>Weight", "Basic<br>Freight",
        "Other<br>Amount", "SGST<br>Amount", "CGST<br>Amount", "IGST<br>Amount",
        "Total GST<br>Amount", "Grand Total<br>Amount", "Action"
    ],
    TOTALS_COLUMNS: [
        { colspan: 10, label: "Totals:", align: "text-end" },
        { id: "totalQuantity" }, { id: "totalChargeableWeight" }, { id: "totalFreight" },
        { id: "totalOtherAmt" }, { id: "totalSGST" }, { id: "totalCGST" },
        { id: "totalIGST" }, { id: "totalGST" }, { id: "totalGrand" }, { empty: true }
    ]
};

// ============================================
// STATE MANAGEMENT
// ============================================
class FTLInvoiceState {
    constructor() {
        this.lockedBookingIds = [];
        this.totals = this.getInitialTotals();
        this.mergedChargesMap = {};
        this.unlockTimer = null;
    }

    getInitialTotals() {
        return { qty: 0, weight: 0, freight: 0, other: 0, sgst: 0, cgst: 0, igst: 0, gst: 0, grand: 0 };
    }

    reset() {
        this.lockedBookingIds = [];
        this.totals = this.getInitialTotals();
        this.mergedChargesMap = {};
        if (this.unlockTimer) {
            clearTimeout(this.unlockTimer);
            this.unlockTimer = null;
        }
    }
}

const ftlState = new FTLInvoiceState();

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatAmt = (v) => (parseFloat(v) || 0).toFixed(2);

const getFTLTableBody = () => document.querySelector('#pendingShipmentTable tbody');

function initChargesObject() {
    return {
        BasicFrightAmt: 0, FSCAmt: 0, OtherAmt: 0,
        totalSGST: 0, totalCGST: 0, totalIGST: 0,
        totalGST: 0, grandTotal: 0, chargesMap: {}
    };
}

function processCharge(obj, charge) {
    const type = (charge.ChargesType || 'Other').trim();
    const typeLower = type.toLowerCase();

    if (!obj.chargesMap[type]) {
        obj.chargesMap[type] = { TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0, IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0 };
    }

    const entry = obj.chargesMap[type];
    ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
        entry[field] += parseFloatSafe(charge[field]);
    });

    if (typeLower === 'freight amount') obj.BasicFrightAmt += parseFloatSafe(charge.TotalAmount);
    else obj.OtherAmt += parseFloatSafe(charge.TotalAmount);

    obj.totalSGST += parseFloatSafe(charge.SGSTAmt);
    obj.totalCGST += parseFloatSafe(charge.CGSTAmt);
    obj.totalIGST += parseFloatSafe(charge.IGSTAmt);
    obj.totalGST += parseFloatSafe(charge.TotalGSTAmt);
    obj.grandTotal += parseFloatSafe(charge.GrandTotalAmt);
}

function updateFTLTotalsDisplay() {
    const t = ftlState.totals;
    const map = {
        'totalQuantity': t.qty, 'totalChargeableWeight': t.weight,
        'totalFreight': t.freight, 'totalOtherAmt': t.other,
        'totalSGST': t.sgst, 'totalCGST': t.cgst,
        'totalIGST': t.igst, 'totalGST': t.gst, 'totalGrand': t.grand
    };

    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatAmt(val);
    });
}

function startFTLAutoUnlockTimer() {
    if (ftlState.unlockTimer) clearTimeout(ftlState.unlockTimer);
    ftlState.unlockTimer = setTimeout(() => {
        if (ftlState.lockedBookingIds.length) ftl_unlockBooking(UserLoginID);
    }, 30 * 60 * 1000); // 30 mins
}

// ============================================
// DOM MANIPULATION HELPERS
// ============================================
function createFTLRow(invoice, charges) {
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

// ============================================
// CORE BUSINESS LOGIC (Optimized)
// ============================================
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
    ftlState.reset();

    try {
        // STEP 1: FETCH BOOKINGS
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .eq('InvoiceStatus', "Pending")
            .eq('IsLocked', false)
            .order('PickupDate', { ascending: true })
            .order('LRNumber', { ascending: true });

        if (error) throw error;
        if (!data?.length) return alert('No pending invoices');

        const bookingIds = data.map(d => d.id);
        const lrNumbers = data.map(d => d.LRNumber);

        // STEP 2: LOCK BOOKINGS
        const { data: lockedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({ IsLocked: true, LockedBy: UserLoginID, LockedAt: new Date().toISOString() })
            .in('id', bookingIds)
            .eq('IsLocked', false)
            .select('id');

        if (lockError) throw lockError;

        ftlState.lockedBookingIds = lockedRows.map(r => r.id);
        if (ftlState.lockedBookingIds.length !== bookingIds.length) {
            console.warn("⚠ Some records already locked by another user");
        }

        startFTLAutoUnlockTimer();

        // STEP 3: BULK FETCH CHARGES
        const { data: chargesData, error: chargeError } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .in('LRNumber', lrNumbers)
            .eq('AccountType', 'Sale')
            .order('id', { ascending: true });

        if (chargeError) throw chargeError;

        const chargesByLR = {};
        (chargesData || []).forEach(charge => {
            const lr = charge.LRNumber;
            if (!chargesByLR[lr]) chargesByLR[lr] = initChargesObject();
            processCharge(chargesByLR[lr], charge);
        });

        // STEP 4: RENDER & ACCUMULATE
        FTL_FCL_createPendingShipmentTableHeaderAndFooter();
        const tbody = getFTLTableBody();
        const fragment = document.createDocumentFragment();

        data.forEach(inv => {
            if (!ftlState.lockedBookingIds.includes(inv.id)) return; // Only process successfully locked rows
            const charges = chargesByLR[inv.LRNumber];
            if (!charges || charges.grandTotal <= 0) return;

            accumulateFTLTotals(inv, charges);
            fragment.appendChild(createFTLRow(inv, charges));
        });

        tbody.appendChild(fragment);
        updateFTLTotalsDisplay();
        renderChargesTable(ftlState.mergedChargesMap);

    } catch (err) {
        console.error(err);
        alert('Error loading invoices');
    } finally {
        hideSpinner();
        btn.disabled = false;
    }
}

function accumulateFTLTotals(inv, charges) {
    const t = ftlState.totals;
    t.qty += parseFloatSafe(inv.Quantity);
    t.weight += parseFloatSafe(inv.ChargeableWeight);
    t.freight += charges.BasicFrightAmt;
    t.other += charges.OtherAmt;
    t.sgst += charges.totalSGST;
    t.cgst += charges.totalCGST;
    t.igst += charges.totalIGST;
    t.gst += charges.totalGST;
    t.grand += charges.grandTotal;

    Object.entries(charges.chargesMap).forEach(([type, amt]) => {
        if (!ftlState.mergedChargesMap[type]) {
            ftlState.mergedChargesMap[type] = { TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0, IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0 };
        }
        ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
            ftlState.mergedChargesMap[type][field] += amt[field];
        });
    });
}

// ============================================
// UI & ROW MANAGEMENT
// ============================================
async function FTL_FCL_createPendingShipmentTableHeaderAndFooter() {
    const table = document.getElementById("pendingShipmentTable");
    table.querySelectorAll("thead, tfoot").forEach(el => el.remove());

    const thead = document.createElement("thead");
    thead.className = "table-light";
    const headRow = document.createElement("tr");
    TABLE_CONFIG_FTL.HEADER_COLS.forEach(text => {
        const th = document.createElement("th");
        th.innerHTML = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.prepend(thead);

    const tfoot = document.createElement("tfoot");
    tfoot.className = "table-light";
    const footRow = document.createElement("tr");
    footRow.id = "totalsRow";

    TABLE_CONFIG_FTL.TOTALS_COLUMNS.forEach(item => {
        const th = document.createElement("th");
        if (item.colspan) th.colSpan = item.colspan;
        if (item.label) th.textContent = item.label;
        if (item.id) {
            th.id = item.id;
            th.className = "text-end";
            th.textContent = "0.00";
        }
        if (item.align) th.className = (th.className ? th.className + " " : "") + item.align;
        if (item.empty) th.textContent = "";
        footRow.appendChild(th);
    });

    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
}

function ftl_removeRow(button) {
    const row = button.closest('tr');
    if (!row) return;

    const shipId = parseInt(row.getAttribute('data-ship-id'));

    // Un-track and unlock
    if (shipId) {
        ftlState.lockedBookingIds = ftlState.lockedBookingIds.filter(id => id !== shipId);
        unlockShipmentRecord_ftl(shipId); // async fire & forget
    }

    // Subtract from state
    const t = ftlState.totals;
    t.qty -= parseFloatSafe(row.cells[10].textContent);
    t.weight -= parseFloatSafe(row.cells[11].textContent);
    t.freight -= parseFloatSafe(row.cells[12].textContent);
    t.other -= parseFloatSafe(row.cells[13].textContent);
    t.sgst -= parseFloatSafe(row.cells[14].textContent);
    t.cgst -= parseFloatSafe(row.cells[15].textContent);
    t.igst -= parseFloatSafe(row.cells[16].textContent);
    t.gst -= parseFloatSafe(row.cells[17].textContent);
    t.grand -= parseFloatSafe(row.cells[18].textContent);

    updateFTLTotalsDisplay();
    row.remove();
}

// ============================================
// SINGLE ACTIONS
// ============================================
async function ftl_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    if (!shipmentNo || !invoiceNo) return alert('Shipment number and invoice number required');

    try {
        showSpinner();

        // Check UI duplicates
        const exists = Array.from(document.querySelectorAll('#pendingShipmentTable tbody tr'))
            .some(row => row.cells[0]?.textContent.trim() === shipmentNo);
        if (exists) return alert('Shipment already added');

        // Fetch Shipment
        const { data: shipment, error: fetchError } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('company_id', CompanyID)
            .single();

        if (fetchError || !shipment) return alert('Shipment not found');
        if (shipment.InvoiceNumber && shipment.InvoiceNumber !== invoiceNo) return alert('Assigned to another invoice');
        if (shipment.IsLocked) return alert('Locked by another user');

        // Lock Record
        const { data: updatedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true, LockedBy: UserLoginID, LockedAt: new Date().toISOString(),
                invoice_number: invoiceNo, InvoiceStatus: true
            })
            .eq('id', shipment.id)
            .eq('IsLocked', false)
            .select('id');

        if (lockError || !updatedRows?.length) return alert('Record locked by another user');

        // Fetch Charges
        const { data: chargesData } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('AccountType', 'Sale');

        const chargesObj = initChargesObject();
        (chargesData || []).forEach(c => processCharge(chargesObj, c));

        if (chargesObj.grandTotal <= 0) return alert('No billable amount found');

        // Append to UI & State
        const tbody = getFTLTableBody();
        if (!tbody) FTL_FCL_createPendingShipmentTableHeaderAndFooter();

        ftlState.lockedBookingIds.push(shipment.id);
        accumulateFTLTotals(shipment, chargesObj);

        document.querySelector('#pendingShipmentTable tbody').appendChild(createFTLRow(shipment, chargesObj));
        updateFTLTotalsDisplay();

        // Re-render charge breakdown safely
        if (typeof renderChargesTable === "function") renderChargesTable(ftlState.mergedChargesMap);

    } catch (err) {
        console.error('❌ Error:', err.message);
        alert('Error adding shipment');
    } finally {
        hideSpinner();
    }
}

async function ftl_loadInvoiceBookings(invoiceNo) {
    if (!invoiceNo) return alert('Please enter a valid invoice number.');

    showSpinner();
    ftlState.reset();

    try {
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('PickupDate', { ascending: true });

        if (error) throw error;
        if (!data?.length) return alert('No shipments found for this invoice.');

        const lrNumbers = data.map(d => d.LRNumber);

        const { data: chargesData } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .in('LRNumber', lrNumbers)
            .eq('AccountType', 'Sale');

        const chargesByLR = {};
        (chargesData || []).forEach(charge => {
            const lr = charge.LRNumber;
            if (!chargesByLR[lr]) chargesByLR[lr] = initChargesObject();
            processCharge(chargesByLR[lr], charge);
        });

        FTL_FCL_createPendingShipmentTableHeaderAndFooter();
        const tbody = getFTLTableBody();
        const fragment = document.createDocumentFragment();

        data.forEach(inv => {
            const charges = chargesByLR[inv.LRNumber];
            if (!charges || charges.grandTotal <= 0) return;

            ftlState.lockedBookingIds.push(inv.id);
            accumulateFTLTotals(inv, charges);
            fragment.appendChild(createFTLRow(inv, charges));
        });

        tbody.appendChild(fragment);
        updateFTLTotalsDisplay();
        renderChargesTable(ftlState.mergedChargesMap);

    } catch (err) {
        console.error(err);
        alert('Error loading bookings.');
    } finally {
        hideSpinner();
    }
}

async function ftl_updateInvoiceNumbers(invoiceNo) {
    if (!invoiceNo) return alert('Invalid invoice number.');

    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr');
    const shipmentIds = Array.from(rows).map(r => parseInt(r.getAttribute('data-ship-id'))).filter(id => !isNaN(id));

    showSpinner();
    try {
        await supabaseClient
            .from('FullLoadBookingDetails')
            .update({ InvoiceStatus: false, invoice_number: null })
            .eq('invoice_number', invoiceNo);

        if (shipmentIds.length > 0) {
            await supabaseClient
                .from('FullLoadBookingDetails')
                .update({ InvoiceStatus: true, invoice_number: invoiceNo, IsLocked: false, LockedBy: null, LockedAt: null })
                .in('id', shipmentIds);
        }
    } catch (err) {
        console.error('❌ Error updating invoice:', err.message);
        alert('Error updating invoice numbers.');
    } finally {
        hideSpinner();
    }
}

async function ftl_unlockBooking(userID) {
    if (!userID) return;
    try {
        await supabaseClient
            .from("FullLoadBookingDetails")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null })
            .eq("LockedBy", userID);

        ftlState.lockedBookingIds = [];
    } catch (err) {
        console.error("❌ Unlock failed:", err.message);
    }
}