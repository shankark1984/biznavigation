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
    ],
    // Named cell indices — survives reordering better than magic numbers
    CELL_INDEX: {
        QTY: 10, WEIGHT: 11, FREIGHT: 12, OTHER: 13,
        SGST: 14, CGST: 15, IGST: 16, GST: 17, GRAND: 18
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================
class FTLInvoiceState {
    constructor() {
        this.lockedBookingIds = [];
        this.totals = this.getInitialTotals();
        this.mergedChargesMap = {};
        this.rowCharges = {};    // NEW: shipId → per-row charges (for precise removal)
        this.unlockTimer = null;
    }

    getInitialTotals() {
        return { qty: 0, weight: 0, freight: 0, other: 0, sgst: 0, cgst: 0, igst: 0, gst: 0, grand: 0 };
    }

    reset() {
        this.lockedBookingIds = [];
        this.totals = this.getInitialTotals();
        this.mergedChargesMap = {};
        this.rowCharges = {};
        if (this.unlockTimer) {
            clearTimeout(this.unlockTimer);
            this.unlockTimer = null;
        }
    }
}

const ftlState = new FTLInvoiceState();

// Public API — call this from newInvoice() in Invoice.js
function ftl_resetState() {
    ftlState.reset();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatAmt = (v) => (parseFloat(v) || 0).toFixed(2);

// Reusable toCents / toCurrency (local to FTL — avoids load-order dependency)
const ftlToCents = (amount) => Math.round((parseFloat(amount) || 0) * 100);
const ftlFromCents = (cents) => cents / 100;

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

async function FTL_FCL_getPendingInvoiceDetails() {
    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const movementType = document.getElementById('movementType').value;

    if (!partyCode) return alert('Select customer. (Hidden partyCode is missing)');
    if (!invoiceDate) return alert('Select invoice date');
    if (!movementType) return alert('Select movement type');
    if (!UserLoginID) return alert('User session missing — please log in again.');

    const btn = document.getElementById('fetchPendingInvoices');
    if (btn.disabled) return;
    btn.disabled = true;
    showSpinner();

    // Reset local state + clear any leftover rows from a previous fetch
    ftlState.reset();
    const tbody = getFTLTableBody();
    if (tbody) tbody.innerHTML = '';

    try {
        // ─────────────────────────────────────────────
        // STEP 1: Fetch unlocked, pending bookings with sale > 0
        // ─────────────────────────────────────────────
        const { data, error } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('id, LRNumber, PickupDate, TransitType, ModeType, RouteDetails, OriginCity, DestinationCity, VehicleType, VehicleNumber, ContainerNumber, Quantity, ChargeableWeight, GrandTotalSale')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .eq('InvoiceStatus', 'Pending')
            .gt('GrandTotalSale', 0)
            .or('IsLocked.eq.false,IsLocked.is.null')
            .order('PickupDate', { ascending: true })
            .order('LRNumber', { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            alert('No pending invoices found for this Customer & Company.');
            return;
        }

        // ─────────────────────────────────────────────
        // STEP 2: Atomically lock the fetched rows
        // ─────────────────────────────────────────────
        const bookingIds = data.map(d => d.id);

        const { data: lockedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: new Date().toISOString()
            })
            .in('id', bookingIds)
            .or('IsLocked.eq.false,IsLocked.is.null')
            .select('id');

        if (lockError) throw lockError;

        const lockedIdsSet = new Set((lockedRows || []).map(r => r.id));
        if (lockedIdsSet.size === 0) {
            alert('All matching invoices are currently locked by another user. Please try again shortly.');
            return;
        }

        ftlState.lockedBookingIds = Array.from(lockedIdsSet);
        startFTLAutoUnlockTimer();

        const lockedBookings = data.filter(d => lockedIdsSet.has(d.id));
        const lockedLrNumbers = lockedBookings.map(d => d.LRNumber);

        // ─────────────────────────────────────────────
        // STEP 3: Bulk-fetch sale charges for locked LRs
        // ─────────────────────────────────────────────
        const { data: chargesData, error: chargeError } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .in('LRNumber', lockedLrNumbers)
            .eq('AccountType', 'Sale')
            .order('id', { ascending: true });

        if (chargeError) throw chargeError;

        const chargesByLR = {};
        (chargesData || []).forEach(charge => {
            const lr = charge.LRNumber;
            if (!chargesByLR[lr]) chargesByLR[lr] = initChargesObject();
            processCharge(chargesByLR[lr], charge);
        });

        // ─────────────────────────────────────────────
        // STEP 4: Build table headers + render rows
        // ─────────────────────────────────────────────
        FTL_FCL_createPendingShipmentTableHeaderAndFooter();
        const tbodyEl = getFTLTableBody();     // re-query — createTable may have rebuilt DOM
        const fragment = document.createDocumentFragment();

        lockedBookings.forEach(inv => {
            const charges = chargesByLR[inv.LRNumber];
            if (!charges || charges.grandTotal <= 0) return;

            ftlState.rowCharges[inv.id] = charges;
            accumulateFTLTotals(inv, charges);
            fragment.appendChild(createFTLRow(inv, charges));
        });

        tbodyEl.appendChild(fragment);
        updateFTLTotalsDisplay();

        if (typeof renderChargesTable === 'function') {
            renderChargesTable(ftlState.mergedChargesMap);
        }
    } catch (err) {
        console.error('❌ Error loading invoices:', err);
        alert('Error loading invoices. Check console for details.');
        // Rollback local lock state — leave server as-is
        ftlState.reset();
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
function FTL_FCL_createPendingShipmentTableHeaderAndFooter() {
    const table = document.getElementById("pendingShipmentTable");
    if (!table) return;

    table.querySelectorAll("thead, tfoot").forEach(el => el.remove());

    // THEAD
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

    // TFOOT
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

async function ftl_removeRow(button) {
    const row = button.closest('tr');
    if (!row) return;

    const shipId = parseInt(row.getAttribute('data-ship-id'));
    const cachedCharges = ftlState.rowCharges[shipId];

    // 1. Unlock the specific shipment in Supabase
    if (shipId) {
        ftlState.lockedBookingIds = ftlState.lockedBookingIds.filter(id => id !== shipId);
        try {
            await supabaseClient
                .from('FullLoadBookingDetails')
                .update({ IsLocked: false, LockedBy: null, LockedAt: null })
                .eq('id', shipId);
        } catch (err) {
            console.error("❌ Failed to unlock row on deletion:", err.message);
        }
    }

    // 2. Subtract from state using cached per-row charges & data attributes (precise)
    if (cachedCharges) {
        const t = ftlState.totals;

        // Grab numeric values directly from data attributes or safe parsing
        const qty = parseFloatSafe(row.querySelector('td:nth-child(11)')?.textContent);
        const weight = parseFloatSafe(row.querySelector('td:nth-child(12)')?.textContent);

        t.qty -= qty;
        t.weight -= weight;
        t.freight -= cachedCharges.BasicFrightAmt;
        t.other -= cachedCharges.OtherAmt;
        t.sgst -= cachedCharges.totalSGST;
        t.cgst -= cachedCharges.totalCGST;
        t.igst -= cachedCharges.totalIGST;
        t.gst -= cachedCharges.totalGST;
        t.grand -= cachedCharges.grandTotal;

        // Subtract this row's charge breakdown from mergedChargesMap
        Object.entries(cachedCharges.chargesMap).forEach(([type, amt]) => {
            const merged = ftlState.mergedChargesMap[type];
            if (!merged) return;
            ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
                merged[field] -= amt[field];
            });
            // Clean up zero entries
            const isEmpty = ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt']
                .every(f => Math.abs(merged[f]) < 0.005);
            if (isEmpty) delete ftlState.mergedChargesMap[type];
        });

        delete ftlState.rowCharges[shipId];
    }

    // 3. Remove from DOM
    row.remove();

    // 4. Refresh displays
    updateFTLTotalsDisplay();
    if (typeof renderChargesTable === 'function') {
        renderChargesTable(ftlState.mergedChargesMap);
    }

    // 5. If no rows left, clear everything
    const remaining = getFTLTableBody()?.querySelectorAll('tr').length || 0;
    if (remaining === 0) {
        ftlState.reset();
        updateFTLTotalsDisplay();
        if (typeof clearChargesTable === 'function') clearChargesTable();
    }
}

// ============================================
// SINGLE ACTIONS
// ============================================
async function ftl_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    if (!shipmentNo || !invoiceNo) return alert('Shipment number and invoice number required');

    try {
        showSpinner();

        // 1. UI duplicate check
        const exists = Array.from(document.querySelectorAll('#pendingShipmentTable tbody tr'))
            .some(row => row.cells[0]?.textContent.trim() === shipmentNo);
        if (exists) return alert('Shipment already added');

        // 2. Fetch shipment
        const { data: shipment, error: fetchError } = await supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('company_id', CompanyID)
            .single();

        if (fetchError || !shipment) return alert('Shipment not found');
        if (shipment.InvoiceNumber && shipment.InvoiceNumber !== invoiceNo) return alert('Assigned to another invoice');

        // FIX: Treat NULL as unlocked too
        if (shipment.IsLocked === true) return alert('Locked by another user');

        // 3. Lock record — FIX: handle NULL IsLocked
        const { data: updatedRows, error: lockError } = await supabaseClient
            .from('FullLoadBookingDetails')
            .update({
                IsLocked: true, LockedBy: UserLoginID, LockedAt: new Date().toISOString(),
                invoice_number: invoiceNo, InvoiceStatus: true
            })
            .eq('id', shipment.id)
            .or('IsLocked.eq.false,IsLocked.is.null')
            .select('id');

        if (lockError || !updatedRows?.length) return alert('Record locked by another user');

        // 4. Fetch charges
        const { data: chargesData } = await supabaseClient
            .from('FullLoadBookingCharges')
            .select('*')
            .eq('LRNumber', shipmentNo)
            .eq('AccountType', 'Sale');

        const chargesObj = initChargesObject();
        (chargesData || []).forEach(c => processCharge(chargesObj, c));

        if (chargesObj.grandTotal <= 0) return alert('No billable amount found');

        // 5. Ensure thead/tfoot exist, then re-query tbody
        if (!getFTLTableBody()) {
            FTL_FCL_createPendingShipmentTableHeaderAndFooter();
        }
        const tbody = getFTLTableBody();
        if (!tbody) return alert('Table not ready');

        // 6. Update state (with dedupe)
        if (!ftlState.lockedBookingIds.includes(shipment.id)) {
            ftlState.lockedBookingIds.push(shipment.id);
        }
        ftlState.rowCharges[shipment.id] = chargesObj;
        accumulateFTLTotals(shipment, chargesObj);

        // 7. Append row + refresh
        tbody.appendChild(createFTLRow(shipment, chargesObj));
        updateFTLTotalsDisplay();
        if (typeof renderChargesTable === 'function') {
            renderChargesTable(ftlState.mergedChargesMap);
        }

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

            if (!ftlState.lockedBookingIds.includes(inv.id)) {
                ftlState.lockedBookingIds.push(inv.id);
            }
            ftlState.rowCharges[inv.id] = charges;
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
    const shipmentIds = Array.from(rows)
        .map(r => parseInt(r.getAttribute('data-ship-id')))
        .filter(id => !isNaN(id));

    showSpinner();
    try {
        // Unlink previous invoice assignments
        await supabaseClient
            .from('FullLoadBookingDetails')
            .update({ InvoiceStatus: false, invoice_number: null })
            .eq('invoice_number', invoiceNo);

        if (shipmentIds.length > 0) {
            await supabaseClient
                .from('FullLoadBookingDetails')
                .update({
                    InvoiceStatus: true,
                    invoice_number: invoiceNo,
                    IsLocked: false,
                    LockedBy: null,
                    LockedAt: null
                })
                .in('id', shipmentIds);
        }

        // FIX: clear local lock state after successful save
        ftlState.lockedBookingIds = [];
        ftlState.rowCharges = {};
        ftlState.mergedChargesMap = {};

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

        ftlState.reset();
    } catch (err) {
        console.error("❌ Unlock failed:", err.message);
    }
}