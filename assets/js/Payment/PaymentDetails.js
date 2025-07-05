// Constants and DOM elements
const paymentFormElements = {
    paymentID: document.getElementById('paymentID'),
    partyCode: document.getElementById('partyCode'),
    partyName: document.getElementById('partyName'),
    receiptOn: document.getElementById('receiptOn'),
    transactionType: document.getElementById('transactionType'),
    paymentMode: document.getElementById('paymentMode'),
    inputBankName: document.getElementById('inputBankName'),
    referenceNo: document.getElementById('referenceNo'),
    infomation: document.getElementById('infomation'),
    paymentAmount: document.getElementById('paymentAmount'),
    deductionAmount: document.getElementById('deductionAmount'),
    paymentAllocationBody: document.getElementById('paymentAllocationBody'),
    addRowButton: document.getElementById('addRowButton'),
    totalAllocatedAmount: document.getElementById('totalAllocatedAmount'),
    totalOtherDeductionAmount: document.getElementById('totalOtherDeductionAmount'),
    totalTDSDeductionAmount: document.getElementById('totalTDSDeductionAmount'),
    rowCounter: document.getElementById('rowCounter')
};

// Event Listeners
newButton.addEventListener('click', resetForm);
modifyButton.addEventListener('click', enableFormForModification);
saveButton.addEventListener('click', savePaymentDetails);
paymentFormElements.partyName.addEventListener('change', handlePartyChange);

document.addEventListener('DOMContentLoaded', initializeForm);

// Main Functions
async function initializeForm() {
    try {
        if (!await checkAccess(UserLoginID, 'PaymentDetails')) {
            disableForm();
            alert("You do not have permission to view this form.");
            return;
        }

        await Promise.all([
            loadSuggestions('partySuggestions', 'PartyDetails', CompanyID),
            loadBankNameSuggestions(),
            loadPaymentIDSuggestions(CompanyID)
        ]);

        initializePaymentAllocationRows();
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing the form:', error);
        alert('An unexpected error occurred while loading the form.');
    }
}

function resetForm() {
    // Clear and reset form controls
    document.querySelectorAll('.form-control').forEach(input => {
        input.value = '';
        input.disabled = false;
    });

    // Reset button states
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;
    paymentFormElements.paymentID.disabled = false;
    paymentFormElements.addRowButton.disabled = false;

    // Clear and reset allocation table
    paymentFormElements.paymentAllocationBody.innerHTML = '';
    initializePaymentAllocationRows();
    updateTotals();
}

function enableFormForModification() {
    document.querySelectorAll('.form-control').forEach(input => input.disabled = false);
    paymentFormElements.paymentID.disabled = true;
    saveButton.disabled = false;
    modifyButton.disabled = true;
    paymentFormElements.addRowButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    loadBankNameSuggestions();
}

function setupEventListeners() {
    paymentFormElements.paymentID.addEventListener('input', debounce(() => {
        loadPaymentIDSuggestions(CompanyID);
    }, 300));

    paymentFormElements.paymentID.addEventListener('change', fetchPaymentDetails);
}

// Payment ID Generation
async function generatePaymentID(companyID) {
    const { data, error } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID')
        .eq('company_id', companyID)
        .order('PaymentID', { ascending: false })
        .limit(1);

    if (error) throw error;

    return data.length === 0
        ? `${companyID}_P001`
        : `${companyID}_P${String(parseInt(data[0].PaymentID.split('_P')[1] || 0) + 1).padStart(3, '0')}`;
}

// Form Submission
async function savePaymentDetails() {
    const isUpdate = saveButton.textContent.trim() === 'Update';
    const paymentID = isUpdate
        ? paymentFormElements.paymentID.value.trim()
        : await generatePaymentID(CompanyID);

    const formData = getFormData();
    if (!validateFormData(formData)) return;

    // Calculate Allocated Amount Total
    let totalAllocated = 0;
    let totalOtherDeduction = 0;
    let totalTDSDeduction = 0;

    document.querySelectorAll('#paymentAllocationBody tr').forEach(row => {
        totalAllocated += parseFloat(row.querySelector('.allocatedAmount')?.value || 0);
        totalOtherDeduction += parseFloat(row.querySelector('.otherDeductionAmount')?.value || 0);
        totalTDSDeduction += parseFloat(row.querySelector('.tdsDeductionAmount')?.value || 0);
    });

    const allocatedAmount = totalAllocated + totalOtherDeduction + totalTDSDeduction;
    const paymentAmount = (
        parseFloat(formData.PaymentAmount || 0) + parseFloat(formData.DeductionAmount || 0)
    ).toFixed(2);

    console.log('Allocated Amount:', allocatedAmount);
    console.log('Payment Amount:', paymentAmount, 'Deduction Amount:', formData.DeductionAmount,
        'Payment Amount:', formData.PaymentAmount);

    if (allocatedAmount > paymentAmount) {
        alert("Payment collected can't be more than Allocated Amount.");
        return; // Stop further processing
    }

    // Calculate Suspense Amount
    const suspenseAmount = allocatedAmount < paymentAmount ? (paymentAmount - allocatedAmount) : 0;

    try {
        // Attach suspenseAmount to formData
        formData.SuspenseAmount = suspenseAmount;

        if (isUpdate) {
            await updatePaymentDetails(paymentID, formData);
        } else {
            paymentFormElements.paymentID.value = paymentID;
            await createPaymentDetails(paymentID, formData);
        }

        await handlePaymentAllocations(paymentID);
        handlePostSaveActions(isUpdate);

    } catch (error) {
        console.error('Error saving payment details:', error);
        alert('Failed to process payment details. Please try again.');
    }
}

// Helper Functions
function getFormData() {
    return {
        PartyCode: paymentFormElements.partyCode.value.trim(),
        SuspenseAmount: parseFloat(paymentFormElements.suspenseAmount?.value || 0) || 0,
        ReceiptOn: paymentFormElements.receiptOn.value.trim(),
        TransactionType: paymentFormElements.transactionType.value.trim(),
        PaymentMode: paymentFormElements.paymentMode.value.trim(),
        BankName: paymentFormElements.inputBankName.value.trim(),
        ReferenceNo: paymentFormElements.referenceNo.value.trim(),
        Narration: paymentFormElements.infomation.value.trim(),
        PaymentAmount: parseFloat(paymentFormElements.paymentAmount.value) || 0,
        DeductionAmount: parseFloat(paymentFormElements.deductionAmount.value) || 0,
    };
}

function validateFormData(formData) {
    if (!formData.PartyCode || !formData.ReceiptOn || !formData.PaymentMode) {
        alert('Please fill in all required fields.');
        return false;
    }
    updateTotals();
    return true;
}

async function createPaymentDetails(paymentID, formData) {
    await supabaseClient.from('PaymentDetails').insert([{
        ...formData,
        PaymentID: paymentID,
        company_id: CompanyID,
        created_by: UserLoginID,
        created_at: localtimeStamp,
    }]);
    alert('Payment details saved successfully!');
}

async function updatePaymentDetails(paymentID, formData) {
    await supabaseClient.from('PaymentDetails')
        .update({
            ...formData,
            update_by: UserLoginID,
            update_at: localtimeStamp
        })
        .eq('PaymentID', paymentID)
        .eq('company_id', CompanyID);
    alert('Payment details updated successfully!');
}

async function handlePaymentAllocations(paymentID) {
    await supabaseClient.from('PaymentLineItems').delete().eq('PaymentID', paymentID);
    const allocations = getAllocationData(paymentID);
    if (allocations.length > 0) {
        const { error } = await supabaseClient.from('PaymentLineItems').insert(allocations);
        if (error) throw error;
    }
}

function getAllocationData(paymentID) {
    return Array.from(document.querySelectorAll('#paymentAllocationBody tr'))
        .map(row => {
            const invoiceNo = row.querySelector('.invoiceNoInput')?.value.trim();
            if (!invoiceNo) return null;

            return {
                PaymentID: paymentID,
                InvoiceNo: invoiceNo,
                PaymentAmount: parseFloat(row.querySelector('.allocatedAmount')?.value || 0),
                OtherDeductionAmount: parseFloat(row.querySelector('.otherDeductionAmount')?.value || 0),
                TDSDeductionAmount: parseFloat(row.querySelector('.tdsDeductionAmount')?.value || 0),
                Narration: row.querySelector('.information')?.value.trim(),
                created_at: localtimeStamp,
                created_by: UserLoginID
            };
        })
        .filter(Boolean);
}

function handlePostSaveActions(isUpdate) {
    disableForm();
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;
    modifyButton.disabled = false;
}

// Allocation Table Functions
function initializePaymentAllocationRows() {
    for (let i = 0; i < 5; i++) addPaymentAllocationRow(CompanyID);
}

async function addPaymentAllocationRow(companyID, rowData = null) {
    const uniqueID = `invoiceNoSuggestions_${Date.now()}`;
    const row = document.createElement('tr');
    row.innerHTML = createAllocationRowHTML(uniqueID);
    paymentFormElements.paymentAllocationBody.appendChild(row);

    setupRowEventListeners(row, companyID, uniqueID);

    if (rowData) {
        await populateRowWithData(row, rowData, companyID);
    }

    updateRowCounter();
}

function createAllocationRowHTML(uniqueID) {
    return `
        <td style="width: 12%;">
            <input list="${uniqueID}" class="form-control bg-light-input invoiceNoInput fs-7" style="width: 140px;" required autocomplete="off" placeholder="Search Invoice No...">
            <datalist id="${uniqueID}"></datalist>
        </td>
        <td style="width: 8%;"><input type="date" class="form-control invoiceDate fs-7" style="width: 120px;" readonly></td>
        <td style="width: 12%;"><input type="number" class="form-control invoiceAmount text-end fs-7" style="width: 120px;" readonly value="0.00" step="0.01" min="0"></td>
        <td style="width: 12%;"><input type="number" class="form-control balanceAmount text-end fs-7" style="width: 120px;" readonly value="0.00" step="0.01" min="0"></td>
        <td style="width: 12%;"><input type="number" class="form-control allocatedAmount text-end fs-7" style="width: 120px;" value="0.00" step="0.01" min="0"></td>
        <td style="width: 12%;"><input type="number" class="form-control otherDeductionAmount text-end fs-7" style="width: 120px;" value="0.00" step="0.01" min="0"></td>
        <td style="width: 12%;"><input type="number" class="form-control tdsDeductionAmount text-end fs-7" style="width: 120px;" value="0.00" step="0.01" min="0"></td>
        <td style="width: 15%;"><textarea class="form-control information fs-7" rows="1"></textarea></td>
        <td style="width: 8%;" class="text-center">
            <button type="button" class="btn btn-sm btn-danger delete-btn"><i class="bi bi-trash-fill"></i></button>
        </td>
    `;
}

function setupRowEventListeners(row, companyID, uniqueID) {
    const deleteBtn = row.querySelector('.delete-btn');
    const invoiceInput = row.querySelector('.invoiceNoInput');
    const datalist = row.querySelector('datalist');
    const partyCode = paymentFormElements.partyCode.value;
    // consolest.log('Setting up row event listeners for companyID:', companyID, 'and partyCode:', partyCode);
    deleteBtn.addEventListener('click', () => {
        row.remove();
        updateRowCounter();
    });

    ['allocatedAmount', 'otherDeductionAmount', 'tdsDeductionAmount'].forEach(className => {
        row.querySelector(`.${className}`).addEventListener('input', updateTotals);
    });

    invoiceInput.addEventListener('input', debounce(() => {
        loadInvoiceSuggestions(companyID, invoiceInput.value.trim(), datalist, partyCode);
    }, 300));

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
    const partyCode = document.getElementById("partyCode").value.trim();
    row.querySelector('.invoiceNoInput').value = rowData.InvoiceNo || '';
    row.querySelector('.allocatedAmount').value = parseFloat(rowData.PaymentAmount || 0).toFixed(2);
    row.querySelector('.otherDeductionAmount').value = parseFloat(rowData.OtherDeductionAmount || 0).toFixed(2);
    row.querySelector('.tdsDeductionAmount').value = parseFloat(rowData.TDSDeductionAmount || 0).toFixed(2);
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

// Data Loading Functions
async function fetchPaymentDetails(e) {
    const selectedPaymentID = e.target.value.trim();
    if (!selectedPaymentID) return;

    const { data } = await supabaseClient
        .from('PaymentDetails')
        .select('*')
        .eq('PaymentID', selectedPaymentID)
        .eq('company_id', CompanyID)
        .single();

    if (!data) return;

    populateFormWithPaymentData(data);
    await loadPaymentAllocations(selectedPaymentID);
    handlePostFetchActions();
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
    paymentFormElements.infomation.value = data.Narration || '';
    paymentFormElements.paymentAmount.value = parseFloat(data.PaymentAmount || 0).toFixed(2);
    paymentFormElements.deductionAmount.value = parseFloat(data.DeductionAmount || 0).toFixed(2);
}

function handlePostFetchActions() {
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;
    paymentFormElements.paymentID.disabled = true;
    modifyButton.disabled = false;
    paymentFormElements.addRowButton.disabled = true;
    disableForm();
}

async function loadPaymentAllocations(paymentID) {
    paymentFormElements.paymentAllocationBody.innerHTML = '';

    const { data } = await supabaseClient
        .from('PaymentLineItems')
        .select('*')
        .eq('PaymentID', paymentID);

    if (!data || data.length === 0) {
        updateRowCounter();
        return;
    }

    for (const item of data) {
        await addPaymentAllocationRow(CompanyID, item);
    }

    updateRowCounter();
}

async function loadPaymentIDSuggestions(companyID) {
    const searchText = paymentFormElements.paymentID.value.trim();
    const datalist = document.getElementById('paymentIDSuggestions');
    datalist.innerHTML = '';

    if (!searchText) return;

    const { data } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID')
        .ilike('PaymentID', `%${searchText}%`)
        .eq('company_id', companyID)
        .order('PaymentID', { ascending: true })
        .limit(10);

    data?.forEach(item => {
        const option = document.createElement('option');
        option.value = item.PaymentID;
        datalist.appendChild(option);
    });
}

async function loadInvoiceSuggestions(companyID, searchText, datalist, partyCode) {
    datalist.innerHTML = '';
    if (!searchText || !partyCode) return;

    const { data } = await supabaseClient
        .from('InvoicePaymentView')
        .select('InvoiceNo')
        .eq('company_id', companyID)
        .eq('PartyCode', partyCode)
        .gt('BalanceAmount', 0)
        .ilike('InvoiceNo', `%${searchText}%`)
        .order('InvoiceNo', { ascending: true })
        .limit(10);

    if (!data || data.length === 0) {
        const noOption = document.createElement('option');
        noOption.value = '';
        noOption.label = 'No matching invoice found';
        datalist.appendChild(noOption);
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.InvoiceNo;
        datalist.appendChild(option);
    });
}

// Utility Functions
function updateTotals() {
    const totals = Array.from(document.querySelectorAll('#paymentAllocationBody tr'))
        .reduce((acc, row) => ({
            allocated: acc.allocated + parseFloat(row.querySelector('.allocatedAmount')?.value || 0),
            otherDeduction: acc.otherDeduction + parseFloat(row.querySelector('.otherDeductionAmount')?.value || 0),
            tdsDeduction: acc.tdsDeduction + parseFloat(row.querySelector('.tdsDeductionAmount')?.value || 0)
        }), { allocated: 0, otherDeduction: 0, tdsDeduction: 0 });

    paymentFormElements.totalAllocatedAmount.textContent = totals.allocated.toFixed(2);
    paymentFormElements.totalOtherDeductionAmount.textContent = totals.otherDeduction.toFixed(2);
    paymentFormElements.totalTDSDeductionAmount.textContent = totals.tdsDeduction.toFixed(2);

    const paymentAmount = parseFloat(paymentFormElements.paymentAmount?.value || 0);
    const deductionAmount = parseFloat(paymentFormElements.deductionAmount?.value || 0);

    let errorMessage = '';
    if (totals.allocated > paymentAmount) {
        errorMessage = 'Total Allocated Amount cannot exceed Payment Amount';
    } else if ((totals.otherDeduction + totals.tdsDeduction) > deductionAmount) {
        errorMessage = 'Total Deduction Amount cannot exceed Deduction Amount';
    }

    showNotification(errorMessage);
}

function updateRowCounter() {
    const rowCount = document.querySelectorAll('#paymentAllocationBody tr').length;
    paymentFormElements.rowCounter.textContent = `Total Rows: ${rowCount}`;
    updateTotals();
}

function debounce(func, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

async function handlePartyChange() {
    const partyCode = paymentFormElements.partyCode.value.trim();
    if (!partyCode) return;
    // Check suspense payments for the selected party
    const { data: suspensePayments, error } = await supabaseClient
        .from('PaymentDetails')
        .select('PaymentID, ReceiptOn, SuspenseAmount, PartyCode, TransactionType, PaymentMode')
        .eq('PartyCode', partyCode)
        .gt('SuspenseAmount', 0);

    if (error) {
        console.error('Error fetching suspense payments:', error);
        return;
    }

    if (suspensePayments.length > 0) {
        // Show the popup and display suspense payments
        showSuspensePopup(suspensePayments);
    }
    // Additional party change handling if needed
}

function showSuspensePopup(payments) {
    const popupTableBody = document.getElementById('suspenseTableBody');
    popupTableBody.innerHTML = ''; // Clear previous rows

    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.PaymentID}</td>
            <td>${payment.ReceiptOn}</td>
            <td>${payment.SuspenseAmount}</td>
            <td>${payment.TransactionType}</td>
            <td>${payment.PaymentMode}</td>
            <td><button class="btn btn-sm btn-primary selectPayment" data-id="${payment.PaymentID}">Select</button></td>
        `;
        popupTableBody.appendChild(row);
    });

    // Show popup (You can use Bootstrap Modal or your custom popup)
    $('#suspensePopup').modal('show'); // If using Bootstrap
}
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('selectPayment')) {
        const paymentID = e.target.getAttribute('data-id');

        // Fetch full payment details
        const { data: paymentDetails, error } = await supabaseClient
            .from('PaymentDetails')
            .select('*')
            .eq('PaymentID', paymentID)
            .single();

        if (error) {
            console.error('Error loading payment details:', error);
            return;
        }

        // Load payment details into the form
        loadPaymentDetailsToForm(paymentDetails);

        // Close the popup
        document.getElementById('paymentID').focus();
        $('#suspensePopup').modal('hide');
    }
});
async function loadPaymentDetailsToForm(payment) {
    document.getElementById('paymentID').value = payment.PaymentID;
    document.getElementById('receiptOn').value = payment.ReceiptOn;
    // document.getElementById('suspenseAmount').value = payment.SuspenseAmount;
    const partyData = await getPartyDetailsByCode(payment.PartyCode);
    document.getElementById('partyCode').value = payment.PartyCode;
    document.getElementById('partyName').value = partyData.PartyName || '';
    document.getElementById('transactionType').value = payment.TransactionType;
    document.getElementById('paymentMode').value = payment.PaymentMode;
    document.getElementById('inputBankName').value = payment.BankName || '';
    document.getElementById('referenceNo').value = payment.ReferenceNo || '';
    document.getElementById('infomation').value = payment.Narration || '';
    document.getElementById('paymentAmount').value = parseFloat(payment.PaymentAmount || 0).toFixed(2);
    document.getElementById('deductionAmount').value = parseFloat(payment.DeductionAmount || 0).toFixed(2);
    await loadPaymentAllocations(payment.PaymentID);
    handlePostFetchActions();
    // You can add more fields here as required
}

function disableForm() {
    document.querySelectorAll('.form-control').forEach(input => input.disabled = true);
    paymentFormElements.addRowButton.disabled = true;
    document.querySelectorAll('.delete-btn').forEach(button => button.disabled = true);
}

