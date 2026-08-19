// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const TABLE_CONFIG_IB = {
    HEADER_COLS: [
        "Docket<br>No", "Booked<br>Date", "Movement<br>Type", "Transit<br>Type",
        "Mode<br>Type", "Origin", "Destination", "No.<br>of Units",
        "Actual<br>Weight", "Chargeable<br>Weight", "Basic<br>Freight",
        "FSC<br>Amount", "Other<br>Amount", "SGST<br>Amount", "CGST<br>Amount",
        "IGST<br>Amount", "Total GST<br>Amount", "Grand Total<br>Amount", "Action"
    ],
    TOTALS_COLUMNS: [
        { colspan: 10, label: "Totals:", align: "text-end" },
        { id: "totalFreight" }, { id: "totalFSCAmt" }, { id: "totalOtherAmt" },
        { id: "totalSGST" }, { id: "totalCGST" }, { id: "totalIGST" },
        { id: "totalGST" }, { id: "totalGrand" }, { empty: true }
    ]
};

// ============================================
// STATE MANAGEMENT
// ============================================
class InvoiceState {
    constructor() {
        this.lockedBookingIds = [];
        this.totals = {
            totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0,
            totalGST: 0, totalGrand: 0
        };
        this.mergedChargesMap = {};
        this.unlockTimer = null;
    }

    reset() {
        this.lockedBookingIds = [];
        this.totals = { ...this.totals, totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0, totalSGST: 0, totalCGST: 0, totalIGST: 0, totalGST: 0, totalGrand: 0 };
        this.mergedChargesMap = {};
        if (this.unlockTimer) {
            clearTimeout(this.unlockTimer);
            this.unlockTimer = null;
        }
    }
}

const invoiceState = new InvoiceState();

// ============================================
// UTILITY FUNCTIONS
// ============================================


const updateElementText = (id, value, decimals = 2) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(value).toFixed(decimals);
};

// ============================================
// DOM MANIPULATION HELPERS
// ============================================

const getTableBody = () => document.getElementById('pendingShipmentTable')?.querySelector('tbody');

// ============================================
// VALIDATION FUNCTIONS
// ============================================
const validateInvoiceInputs = () => {
    const partyCode = getElementValue('partyCode');
    const invoiceDate = getElementValue('invoiceDate');
    const movementType = getElementValue('movementType');

    if (!partyCode) { alert('Please select a customer first.'); return null; }
    if (!invoiceDate) { alert('Please select an invoice date first.'); document.getElementById('invoiceDate')?.focus(); return null; }
    if (!movementType) { alert('Please select a movement type first.'); document.getElementById('movementType')?.focus(); return null; }

    return { partyCode, invoiceDate, movementType };
};

// ============================================
// CORE BUSINESS LOGIC
// ============================================
async function getPendingInvoiceDetails() {
    const validation = validateInvoiceInputs();
    if (!validation) return;

    const { partyCode, movementType } = validation;
    const department = getElementValue('department');

    const fetchButton = document.getElementById('fetchPendingInvoices');
    fetchButton.disabled = true;
    showSpinner();

    try {
        const data = await fetchPendingInvoices(partyCode, movementType, department);
        if (!data?.length) {
            alert('No pending invoices found or all are currently locked.');
            return;
        }

        await processInvoices(data);
    } catch (error) {
        console.error('Error fetching or locking pending invoices:', error.message);
        alert('Error loading invoices. Please try again.');
    } finally {
        fetchButton.disabled = false;
        hideSpinner();
    }
}

async function fetchPendingInvoices(partyCode, movementType, department) {
    let query = supabaseClient
        .from('international_booking')
        .select('*')
        .eq('company_id', CompanyID)
        .eq('CustomerCode', partyCode)
        .or('InvoiceNumber.is.null,InvoiceNumber.eq.""')
        .eq('IsLocked', false)
        .order('BookedDate', { ascending: true });

    // Apply movement type filter
    if (movementType === 'Forwarding') {
        query = query.in('MovementType', ['Import', 'Export']);
    } else {
        query = query.eq('MovementType', movementType);
    }

    // Apply department filter
    if (department && department.toLowerCase() !== 'all') {
        query = query.eq('Department', department);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
}

async function processInvoices(invoices) {
    const validInvoices = [];

    // Lock invoices and collect valid ones
    await Promise.all(invoices.map(async (invoice) => {
        const charges = await getBookingCharges(invoice.id);
        if (!charges || charges.grandTotal <= 0) return;

        await lockInvoice(invoice.id);
        validInvoices.push({ invoice, charges });
    }));

    if (!validInvoices.length) {
        alert('No pending invoices with grand total greater than 0 found.');
        return;
    }

    // Update state
    invoiceState.lockedBookingIds = validInvoices.map(({ invoice }) => invoice.id);
    invoiceState.reset();
    startAutoUnlockTimer();

    // Render table
    await renderInvoiceTable(validInvoices);
    updateTotalsDisplay(invoiceState.totals);
}

async function lockInvoice(invoiceId) {
    const { error } = await supabaseClient
        .from('international_booking')
        .update({
            IsLocked: true,
            LockedBy: UserLoginID,
            LockedAt: localtimeStamp
        })
        .eq('id', invoiceId);

    if (error) throw error;
}

function startAutoUnlockTimer() {
    if (invoiceState.unlockTimer) {
        clearTimeout(invoiceState.unlockTimer);
    }

    invoiceState.unlockTimer = setTimeout(() => {
        if (invoiceState.lockedBookingIds.length) {
            unlockBooking_ib(UserLoginID);
        }
    }, 30 * 60 * 1000); // 30 minutes
}

async function renderInvoiceTable(validInvoices) {
    const tableBody = getTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    createPendingShipmentTableHeaderAndFooter_ib();

    // Reset state
    invoiceState.totals = { totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0, totalSGST: 0, totalCGST: 0, totalIGST: 0, totalGST: 0, totalGrand: 0 };
    invoiceState.mergedChargesMap = {};

    validInvoices.forEach(({ invoice, charges }) => {
        addInvoiceRow(tableBody, invoice, charges);
        accumulateTotals(charges);
        mergeCharges(charges.chargesMap);
    });

    renderChargesTable(invoiceState.mergedChargesMap);
}

function addInvoiceRow(tableBody, invoice, charges) {
    const row = document.createElement('tr');
    row.dataset.shipId = invoice.id;

    const cells = [
        invoice.DocketNo || '',
        invoice.BookedDate || '',
        invoice.MovementType || '',
        invoice.TransitType || '',
        invoice.ModeType || '',
        invoice.Origin || '',
        invoice.Destination || '',
        `${invoice.NoofUnit || ''} ${invoice.UOMType || ''}`,
        invoice.AcutalWeight || '',
        invoice.ChargableWeight || '',
        formatAmount(charges.BasicFrightAmt),
        formatAmount(charges.FSCAmt),
        formatAmount(charges.OtherAmt),
        formatAmount(charges.totalSGST),
        formatAmount(charges.totalCGST),
        formatAmount(charges.totalIGST),
        formatAmount(charges.totalGST),
        formatAmount(charges.grandTotal)
    ];

    cells.forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        row.appendChild(td);
    });

    // Action cell with delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm delete-btn';
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.onclick = () => removeRow(deleteBtn);
    actionTd.appendChild(deleteBtn);
    row.appendChild(actionTd);

    tableBody.appendChild(row);
}

function accumulateTotals(charges) {
    const t = invoiceState.totals;
    t.totalFreight += charges.BasicFrightAmt;
    t.totalFSCAmt += charges.FSCAmt;
    t.totalOtherAmt += charges.OtherAmt;
    t.totalSGST += charges.totalSGST;
    t.totalCGST += charges.totalCGST;
    t.totalIGST += charges.totalIGST;
    t.totalGST += charges.totalGST;
    t.totalGrand += charges.grandTotal;
}

function mergeCharges(chargesMap) {
    Object.entries(chargesMap).forEach(([type, amounts]) => {
        const normalizedType = toProperCase(type.trim().toLowerCase());
        if (!invoiceState.mergedChargesMap[normalizedType]) {
            invoiceState.mergedChargesMap[normalizedType] = {
                TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
            };
        }

        const entry = invoiceState.mergedChargesMap[normalizedType];
        Object.keys(amounts).forEach(key => {
            entry[key] = (entry[key] || 0) + (amounts[key] || 0);
        });
    });
}

// ============================================
// GET BOOKING CHARGES (Optimized)
// ============================================
async function getBookingCharges(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_IB', bookingID)
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data?.length) return null;

        const chargesMap = {};
        let total = {
            BasicFrightAmt: 0, FSCAmt: 0, OtherAmt: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0,
            totalGST: 0, grandTotal: 0
        };

        data.forEach(charge => {
            const type = (charge.ChargesType || 'Other').trim();
            const typeLower = type.toLowerCase();

            // Initialize charge type in map
            if (!chargesMap[type]) {
                chargesMap[type] = { TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0, IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0 };
            }

            // Accumulate charge amounts
            const mapEntry = chargesMap[type];
            ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
                mapEntry[field] += parseFloatSafe(charge[field]);
            });

            // Categorize charges
            const amount = parseFloatSafe(charge.TotalAmount);
            if (typeLower === CHARGE_TYPES.FREIGHT) {
                total.BasicFrightAmt += amount;
            } else if (typeLower === CHARGE_TYPES.FSC) {
                total.FSCAmt += amount;
            } else {
                total.OtherAmt += amount;
            }

            // Accumulate tax totals
            total.totalSGST += parseFloatSafe(charge.SGSTAmt);
            total.totalCGST += parseFloatSafe(charge.CGSTAmt);
            total.totalIGST += parseFloatSafe(charge.IGSTAmt);
            total.totalGST += parseFloatSafe(charge.TotalGSTAmt);
            total.grandTotal += parseFloatSafe(charge.GrandTotalAmt);
        });

        return { ...total, chargesMap };
    } catch (error) {
        console.error('Error fetching booking charges:', error.message);
        return null;
    }
}

// ============================================
// UPDATE TOTALS (Optimized)
// ============================================
function updateTotalsDisplay(totals) {
    const totalKeys = ['totalFreight', 'totalFSCAmt', 'totalOtherAmt', 'totalSGST', 'totalCGST', 'totalIGST', 'totalGST'];
    totalKeys.forEach(key => {
        updateElementText(key, totals[key] || 0);
    });
    updateElementText('totalGrand', Math.round(totals.totalGrand || 0));
    updateElementText('totalQuantity', totals.totalQuantity || 0);
    updateElementText('totalChargeableWeight', totals.totalChargeableWeight || 0);

    // Update invoice data
    invoiceData.BasicAmount = formatAmount(totals.totalFreight);
    invoiceData.OtherAmount = formatAmount((totals.totalFSCAmt || 0) + (totals.totalOtherAmt || 0));
    invoiceData.CGSTAmount = formatAmount(totals.totalCGST);
    invoiceData.SGSTAmount = formatAmount(totals.totalSGST);
    invoiceData.IGSTAmount = formatAmount(totals.totalIGST);
    invoiceData.TotalGSTAmount = formatAmount(totals.totalGST);
    invoiceData.GrandTotalAmount = formatAmount(Math.round(totals.totalGrand || 0));
}

// ============================================
// UPDATE INVOICE NUMBERS (Optimized)
// ============================================
async function updateInvoiceNumbers(invNo) {
    if (!invNo) {
        console.warn('No invoice number provided');
        return;
    }

    const tableBody = getTableBody();
    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr[data-ship-id]');
    const shipmentIds = Array.from(rows)
        .map(row => parseInt(row.dataset.shipId))
        .filter(id => !isNaN(id));

    // if (!shipmentIds.length) {
    //     console.warn('No shipment IDs found for invoice update.');
    //     return;
    // }

    try {
        // Clear previous assignments
        await supabaseClient
            .from('international_booking')
            .update({ InvoiceStatus: false, InvoiceNumber: null })
            .eq('InvoiceNumber', invNo);

        // Update new assignments
        const { error } = await supabaseClient
            .from('international_booking')
            .update({
                InvoiceStatus: true,
                InvoiceNumber: invNo,
                IsLocked: false,
                LockedBy: null,
                LockedAt: null
            })
            .in('id', shipmentIds);

        if (error) throw error;
        console.log(`Invoice numbers updated for ${shipmentIds.length} shipments`);
    } catch (error) {
        console.error('Error updating invoice numbers:', error.message);
        throw error;
    }
}

// ============================================
// LOAD INVOICE BOOKINGS (Optimized)
// ============================================
async function loadInvoiceBookings(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();
    invoiceState.reset();

    try {
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('BookedDate', { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            alert('No shipments found for this invoice.');
            document.getElementById('fetchPendingInvoices').disabled = false;
            return;
        }

        await renderLoadedInvoice(data);
    } catch (error) {
        console.error('Error loading linked bookings:', error.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

async function renderLoadedInvoice(invoices) {
    const tableBody = getTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    createPendingShipmentTableHeaderAndFooter_ib();

    // Reset state
    invoiceState.totals = { totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0, totalSGST: 0, totalCGST: 0, totalIGST: 0, totalGST: 0, totalGrand: 0 };
    invoiceState.mergedChargesMap = {};

    // Process all invoices
    await Promise.all(invoices.map(async (invoice) => {
        const charges = await getBookingCharges(invoice.id);
        if (!charges || charges.grandTotal <= 0) return;

        addInvoiceRow(tableBody, invoice, charges);
        accumulateTotals(charges);
        mergeCharges(charges.chargesMap);
    }));

    updateTotalsDisplay(invoiceState.totals);
    renderChargesTable(invoiceState.mergedChargesMap);
}

// ============================================
// ADD SINGLE SHIPMENT (Optimized)
// ============================================
async function addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    if (!shipmentNo || !invoiceNo) {
        alert('Shipment number and invoice number are required.');
        return;
    }

    showSpinner();

    try {
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

        // Lock and assign shipment
        await supabaseClient
            .from('international_booking')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id);

        // Add to table
        const tableBody = getTableBody();
        if (!tableBody) {
            alert('Table not found.');
            return;
        }
        createPendingShipmentTableHeaderAndFooter_ib();
        addInvoiceRow(tableBody, data, charges);
        accumulateTotals(charges);
        mergeCharges(charges.chargesMap);
        updateTotalsDisplay(invoiceState.totals);
        renderChargesTable(invoiceState.mergedChargesMap);

        alert('Shipment added successfully! 2');
    } catch (error) {
        console.error('Error adding shipment:', error.message);
        alert('Error adding shipment: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// ============================================
// UNLOCK BOOKING (Optimized)
// ============================================
async function unlockBooking_ib(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("international_booking")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null })
            .eq("LockedBy", userID);

        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            invoiceState.lockedBookingIds = [];
            if (invoiceState.unlockTimer) {
                clearTimeout(invoiceState.unlockTimer);
                invoiceState.unlockTimer = null;
            }
        }
    } catch (error) {
        console.error("Unexpected error during unlock:", error);
    }
}

// ============================================
// REMOVE ROW (Optimized)
// ============================================
function removeRow(button) {
    const row = button?.closest('tr');
    if (!row) return;

    const shipId = parseInt(row.dataset.shipId);
    if (!isNaN(shipId)) {
        const index = invoiceState.lockedBookingIds.indexOf(shipId);
        if (index !== -1) invoiceState.lockedBookingIds.splice(index, 1);
        unlockShipmentRecord(shipId);
    }

    // Subtract row values from totals
    const values = Array.from(row.cells).slice(10, 18).map(cell => parseFloatSafe(cell.textContent));
    const [freightAmt, fscAmt, otherAmt, sgstAmt, cgstAmt, igstAmt, gstAmt, grandAmt] = values;

    const t = invoiceState.totals;
    t.totalFreight -= freightAmt;
    t.totalFSCAmt -= fscAmt;
    t.totalOtherAmt -= otherAmt;
    t.totalSGST -= sgstAmt;
    t.totalCGST -= cgstAmt;
    t.totalIGST -= igstAmt;
    t.totalGST -= gstAmt;
    t.totalGrand -= grandAmt;

    updateTotalsDisplay(t);
    row.remove();
}

// ============================================
// TABLE HEADER/FOOTER (Optimized)
// ============================================
async function createPendingShipmentTableHeaderAndFooter_ib() {
    const table = document.getElementById("pendingShipmentTable");
    if (!table) return;

    // Remove existing head/foot
    table.querySelectorAll('thead, tfoot').forEach(el => el.remove());

    // Create THEAD
    const thead = document.createElement("thead");
    thead.className = "table-light";
    const headRow = document.createElement("tr");
    TABLE_CONFIG_IB.HEADER_COLS.forEach(text => {
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

    TABLE_CONFIG_IB.TOTALS_COLUMNS.forEach(item => {
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