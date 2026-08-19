/* =========================================================
   CONSTANTS & CONFIGURATION
========================================================= */
const FORWARDING_TYPES = ['Forwarding', 'Import', 'Export'];
const INVOICE_TYPE_MAP = {
    'Forwarding': { loadFn: 'loadInvoiceBookings', createTableFn: 'createPendingShipmentTableHeaderAndFooter_ib' },
    'Import': { loadFn: 'loadInvoiceBookings', createTableFn: 'createPendingShipmentTableHeaderAndFooter_ib' },
    'Export': { loadFn: 'loadInvoiceBookings', createTableFn: 'createPendingShipmentTableHeaderAndFooter_ib' },
    'Customs Clearance': { loadFn: 'loadInvoiceLineItems_cc', createTableFn: 'createPendingShipmentTableHeaderAndFooter' },
    'Domestic': { loadFn: 'd_loadInvoiceBookings', createTableFn: 'd_createPendingShipmentTableHeaderAndFooter_ib' },
    'Full Truck Load': { loadFn: 'ftl_loadInvoiceBookings', createTableFn: 'FTL_FCL_createPendingShipmentTableHeaderAndFooter' }
};

const TOTAL_ELEMENT_IDS = [
    'totalFreight', 'totalFSCAmt', 'totalOtherAmt',
    'totalSGST', 'totalCGST', 'totalIGST',
    'totalGST', 'totalGrand'
];

// Flag to prevent duplicate loading
let isLoadingInvoice = false;

// =========================================================
// STATE MANAGEMENT
// =========================================================
class InvoiceManager {
    constructor() {
        this.invoiceData = {};
        this.invoiceChargesData = {};
        this.bankID = null;
        this.bankMap = {};
        this.lockedBookingIds = [];
        this.unlockTimers = [];
    }

    reset() {
        this.invoiceData = {};
        this.invoiceChargesData = {};
        this.bankID = null;
        this.lockedBookingIds = [];
        this.clearUnlockTimers();
    }

    clearUnlockTimers() {
        this.unlockTimers.forEach(timer => clearTimeout(timer));
        this.unlockTimers = [];
    }

    setInvoiceData(data) {
        this.invoiceData = { ...this.invoiceData, ...data };
    }

    getInvoiceData() {
        return this.invoiceData;
    }

    setBankID(id) {
        this.bankID = id;
    }

    getBankID() {
        return this.bankID;
    }

    setBankMap(map) {
        this.bankMap = map;
    }

    getBankMap() {
        return this.bankMap;
    }

    addLockedBooking(id) {
        if (!this.lockedBookingIds.includes(id)) {
            this.lockedBookingIds.push(id);
        }
    }

    getLockedBookings() {
        return this.lockedBookingIds;
    }

    clearLockedBookings() {
        this.lockedBookingIds = [];
    }
}

const invoiceManager = new InvoiceManager();

// =========================================================
// UTILITY FUNCTIONS
// =========================================================

function getTextValue(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with id "${id}" not found, returning 0`);
        return 0;
    }
    const text = el.textContent || '0';
    return parseFloat(text.replace(/,/g, '')) || 0;
}

function formatAmount(value) {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
    return value.toFixed(2);
}

function showToast(message) {
    // Use a proper toast notification if available
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toastEl = document.getElementById('liveToast');
        if (toastEl) {
            const toastBody = toastEl.querySelector('.toast-body');
            if (toastBody) toastBody.textContent = message;
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
            return;
        }
    }
    // Fallback to alert
    console.log('Toast:', message);
    alert(message);
}

function showSpinner() {
    const spinner = document.getElementById('saveSpinner');
    if (spinner) spinner.classList.remove('d-none');
}

function hideSpinner() {
    const spinner = document.getElementById('saveSpinner');
    if (spinner) spinner.classList.add('d-none');
}

function disableForm() {
    const inputs = document.querySelectorAll('#container input, #container select, #container textarea');
    inputs.forEach(input => {
        if (input.id !== 'invoiceNo' &&
            input.id !== 'reportType' &&
            input.id !== 'saveButton' &&
            input.id !== 'modifyButton' &&
            input.id !== 'deleteButton' &&
            input.id !== 'reportButton' &&
            input.id !== 'newButton') {
            input.disabled = true;
        }
    });
}

function enableForm() {
    const inputs = document.querySelectorAll('#container input, #container select, #container textarea');
    inputs.forEach(input => {
        if (input.id !== 'invoiceNo' &&
            input.id !== 'saveButton' &&
            input.id !== 'modifyButton' &&
            input.id !== 'deleteButton' &&
            input.id !== 'reportButton' &&
            input.id !== 'newButton') {
            input.disabled = false;
        }
    });
}

function clearPendingShipmentTable() {
    const table = document.getElementById('pendingShipmentTable');
    if (table?.tBodies?.[0]) {
        table.tBodies[0].innerHTML = '';
    }
}

function clearInvoiceTotals() {
    TOTAL_ELEMENT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0.00';
    });
}

function clearChargesTable() {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    if (tbody) tbody.innerHTML = '';

    ['totalFreightAmt', 'totalSGSTAmt', 'totalCGSTAmt', 'totalIGSTAmt', 'totalGSTAmt', 'totalGrandAmt']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0.00';
        });
}


// =========================================================
// DOM READY - OPTIMIZED
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Promise.all([
            loadSuggestions('partySuggestions', 'PartyDetails', CompanyID),
            loadDefaultBank(),
            loadDatalist('departmentList', 'Department')
        ]);

        setupBankSelection();
        setupInvoiceFromURL();

        // Set default date
        const invoiceDate = document.getElementById('invoiceDate');
        if (invoiceDate && !invoiceDate.value) {
            invoiceDate.value = new Date().toISOString().split('T')[0];
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize application');
    }
});

function setupBankSelection() {
    const bankInput = document.getElementById('inputBankName');
    const bankIDInput = document.getElementById('bankIDs');
    bankInput?.addEventListener('input', function () {
        const selectedValue = this.value.trim();
        const bankMap = invoiceManager.getBankMap();
        if (bankMap && bankMap[selectedValue]) {
            invoiceManager.setBankID(bankMap[selectedValue]);
            if (bankIDInput) bankIDInput.value = invoiceManager.getBankID();
        } else {
            invoiceManager.setBankID(null);
            if (bankIDInput) bankIDInput.value = '';
        }
    });
}

// =========================================================
// FIX: SETUP INVOICE FROM URL - PREVENT DUPLICATES
// =========================================================
async function setupInvoiceFromURL() {
    const params = new URLSearchParams(window.location.search);
    const invoiceNo = params.get("invoiceNo");

    if (invoiceNo) {
        const invoiceInput = document.getElementById("invoiceNo");
        if (invoiceInput) {
            invoiceInput.value = invoiceNo;
            // Use a flag to prevent duplicate loading
            isLoadingInvoice = true;

            // Directly load the invoice without triggering change event
            await loadInvoice(invoiceNo);

            isLoadingInvoice = false;
        }
    }
}

// =========================================================
// CUSTOMER SELECTION - OPTIMIZED
// =========================================================
document.getElementById('partyName')?.addEventListener('change', async function () {
    const selectedPartyName = this.value.trim();
    const options = Array.from(document.getElementById('partySuggestions')?.options || []);
    const option = options.find(opt => opt.value === selectedPartyName);

    if (!option) {
        alert('Invalid customer selection.');
        return;
    }

    const partyCode = document.getElementById('partyCode').value;

    try {
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .select('*')
            .eq('PartyCode', partyCode)
            .eq('Status', 'Active');

        if (error) throw error;

        if (!data?.length) {
            alert('No active billing address found.');
            return;
        }

        if (data.length === 1) {
            fillInvoiceAddress(data[0]);
        } else {
            showAddressSelectionModal(data);
        }

        document.getElementById('invoiceDate')?.focus();
    } catch (err) {
        console.error('Error loading billing addresses:', err);
        alert('Error loading billing addresses. Please try again.');
    }
});

document.getElementById('partyName')?.addEventListener('input', function () {
    const partyValue = this.value.trim();
    const btn = document.getElementById('addShipmentNo');
    if (btn) btn.disabled = !partyValue;
});

function fillInvoiceAddress(addr) {
    const addressEl = document.getElementById('invoiceAddress');
    if (addressEl) {
        addressEl.value = formatAddress(addr);
    }
}

function formatAddress(a) {
    if (!a) return '';
    return `${a.Address || ''}, ${a.City || ''}, ${a.PinCode || ''}, ${a.State || ''}, ${a.Country || ''}`;
}

// =========================================================
// INVOICE NUMBER GENERATION - FIXED
// =========================================================
async function generateInvoiceNumber(invoiceDateValue) {
    if (!invoiceDateValue) return '';

    try {
        // Get company short code
        const { data: companyData, error: companyError } = await supabaseClient
            .from('company_profile')
            .select('short_code')
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (companyError) {
            console.error('Error fetching company profile:', companyError);
            return '';
        }

        if (!companyData) {
            console.error('No company profile found');
            return '';
        }

        const shortCode = companyData.short_code;
        const fy = getFinancialYear(invoiceDateValue);

        // Get last invoice number
        const { data: lastInvoice, error: lastError } = await supabaseClient
            .from('InvoiceDetails')
            .select('InvoiceNo')
            .like('InvoiceNo', `${shortCode}/${fy}/%`)
            .eq('company_id', CompanyID)
            .order('InvoiceNo', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastError) {
            console.error('Error fetching last invoice:', lastError);
            return '';
        }

        const nextNumber = lastInvoice ? parseInt(lastInvoice.InvoiceNo.split('/').pop()) + 1 : 1;
        return `${shortCode}/${fy}/${nextNumber.toString().padStart(4, '0')}`;

    } catch (error) {
        console.error('Error generating invoice number:', error);
        return '';
    }
}

function getFinancialYear(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const startYear = d.getMonth() >= 3 ? d.getFullYear() % 100 : (d.getFullYear() - 1) % 100;
    const endYear = (startYear + 1) % 100;
    return `${startYear.toString().padStart(2, '0')}-${endYear.toString().padStart(2, '0')}`;
}

// =========================================================
// FIX: FETCH PENDING INVOICES - CLEAR TABLE FIRST
// =========================================================
document.getElementById('fetchPendingInvoices')?.addEventListener('click', async () => {
    // Skip if we're loading from URL
    if (isLoadingInvoice) return;

    const type = document.getElementById('movementType')?.value;
    const actionMap = {
        'Forwarding': getPendingInvoiceDetails,
        'Import': getPendingInvoiceDetails,
        'Export': getPendingInvoiceDetails,
        'Customs Clearance': CustomsClearanceInvoiceDetails,
        'Domestic': d_getPendingInvoiceDetails,
        'Full Truck Load': FTL_FCL_getPendingInvoiceDetails
    };

    const action = actionMap[type];
    if (action) {
        try {
            // Clear existing table rows before fetching new data
            clearPendingShipmentTable();
            await action();
            showToast('Pending invoices loaded successfully');
        } catch (e) {
            console.error('Error fetching invoices:', e);
            alert('Failed to fetch invoices: ' + e.message);
        }
    } else {
        alert('Select valid Movement Type');
    }
});

// =========================================================
// FIX: SAVE INVOICE - COMPLETE FIX
// =========================================================
document.getElementById('saveButton')?.addEventListener('click', async function () {
    if (this.disabled) return;

    const spinner = document.getElementById('saveSpinnerBtn');
    const originalText = this.innerHTML;

    // Disable button and show processing
    this.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    this.innerHTML = `
        <span id="saveSpinnerBtn" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Processing...
    `;

    try {
        await saveInvoice(this);
    } catch (error) {
        console.error('Save error:', error);
        showToast(error.message || 'Save failed');
        // Restore button on error
        this.disabled = false;
        this.innerHTML = originalText;
    }
});

async function saveInvoice(saveBtn) {
    const isInsert = saveBtn.dataset.mode === 'insert';

    // Collect invoice data
    const invoiceData = await collectInvoiceDataAsync(isInsert);

    if (!invoiceData) {
        // Re-enable button on validation failure
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        return;
    }

    const invoiceNo = invoiceData.InvoiceNo;

    try {
        if (isInsert) {
            invoiceData.created_by = UserLoginID;
            invoiceData.created_at = localtimeStamp;

            const { error } = await supabaseClient
                .from('InvoiceDetails')
                .insert([invoiceData]);

            if (error) throw error;
        } else {
            invoiceData.updated_by = UserLoginID;
            invoiceData.updated_at = localtimeStamp;

            const { error } = await supabaseClient
                .from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceNo)
                .eq('company_id', CompanyID);

            if (error) throw error;
        }

        showToast(`Invoice ${isInsert ? 'Saved' : 'Updated'} Successfully`);

        // Clear pending shipment table after saving to prevent duplicates on reload
        clearPendingShipmentTable();

        await updateLinkedBookings(invoiceData.InvoiceType, invoiceNo);
        finalizeInvoice(saveBtn);

    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
}

async function collectInvoiceDataAsync(isInsert) {
    const partyCode = getElementValue('partyCode');
    const invoiceDate = getElementValue('invoiceDate');
    const invoiceType = getElementValue('movementType');
    const invoiceAddress = getElementValue('invoiceAddress');
    const bankID = document.getElementById('bankIDs')?.value.trim();

    // Validation
    if (!partyCode || !invoiceDate || !invoiceType || !invoiceAddress) {
        showToast('Fill all required fields');
        return null;
    }

    if (!bankID) {
        showToast('Select valid Bank Name');
        return null;
    }

    let invoiceNo = document.getElementById('invoiceNo')?.value.trim();

    if (isInsert) {
        // Generate new invoice number
        invoiceNo = await generateInvoiceNumber(invoiceDate);
        if (!invoiceNo) {
            showToast('Invoice number generation failed');
            return null;
        }
        document.getElementById('invoiceNo').value = invoiceNo;
    }

    const totals = collectTotals(invoiceType);

    // Debug: Log collected totals
    console.log('Collected totals for invoice:', {
        invoiceType,
        totals,
        BasicAmount: totals.freight,
        OtherAmount: totals.fsc + totals.other
    });

    return {
        InvoiceNo: invoiceNo,
        InvoiceDate: invoiceDate,
        InvoiceType: invoiceType,
        PartyCode: partyCode,
        InvoiceAddress: invoiceAddress,
        BankID: bankID,
        company_id: CompanyID,
        BasicAmount: totals.freight,
        OtherAmount: totals.fsc + totals.other,
        SGSTAmount: totals.sgst,
        CGSTAmount: totals.cgst,
        IGSTAmount: totals.igst,
        TotalGSTAmount: totals.gst,
        GrandTotalAmount: Math.round(totals.grand),
        Remarks: getElementValue('invoiceInformation')
    };
}

// FIX: collectTotals - Correct element ID mapping
function collectTotals(invoiceType) {
    const isCustoms = invoiceType === 'Customs Clearance';
    const isDomestic = invoiceType === 'Domestic';
    const isFTL = invoiceType === 'Full Truck Load';

    // Determine which element IDs to use
    let freightId, fscId, otherId, sgstId, cgstId, igstId, gstId, grandId;

    if (isCustoms) {
        // Customs uses _sc suffix
        freightId = 'totalFreight_sc';
        fscId = 'totalFSCAmt_sc';
        otherId = 'totalOtherAmt_sc';
        sgstId = 'totalSGST_sc';
        cgstId = 'totalCGST_sc';
        igstId = 'totalIGST_sc';
        gstId = 'totalGST_sc';
        grandId = 'totalGrand_sc';
    } else if (isDomestic) {
        // Domestic uses standard IDs (no suffix)
        freightId = 'totalFreight';
        fscId = 'totalFSCAmt';
        otherId = 'totalOtherAmt';
        sgstId = 'totalSGST';
        cgstId = 'totalCGST';
        igstId = 'totalIGST';
        gstId = 'totalGST';
        grandId = 'totalGrand';
    } else if (isFTL) {
        // FTL/FCL uses standard IDs
        freightId = 'totalFreight';
        fscId = 'totalFSCAmt';
        otherId = 'totalOtherAmt';
        sgstId = 'totalSGST';
        cgstId = 'totalCGST';
        igstId = 'totalIGST';
        gstId = 'totalGST';
        grandId = 'totalGrand';
    } else {
        // Forwarding/Import/Export uses standard IDs
        freightId = 'totalFreight';
        fscId = 'totalFSCAmt';
        otherId = 'totalOtherAmt';
        sgstId = 'totalSGST';
        cgstId = 'totalCGST';
        igstId = 'totalIGST';
        gstId = 'totalGST';
        grandId = 'totalGrand';
    }

    // Get values from the DOM
    const freight = getTextValue(freightId);
    const fsc = isCustoms ? 0 : getTextValue(fscId);
    const other = isCustoms ? 0 : getTextValue(otherId);
    const sgst = getTextValue(sgstId);
    const cgst = getTextValue(cgstId);
    const igst = getTextValue(igstId);
    const gst = getTextValue(gstId);
    const grand = getTextValue(grandId);

    console.log('Collecting totals with IDs:', {
        freightId, freight,
        fscId, fsc,
        otherId, other,
        sgstId, sgst,
        cgstId, cgst,
        igstId, igst,
        gstId, gst,
        grandId, grand
    });

    return { freight, fsc, other, sgst, cgst, igst, gst, grand };
}

async function updateLinkedBookings(invoiceType, invoiceNo) {
    const updateMap = {
        'Forwarding': updateInvoiceNumbers,
        'Import': updateInvoiceNumbers,
        'Export': updateInvoiceNumbers,
        'Customs Clearance': updateInvoiceNumbers_cc,
        'Domestic': d_updateInvoiceNumbers,
        'Full Truck Load': ftl_updateInvoiceNumbers
    };

    const updateFn = updateMap[invoiceType];
    if (updateFn) {
        try {
            await updateFn(invoiceNo);
        } catch (error) {
            console.error('Error updating linked bookings:', error);
        }
    }
}

function finalizeInvoice(saveBtn) {
    disableForm();

    // Disable all delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
    });

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Updated';

    document.getElementById('modifyButton').disabled = false;
    document.getElementById('reportButton').disabled = false;
    document.getElementById('fetchPendingInvoices').disabled = true;
}

// =========================================================
// UPDATE TOTALS - OPTIMIZED
// =========================================================
function updateTotals(totals) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    };

    setValue('totalFreight', totals.totalFreight || 0);
    setValue('totalFSCAmt', totals.totalFSCAmt || 0);
    setValue('totalOtherAmt', totals.totalOtherAmt || 0);
    setValue('totalSGST', totals.totalSGST || 0);
    setValue('totalCGST', totals.totalCGST || 0);
    setValue('totalIGST', totals.totalIGST || 0);
    setValue('totalGST', totals.totalGST || 0);
    setValue('totalGrand', Math.round(totals.totalGrand || 0));

    // Update invoiceData
    invoiceManager.setInvoiceData({
        BasicAmount: totals.totalFreight || 0,
        OtherAmount: (totals.totalFSCAmt || 0) + (totals.totalOtherAmt || 0),
        CGSTAmount: totals.totalCGST || 0,
        SGSTAmount: totals.totalSGST || 0,
        IGSTAmount: totals.totalIGST || 0,
        TotalGSTAmount: totals.totalGST || 0,
        GrandTotalAmount: Math.round(totals.totalGrand || 0)
    });
}

// =========================================================
// RENDER CHARGES TABLE - OPTIMIZED
// =========================================================
function renderChargesTable(chargesMap) {
    const tbody = document.querySelector('#pendingShipmentCharges tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const chargeOrder = ['Freight Amount', 'Custom Clearance Charges', 'Duty'];
    const sortedEntries = Object.entries(chargesMap).sort(([a], [b]) => {
        const indexA = chargeOrder.indexOf(a);
        const indexB = chargeOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    let totals = { TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0, IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0 };

    sortedEntries.forEach(([type, amounts]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${type}</td>
            <td class="text-end">${formatAmount(amounts.TotalAmount)}</td>
            <td class="text-end">${formatAmount(amounts.SGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.CGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.IGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.TotalGSTAmt)}</td>
            <td class="text-end">${formatAmount(amounts.GrandTotalAmt)}</td>
        `;
        tbody.appendChild(row);

        Object.keys(totals).forEach(key => {
            totals[key] += amounts[key] || 0;
        });
    });

    // Update footer totals
    document.getElementById('totalFreightAmt').textContent = formatAmount(totals.TotalAmount);
    document.getElementById('totalSGSTAmt').textContent = formatAmount(totals.SGSTAmt);
    document.getElementById('totalCGSTAmt').textContent = formatAmount(totals.CGSTAmt);
    document.getElementById('totalIGSTAmt').textContent = formatAmount(totals.IGSTAmt);
    document.getElementById('totalGSTAmt').textContent = formatAmount(totals.TotalGSTAmt);
    document.getElementById('totalGrandAmt').textContent = formatAmount(Math.round(totals.GrandTotalAmt));
}

// =========================================================
// GET INVOICE DETAILS - OPTIMIZED
// =========================================================
async function getInvoiceDetails(invoiceNo) {
    if (!invoiceNo) return null;

    showSpinner();
    try {
        const { data, error } = await supabaseClient
            .from('InvoiceDetails')
            .select('*')
            .eq('InvoiceNo', invoiceNo)
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            showToast('Invoice not found');
            return null;
        }

        return data;
    } catch (err) {
        console.error('Error fetching invoice details:', err.message);
        alert('Error loading invoice: ' + err.message);
        return null;
    } finally {
        hideSpinner();
    }
}

// =========================================================
// FIX: MOVEMENT TYPE CHANGE - CHECK FLAG
// =========================================================
document.getElementById('movementType')?.addEventListener('change', async (e) => {
    // Skip if we're loading from URL
    if (isLoadingInvoice) return;

    const movementType = e.target.value.trim();
    const tableMap = {
        'Forwarding': d_createPendingShipmentTableHeaderAndFooter_ib,
        'Import': d_createPendingShipmentTableHeaderAndFooter_ib,
        'Export': d_createPendingShipmentTableHeaderAndFooter_ib,
        'Customs Clearance': createPendingShipmentTableHeaderAndFooter,
        'Domestic': d_createPendingShipmentTableHeaderAndFooter_ib,
        'Full Truck Load': FTL_FCL_createPendingShipmentTableHeaderAndFooter
    };

    const createTableFn = tableMap[movementType];
    if (createTableFn) {
        try {
            // Clear table before creating new one
            clearPendingShipmentTable();
            await createTableFn();
        } catch (error) {
            console.error('Error creating table:', error);
        }
    } else {
        console.warn('Unknown movement type:', movementType);
    }
});

// =========================================================
// FIX: LOAD INVOICE - PREVENT DUPLICATE TABLE LOADING
// =========================================================
document.getElementById("invoiceNo")?.addEventListener("change", async (e) => {
    // Skip if we're loading from URL
    if (isLoadingInvoice) return;
    await loadInvoice(e.target.value);
});

async function loadInvoice(invoiceNo) {
    if (!invoiceNo || !invoiceNo.trim()) return;

    invoiceNo = invoiceNo.trim();
    const invoiceDetails = await getInvoiceDetails(invoiceNo);
    if (!invoiceDetails) {
        alert("Invoice not found.");
        return;
    }

    // Populate form
    populateInvoiceForm(invoiceDetails);

    // Get party details
    const partyData = await getPartyDetailsByCode(invoiceDetails.PartyCode);
    if (partyData) {
        document.getElementById("partyName").value = partyData.PartyName || "";
    } else {
        alert("Party not found.");
    }

    // Check payment status
    const paymentInfo = await paymentDetails(invoiceNo);
    document.getElementById("modifyButton").disabled = paymentInfo.rows?.length > 0;

    // Disable controls
    disableForm();
    document.getElementById('saveButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = false;
    document.getElementById('fetchPendingInvoices').disabled = true;

    // FIX: Load linked bookings - prevent duplicate table creation
    // First, set the movement type without triggering the change event
    const movementTypeSelect = document.getElementById('movementType');
    if (movementTypeSelect && invoiceDetails.InvoiceType) {
        movementTypeSelect.value = invoiceDetails.InvoiceType;
        // Manually create table without triggering event
        const tableMap = {
            'Forwarding': d_createPendingShipmentTableHeaderAndFooter_ib,
            'Import': d_createPendingShipmentTableHeaderAndFooter_ib,
            'Export': d_createPendingShipmentTableHeaderAndFooter_ib,
            'Customs Clearance': createPendingShipmentTableHeaderAndFooter,
            'Domestic': d_createPendingShipmentTableHeaderAndFooter_ib,
            'Full Truck Load': FTL_FCL_createPendingShipmentTableHeaderAndFooter
        };
        const createTableFn = tableMap[invoiceDetails.InvoiceType];
        if (createTableFn) {
            try {
                clearPendingShipmentTable();
                await createTableFn();
            } catch (error) {
                console.error('Error creating table:', error);
            }
        }
    }

    // Load the actual data
    await loadLinkedBookings(invoiceDetails.InvoiceType, invoiceNo);

    // Disable delete buttons
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.disabled = true;
    });
}

function populateInvoiceForm(invoiceDetails) {
    console.log('invoiceDetails.BankID', invoiceDetails.BankID);
    document.getElementById("invoiceNo").value = invoiceDetails.InvoiceNo || "";
    document.getElementById("partyCode").value = invoiceDetails.PartyCode || "";
    document.getElementById("invoiceDate").value = invoiceDetails.InvoiceDate || "";
    document.getElementById("invoiceAddress").value = invoiceDetails.InvoiceAddress || "";
    document.getElementById("movementType").value = invoiceDetails.InvoiceType || "";
    document.getElementById("bankIDs").value = invoiceDetails.BankID || "";
    document.getElementById("inputBankName").value = getBankNameByCode(invoiceDetails.BankID) || "";
    document.getElementById("invoiceInformation").value = invoiceDetails.Remarks || "";
    document.getElementById("tempFormID").value = invoiceDetails.id || "";
}

// =========================================================
// FIX: LOAD LINKED BOOKINGS - CLEAR TABLE FIRST
// =========================================================
async function loadLinkedBookings(invoiceType, invoiceNo) {
    const config = INVOICE_TYPE_MAP[invoiceType];
    if (!config) {
        console.warn('Unknown Invoice Type:', invoiceType);
        return;
    }

    // Clear existing table rows before loading new data
    clearPendingShipmentTable();

    const loadFn = window[config.loadFn];
    if (loadFn) {
        try {
            await loadFn(invoiceNo);
        } catch (error) {
            console.error('Error loading linked bookings:', error);
        }
    }
}

// =========================================================
// FIX: ADD SHIPMENT - CHECK FOR DUPLICATES
// =========================================================
document.getElementById('addShipmentNo')?.addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipmentNo')?.value?.trim();
    const invoiceNo = document.getElementById('invoiceNo')?.value?.trim();
    const movementType = document.getElementById('movementType')?.value?.trim();

    if (!shipmentNo) {
        alert('Please enter/select a Shipment Number.');
        return;
    }

    if (!invoiceNo) {
        alert('Please save the invoice first before adding shipments.');
        return;
    }

    // Check if shipment already exists in table
    const table = document.getElementById('pendingShipmentTable');
    if (table?.tBodies?.[0]) {
        const existingRows = table.tBodies[0].querySelectorAll('tr');
        for (const row of existingRows) {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                // Assuming shipment number is in the second column (index 1)
                const existingShipment = cells[1]?.textContent?.trim();
                if (existingShipment === shipmentNo) {
                    alert(`Shipment ${shipmentNo} is already added to this invoice.`);
                    return;
                }
            }
        }
    }

    showSpinner();

    const addMap = {
        'Forwarding': addSingleShipmentToInvoice,
        'Import': addSingleShipmentToInvoice,
        'Export': addSingleShipmentToInvoice,
        'Customs Clearance': addSingleShipmentToInvoice_cc,
        'Domestic': d_addSingleShipmentToInvoice,
        'Full Truck Load': ftl_addSingleShipmentToInvoice
    };

    const addFn = addMap[movementType];
    if (addFn) {
        try {
            await addFn(shipmentNo, invoiceNo);
            // showToast('Shipment added successfully 3');
        } catch (error) {
            console.error('Error adding shipment:', error);
            alert('Failed to add shipment: ' + error.message);
        }
    } else {
        console.warn('Unknown movement type:', movementType);
        alert('Unknown movement type. Please select a valid type.');
    }

    hideSpinner();
});

// =========================================================
// MODIFY BUTTON - OPTIMIZED
// =========================================================
document.getElementById('modifyButton')?.addEventListener('click', () => {
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
        saveBtn.dataset.mode = 'update';
    }

    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('invoiceNo').disabled = true;
    document.getElementById('movementType').disabled = false;
    document.getElementById('partyName').disabled = false;
    document.getElementById('fetchPendingInvoices').disabled = false;
    document.getElementById('addShipmentNo').disabled = false;

    enableForm();

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.disabled = false;
    });
});

// =========================================================
// REPORT BUTTON - OPTIMIZED
// =========================================================
document.getElementById('reportButton')?.addEventListener('click', async function () {
    const originalText = this.innerHTML;
    const invoiceNo = document.getElementById('invoiceNo')?.value?.trim();

    if (!invoiceNo) {
        alert('Please enter/select an Invoice Number.');
        return;
    }

    try {
        this.disabled = true;
        this.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Processing...
        `;

        const invoiceDetails = await getInvoiceDetails(invoiceNo);
        if (!invoiceDetails) return;

        const reportType = document.getElementById('reportType')?.value || 'Main';
        const reportMap = {
            'Forwarding': generate_International_InvoicePDF_Main,
            'Import': generate_International_InvoicePDF_Main,
            'Export': generate_International_InvoicePDF_Main,
            'Customs Clearance': generate_Clear_InvoicePDF_Main,
            'Domestic': generate_DomesticReports_InvoicePDF,
            'Full Truck Load': generate_FullTruckReports_InvoicePDF
        };

        const reportFn = reportMap[invoiceDetails.InvoiceType];
        if (reportFn) {
            if (FORWARDING_TYPES.includes(invoiceDetails.InvoiceType)) {
                if (reportType === 'Main') {
                    await generate_International_InvoicePDF_Main(invoiceDetails);
                } else if (reportType === 'Print Annexure') {
                    await generate_International_InvoicePDF_Annexure(invoiceDetails);
                }
            } else {
                await reportFn(invoiceDetails);
            }
        } else {
            console.warn('Unknown movement type:', invoiceDetails.InvoiceType);
            alert('Report generation not available for this invoice type.');
        }
    } catch (error) {
        console.error('Report generation failed:', error);
        alert('Failed to generate report: ' + error.message);
    } finally {
        this.disabled = false;
        this.innerHTML = originalText;
    }
});

// =========================================================
// ADDRESS SELECTION MODAL - OPTIMIZED
// =========================================================
function showAddressSelectionModal(addresses) {
    const container = document.getElementById('addressListContainer');
    const modalEl = document.getElementById('addressSelectionModal');
    const invoiceAddressInput = document.getElementById('invoiceAddress');

    if (!container || !modalEl) return;

    container.innerHTML = '';

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    modalEl.addEventListener('hide.bs.modal', function () {
        if (modalEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }, { once: true });

    modalEl.addEventListener('hidden.bs.modal', function () {
        invoiceAddressInput?.focus();
    }, { once: true });

    addresses.forEach((address) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-primary w-100 mb-2 text-start';
        button.textContent = formatAddress(address);

        button.addEventListener('click', () => {
            if (invoiceAddressInput) {
                invoiceAddressInput.value = formatAddress(address);
            }
            button.blur();
            modal.hide();
        });

        container.appendChild(button);
    });

    modal.show();
}

// =========================================================
// UNLOCK ON EXIT - OPTIMIZED
// =========================================================
window.addEventListener('beforeunload', async () => {
    try {
        await Promise.all([
            autoUnlockRecords("FullLoadBookingDetails"),
            autoUnlockRecords("international_booking"),
            unlockBooking_ib(UserLoginID),
            unlockBooking_cc(UserLoginID),
            d_unlockBooking_db(UserLoginID),
            ftl_unlockBooking(UserLoginID)
        ]);
    } catch (e) {
        console.error('Unlock failed:', e);
    }
});

// =========================================================
// FIX: NEW INVOICE - RESET TABLE
// =========================================================
document.getElementById('newButton')?.addEventListener('click', newInvoice);

async function newInvoice() {
    try {
        // Unlock previous records
        await Promise.all([
            autoUnlockRecords("FullLoadBookingDetails"),
            autoUnlockRecords("international_booking"),
            unlockBooking_ib(UserLoginID),
            unlockBooking_cc(UserLoginID),
            d_unlockBooking_db(UserLoginID),
            ftl_unlockBooking(UserLoginID)
        ]);

        // Reset form and state
        const form = document.getElementById('container');
        if (form) form.reset();

        // Reset UI elements
        const elementsToReset = [
            'invoiceNo', 'partyName', 'partyCode', 'invoiceAddress',
            'movementType', 'transitType', 'department', 'modeType',
            'shipmentNo', 'reportType'
        ];
        elementsToReset.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Set default date
        const invoiceDate = document.getElementById('invoiceDate');
        if (invoiceDate) {
            invoiceDate.value = new Date().toISOString().split('T')[0];
        }

        // Reset buttons
        const saveBtn = document.getElementById('saveButton');
        if (saveBtn) {
            saveBtn.dataset.mode = 'insert';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        }

        document.getElementById('modifyButton').disabled = true;
        document.getElementById('deleteButton').disabled = true;
        document.getElementById('reportButton').disabled = true;
        document.getElementById('fetchPendingInvoices').disabled = false;
        document.getElementById('addShipmentNo').disabled = true;
        document.getElementById('newButton').disabled = false;

        // Reset state
        invoiceManager.reset();

        // Clear tables
        clearPendingShipmentTable();
        clearChargesTable();
        clearInvoiceTotals();

        // Load suggestions
        await loadInvoiceNoSuggestions();

        // Enable form and focus
        enableForm();
        document.getElementById('partyName')?.focus();

        // =========================================================
        // FIX: CLEAR URL PARAMETERS WHEN CREATING NEW INVOICE
        // =========================================================
        // Remove the invoiceNo parameter from URL without page reload
        const url = new URL(window.location.href);
        if (url.searchParams.has('invoiceNo')) {
            url.searchParams.delete('invoiceNo');
            // Update the browser's URL without reloading the page
            window.history.replaceState({}, document.title, url.toString());
        }
        document.getElementById('invoiceNo').disabled = false;

        showToast('🚀 New Invoice Ready');

    } catch (e) {
        console.error('New invoice error:', e);
        showToast('Error creating new invoice: ' + e.message);
    }
}

// =========================================================
// TABLE CREATION WRAPPER - PREVENT DUPLICATES
// =========================================================
function createTableWithCleanup(createFn) {
    return async function () {
        // Clear existing rows before creating new table
        clearPendingShipmentTable();
        // Call the original creation function
        if (typeof createFn === 'function') {
            await createFn();
        }
    };
}

// Apply the fix to existing table creation functions
// Override the global functions with wrapped versions
if (typeof d_createPendingShipmentTableHeaderAndFooter_ib === 'function') {
    const originalFn = d_createPendingShipmentTableHeaderAndFooter_ib;
    d_createPendingShipmentTableHeaderAndFooter_ib = createTableWithCleanup(originalFn);
}

if (typeof createPendingShipmentTableHeaderAndFooter === 'function') {
    const originalFn = createPendingShipmentTableHeaderAndFooter;
    createPendingShipmentTableHeaderAndFooter = createTableWithCleanup(originalFn);
}

if (typeof FTL_FCL_createPendingShipmentTableHeaderAndFooter === 'function') {
    const originalFn = FTL_FCL_createPendingShipmentTableHeaderAndFooter;
    FTL_FCL_createPendingShipmentTableHeaderAndFooter = createTableWithCleanup(originalFn);
}

// =========================================================
// DELETE BUTTON HANDLER - OPTIMIZED
// =========================================================
document.getElementById('deleteButton')?.addEventListener('click', async function () {
    const invoiceNo = document.getElementById('invoiceNo')?.value?.trim();

    if (!invoiceNo) {
        alert('No invoice to delete.');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete invoice ${invoiceNo}?`);
    if (!confirmed) return;

    try {
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Deleting...';

        const { error } = await supabaseClient
            .from('InvoiceDetails')
            .delete()
            .eq('InvoiceNo', invoiceNo)
            .eq('company_id', CompanyID);

        if (error) throw error;

        showToast('Invoice deleted successfully');
        await newInvoice();

    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete invoice: ' + error.message);
    } finally {
        this.disabled = false;
        this.innerHTML = '<i class="bi bi-trash"></i> Delete';
    }
});

// =========================================================
// EXPOSE FOR LEGACY COMPATIBILITY
// =========================================================
window.invoiceData = invoiceManager.getInvoiceData();
window.invoiceChargesData = invoiceManager.invoiceChargesData;
window.bankID = invoiceManager.getBankID();
window.invoiceManager = invoiceManager;
window.isLoadingInvoice = isLoadingInvoice;
window.clearPendingShipmentTable = clearPendingShipmentTable;