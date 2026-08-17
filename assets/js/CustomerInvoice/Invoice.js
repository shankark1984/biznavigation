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
}

const invoiceManager = new InvoiceManager();

// =========================================================
// DOM READY - OPTIMIZED
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadSuggestions('partySuggestions', 'PartyDetails', CompanyID),
        loadBankNameSuggestions(),
        loadDefaultBank(),
        // loadInvoiceNoSuggestions(),
        loadDatalist('departmentList', 'Department')
    ]);

    setupBankSelection();
    setupInvoiceFromURL();
});

function setupBankSelection() {
    const bankInput = document.getElementById('inputBankName');
    const bankIDInput = document.getElementById('bankIDs');

    bankInput?.addEventListener('input', function () {
        const selectedValue = this.value.trim();
        if (bankMap?.[selectedValue]) {
            invoiceManager.bankID = bankMap[selectedValue];
            bankIDInput.value = invoiceManager.bankID;
        } else {
            invoiceManager.bankID = null;
            bankIDInput.value = '';
        }
    });
}

async function setupInvoiceFromURL() {
    const params = new URLSearchParams(window.location.search);
    const invoiceNo = params.get("invoiceNo");

    if (invoiceNo) {
        const invoiceInput = document.getElementById("invoiceNo");
        invoiceInput.value = invoiceNo;
        invoiceInput.dispatchEvent(new Event("change"));
        await loadInvoice(invoiceNo);
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

        data.length === 1
            ? fillInvoiceAddress(data[0])
            : showAddressSelectionModal(data);

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
    return `${a.Address}, ${a.City}, ${a.PinCode}, ${a.State}, ${a.Country}`;
}

// =========================================================
// INVOICE NUMBER GENERATION - OPTIMIZED
// =========================================================
async function generateInvoiceNumber(invoiceDateValue) {
    if (!invoiceDateValue) return '';

    try {
        const [companyResult, lastResult] = await Promise.all([
            supabaseClient
                .from('company_profile')
                .select('short_code')
                .eq('company_id', CompanyID)
                .maybeSingle(),
            supabaseClient
                .from('InvoiceDetails')
                .select('InvoiceNo')
                .like('InvoiceNo', `${companyResult?.data?.short_code || ''}/${getFinancialYear(invoiceDateValue)}/%`)
                .eq('company_id', CompanyID)
                .order('InvoiceNo', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        if (companyResult.error) throw companyResult.error;
        if (!companyResult.data) return '';

        const shortCode = companyResult.data.short_code;
        const fy = getFinancialYear(invoiceDateValue);
        const lastInvoice = lastResult.data;
        const nextNumber = lastInvoice ? parseInt(lastInvoice.InvoiceNo.split('/').pop()) + 1 : 1;

        return `${shortCode}/${fy}/${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        return '';
    }
}

function getFinancialYear(dateStr) {
    const d = new Date(dateStr);
    const startYear = d.getMonth() >= 3 ? d.getFullYear() % 100 : (d.getFullYear() - 1) % 100;
    const endYear = (startYear + 1) % 100;
    return `${startYear.toString().padStart(2, '0')}-${endYear.toString().padStart(2, '0')}`;
}

// =========================================================
// FETCH PENDING INVOICES - OPTIMIZED
// =========================================================
document.getElementById('fetchPendingInvoices')?.addEventListener('click', async () => {
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
            await action();
        } catch (e) {
            console.error('Error fetching invoices:', e);
            alert('Failed to fetch invoices');
        }
    } else {
        alert('Select valid Movement Type');
    }
});

// =========================================================
// SAVE INVOICE - OPTIMIZED WITH FIXED TOTALS
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
    } finally {
        // Only restore if not successfully saved
        if (!this.disabled) {
            this.disabled = false;
            this.innerHTML = originalText;
        }
    }
});

async function saveInvoice(saveBtn) {
    const invoiceData = collectInvoiceData(saveBtn.dataset.mode === 'insert');

    if (!invoiceData) return;

    const isInsert = saveBtn.dataset.mode === 'insert';
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
        await updateLinkedBookings(invoiceData.InvoiceType, invoiceNo);
        finalizeInvoice(saveBtn);

    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
}

function collectInvoiceData(isInsert) {
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
        invoiceNo = generateInvoiceNumber(invoiceDate);
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
        await updateFn(invoiceNo);
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
// NEW INVOICE - OPTIMIZED
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
        document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];

        // Reset buttons
        const saveBtn = document.getElementById('saveButton');
        saveBtn.dataset.mode = 'insert';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';

        document.getElementById('modifyButton').disabled = true;
        document.getElementById('deleteButton').disabled = true;
        document.getElementById('reportButton').disabled = true;
        document.getElementById('fetchPendingInvoices').disabled = false;
        document.getElementById('addShipmentNo').disabled = true;
        document.getElementById('newButton').disabled = false;

        // Reset state
        invoiceManager.reset();
        bankID = null;

        // Clear tables
        const table = document.getElementById('pendingShipmentTable');
        if (table?.tBodies?.[0]) {
            table.tBodies[0].innerHTML = '';
        }

        clearInvoiceTotals();
        clearChargesTable();

        // Load suggestions
        await loadInvoiceNoSuggestions();

        // Enable form and focus
        enableForm();
        document.getElementById('partyName').focus();
        showToast('🚀 New Invoice Ready');

    } catch (e) {
        console.error('New invoice error:', e);
        showToast('Error creating new invoice');
    }
}

// =========================================================
// CLEAR FUNCTIONS - OPTIMIZED
// =========================================================
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
// UPDATE TOTALS - OPTIMIZED
// =========================================================
function updateTotals(totals) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    };

    setValue('totalFreight', totals.totalFreight);
    setValue('totalFSCAmt', totals.totalFSCAmt);
    setValue('totalOtherAmt', totals.totalOtherAmt);
    setValue('totalSGST', totals.totalSGST);
    setValue('totalCGST', totals.totalCGST);
    setValue('totalIGST', totals.totalIGST);
    setValue('totalGST', totals.totalGST);
    setValue('totalGrand', Math.round(totals.totalGrand));

    // Update invoiceData
    invoiceManager.setInvoiceData({
        BasicAmount: formatAmount(totals.totalFreight) || 0,
        OtherAmount: (formatAmount(totals.totalFSCAmt) || 0) + (formatAmount(totals.totalOtherAmt) || 0),
        CGSTAmount: formatAmount(totals.totalCGST) || 0,
        SGSTAmount: formatAmount(totals.totalSGST) || 0,
        IGSTAmount: formatAmount(totals.totalIGST) || 0,
        TotalGSTAmount: formatAmount(totals.totalGST) || 0,
        GrandTotalAmount: formatAmount(Math.round(totals.totalGrand)) || 0
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
// MOVEMENT TYPE CHANGE - OPTIMIZED
// =========================================================
document.getElementById('movementType')?.addEventListener('change', async (e) => {
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
        await createTableFn();
    } else {
        console.warn('Unknown movement type:', movementType);
    }
});

// =========================================================
// LOAD INVOICE - OPTIMIZED
// =========================================================
document.getElementById("invoiceNo")?.addEventListener("change", async (e) => {
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

    // Load linked bookings
    await loadLinkedBookings(invoiceDetails.InvoiceType, invoiceNo);

    // Disable delete buttons
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.disabled = true;
    });
}

function populateInvoiceForm(invoiceDetails) {
    document.getElementById("invoiceNo").value = invoiceDetails.InvoiceNo || "";
    document.getElementById("partyCode").value = invoiceDetails.PartyCode || "";
    document.getElementById("invoiceDate").value = invoiceDetails.InvoiceDate || "";
    document.getElementById("invoiceAddress").value = invoiceDetails.InvoiceAddress || "";
    document.getElementById("movementType").value = invoiceDetails.InvoiceType || "";
    document.getElementById("bankIDs").value = getBankNameByCode(invoiceDetails.BankID) || "";
    document.getElementById("inputBankName").value = invoiceDetails.id || "";
    document.getElementById("invoiceInformation").value = invoiceDetails.Remarks || "";
    document.getElementById("tempFormID").value = invoiceDetails.id || "";
}

async function loadLinkedBookings(invoiceType, invoiceNo) {
    const config = INVOICE_TYPE_MAP[invoiceType];
    if (!config) {
        console.warn('Unknown Invoice Type:', invoiceType);
        return;
    }

    const createTableFn = window[config.createTableFn];
    const loadFn = window[config.loadFn];

    if (createTableFn) await createTableFn();
    if (loadFn) await loadFn(invoiceNo);
}

// =========================================================
// ADD SHIPMENT - OPTIMIZED
// =========================================================
document.getElementById('addShipmentNo')?.addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipmentNo')?.value?.trim();
    const invoiceNo = document.getElementById('invoiceNo')?.value?.trim();
    const movementType = document.getElementById('movementType')?.value?.trim();
    const spinner = document.getElementById('saveSpinner');

    if (!shipmentNo) {
        alert('Please enter/select a Shipment Number.');
        return;
    }

    if (spinner) spinner.classList.remove('d-none');

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
        } catch (error) {
            console.error('Error adding shipment:', error);
            alert('Failed to add shipment');
        }
    } else {
        console.warn('Unknown movement type:', movementType);
    }

    hideSpinner();
});

// =========================================================
// MODIFY BUTTON - OPTIMIZED
// =========================================================
document.getElementById('modifyButton')?.addEventListener('click', () => {
    const saveBtn = document.getElementById('saveButton');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
    saveBtn.dataset.mode = 'update';

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
        }
    } catch (error) {
        console.error('Report generation failed:', error);
        alert('Failed to generate report.');
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
        button.className = 'btn btn-outline-primary w-100 mb-2';
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
    // Implement toast notification
    alert(message); // Replace with proper toast implementation
}

// =========================================================
// EXPOSE FOR LEGACY COMPATIBILITY
// =========================================================
window.invoiceData = invoiceManager.getInvoiceData();
window.invoiceChargesData = invoiceManager.invoiceChargesData;
window.bankID = invoiceManager.bankID;