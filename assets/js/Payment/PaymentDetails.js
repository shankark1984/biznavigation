// DOM Cache
const $ = id => document.getElementById(id);
const paymentFormElements = {
    paymentID: $("paymentID"),
    partyCode: $("partyCode"),
    partyName: $("partyName"),
    receiptOn: $("receiptOn"),
    transactionType: $("transactionType"),
    paymentMode: $("paymentMode"),
    inputBankName: $("inputBankName"),
    referenceNo: $("referenceNo"),
    information: $("information"),
    paymentAmount: $("paymentAmount"),
    deductionAmount: $("deductionAmount"),
    totalAllocatedAmount: $("totalAllocatedAmount"),
    totalOtherDeductionAmount: $("totalOtherDeductionAmount"),
    totalTDSDeductionAmount: $("totalTDSDeductionAmount"),
    rowCounter: $("rowCounter"),
    unallocatedAmount: $("unallocatedAmount"), // if exists in DOM
    undeductedAmount: $("undeductedAmount"), // if exists in DOM
    paymentIDSuggestions: $("paymentIDSuggestions"), // if exists in DOM
};
// ========== Utility Functions ==========

/**
 * Debounce helper
 */
function debounce(fn, delay = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Get form data as key-value pairs
 */
async function getFormData() {
    return {
        PartyCode: paymentFormElements.partyCode.value.trim(),
        SuspenseAmount: parseFloat(paymentFormElements.suspenseAmount?.value || 0) || 0,
        ReceiptOn: paymentFormElements.receiptOn.value.trim(),
        TransactionType: paymentFormElements.transactionType.value.trim(),
        PaymentMode: paymentFormElements.paymentMode.value.trim(),
        BankName: paymentFormElements.inputBankName.value.trim(),
        ReferenceNo: paymentFormElements.referenceNo.value.trim(),
        Narration: paymentFormElements.information.value.trim(),
        PaymentAmount: parseFloat(paymentFormElements.paymentAmount.value) || 0,
        DeductionAmount: parseFloat(paymentFormElements.deductionAmount.value) || 0,
    };
}

/**
 * Validate essential form fields (stop save if missing)
 */
async function validateFormData(formData) {
    if (!formData.PartyCode || !formData.ReceiptOn || !formData.PaymentMode) {
        alert("Please fill in all required fields.");
        return false;
    }
    updateTotals();
    return true;
}

/**
 * Show notification if provided
 */
function showNotification(message) {
    // Optionally implement or integrate with a toast/snackbar system.
    if (message) alert(message);
}

/**
 * Returns number safely, defaulting to 0
 */
function safeNumber(value) {
    return parseFloat(value || 0);
}

/**
 * Disable all form fields
 */
async function disableForm() {
    document.querySelectorAll('.form-control').forEach(el => el.disabled = true);
    document.querySelectorAll('.delete-btn').forEach(btn => btn.disabled = true);
}

// ========== Main UI Logic ==========

/**
 * Resets the payment form state
 */
async function resetForm() {
    // Clear form values except paymentID which should be editable
    Object.values(paymentFormElements).forEach(el => {
        if (!el) return;
        if ('value' in el) el.value = '';
        if (el.classList.contains('form-control')) el.disabled = false;
    });

    // Retrieve transactionType from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');

    if (type === 'Credit' || type === 'Debit') {
        paymentFormElements.transactionType.value = type;
        paymentFormElements.transactionType.disabled = true;
        pageTitle.textContent = `Payment Details - ${type}`;
    } else {
        paymentFormElements.transactionType.value = '';
        paymentFormElements.transactionType.disabled = false;
        pageTitle.textContent = 'Payment Details';
    }

    paymentFormElements.paymentID.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;

    // Initialize default rows, etc.
    updateTotals();
}

/**
 * Enables the form for modification
 */
function enableFormForModification() {
    document.querySelectorAll('.form-control').forEach(input => input.disabled = false);
    paymentFormElements.paymentID.disabled = true;
    saveButton.disabled = false;
    modifyButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    loadBankNameSuggestions();
    document.querySelectorAll('.delete-btn').forEach(btn => btn.disabled = false);
}

/**
 * Initialize event listeners
 */
function setupEventListeners() {
    paymentFormElements.paymentID.addEventListener('input', debounce(() => loadPaymentIDSuggestions(CompanyID)));
    paymentFormElements.paymentID.addEventListener('change', fetchPaymentDetails);
}

newButton.addEventListener('click', resetForm);
modifyButton.addEventListener('click', enableFormForModification);
saveButton.addEventListener('click', savePaymentDetails);
paymentFormElements.partyName.addEventListener('change', handlePartyChange);


document.addEventListener('DOMContentLoaded', initializeForm);

// ========== Core Functions ==========

/**
 * Loads the form for first use or reset, initializes suggestions
 */
async function initializeForm() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionType = urlParams.get("type");
        if (transactionType && (transactionType === "Credit" || transactionType === "Debit")) {
            pageTitle.textContent = `Payment Details - ${transactionType}`;
            paymentFormElements.transactionType.value = transactionType;
            paymentFormElements.transactionType.disabled = true;
        }
        await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
        paymentFormElements.paymentID.addEventListener("input", () => {
            loadPaymentIDSuggestions(CompanyID);
        });
        await loadBankNameSuggestions();
        setupEventListeners();
    } catch (e) {
        console.error('Error initializing form:', e);
        alert("An unexpected error occurred while loading the form.");
    }
}


/**
 * Get a new Payment ID or returns the current if update.
 */
async function generatePaymentID(companyID) {
    const { data, error } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID')
        .eq('company_id', companyID)
        .order('PaymentID', { ascending: false })
        .limit(1);
    if (error) throw error;
    if (!data.length) return `${companyID}_P001`;
    return `${companyID}_P${String(parseInt(data[0].PaymentID.split('_P')[1] || 0) + 1).padStart(3, '0')}`;
}

async function savePaymentDetails() {
    const isUpdate = /update/i.test(saveButton.textContent);
    const paymentID = isUpdate
        ? paymentFormElements.paymentID.value.trim()
        : await generatePaymentID(CompanyID);

    const formData = getFormData();
    if (!validateFormData(formData)) return;

    let totalAllocated = 0, totalOtherDeduction = 0, totalTDSDeduction = 0;
    for (const row of document.querySelectorAll("#paymentAllocationBody tr")) {
        totalAllocated += safeNumber(row.querySelector('.allocatedAmount')?.value);
        totalOtherDeduction += safeNumber(row.querySelector('.otherDeductionAmount')?.value);
        totalTDSDeduction += safeNumber(row.querySelector('.tdsDeductionAmount')?.value);
    }

    const allocatedAmount = totalAllocated + totalOtherDeduction + totalTDSDeduction;
    const paymentAmount = safeNumber(formData.PaymentAmount) + safeNumber(formData.DeductionAmount);

    if (allocatedAmount > paymentAmount) {
        alert("Payment collected can't be more than Allocated Amount.");
        return;
    }

    formData.SuspenseAmount = allocatedAmount < paymentAmount ? (paymentAmount - allocatedAmount) : 0;

    try {
        if (isUpdate) {
            await updatePaymentDetails(paymentID, formData);
        } else {
            paymentFormElements.paymentID.value = paymentID;
            await createPaymentDetails(paymentID, formData);
        }
        await handlePaymentAllocations(paymentID);
        handlePostSaveActions(isUpdate);
    } catch (e) {
        console.error("Error saving payment details:", e);
        alert("Failed to process payment details.");
    }
}

/**
 * Create (insert) payment record
 */
async function createPaymentDetails(paymentID, formData) {
    await supabaseClient.from('PaymentDetails').insert([{
        ...formData,
        PaymentID: paymentID,
        company_id: CompanyID,
        created_by: UserLoginID,
        created_at: localtimeStamp,
    }]);
    alert("Payment details saved!");
}

/**
 * Update payment record
 */
async function updatePaymentDetails(paymentID, formData) {
    await supabaseClient.from('PaymentDetails')
        .update({
            ...formData,
            update_by: UserLoginID,
            update_at: localtimeStamp
        })
        .eq('PaymentID', paymentID)
        .eq('company_id', CompanyID);
    alert("Payment details updated!");
}

/**
 * Save Payment Allocations line items
 */
async function handlePaymentAllocations(paymentID) {
    await supabaseClient.from('PaymentLineItems').delete().eq('PaymentID', paymentID);
    const allocations = getAllocationData(paymentID);
    if (allocations.length > 0) {
        const { error } = await supabaseClient.from('PaymentLineItems').insert(allocations);
        if (error) throw error;
    }
}

/**
 * Build array of payment allocation line items
 */
function getAllocationData(paymentID) {
    return Array.from(document.querySelectorAll('#paymentAllocationBody tr'))
        .map(row => {
            const invoiceNo = row.querySelector('.invoiceNoInput')?.value.trim();
            if (!invoiceNo) return null;
            return {
                PaymentID: paymentID,
                InvoiceNo: invoiceNo,
                PaymentAmount: safeNumber(row.querySelector('.allocatedAmount')?.value),
                OtherDeductionAmount: safeNumber(row.querySelector('.otherDeductionAmount')?.value),
                TDSDeductionAmount: safeNumber(row.querySelector('.tdsDeductionAmount')?.value),
                Narration: row.querySelector('.information')?.value.trim(),
                created_at: localtimeStamp,
                created_by: UserLoginID
            };
        }).filter(Boolean);
}

/**
 * Disable and configure buttons after save
 */
function handlePostSaveActions(isUpdate) {
    disableForm();
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;
    modifyButton.disabled = false;
}


function createAllocationRowHTML(uniqueID) {
    const classes = "form-control fs-7";
    const inputClass = "text-end";
    const paddingStyle = "padding-left: 3px; padding-right: 3px;"; // adjust px as needed

    return `
    <td style="${paddingStyle}">
      <input list="${uniqueID}" class="${classes} bg-light-input invoiceNoInput" autocomplete="off" placeholder="Search Invoice No...">
      <datalist id="${uniqueID}"></datalist>
    </td>
    <td style="${paddingStyle}"><input type="date" class="${classes} invoiceDate" readonly></td>
    <td style="${paddingStyle}"><input type="number" class="${classes} invoiceAmount ${inputClass}" readonly value="0.00" step="0.01" min="0"></td>
    <td style="${paddingStyle}"><input type="number" class="${classes} balanceAmount ${inputClass}" readonly value="0.00" step="0.01" min="0"></td>
    <td style="${paddingStyle}"><input type="number" class="${classes} allocatedAmount ${inputClass}" value="0.00" step="0.01" min="0"></td>
    <td style="${paddingStyle}"><input type="number" class="${classes} otherDeductionAmount ${inputClass}" value="0.00" step="0.01" min="0"></td>
    <td style="${paddingStyle}"><input type="number" class="${classes} tdsDeductionAmount ${inputClass}" value="0.00" step="0.01" min="0"></td>
    <td style="${paddingStyle}"><textarea class="${classes} information" rows="1"></textarea></td>
    <td style="${paddingStyle}" class="text-center">
      <button type="button" class="btn btn-sm btn-danger delete-btn">
        <i class="bi bi-trash-fill"></i>
      </button>
    </td>
  `;
}


function setupRowEventListeners(row, companyID, uniqueID) {
    row.querySelector('.delete-btn').addEventListener('click', () => {
        row.remove();
        updateRowCounter();
    });

    ['allocatedAmount', 'otherDeductionAmount', 'tdsDeductionAmount'].forEach(cls =>
        row.querySelector(`.${cls}`).addEventListener('input', updateTotals)
    );

    const invoiceInput = row.querySelector('.invoiceNoInput');
    const datalist = row.querySelector('datalist');
    const partyCode = paymentFormElements.partyCode.value;

    invoiceInput.addEventListener('input', debounce(() => {
        loadInvoiceSuggestions(companyID, invoiceInput.value.trim(), datalist, partyCode)
    }));

    invoiceInput.addEventListener('change', () => handleInvoiceChange(row, companyID, partyCode));
}

async function handleInvoiceChange(row, companyID, partyCode) {
    const selectedInvoiceNo = row.querySelector('.invoiceNoInput').value.trim();

    if (!selectedInvoiceNo) return;
    const { data } = await supabaseClient
        .from('InvoicePaymentView')
        .select('InvoiceDate, GrandTotalAmount, BalanceAmount')
        .eq('company_id', companyID)
        .eq('PartyCode', partyCode)
        .eq('InvoiceNo', selectedInvoiceNo)
        .gt('BalanceAmount', 0)
        .maybeSingle();
    if (data) {
        row.querySelector('.invoiceDate').value = data.InvoiceDate;
        row.querySelector('.invoiceAmount').value = data.GrandTotalAmount;
        row.querySelector('.balanceAmount').value = data.BalanceAmount;
    }
}

async function populateRowWithData(row, rowData, companyID) {
    const partyCode = paymentFormElements.partyCode.value.trim();
    row.querySelector('.invoiceNoInput').value = rowData.InvoiceNo || '';
    row.querySelector('.allocatedAmount').value = safeNumber(rowData.PaymentAmount).toFixed(2);
    row.querySelector('.otherDeductionAmount').value = safeNumber(rowData.OtherDeductionAmount).toFixed(2);
    row.querySelector('.tdsDeductionAmount').value = safeNumber(rowData.TDSDeductionAmount).toFixed(2);
    row.querySelector('.information').value = rowData.Narration || '';

    const { data: invoiceData } = await supabaseClient
        .from('InvoicePaymentView')
        .select('InvoiceDate, GrandTotalAmount, BalanceAmount')
        .eq('company_id', companyID)
        .eq('PartyCode', partyCode)
        .eq('InvoiceNo', rowData.InvoiceNo)
        .single();
    if (invoiceData) {
        row.querySelector('.invoiceDate').value = invoiceData.InvoiceDate;
        row.querySelector('.invoiceAmount').value = invoiceData.GrandTotalAmount;
        row.querySelector('.balanceAmount').value = invoiceData.BalanceAmount;
    }
    updateTotals();
}

// ========== Data Loading, Fetching, Suggestions ==========

async function fetchPaymentDetails(e) {
    const selectedPaymentID = e.target.value.trim();
    if (!selectedPaymentID) return;

    try {
        const { data, error } = await supabaseClient
            .from('PaymentDetails')
            .select('*')
            .eq('PaymentID', selectedPaymentID)
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (error || !data) {

            return;
        }

        // If data is valid, proceed normally
        await populateFormWithPaymentData(data);

        await handlePostFetchActions();

    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An unexpected error occurred. Please try again later.');
    }
}



async function populateFormWithPaymentData(data) {
    const partyData = await getPartyDetailsByCode(data.PartyCode);
    paymentFormElements.receiptOn.value = data.ReceiptOn || '';
    paymentFormElements.partyCode.value = data.PartyCode || '';
    paymentFormElements.partyName.value = partyData.PartyName || '';
    paymentFormElements.transactionType.value = data.TransactionType || '';
    paymentFormElements.paymentMode.value = data.PaymentMode || '';
    paymentFormElements.inputBankName.value = data.BankName || '';
    paymentFormElements.referenceNo.value = data.ReferenceNo || '';
    paymentFormElements.information.value = data.Narration || '';
    paymentFormElements.paymentAmount.value = safeNumber(data.PaymentAmount).toFixed(2);
    paymentFormElements.deductionAmount.value = safeNumber(data.DeductionAmount).toFixed(2);
}

async function handlePostFetchActions() {
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;
    paymentFormElements.paymentID.disabled = true;
    modifyButton.disabled = false;
    disableForm();
}

async function loadPaymentAllocations(paymentID) {
    paymentFormElements.paymentAllocationBody.innerHTML = '';
    const { data } = await supabaseClient.from('PaymentLineItems').select('*').eq('PaymentID', paymentID);
    if (!(data && data.length)) {
        updateRowCounter();
        return;
    }
    for (const item of data) await addPaymentAllocationRow(CompanyID, item);
    updateRowCounter();
}

// Payment/Invoice Suggestions

let lastPaymentIDRequestId = 0;

async function loadPaymentIDSuggestions(companyID) {
    const inputVal = paymentFormElements.paymentID.value.trim();
    const datalist = paymentFormElements.paymentIDSuggestions;
    const transactionType = paymentFormElements.transactionType.value.trim();

    datalist.innerHTML = '';
    if (!inputVal) return;

    const requestId = ++lastPaymentIDRequestId;

    const { data, error } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID')
        .ilike('PaymentID', `%${inputVal}%`)
        .eq('company_id', companyID)
        .eq('TransactionType', transactionType)
        .order('PaymentID', { ascending: true })
        .limit(10);

    // If this response is from an outdated request, do not update suggestions
    if (requestId !== lastPaymentIDRequestId) return;

    if (error) {
        console.error('Error loading PaymentID suggestions:', error);
        return;
    }

    // Clear again before appending in case of race conditions
    datalist.innerHTML = '';

    // Append unique PaymentIDs only
    const uniqueIDs = new Set();
    data.forEach(item => {
        if (!uniqueIDs.has(item.PaymentID)) {
            const option = document.createElement('option');
            option.value = item.PaymentID;
            datalist.appendChild(option);
            uniqueIDs.add(item.PaymentID);
        }
    });
}

async function loadInvoiceSuggestions(companyID, searchText, datalist, partyCode) {
    datalist.innerHTML = '';
    if (!partyCode) partyCode = paymentFormElements.partyCode.value.trim();

    if (!searchText || !partyCode) return;

    const { data } = await supabaseClient
        .from("InvoicePaymentView")
        .select("InvoiceNo")
        .eq("company_id", companyID)
        .eq("PartyCode", partyCode)
        .gt("BalanceAmount", 0)
        .ilike("InvoiceNo", `%${searchText}%`)
        .order("InvoiceNo", { ascending: true })
        .limit(10);
    if (!(data && data.length)) {
        const noOption = document.createElement("option");
        noOption.value = "";
        noOption.label = "No matching invoice found";
        datalist.appendChild(noOption);
        return;
    }
    data.forEach(item => {
        const option = document.createElement("option");
        option.value = item.InvoiceNo;
        datalist.appendChild(option);
    });
}

// ========== Totals/UI State ==========

function updateTotals() {
    const totals = Array.from(document.querySelectorAll('#paymentAllocationBody tr')).reduce((acc, row) => ({
        allocated: acc.allocated + safeNumber(row.querySelector('.allocatedAmount')?.value),
        otherDeduction: acc.otherDeduction + safeNumber(row.querySelector('.otherDeductionAmount')?.value),
        tdsDeduction: acc.tdsDeduction + safeNumber(row.querySelector('.tdsDeductionAmount')?.value)
    }), { allocated: 0, otherDeduction: 0, tdsDeduction: 0 });

    paymentFormElements.totalAllocatedAmount.textContent = totals.allocated.toFixed(2);
    paymentFormElements.totalOtherDeductionAmount.textContent = totals.otherDeduction.toFixed(2);
    paymentFormElements.totalTDSDeductionAmount.textContent = totals.tdsDeduction.toFixed(2);

    const paymentAmount = safeNumber(paymentFormElements.paymentAmount?.value);
    const deductionAmount = safeNumber(paymentFormElements.deductionAmount?.value);

    // Compute unallocated and undeducted
    const unallocatedAmount = paymentAmount - totals.allocated;
    const undeductedAmount = deductionAmount - (totals.otherDeduction + totals.tdsDeduction);

    // Show in UI if there's a corresponding element (Optional: add <span id="unallocatedAmount">0.00</span> in your HTML)
    if (paymentFormElements.unallocatedAmount) {
        paymentFormElements.unallocatedAmount.textContent = unallocatedAmount.toFixed(2);
    }

    // Optionally, same for undeducted amount
    if (paymentFormElements.undeductedAmount) {
        paymentFormElements.undeductedAmount.textContent = undeductedAmount.toFixed(2);
    }

    let errorMessage = '';
    if (totals.allocated > paymentAmount) {
        errorMessage = "Total Allocated Amount cannot exceed Payment Amount";
    } else if ((totals.otherDeduction + totals.tdsDeduction) > deductionAmount) {
        errorMessage = "Total Deduction Amount cannot exceed Deduction Amount";
    }
    showNotification(errorMessage);

    // Optionally return for code use
    return { ...totals, unallocatedAmount, undeductedAmount };
}


function updateRowCounter() {
    const rowCount = document.querySelectorAll('#paymentAllocationBody tr').length;
    paymentFormElements.rowCounter.textContent = `Total Rows: ${rowCount}`;
    updateTotals();
}

// ========== Suspense/Party Change Popup Logic ==========

async function handlePartyChange() {
    const partyCode = paymentFormElements.partyCode.value.trim();

    if (!partyCode) return;
    // Disable paymentID field when partyName changes
    paymentFormElements.paymentID.disabled = true;
    const { data: suspensePayments, error } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID, ReceiptOn, SuspenseAmount, PartyCode, TransactionType, PaymentMode,ReferenceNo')
        .eq('PartyCode', partyCode)
        .gt('SuspenseAmount', 0);
    if (error) {
        console.error('Error fetching suspense payments:', error);
        return;
    }

    if (suspensePayments.length > 0) {
        await showSuspensePopup(suspensePayments);
        makeAllocationRowsReadonly();
    }
}

async function showSuspensePopup(payments) {
    const popupTableBody = document.getElementById('suspenseTableBody');
    popupTableBody.innerHTML = '';
    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.PaymentID}</td>
            <td>${payment.ReceiptOn}</td>
            <td>${payment.SuspenseAmount}</td>
            <td>${payment.TransactionType}</td>
            <td>${payment.PaymentMode}</td>
            <td>${payment.ReferenceNo}</td>
            <td>
                <button class="btn btn-sm btn-primary selectPayment" data-id="${payment.PaymentID}">Select</button>
            </td>`;
        popupTableBody.appendChild(row);
    });
    // Bootstrap 5: show modal
    const suspenseModalEl = document.getElementById('suspensePopup');
    const suspenseModal = bootstrap.Modal.getOrCreateInstance(suspenseModalEl);
    suspenseModal.show();
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('selectPayment')) {
        const paymentID = e.target.getAttribute('data-id');
        const { data: paymentDetails, error } = await supabaseClient
            .from('PaymentDetails').select('*').eq('PaymentID', paymentID).single();
        if (error) {
            console.error('Error loading payment details:', error);
            return;
        }
        await loadPaymentDetailsToForm(paymentDetails);

        // Move focus out of modal BEFORE hiding to avoid aria-hidden+focused conflict
        const paymentIDInput = document.getElementById("paymentID");
        if (paymentIDInput) paymentIDInput.focus();

        const suspenseModalEl = document.getElementById('suspensePopup');
        const suspenseModal = bootstrap.Modal.getOrCreateInstance(suspenseModalEl);
        suspenseModal.hide();
    }
});

async function loadPaymentDetailsToForm(payment) {
    paymentFormElements.paymentID.value = payment.PaymentID;
    paymentFormElements.receiptOn.value = payment.ReceiptOn;
    // paymentFormElements.suspenseAmount.value = payment.SuspenseAmount;
    const partyData = await getPartyDetailsByCode(payment.PartyCode);
    paymentFormElements.partyCode.value = payment.PartyCode;
    paymentFormElements.partyName.value = partyData.PartyName || '';
    paymentFormElements.transactionType.value = payment.TransactionType;
    paymentFormElements.paymentMode.value = payment.PaymentMode;
    paymentFormElements.inputBankName.value = payment.BankName || '';
    paymentFormElements.referenceNo.value = payment.ReferenceNo || '';
    paymentFormElements.information.value = payment.Narration || '';
    paymentFormElements.paymentAmount.value = safeNumber(payment.PaymentAmount).toFixed(2);
    paymentFormElements.deductionAmount.value = safeNumber(payment.DeductionAmount).toFixed(2);
    await loadPaymentAllocations(payment.PaymentID);
    handlePostFetchActions();
}

async function makeAllocationRowsReadonly() {
    const rows = paymentFormElements.paymentAllocationBody.querySelectorAll('tr');
    rows.forEach(row => {
        row.querySelectorAll('input, textarea, button.delete-btn').forEach(el => {
            el.disabled = true;
        });
    });
}
