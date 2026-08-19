// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const DB_TABLE_CONFIG = {
    HEADER_COLS: [
        "Docket<br>No", "Booked<br>Date", "Transit<br>Type", "Mode<br>Type",
        "Origin", "Destination", "No.<br>of Units", "Actual<br>Weight",
        "Chargeable<br>Weight", "Basic<br>Freight", "FSC<br>Amount",
        "Other<br>Amount", "SGST<br>Amount", "CGST<br>Amount",
        "IGST<br>Amount", "Total GST<br>Amount", "Grand Total<br>Amount", "Action"
    ],
    TOTALS_COLUMNS: [
        { colspan: 8, label: "Totals:", align: "text-end" },
        { id: "totalQuantity" }, { id: "totalFreight" }, { id: "totalFSCAmt" },
        { id: "totalOtherAmt" }, { id: "totalSGST" }, { id: "totalCGST" },
        { id: "totalIGST" }, { id: "totalGST" }, { id: "totalGrand" },
        { empty: true }
    ]
};

// ============================================
// STATE MANAGEMENT FOR DOMESTIC BOOKING
// ============================================
class DomesticBookingState {
    constructor() {
        this.lockedBookingIds = [];
        this.mergedChargesMap = {};
        this.unlockTimer = null;
        this.totals = {
            totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0,
            totalGST: 0, totalGrand: 0, totalQuantity: 0
        };
        // Debug: track charge categorization
        this.chargeCategories = { freight: [], fsc: [], other: [] };
    }

    reset() {
        this.lockedBookingIds = [];
        this.mergedChargesMap = {};
        this.chargeCategories = { freight: [], fsc: [], other: [] };
        this.totals = {
            totalFreight: 0, totalFSCAmt: 0, totalOtherAmt: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0,
            totalGST: 0, totalGrand: 0, totalQuantity: 0
        };
        this.clearTimer();
    }

    clearTimer() {
        if (this.unlockTimer) {
            clearTimeout(this.unlockTimer);
            this.unlockTimer = null;
        }
    }

    updateTotals(charges, quantity = 0) {
        // console.log('Updating totals with charges:', charges);

        this.totals.totalFreight += charges.BasicFrightAmt || 0;
        this.totals.totalFSCAmt += charges.FSCAmt || 0;
        this.totals.totalOtherAmt += charges.OtherAmt || 0;
        this.totals.totalSGST += charges.totalSGST || 0;
        this.totals.totalCGST += charges.totalCGST || 0;
        this.totals.totalIGST += charges.totalIGST || 0;
        this.totals.totalGST += charges.totalGST || 0;
        this.totals.totalGrand += charges.grandTotal || 0;
        this.totals.totalQuantity += quantity || 0;

        // console.log('Updated totals:', this.totals);
    }

    mergeCharges(chargesMap) {
        Object.entries(chargesMap).forEach(([type, amounts]) => {
            // Keep the original type name for display
            const displayType = type;
            if (!this.mergedChargesMap[displayType]) {
                this.mergedChargesMap[displayType] = {
                    TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                    IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
                };
            }

            const entry = this.mergedChargesMap[displayType];
            Object.keys(entry).forEach(key => {
                entry[key] += parseFloatSafe(amounts[key]);
            });
        });
    }

    getInvoiceData() {
        return {
            BasicAmount: parseFloatSafe(this.totals.totalFreight),
            OtherAmount: parseFloatSafe(this.totals.totalFSCAmt) + parseFloatSafe(this.totals.totalOtherAmt),
            CGSTAmount: parseFloatSafe(this.totals.totalCGST),
            SGSTAmount: parseFloatSafe(this.totals.totalSGST),
            IGSTAmount: parseFloatSafe(this.totals.totalIGST),
            TotalGSTAmount: parseFloatSafe(this.totals.totalGST),
            GrandTotalAmount: parseFloatSafe(this.totals.totalGrand)
        };
    }
}

const dbState = new DomesticBookingState();

// ============================================
// UTILITY FUNCTIONS
// ============================================
const getDBElementValue = (id) => document.getElementById(id)?.value?.trim() || '';
const getDBTableBody = () => document.getElementById('pendingShipmentTable')?.querySelector('tbody');
const getFooterValue = (id) => parseFloatSafe(document.getElementById(id)?.textContent);
const createTableCell = (text, className = '') => {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
};

// ============================================
// VALIDATION
// ============================================
const validateDBInputs = () => {
    const partyCode = getDBElementValue('partyCode');
    const invoiceDate = getDBElementValue('invoiceDate');
    const movementType = getDBElementValue('movementType');

    if (!partyCode) { alert('Please select a customer first.'); return null; }
    if (!invoiceDate) { alert('Please select an invoice date first.'); document.getElementById('invoiceDate')?.focus(); return null; }
    if (!movementType) { alert('Please select a movement type first.'); document.getElementById('movementType')?.focus(); return null; }

    return { partyCode, invoiceDate, movementType };
};

// ============================================
// MAIN FUNCTION - GET PENDING INVOICES
// ============================================
async function d_getPendingInvoiceDetails() {
    const validation = validateDBInputs();
    if (!validation) return;

    const { partyCode } = validation;
    const department = getDBElementValue('department');
    const fetchButton = document.getElementById('fetchPendingInvoices');

    fetchButton.disabled = true;
    showSpinner();

    try {
        const data = await fetchPendingDBInvoices(partyCode, department);
        if (!data?.length) {
            alert('No pending invoices found or all are currently locked.');
            return;
        }

        await processDBInvoices(data);
    } catch (error) {
        console.error('Error fetching or locking pending invoices:', error.message);
        alert('Error loading invoices. Please try again.');
    } finally {
        fetchButton.disabled = false;
        hideSpinner();
    }
}

async function fetchPendingDBInvoices(partyCode, department) {
    let query = supabaseClient
        .from('DomesticBookingDetails')
        .select('*')
        .eq('company_id', CompanyID)
        .eq('CustomerCode', partyCode)
        .or('InvoiceNumber.is.null,InvoiceNumber.eq.""')
        .eq('IsLocked', false)
        .order('BookingDate', { ascending: true });

    if (department && department.toLowerCase() !== 'all') {
        query = query.eq('Department', department);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

async function processDBInvoices(invoices) {
    dbState.reset();
    const validInvoices = [];

    // Process all invoices in parallel
    await Promise.all(invoices.map(async (invoice) => {
        const charges = await d_getBookingCharges(invoice.id);
        if (!charges || charges.grandTotal <= 0) return;

        await lockDBInvoice(invoice.id);
        validInvoices.push({ invoice, charges });
    }));

    if (!validInvoices.length) {
        alert('No pending invoices with grand total greater than 0 found.');
        return;
    }

    dbState.lockedBookingIds = validInvoices.map(({ invoice }) => invoice.id);
    startDBAutoUnlockTimer();

    // Render table
    await renderDBInvoiceTable(validInvoices);
    updateDBTotalsDisplay();
    renderChargesTable(dbState.mergedChargesMap);
}

async function lockDBInvoice(invoiceId) {
    const { error } = await supabaseClient
        .from('DomesticBookingDetails')
        .update({
            IsLocked: true,
            LockedBy: UserLoginID,
            LockedAt: localtimeStamp
        })
        .eq('id', invoiceId);

    if (error) throw error;
}

function startDBAutoUnlockTimer() {
    dbState.clearTimer();
    dbState.unlockTimer = setTimeout(() => {
        if (dbState.lockedBookingIds.length) {
            d_unlockBooking_db(UserLoginID);
        }
    }, 30 * 60 * 1000); // 30 minutes
}

// ============================================
// RENDER TABLE
// ============================================
async function renderDBInvoiceTable(validInvoices) {
    const tableBody = getDBTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    await d_createPendingShipmentTableHeaderAndFooter_ib();

    validInvoices.forEach(({ invoice, charges }) => {
        addDBRow(tableBody, invoice, charges);
        dbState.updateTotals(charges, parseFloatSafe(invoice.Quantity));
        dbState.mergeCharges(charges.chargesMap);
    });
}

function addDBRow(tableBody, invoice, charges) {
    const row = document.createElement('tr');
    row.dataset.shipId = invoice.id;

    const rowData = [
        invoice.DocketNo || '',
        formatDate(invoice.BookingDate),
        invoice.TransitType || '',
        invoice.ModeType || '',
        invoice.OriginCity || '',
        invoice.DestinationCity || '',
        invoice.Quantity || '',
        `${invoice.ActualWeight || ''} ${invoice.UOMType || ''}`,
        `${invoice.ChargeableWeight || ''} ${invoice.UOMType || ''}`,
        parseFloatSafe(charges.BasicFrightAmt).toFixed(2),
        parseFloatSafe(charges.FSCAmt).toFixed(2),
        parseFloatSafe(charges.OtherAmt).toFixed(2),
        parseFloatSafe(charges.totalSGST).toFixed(2),
        parseFloatSafe(charges.totalCGST).toFixed(2),
        parseFloatSafe(charges.totalIGST).toFixed(2),
        parseFloatSafe(charges.totalGST).toFixed(2),
        parseFloatSafe(charges.grandTotal).toFixed(2)
    ];

    rowData.forEach(text => {
        row.appendChild(createTableCell(text));
    });

    // Action cell with delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm delete-btn';
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.onclick = () => d_removeRow(deleteBtn);
    actionTd.appendChild(deleteBtn);
    row.appendChild(actionTd);

    tableBody.appendChild(row);
}

// ============================================
// GET BOOKING CHARGES (FIXED - Better categorization)
// ============================================
async function d_getBookingCharges(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('DomesticBookingCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_DB', bookingID)
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data?.length) {
            console.log('No charges found for booking:', bookingID);
            return null;
        }

        // console.log('Raw charges data for booking', bookingID, ':', data);

        const chargesMap = {};
        let totals = {
            BasicFrightAmt: 0, FSCAmt: 0, OtherAmt: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0,
            totalGST: 0, grandTotal: 0
        };

        data.forEach(charge => {
            const type = (charge.ChargesType || 'Other').trim();
            const typeLower = type.toLowerCase();

            // console.log(`Processing charge: "${type}" (${typeLower}), Amount: ${charge.TotalAmount}`);

            // Initialize chargesMap entry with original type name
            if (!chargesMap[type]) {
                chargesMap[type] = {
                    TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                    IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
                };
            }

            // Add to chargesMap
            const amounts = chargesMap[type];
            ['TotalAmount', 'SGSTAmt', 'CGSTAmt', 'IGSTAmt', 'TotalGSTAmt', 'GrandTotalAmt'].forEach(field => {
                amounts[field] += parseFloatSafe(charge[field]);
            });

            // CRITICAL FIX: Better categorization with multiple checks
            const amount = parseFloatSafe(charge.TotalAmount);
            let categorized = false;

            // Check for Freight - multiple variations
            if (typeLower.includes('freight') ||
                typeLower.includes('basic') ||
                typeLower === 'freight amount' ||
                typeLower === 'freight' ||
                typeLower === 'basic freight' ||
                typeLower === 'basic freight amount') {
                totals.BasicFrightAmt += amount;
                categorized = true;
                // console.log(`✅ "${type}" categorized as FREIGHT, added ${amount} to BasicFrightAmt`);
            }

            // Check for FSC - multiple variations
            if (!categorized && (typeLower.includes('fuel') ||
                typeLower.includes('fsc') ||
                typeLower === 'fuel surcharge' ||
                typeLower === 'fuel charge' ||
                typeLower === 'fuel adjustment')) {
                totals.FSCAmt += amount;
                categorized = true;
                // console.log(`✅ "${type}" categorized as FSC, added ${amount} to FSCAmt`);
            }

            // Everything else goes to Other
            if (!categorized) {
                totals.OtherAmt += amount;
                // console.log(`📦 "${type}" categorized as OTHER, added ${amount} to OtherAmt`);
            }

            // Add GST amounts
            totals.totalSGST += parseFloatSafe(charge.SGSTAmt);
            totals.totalCGST += parseFloatSafe(charge.CGSTAmt);
            totals.totalIGST += parseFloatSafe(charge.IGSTAmt);
            totals.totalGST += parseFloatSafe(charge.TotalGSTAmt);
            totals.grandTotal += parseFloatSafe(charge.GrandTotalAmt);
        });

        // console.log('Final calculated totals:', totals);
        // console.log('Charges Map:', chargesMap);

        return { ...totals, chargesMap };
    } catch (error) {
        console.error('Error fetching booking charges:', error.message);
        return null;
    }
}

// ============================================
// UPDATE TOTALS (FIXED - Ensures BasicAmount is set)
// ============================================
function updateDBTotalsDisplay() {
    // console.log('Updating totals display with state:', dbState.totals);

    const totalElements = {
        totalQuantity: dbState.totals.totalQuantity,
        totalFreight: dbState.totals.totalFreight,
        totalFSCAmt: dbState.totals.totalFSCAmt,
        totalOtherAmt: dbState.totals.totalOtherAmt,
        totalSGST: dbState.totals.totalSGST,
        totalCGST: dbState.totals.totalCGST,
        totalIGST: dbState.totals.totalIGST,
        totalGST: dbState.totals.totalGST,
        totalGrand: dbState.totals.totalGrand
    };

    // Update UI totals
    Object.entries(totalElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            const formattedValue = parseFloatSafe(value).toFixed(2);
            el.textContent = formattedValue;
            // console.log(`Updated ${id}: ${formattedValue}`);
        }
    });

    // CRITICAL FIX: Explicitly set invoiceData with proper values
    const basicAmount = parseFloatSafe(dbState.totals.totalFreight);
    const otherAmount = parseFloatSafe(dbState.totals.totalFSCAmt) + parseFloatSafe(dbState.totals.totalOtherAmt);
    const cgstAmount = parseFloatSafe(dbState.totals.totalCGST);
    const sgstAmount = parseFloatSafe(dbState.totals.totalSGST);
    const igstAmount = parseFloatSafe(dbState.totals.totalIGST);
    const totalGstAmount = parseFloatSafe(dbState.totals.totalGST);
    const grandTotalAmount = parseFloatSafe(dbState.totals.totalGrand);

    // console.log('Setting invoiceData values:', {
    //     BasicAmount: basicAmount,
    //     OtherAmount: otherAmount,
    //     CGSTAmount: cgstAmount,
    //     SGSTAmount: sgstAmount,
    //     IGSTAmount: igstAmount,
    //     TotalGSTAmount: totalGstAmount,
    //     GrandTotalAmount: grandTotalAmount
    // });

    // Update invoiceData with explicit values
    if (typeof invoiceData !== 'undefined') {
        invoiceData.BasicAmount = basicAmount;
        invoiceData.OtherAmount = otherAmount;
        invoiceData.CGSTAmount = cgstAmount;
        invoiceData.SGSTAmount = sgstAmount;
        invoiceData.IGSTAmount = igstAmount;
        invoiceData.TotalGSTAmount = totalGstAmount;
        invoiceData.GrandTotalAmount = grandTotalAmount;

        // console.log('✅ invoiceData updated:', invoiceData);
    } else {
        console.error('❌ invoiceData is not defined!');
        // Try to set it on window
        window.invoiceData = window.invoiceData || {};
        window.invoiceData.BasicAmount = basicAmount;
        window.invoiceData.OtherAmount = otherAmount;
        window.invoiceData.CGSTAmount = cgstAmount;
        window.invoiceData.SGSTAmount = sgstAmount;
        window.invoiceData.IGSTAmount = igstAmount;
        window.invoiceData.TotalGSTAmount = totalGstAmount;
        window.invoiceData.GrandTotalAmount = grandTotalAmount;
    }
}

// ============================================
// UPDATE TOTALS (Legacy compatibility)
// ============================================
function d_updateTotals_db(totals) {
    if (!totals) return;
    Object.assign(dbState.totals, totals);
    updateDBTotalsDisplay();
}

// ============================================
// UNLOCK BOOKING
// ============================================
async function d_unlockBooking_db(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("DomesticBookingDetails")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null })
            .eq("LockedBy", userID);

        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            dbState.lockedBookingIds = [];
            dbState.clearTimer();
        }
    } catch (error) {
        console.error("Unexpected error during unlock:", error);
    }
}

// ============================================
// UNLOCK SINGLE SHIPMENT RECORD
// ============================================
async function unlockShipmentRecord(shipId) {
    if (!shipId) return;

    try {
        const { error } = await supabaseClient
            .from('DomesticBookingDetails')
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
async function d_createPendingShipmentTableHeaderAndFooter_ib() {
    const table = document.getElementById("pendingShipmentTable");
    if (!table) return;

    // Remove existing head/foot
    table.querySelectorAll('thead, tfoot').forEach(el => el.remove());

    // Create THEAD
    const thead = document.createElement("thead");
    thead.className = "table-light";
    const headRow = document.createElement("tr");
    DB_TABLE_CONFIG.HEADER_COLS.forEach(text => {
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

    DB_TABLE_CONFIG.TOTALS_COLUMNS.forEach(item => {
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
async function d_updateInvoiceNumbers(invNo) {
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
            .from('DomesticBookingDetails')
            .update({ InvoiceStatus: false, InvoiceNumber: null })
            .eq('InvoiceNumber', invNo);

        // Update new assignments
        const { error } = await supabaseClient
            .from('DomesticBookingDetails')
            .update({ InvoiceStatus: true, InvoiceNumber: invNo })
            .in('id', shipmentIds);

        if (error) throw error;
        console.log(`Invoice numbers updated for ${shipmentIds.length} shipments`);
    } catch (error) {
        console.error('Error updating invoice numbers:', error.message);
        throw error;
    }
}

// ============================================
// LOAD INVOICE BOOKINGS
// ============================================
async function d_loadInvoiceBookings(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();
    dbState.reset();

    try {
        const { data, error } = await supabaseClient
            .from('DomesticBookingDetails')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('BookingDate', { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            alert('No shipments found for this invoice.');
            return;
        }

        await renderDBLoadedInvoice(data);
    } catch (error) {
        console.error('Error loading linked bookings:', error.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

async function renderDBLoadedInvoice(invoices) {
    const tableBody = getDBTableBody();
    if (!tableBody) return;

    tableBody.innerHTML = '';
    await d_createPendingShipmentTableHeaderAndFooter_ib();

    // Process all invoices in parallel
    const processed = await Promise.all(invoices.map(async (invoice) => {
        const charges = await d_getBookingCharges(invoice.id);
        if (!charges || charges.grandTotal <= 0) return null;
        return { invoice, charges };
    }));

    const validItems = processed.filter(item => item !== null);

    validItems.forEach(({ invoice, charges }) => {
        addDBRow(tableBody, invoice, charges);
        dbState.updateTotals(charges, parseFloatSafe(invoice.Quantity));
        dbState.mergeCharges(charges.chargesMap);
    });

    updateDBTotalsDisplay();
    renderChargesTable(dbState.mergedChargesMap);
}

// ============================================
// ADD SINGLE SHIPMENT (FIXED)
// ============================================
async function d_addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    if (!shipmentNo || !invoiceNo) {
        alert("Enter shipment number and invoice number");
        return;
    }

    showSpinner();

    try {
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

        // FIX: Use the correct function name (d_getBookingCharges)
        const charges = await d_getBookingCharges(data.id);

        if (!charges || parseFloatSafe(charges.grandTotal) <= 0) {
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

        const tableBody = getDBTableBody();
        if (!tableBody) {
            alert('Table not found.');
            return;
        }

        // Add row
        addDBRow(tableBody, data, charges);
        dbState.updateTotals(charges, parseFloatSafe(data.Quantity));
        dbState.mergeCharges(charges.chargesMap);
        updateDBTotalsDisplay();
        renderChargesTable(dbState.mergedChargesMap);

        alert('Shipment added successfully!');
    } catch (error) {
        console.error('Error adding shipment:', error.message);
        alert('Error adding shipment: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// ============================================
// REMOVE ROW (FIXED)
// ============================================
function d_removeRow(button) {
    const row = button?.closest('tr');
    if (!row) return;

    const shipId = row.dataset.shipId;
    console.log('Removing row for Shipment ID:', shipId);

    if (shipId) {
        const index = dbState.lockedBookingIds.indexOf(parseInt(shipId));
        if (index !== -1) {
            dbState.lockedBookingIds.splice(index, 1);
        }
        unlockShipmentRecord(shipId);
    }

    // Get the amounts from the row
    // Column indices: 0=DocNo, 1=Date, 2=Transit, 3=Mode, 4=Origin, 5=Dest, 6=Qty, 
    // 7=ActualWt, 8=ChargeableWt, 9=BasicFreight, 10=FSC, 11=Other, 12=SGST, 13=CGST, 14=IGST, 15=GST, 16=Grand
    const quantity = parseFloatSafe(row.cells[6]?.textContent);
    const freightAmt = parseFloatSafe(row.cells[9]?.textContent);
    const fscAmt = parseFloatSafe(row.cells[10]?.textContent);
    const otherAmt = parseFloatSafe(row.cells[11]?.textContent);
    const sgstAmt = parseFloatSafe(row.cells[12]?.textContent);
    const cgstAmt = parseFloatSafe(row.cells[13]?.textContent);
    const igstAmt = parseFloatSafe(row.cells[14]?.textContent);
    const gstAmt = parseFloatSafe(row.cells[15]?.textContent);
    const grandAmt = parseFloatSafe(row.cells[16]?.textContent);

    // Subtract from state and update display
    dbState.totals.totalQuantity -= quantity;
    dbState.totals.totalFreight -= freightAmt;
    dbState.totals.totalFSCAmt -= fscAmt;
    dbState.totals.totalOtherAmt -= otherAmt;
    dbState.totals.totalSGST -= sgstAmt;
    dbState.totals.totalCGST -= cgstAmt;
    dbState.totals.totalIGST -= igstAmt;
    dbState.totals.totalGST -= gstAmt;
    dbState.totals.totalGrand -= grandAmt;

    updateDBTotalsDisplay();

    // Remove row from table
    row.remove();
}