// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const CC_TABLE_CONFIG = {
    HEADER_COLS: [
        "Sr No.", "Job No", "Job<br>Date", "BL / AWB<br>No", "BL / AWB<br>Date",
        "BE No", "BE Date", "Movement<br>Type", "Transit<br>Type", "Mode<br>Type",
        "Customs<br>Broker", "Clearance<br>Port", "Clearance<br>Country",
        "Quantity", "Cargo<br>Weight", "Total<br>Amount", "SGST<br>Amount",
        "CGST<br>Amount", "IGST<br>Amount", "Total GST<br>Amount",
        "Grand Total<br>Amount", "Action", "id"
    ],
    TOTALS_COLUMNS: [
        { colspan: 15, label: "Totals:", align: "text-end" },
        { id: "totalFreight_sc" }, { id: "totalSGST_sc" },
        { id: "totalCGST_sc" }, { id: "totalIGST_sc" },
        { id: "totalGST_sc" }, { id: "totalGrand_sc" },
        { empty: true }
    ]
};

// ============================================
// STATE MANAGEMENT FOR CUSTOMS CLEARANCE
// ============================================
class CustomsClearanceState {
    constructor() {
        this.lockedBookingIds = [];
        this.mergedChargesMap = {};
        this.unlockTimer = null;
        this.totals = {
            totalFreight: 0, totalSGST: 0, totalCGST: 0,
            totalIGST: 0, totalGST: 0, totalGrand: 0
        };
    }

    reset() {
        this.lockedBookingIds = [];
        this.mergedChargesMap = {};
        this.totals = {
            totalFreight: 0, totalSGST: 0, totalCGST: 0,
            totalIGST: 0, totalGST: 0, totalGrand: 0
        };
        if (this.unlockTimer) {
            clearTimeout(this.unlockTimer);
            this.unlockTimer = null;
        }
    }

    updateTotals(charges) {
        this.totals.totalFreight += charges.BasicFrightAmt || 0;
        this.totals.totalSGST += charges.totalSGST || 0;
        this.totals.totalCGST += charges.totalCGST || 0;
        this.totals.totalIGST += charges.totalIGST || 0;
        this.totals.totalGST += charges.totalGST || 0;
        this.totals.totalGrand += charges.grandTotal || 0;
    }

    mergeCharges(chargesMap) {
        Object.entries(chargesMap).forEach(([type, amounts]) => {
            const normalizedType = toProperCase(type.trim().toLowerCase());
            if (!this.mergedChargesMap[normalizedType]) {
                this.mergedChargesMap[normalizedType] = {
                    TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                    IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
                };
            }

            const entry = this.mergedChargesMap[normalizedType];
            Object.keys(entry).forEach(key => {
                entry[key] += parseFloat(amounts[key]) || 0;
            });
        });
    }
}

const ccState = new CustomsClearanceState();

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getCCElementValue = (id) => document.getElementById(id)?.value?.trim() || '';
const getCCTableBody = () => document.getElementById('pendingShipmentTable')?.querySelector('tbody');

// ============================================
// VALIDATION
// ============================================
const validateCCInputs = () => {
    const partyCode = getCCElementValue('partyCode');
    const invoiceDate = getCCElementValue('invoiceDate');
    const movementType = getCCElementValue('movementType');

    if (!partyCode) { alert('Please select a customer first.'); return null; }
    if (!invoiceDate) { alert('Please select an invoice date first.'); document.getElementById('invoiceDate')?.focus(); return null; }
    if (!movementType) { alert('Please select a movement type first.'); document.getElementById('movementType')?.focus(); return null; }

    return { partyCode, invoiceDate, movementType };
};

// ============================================
// MAIN FUNCTION - GET PENDING INVOICES
// ============================================
async function CustomsClearanceInvoiceDetails() {
    const validation = validateCCInputs();
    if (!validation) return;

    const { partyCode } = validation;
    const fetchButton = document.getElementById('fetchPendingInvoices');
    fetchButton.disabled = true;
    showSpinner();

    try {
        const data = await fetchPendingCCInvoices(partyCode);
        if (!data?.length) {
            alert('No pending invoices found or all are currently locked.');
            return;
        }

        await processCCInvoices(data);
    } catch (error) {
        console.error('Error fetching or locking pending invoices:', error.message);
        alert('Error loading invoices. Please try again.');
    } finally {
        fetchButton.disabled = false;
        hideSpinner();
    }
}

async function fetchPendingCCInvoices(partyCode) {
    const { data, error } = await supabaseClient
        .from('CustomsClearanceView')
        .select('*')
        .eq('company_id', CompanyID)
        .eq('PartyCode', partyCode)
        .or('InvoiceNo.is.null,InvoiceNo.eq.""')
        .eq('IsLocked', false)
        .order('JobDate', { ascending: true });

    if (error) throw error;
    return data;
}

async function processCCInvoices(invoices) {
    ccState.reset();
    const validInvoices = [];

    // Process all invoices in parallel
    await Promise.all(invoices.map(async (invoice) => {
        const charges = await getBookingCharges_cc(invoice.id);
        if (!charges || charges.grandTotal <= 0) return;

        await lockCCInvoice(invoice.id);
        validInvoices.push({ invoice, charges });
    }));

    if (!validInvoices.length) {
        alert('No pending invoices with grand total greater than 0 found.');
        return;
    }

    ccState.lockedBookingIds = validInvoices.map(({ invoice }) => invoice.id);
    startCCAutoUnlockTimer();

    // Render table
    await renderCCInvoiceTable(validInvoices);
    updateCCTotalsDisplay();
    renderChargesTable(ccState.mergedChargesMap);
}

async function lockCCInvoice(invoiceId) {
    const { error } = await supabaseClient
        .from('CustomsClearance_Details')
        .update({
            IsLocked: true,
            LockedBy: UserLoginID,
            LockedAt: localtimeStamp
        })
        .eq('id', invoiceId);

    if (error) throw error;
}

function startCCAutoUnlockTimer() {
    if (ccState.unlockTimer) {
        clearTimeout(ccState.unlockTimer);
    }

    ccState.unlockTimer = setTimeout(() => {
        if (ccState.lockedBookingIds.length) {
            unlockBooking_cc(UserLoginID);
        }
    }, 30 * 60 * 1000); // 30 minutes
}

// ============================================
// RENDER TABLE
// ============================================
async function renderCCInvoiceTable(validInvoices) {
    const tableBody = getCCTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    createPendingShipmentTableHeaderAndFooter();

    validInvoices.forEach(({ invoice, charges }, index) => {
        addCCRow(tableBody, invoice, charges, index + 1);
        ccState.updateTotals(charges);
        ccState.mergeCharges(charges.chargesMap);
    });
}

function addCCRow(tableBody, invoice, charges, rowNumber) {
    const row = document.createElement('tr');
    row.dataset.shipId = invoice.id;

    const rowData = [
        rowNumber,
        invoice.JobID || '',
        formatDate(invoice.JobDate),
        invoice.BLAWBNo || '',
        formatDate(invoice.BLAWBDate),
        invoice.BENo || '',
        formatDate(invoice.BEDate),
        invoice.MovementType || '',
        invoice.TransitType || '',
        invoice.ModeType || '',
        invoice.CustomsBroker || '',
        invoice.ClearancePort || '',
        invoice.ClearanceCountry || '',
        invoice.Quantity || '1',
        invoice.CargoWeight || '',
        parseFloatSafe(invoice.TotalAmount).toFixed(2),
        parseFloatSafe(invoice.SGSTAmt).toFixed(2),
        parseFloatSafe(invoice.CGSTAmt).toFixed(2),
        parseFloatSafe(invoice.IGSTAmt).toFixed(2),
        parseFloatSafe(invoice.TotalGSTAmt).toFixed(2),
        parseFloatSafe(invoice.GrandTotalAmt).toFixed(2),
    ];

    rowData.forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        row.appendChild(td);
    });

    // Action cell with disabled delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm delete-btn';
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.disabled = true;
    deleteBtn.onclick = () => removeRow_cc(deleteBtn);
    actionTd.appendChild(deleteBtn);
    row.appendChild(actionTd);

    // Hidden ID column
    const hiddenTd = document.createElement('td');
    hiddenTd.style.display = 'none';
    hiddenTd.textContent = invoice.id;
    row.appendChild(hiddenTd);

    tableBody.appendChild(row);
}

// ============================================
// GET BOOKING CHARGES (Optimized)
// ============================================
async function getBookingCharges_cc(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearanceCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_CC', bookingID)
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data?.length) return null;

        const chargesMap = {};
        let totals = {
            BasicFrightAmt: 0,
            totalSGST: 0,
            totalCGST: 0,
            totalIGST: 0,
            totalGST: 0,
            grandTotal: 0
        };

        data.forEach(charge => {
            const type = (charge.ChargesType || 'Other').trim();

            if (!chargesMap[type]) {
                chargesMap[type] = { TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0, IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0 };
            }

            const amounts = chargesMap[type];
            ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
                amounts[field] += parseFloatSafe(charge[field]);
            });

            totals.BasicFrightAmt += parseFloatSafe(charge.TotalAmount);
            totals.totalSGST += parseFloatSafe(charge.SGSTAmt);
            totals.totalCGST += parseFloatSafe(charge.CGSTAmt);
            totals.totalIGST += parseFloatSafe(charge.IGSTAmt);
            totals.totalGST += parseFloatSafe(charge.TotalGSTAmt);
            totals.grandTotal += parseFloatSafe(charge.GrandTotalAmt);
        });

        return { ...totals, chargesMap };
    } catch (error) {
        console.error('Error fetching booking charges:', error.message);
        return null;
    }
}

// ============================================
// UPDATE TOTALS (Optimized)
// ============================================
function updateCCTotalsDisplay() {
    const totalElements = {
        totalFreight_sc: ccState.totals.totalFreight,
        totalSGST_sc: ccState.totals.totalSGST,
        totalCGST_sc: ccState.totals.totalCGST,
        totalIGST_sc: ccState.totals.totalIGST,
        totalGST_sc: ccState.totals.totalGST,
        totalGrand_sc: ccState.totals.totalGrand
    };

    Object.entries(totalElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    });
}

// ============================================
// UPDATE TOTALS FROM TABLE (Legacy compatibility)
// ============================================
function updateTotals_cc() {
    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr');

    const totals = {
        totalFreight: 0, totalSGST: 0, totalCGST: 0,
        totalIGST: 0, totalGST: 0, totalGrand: 0
    };

    rows.forEach(row => {
        totals.totalFreight += parseFloatSafe(row.cells[15]?.textContent);
        totals.totalSGST += parseFloatSafe(row.cells[16]?.textContent);
        totals.totalCGST += parseFloatSafe(row.cells[17]?.textContent);
        totals.totalIGST += parseFloatSafe(row.cells[18]?.textContent);
        totals.totalGST += parseFloatSafe(row.cells[19]?.textContent);
        totals.totalGrand += parseFloatSafe(row.cells[20]?.textContent);
    });

    Object.entries(totals).forEach(([key, value]) => {
        const el = document.getElementById(`${key}_sc`);
        if (el) el.textContent = value.toFixed(2);
    });

    // Also update state
    ccState.totals = totals;
}

// ============================================
// UNLOCK BOOKING
// ============================================
async function unlockBooking_cc(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("CustomsClearance_Details")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null })
            .eq("LockedBy", userID);

        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            ccState.lockedBookingIds = [];
            if (ccState.unlockTimer) {
                clearTimeout(ccState.unlockTimer);
                ccState.unlockTimer = null;
            }
        }
    } catch (error) {
        console.error("Unexpected error during unlock:", error);
    }
}

// ============================================
// UNLOCK SINGLE SHIPMENT RECORD
// ============================================
async function unlockShipmentRecord_cc(shipId) {
    if (!shipId) return;

    try {
        const { error } = await supabaseClient
            .from('CustomsClearance_Details')
            .update({ IsLocked: false, LockedBy: null, LockedAt: null })
            .eq('id', shipId);

        if (error) {
            console.error('Error unlocking shipment:', error.message);
        }
    } catch (error) {
        console.error('Error unlocking shipment:', error);
    }
}

// ============================================
// TABLE HEADER/FOOTER
// ============================================
async function createPendingShipmentTableHeaderAndFooter() {
    const table = document.getElementById("pendingShipmentTable");
    if (!table) return;

    // Remove existing head/foot
    table.querySelectorAll('thead, tfoot').forEach(el => el.remove());

    // Create THEAD
    const thead = document.createElement("thead");
    thead.className = "table-light";
    const headRow = document.createElement("tr");
    CC_TABLE_CONFIG.HEADER_COLS.forEach(text => {
        const th = document.createElement("th");
        th.innerHTML = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.prepend(thead);

    // Create TFOOT
    const tfoot = document.createElement("tfoot");
    tfoot.className = "table-light";
    const footRow = document.createElement("tr");
    footRow.id = "totalsRow";

    CC_TABLE_CONFIG.TOTALS_COLUMNS.forEach(item => {
        const th = document.createElement("th");
        if (item.colspan) th.colSpan = item.colspan;
        if (item.label) th.textContent = item.label;
        if (item.id) {
            th.id = item.id;
            th.className = "text-end";
            th.textContent = "0.00";
        }
        if (item.align) th.className = (th.className || '') + ' ' + item.align;
        if (item.empty) th.textContent = "";
        footRow.appendChild(th);
    });

    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
}

// ============================================
// UPDATE INVOICE NUMBERS
// ============================================
async function updateInvoiceNumbers_cc(invNo) {
    if (!invNo) {
        console.warn('No invoice number provided');
        return;
    }

    const rows = document.querySelectorAll('#pendingShipmentTable tbody tr[data-ship-id]');
    const shipmentIds = Array.from(rows)
        .map(row => parseInt(row.dataset.shipId))
        .filter(id => !isNaN(id));

    if (!shipmentIds.length) {
        console.warn('No shipment IDs found for invoice update.');
        return;
    }

    try {
        // Clear previous assignments
        await supabaseClient
            .from('CustomsClearance_Details')
            .update({ InvoiceNo: null })
            .eq('InvoiceNo', invNo);

        // Update new assignments
        const { error } = await supabaseClient
            .from('CustomsClearance_Details')
            .update({ InvoiceNo: invNo })
            .in('id', shipmentIds);

        if (error) throw error;
        console.log(`Invoice numbers updated for ${shipmentIds.length} shipments`);
    } catch (error) {
        console.error('Error updating invoice numbers:', error.message);
        throw error;
    }
}

// ============================================
// LOAD INVOICE LINE ITEMS
// ============================================
async function loadInvoiceLineItems_cc(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();
    ccState.reset();

    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearanceView')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNo', invoiceNo)
            .order('JobDate', { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            alert('No shipments found for this invoice.');
            return;
        }

        await renderCCLoadedInvoice(data);
    } catch (error) {
        console.error('Error loading linked bookings:', error.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

async function renderCCLoadedInvoice(invoices) {
    const tableBody = getCCTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    await createPendingShipmentTableHeaderAndFooter();

    // Process all invoices in parallel
    const processed = await Promise.all(invoices.map(async (invoice) => {
        const charges = await getBookingCharges_cc(invoice.id);
        if (!charges || charges.grandTotal <= 0) return null;
        return { invoice, charges };
    }));

    const validItems = processed.filter(item => item !== null);

    validItems.forEach(({ invoice, charges }, index) => {
        addCCRow(tableBody, invoice, charges, index + 1);
        ccState.updateTotals(charges);
        ccState.mergeCharges(charges.chargesMap);
    });

    updateCCTotalsDisplay();
    renderChargesTable(ccState.mergedChargesMap);
}

// ============================================
// ADD SINGLE SHIPMENT
// ============================================
async function addSingleShipmentToInvoice_cc(shipmentNo, invoiceNo) {
    if (!shipmentNo || !invoiceNo) {
        alert('Shipment number and invoice number are required.');
        return;
    }

    showSpinner();

    try {
        const partyCode = getCCElementValue('partyCode');
        if (!partyCode) {
            alert('Please select a customer first.');
            return;
        }

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

        if (data.InvoiceNo) {
            alert(`Shipment ${shipmentNo} is already linked to Invoice No: ${data.InvoiceNo}.`);
            return;
        }

        if (data.IsLocked) {
            alert(`Shipment ${shipmentNo} is currently locked by another process/user.`);
            return;
        }

        const charges = await getBookingCharges_cc(data.id);
        if (!charges || charges.grandTotal <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Lock the shipment
        await supabaseClient
            .from('CustomsClearance_Details')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id)
            .eq('company_id', CompanyID)
            .eq('PartyCode', partyCode);

        // Add to table
        const tableBody = getCCTableBody();
        if (!tableBody) {
            alert('Table not found.');
            return;
        }

        const rowNumber = tableBody.children.length + 1;
        addCCRow(tableBody, data, charges, rowNumber);
        ccState.updateTotals(charges);
        ccState.mergeCharges(charges.chargesMap);
        updateCCTotalsDisplay();
        renderChargesTable(ccState.mergedChargesMap);

        alert('Shipment added successfully!');
    } catch (error) {
        console.error('Error adding shipment:', error.message);
        alert('Error adding shipment: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// ============================================
// REMOVE ROW
// ============================================
async function removeRow_cc(button) {
    const row = button?.closest('tr');
    if (!row) return;

    const shipId = row.dataset.shipId;
    if (shipId) {
        await unlockShipmentRecord_cc(shipId);

        // Remove from locked IDs list
        const index = ccState.lockedBookingIds.indexOf(parseInt(shipId));
        if (index !== -1) ccState.lockedBookingIds.splice(index, 1);
    }

    // Remove row
    row.remove();

    // Recalculate totals
    updateTotals_cc();
    renderChargesTable(ccState.mergedChargesMap);
}

// ============================================
// RECALCULATE TOTALS (Legacy compatibility)
// ============================================
async function recalcTotals_cc() {
    updateTotals_cc();
}

// ============================================
// MERGE CHARGES UTILITY (Legacy compatibility)
// ============================================
function mergeChargesIntoMap(newCharges) {
    if (!newCharges?.chargesMap) {
        console.warn('No charges to merge');
        return;
    }

    ccState.mergeCharges(newCharges.chargesMap);
    renderChargesTable(ccState.mergedChargesMap);
}