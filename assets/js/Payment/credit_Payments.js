// =========================================================
// CONSTANTS & CONFIGURATION
// =========================================================
const PAYMENT_CONFIG = {
    TRANSACTION_TYPES: ['Credit', 'Debit'],
    PAYMENT_MODES: ['Cash', 'Bank Transfer', 'Net Settlement', 'Cheque', 'DD'],
    BANK_REQUIRED_MODES: ['Bank Transfer', 'Cheque', 'DD'],
    DEBOUNCE_DELAY: 300,
    SUSPENSE_THRESHOLD: 0.01 // For floating point comparison
};

// =========================================================
// STATE MANAGEMENT
// =========================================================
class PaymentManager {
    constructor() {
        this.paymentIDTimer = null;
        this.allInvoices = [];
        this.invoiceMap = {};
        this.deletedPaymentLines = [];
        this.suspensePaymentSelected = false;
        this.isNewEntry = false;
        this.currentPaymentID = null;
    }

    reset() {
        this.allInvoices = [];
        this.invoiceMap = {};
        this.deletedPaymentLines = [];
        this.suspensePaymentSelected = false;
        this.currentPaymentID = null;
        this.clearTimer();
    }

    clearTimer() {
        if (this.paymentIDTimer) {
            clearTimeout(this.paymentIDTimer);
            this.paymentIDTimer = null;
        }
    }

    setInvoices(invoices) {
        this.allInvoices = invoices || [];
        this.invoiceMap = {};
        this.allInvoices.forEach(invoice => {
            this.invoiceMap[invoice.InvoiceNo] = invoice;
        });
    }

    addDeletedLine(id) {
        if (id) {
            this.deletedPaymentLines.push(id);
        }
    }

    getDeletedLines() {
        return this.deletedPaymentLines;
    }

    clearDeletedLines() {
        this.deletedPaymentLines = [];
    }

    getInvoices() {
        return this.allInvoices;
    }

    getInvoiceByNo(invoiceNo) {
        return this.invoiceMap[invoiceNo] || null;
    }
}

const paymentManager = new PaymentManager();

// =========================================================
// DOM REFERENCES
// =========================================================
const creditPayInput = {
    paymentID: document.getElementById("paymentID"),
    receiptOn: document.getElementById("receiptOn"),
    partyCode: document.getElementById("partyCode"),
    partyName: document.getElementById("partyName"),
    transactionType: document.getElementById("transactionType"),
    paymentMode: document.getElementById("paymentMode"),
    inputBankName: document.getElementById("inputBankName"),
    bankID: document.getElementById("bankIDs"),
    referenceNo: document.getElementById("referenceNo"),
    information: document.getElementById("information"),
    paymentAmount: document.getElementById("paymentAmount"),
    deductionAmount: document.getElementById("deductionAmount"),
};

// DOM Elements
const addInvoiceDetailsButton = document.getElementById("addInvoiceDetailsButton");

// =========================================================
// INITIALIZATION - OPTIMIZED
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await Promise.all([
            loadSuggestions("partySuggestions", "PartyDetails", CompanyID),
            loadDefaultBank()
        ]);

        // Set default date
        const receiptOn = document.getElementById("receiptOn");
        if (receiptOn) {
            receiptOn.value = new Date().toISOString().split("T")[0];
        }

        // Set default transaction type
        document.getElementById('transactionType').value = "Credit";

        // Setup event listeners
        toggleSettlementMode();
        setupEventListeners();

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize payment form');
    }
});

// =========================================================
// EVENT LISTENERS SETUP
// =========================================================
function setupEventListeners() {
    // Payment ID typeahead
    creditPayInput.paymentID?.addEventListener('input', handlePaymentIDInput);
    creditPayInput.paymentID?.addEventListener('change', handlePaymentIDChange);

    // Party selection
    creditPayInput.partyName?.addEventListener('change', handlePartyChange);

    // Payment mode change
    document.getElementById("paymentMode")?.addEventListener('change', toggleSettlementMode);

    // Amount calculations
    creditPayInput.paymentAmount?.addEventListener('input', calculateSuspenseAmount);
    creditPayInput.deductionAmount?.addEventListener('input', calculateSuspenseAmount);

    // Invoice input
    document.getElementById("invoiceNumberInput")?.addEventListener('input', filterInvoiceDatalist);
    document.getElementById("invoiceNumberInput")?.addEventListener('change', handleInvoiceSelection);

    // Buttons
    saveButton?.addEventListener('click', saveUpdatedCreditPayments);
    newButton?.addEventListener('click', handleNewInvoice);
    modifyButton?.addEventListener('click', handleModifyInvoice);
    addInvoiceDetailsButton?.addEventListener('click', addInvoiceDetailRow);

    // Delete row delegation
    document.querySelector("#paymentDetails tbody")?.addEventListener('click', handleRowDelete);
}

// =========================================================
// PAYMENT ID HANDLERS
// =========================================================
function handlePaymentIDInput(e) {
    paymentManager.clearTimer();
    paymentManager.paymentIDTimer = setTimeout(() => {
        loadPaymentIDSuggestions(CompanyID, e.target.value.trim());
    }, PAYMENT_CONFIG.DEBOUNCE_DELAY);
}

async function handlePaymentIDChange(e) {
    const paymentID = e.target.value.trim();
    if (paymentID) {
        await loadPaymentDetails(paymentID);
    }
}

// =========================================================
// PARTY HANDLER
// =========================================================
async function handlePartyChange() {
    const partyCode = creditPayInput.partyCode.value.trim();
    if (partyCode) {
        await Promise.all([
            getPendingInvoiceDetails(partyCode),
            checkSuspensePayments(partyCode)
        ]);
    } else {
        paymentManager.setInvoices([]);
        refreshBillDatalist();
    }
}

// =========================================================
// INVOICE HANDLERS
// =========================================================
function filterInvoiceDatalist(e) {
    const searchText = e.target.value.toLowerCase();
    const datalist = document.getElementById("invoiceNumberList");
    if (!datalist) return;

    datalist.innerHTML = "";

    // Get already added invoices
    const addedInvoices = new Set();
    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        const invoiceNo = row.cells[1]?.textContent?.trim();
        if (invoiceNo) addedInvoices.add(invoiceNo);
    });

    // Filter and add options
    paymentManager.getInvoices()
        .filter(inv => inv.InvoiceNo.toLowerCase().includes(searchText))
        .filter(inv => !addedInvoices.has(inv.InvoiceNo))
        .forEach(inv => {
            const option = document.createElement("option");
            option.value = inv.InvoiceNo;
            datalist.appendChild(option);
        });
}

function handleInvoiceSelection(e) {
    const invoiceNo = e.target.value.trim();
    const invoice = paymentManager.getInvoiceByNo(invoiceNo);

    if (!invoice) {
        console.warn("Invoice not found:", invoiceNo);
        return;
    }

    document.getElementById("invoiceDate").value =
        invoice.InvoiceDate ? invoice.InvoiceDate.split("T")[0] : "";
    document.getElementById("invoiceAmount").value =
        safeNumber(invoice.GrandTotalAmount).toFixed(2);
    document.getElementById("invoiceBalance").value =
        safeNumber(invoice.BalanceAmount).toFixed(2);
}

// =========================================================
// GENERATE PAYMENT ID - OPTIMIZED
// =========================================================
async function generatePaymentID(companyID) {
    try {
        const { data, error } = await supabaseClient
            .rpc("generate_payment_id", { p_company_id: companyID });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("PaymentID generation failed:", error);
        throw error;
    }
}

// =========================================================
// SAVE PAYMENT - OPTIMIZED
// =========================================================
async function saveUpdatedCreditPayments() {
    const originalText = saveButton.innerHTML;

    try {
        if (!validatePaymentForm()) return;

        const suspenseAmount = calculateSuspenseAmount();
        if (suspenseAmount < 0) {
            alert("Allocated amount exceeds Payment Amount.");
            return;
        }

        // Prepare UI
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const paymentPayload = buildPaymentPayload(suspenseAmount);
        const result = await savePayment(paymentPayload);

        // Save line items
        await savePaymentLineItems(paymentPayload.PaymentID);
        await deleteRemovedLineItems();

        showToast("Payment saved successfully");
        paymentManager.clearDeletedLines();

        // Finalize UI
        finalizePaymentSave();

        return result;

    } catch (error) {
        console.error("Save failed:", error);
        alert(`Save failed: ${error.message}`);
        return null;
    } finally {
        saveButton.innerHTML = originalText;
        if (saveButton.dataset.mode === "insert") {
            saveButton.disabled = false;
        }
    }
}

function buildPaymentPayload(suspenseAmount) {
    const payload = {
        ReceiptOn: creditPayInput.receiptOn.value,
        SuspenseAmount: suspenseAmount || 0,
        PartyCode: creditPayInput.partyCode.value.trim(),
        TransactionType: creditPayInput.transactionType.value,
        PaymentMode: creditPayInput.paymentMode.value,
        BankName: creditPayInput.inputBankName.value,
        BankID: creditPayInput.bankID.value,
        ReferenceNo: creditPayInput.referenceNo.value,
        PaymentAmount: safeNumber(creditPayInput.paymentAmount.value),
        DeductionAmount: safeNumber(creditPayInput.deductionAmount.value),
        Narration: creditPayInput.information.value,
        company_id: CompanyID
    };

    if (saveButton.dataset.mode === "insert") {
        payload.created_by = UserLoginID;
        payload.created_at = localtimeStamp;
    } else {
        payload.update_by = UserLoginID;
        payload.update_at = localtimeStamp;
    }

    return payload;
}

async function savePayment(payload) {
    let result, error;
    const isInsert = saveButton.dataset.mode === "insert";

    if (isInsert) {
        const paymentID = await generatePaymentID(CompanyID);
        creditPayInput.paymentID.value = paymentID;
        payload.PaymentID = paymentID;

        ({ data: result, error } = await supabaseClient
            .from("PaymentDetails")
            .insert(payload)
            .select());
    } else {
        payload.PaymentID = creditPayInput.paymentID.value.trim();

        ({ data: result, error } = await supabaseClient
            .from("PaymentDetails")
            .update(payload)
            .eq("PaymentID", payload.PaymentID)
            .eq("company_id", CompanyID)
            .select());
    }

    if (error) throw error;
    return result;
}

function finalizePaymentSave() {
    saveButton.dataset.mode = "update";
    modifyButton.disabled = false;
    saveButton.disabled = true;
    disableForm();
}

// =========================================================
// VALIDATION - OPTIMIZED
// =========================================================
function validatePaymentForm() {
    const checks = [
        { value: creditPayInput.receiptOn.value, message: "Receipt On is required", focus: creditPayInput.receiptOn },
        { value: creditPayInput.partyCode.value.trim(), message: "Customer is required", focus: creditPayInput.partyName },
        { value: creditPayInput.transactionType.value, message: "Transaction Type is required", focus: creditPayInput.transactionType },
        { value: creditPayInput.paymentMode.value, message: "Payment Mode is required", focus: creditPayInput.paymentMode },
        { value: safeNumber(creditPayInput.paymentAmount.value) > 0, message: "Payment Amount must be greater than zero", focus: creditPayInput.paymentAmount }
    ];

    for (const check of checks) {
        if (!check.value) {
            alert(check.message);
            check.focus?.focus();
            return false;
        }
    }

    // Bank validation
    const paymentMode = creditPayInput.paymentMode.value;
    if (paymentMode !== "Cash" && !creditPayInput.inputBankName.value.trim()) {
        alert("Bank Name is required");
        creditPayInput.inputBankName.focus();
        return false;
    }

    return true;
}

// =========================================================
// CALCULATIONS - OPTIMIZED
// =========================================================
function calculateSuspenseAmount() {
    const paymentAmount = safeNumber(creditPayInput.paymentAmount.value);
    const deductionAmount = safeNumber(creditPayInput.deductionAmount.value);

    const totalAllocated = safeNumber(document.getElementById("totalAllocatedAmount")?.textContent);
    const totalOther = safeNumber(document.getElementById("totalOtherDeductionAmount")?.textContent);
    const totalTDS = safeNumber(document.getElementById("totalTDSDeductionAmount")?.textContent);

    const suspense = (paymentAmount + deductionAmount) - (totalAllocated + totalOther + totalTDS);

    const suspenseEl = document.getElementById("suspenseAmount");
    if (suspenseEl) {
        suspenseEl.textContent = suspense.toFixed(2);
        suspenseEl.classList.toggle("text-danger", suspense > PAYMENT_CONFIG.SUSPENSE_THRESHOLD);
        suspenseEl.classList.toggle("text-success", suspense <= PAYMENT_CONFIG.SUSPENSE_THRESHOLD);
    }

    return suspense;
}

function calculateTotals() {
    let allocated = 0, other = 0, tds = 0, total = 0;

    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        allocated += safeNumber(row.cells[3]?.textContent);
        other += safeNumber(row.cells[4]?.textContent);
        tds += safeNumber(row.cells[5]?.textContent);
        total += safeNumber(row.cells[6]?.textContent);
    });

    const totalEls = {
        totalAllocatedAmount: allocated,
        totalOtherDeductionAmount: other,
        totalTDSDeductionAmount: tds,
        totalPaymentAmount: total
    };

    Object.entries(totalEls).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    });

    calculateSuspenseAmount();
}

// =========================================================
// PAYMENT ID SUGGESTIONS
// =========================================================
async function loadPaymentIDSuggestions(companyID, inputVal = "") {
    const datalist = document.getElementById("paymentIDSuggestions");
    if (!datalist) return;

    try {
        const { data, error } = await supabaseClient
            .from("PaymentDetails")
            .select("PaymentID")
            .eq("company_id", companyID)
            .eq("TransactionType", "Credit")
            .ilike("PaymentID", `%${inputVal}%`)
            .order("PaymentID", { ascending: true })
            .limit(50);

        if (error) throw error;

        datalist.innerHTML = "";
        data?.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d.PaymentID;
            datalist.appendChild(opt);
        });
    } catch (error) {
        console.error("Error loading payment suggestions:", error);
    }
}

// =========================================================
// LOAD PAYMENT DETAILS
// =========================================================
async function loadPaymentDetails(paymentID) {
    if (!paymentID) return;

    try {
        const { data, error } = await supabaseClient
            .from("PaymentDetails")
            .select("*")
            .eq("company_id", CompanyID)
            .eq("PaymentID", paymentID)
            .eq("TransactionType", "Credit")
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            console.log("Payment not found:", paymentID);
            return;
        }

        const party = await getPartyDetailsByCode(data.PartyCode);

        // Populate form
        populatePaymentForm(data, party);

        // Load line items
        await loadPaymentLineItems(data.PaymentID);
        renumberRows();
        calculateTotals();
        refreshBillDatalist();

        // Update UI state
        saveButton.dataset.mode = "update";
        saveButton.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveButton.disabled = true;
        modifyButton.disabled = false;
        addInvoiceDetailsButton.disabled = true;
        disableForm();

    } catch (error) {
        console.error("Load Payment Error:", error);
        showToast("Failed to load payment details");
    }
}

function populatePaymentForm(data, party) {
    creditPayInput.receiptOn.value = data.ReceiptOn ?? "";
    creditPayInput.partyCode.value = data.PartyCode ?? "";
    creditPayInput.partyName.value = party?.PartyName || "";
    creditPayInput.transactionType.value = data.TransactionType ?? "";
    creditPayInput.paymentMode.value = data.PaymentMode ?? "";
    creditPayInput.inputBankName.value = data.BankName ?? "";
    creditPayInput.bankID.value = data.BankID ?? "";
    creditPayInput.referenceNo.value = data.ReferenceNo ?? "";
    creditPayInput.paymentAmount.value = data.PaymentAmount ?? 0;
    creditPayInput.deductionAmount.value = data.DeductionAmount ?? 0;
    creditPayInput.information.value = data.Narration ?? "";
}

// =========================================================
// INVOICE MANAGEMENT - OPTIMIZED
// =========================================================
async function getPendingInvoiceDetails(partyCode) {
    if (!partyCode) {
        paymentManager.setInvoices([]);
        refreshBillDatalist();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("InvoicePaymentView")
            .select(`InvoiceNo, InvoiceDate, GrandTotalAmount, BalanceAmount`)
            .neq("PaymentStatus", "Paid")
            .eq("PartyCode", partyCode)
            .eq("company_id", CompanyID)
            .order("InvoiceDate", { ascending: false });

        if (error) throw error;

        paymentManager.setInvoices(data || []);
        refreshBillDatalist();
    } catch (error) {
        console.error("Invoice Load Error:", error);
        showToast("Failed to load invoices");
    }
}

function refreshBillDatalist() {
    const datalist = document.getElementById("invoiceNumberList");
    if (!datalist) return;

    datalist.innerHTML = "";

    const addedInvoices = new Set();
    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        const invoiceNo = row.cells[1]?.textContent?.trim();
        if (invoiceNo) addedInvoices.add(invoiceNo);
    });

    paymentManager.getInvoices()
        .filter(inv => !addedInvoices.has(inv.InvoiceNo))
        .forEach(inv => {
            const option = document.createElement("option");
            option.value = inv.InvoiceNo;
            datalist.appendChild(option);
        });
}

// =========================================================
// SUSPENSE PAYMENTS - OPTIMIZED
// =========================================================
async function checkSuspensePayments(partyCode) {
    if (!partyCode) return;

    try {
        await getPendingInvoiceDetails(partyCode);

        const { data, error } = await supabaseClient
            .from("PaymentDetails")
            .select(`PaymentID, ReceiptOn, ReferenceNo, PaymentAmount, DeductionAmount, SuspenseAmount`)
            .eq("PartyCode", partyCode)
            .eq("TransactionType", "Credit")
            .eq("company_id", CompanyID)
            .gt("SuspenseAmount", 0)
            .order("ReceiptOn", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            showSuspenseModal(data);
            disableNewEntry();
        } else {
            closeSuspenseModal();
            enableNewEntry();
        }
    } catch (error) {
        console.error("Error checking suspense payments:", error);
    }
}

function showSuspenseModal(rows) {
    const tbody = document.getElementById("suspenseTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    paymentManager.suspensePaymentSelected = false;

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.PaymentID}</td>
            <td>${formatDate(r.ReceiptOn) || ""}</td>
            <td>${r.ReferenceNo || ""}</td>
            <td class="text-end">${safeNumber(r.PaymentAmount).toFixed(2)}</td>
            <td class="text-end">${safeNumber(r.DeductionAmount).toFixed(2)}</td>
            <td class="text-end fw-bold text-danger">${safeNumber(r.SuspenseAmount).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-primary select-suspense" data-paymentid="${r.PaymentID}">
                    Select
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Event delegation for select buttons
    tbody.querySelectorAll('.select-suspense').forEach(btn => {
        btn.addEventListener('click', () => {
            selectSuspensePayment(btn.dataset.paymentid);
        });
    });

    new bootstrap.Modal(
        document.getElementById("suspenseModal"),
        { backdrop: "static", keyboard: false }
    ).show();
}

function selectSuspensePayment(paymentID) {
    paymentManager.suspensePaymentSelected = true;
    closeSuspenseModal();
    creditPayInput.paymentID.value = paymentID;
    creditPayInput.paymentID.dispatchEvent(new Event("change", { bubbles: true }));
    showToast("Modify existing payment to clear suspense");
}

function disableNewEntry() {
    saveButton.disabled = true;
    addInvoiceDetailsButton.disabled = true;
}

function enableNewEntry() {
    saveButton.disabled = false;
    addInvoiceDetailsButton.disabled = false;
}

function closeSuspenseModal() {
    const modalEl = document.getElementById("suspenseModal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
}

// Suspense modal event
document.getElementById("suspenseModal")?.addEventListener("hidden.bs.modal", () => {
    if (paymentManager.suspensePaymentSelected) {
        disableNewEntry();
    } else {
        enableNewEntry();
    }
    creditPayInput.paymentID?.focus();
});

// =========================================================
// INVOICE DETAIL ROW MANAGEMENT - OPTIMIZED
// =========================================================
function addInvoiceDetailRow() {
    const invoiceNo = document.getElementById("invoiceNumberInput")?.value?.trim();
    if (!invoiceNo) {
        alert("Please select an Invoice");
        return;
    }

    const narration = document.getElementById("narration")?.value?.trim() || "";
    const allocatedAmount = safeNumber(document.getElementById("accountedAmount")?.value);
    const otherDeduction = safeNumber(document.getElementById("otherDeuctionAmount")?.value);
    const tdsDeduction = safeNumber(document.getElementById("tDSDeuctionAmount")?.value);
    const totalPayment = allocatedAmount + otherDeduction + tdsDeduction;

    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    // Prevent duplicate invoice
    const exists = [...tbody.rows].some(
        row => row.cells[1]?.textContent?.trim() === invoiceNo
    );

    if (exists) {
        alert("Invoice already added.");
        return;
    }

    const row = document.createElement("tr");
    row.dataset.status = "New";
    row.dataset.id = "";

    row.innerHTML = `
        <td></td>
        <td>${invoiceNo}</td>
        <td>${narration}</td>
        <td class="text-end">${allocatedAmount.toFixed(2)}</td>
        <td class="text-end">${otherDeduction.toFixed(2)}</td>
        <td class="text-end">${tdsDeduction.toFixed(2)}</td>
        <td class="text-end">${totalPayment.toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    renumberRows();
    calculateTotals();
    refreshBillDatalist();
    clearInvoiceInputs();
}

function handleRowDelete(e) {
    const btn = e.target.closest(".remove-row");
    if (!btn) return;

    const row = btn.closest("tr");
    if (!row) return;

    const status = row.dataset.status;
    const id = row.dataset.id;

    if (status === "Old" && id) {
        paymentManager.addDeletedLine(id);
    }

    row.remove();
    renumberRows();
    calculateTotals();
    refreshBillDatalist();
}

function renumberRows() {
    document.querySelectorAll("#paymentDetails tbody tr").forEach((row, index) => {
        if (row.cells[0]) {
            row.cells[0].textContent = index + 1;
        }
    });
}

// =========================================================
// PAYMENT LINE ITEMS - OPTIMIZED
// =========================================================
async function savePaymentLineItems(paymentID) {
    const rows = document.querySelectorAll("#paymentDetails tbody tr");
    const records = [];

    rows.forEach(row => {
        if (row.dataset.status !== "New") return;

        records.push({
            PaymentID: paymentID,
            InvoiceNo: row.cells[1].textContent.trim(),
            Narration: row.cells[2].textContent.trim(),
            PaymentAmount: safeNumber(row.cells[3].textContent),
            OtherDeductionAmount: safeNumber(row.cells[4].textContent),
            TDSDeductionAmount: safeNumber(row.cells[5].textContent),
            company_id: CompanyID,
            created_by: UserLoginID,
            created_at: localtimeStamp
        });
    });

    if (records.length === 0) return;

    const { error } = await supabaseClient
        .from("PaymentLineItems")
        .insert(records)
        .select();

    if (error) throw error;
    await loadPaymentLineItems(paymentID);
}

async function deleteRemovedLineItems() {
    const deletedIds = paymentManager.getDeletedLines();
    if (deletedIds.length === 0) return;

    const { error } = await supabaseClient
        .from("PaymentLineItems")
        .delete()
        .in("id", deletedIds);

    if (error) throw error;
    paymentManager.clearDeletedLines();
}

async function loadPaymentLineItems(paymentID) {
    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from("PaymentLineItems")
            .select("*")
            .eq("PaymentID", paymentID)
            .eq("company_id", CompanyID);

        if (error) throw error;

        tbody.innerHTML = "";
        data?.forEach(addRowFromDB);
        renumberRows();
        calculateTotals();
        refreshBillDatalist();
    } catch (error) {
        console.error("Error loading payment line items:", error);
    }
}

function addRowFromDB(item) {
    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    const row = document.createElement("tr");
    row.dataset.status = "Old";
    row.dataset.id = item.id;

    const paymentAmount = safeNumber(item.PaymentAmount);
    const otherAmount = safeNumber(item.OtherDeductionAmount);
    const tdsAmount = safeNumber(item.TDSDeductionAmount);

    row.innerHTML = `
        <td></td>
        <td>${item.InvoiceNo}</td>
        <td>${item.Narration || ""}</td>
        <td class="text-end">${paymentAmount.toFixed(2)}</td>
        <td class="text-end">${otherAmount.toFixed(2)}</td>
        <td class="text-end">${tdsAmount.toFixed(2)}</td>
        <td class="text-end">${(paymentAmount + otherAmount + tdsAmount).toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
}

// =========================================================
// UI HELPERS - OPTIMIZED
// =========================================================
function toggleSettlementMode() {
    const paymentMode = document.getElementById("paymentMode")?.value;
    const bankInput = document.getElementById("inputBankName");
    const referenceLabel = document.getElementById("referenceNoLabel");

    if (!bankInput || !referenceLabel) return;

    if (paymentMode === "Net Settlement") {
        bankInput.value = "";
        bankInput.disabled = true;
        bankInput.required = false;
        referenceLabel.textContent = "Settlement Ref No";
    } else {
        bankInput.disabled = false;
        bankInput.required = true;
        referenceLabel.textContent = "Reference No";
    }
}

function clearInvoiceInputs() {
    const ids = [
        'invoiceNumberInput', 'invoiceDate', 'invoiceAmount',
        'invoiceBalance', 'accountedAmount', 'otherDeuctionAmount',
        'tDSDeuctionAmount', 'narration'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    refreshBillDatalist();
}

function clearForm() {
    const form = document.getElementById('paymentForm');
    if (form) form.reset();

    document.querySelector("#paymentDetails tbody").innerHTML = "";
    paymentManager.reset();

    calculateTotals();
    calculateSuspenseAmount();
    refreshBillDatalist();
}

function enableForm() {
    document.querySelectorAll('#paymentForm input, #paymentForm select, #paymentForm textarea')
        .forEach(el => el.disabled = false);
    creditPayInput.paymentID.disabled = true;
}

function disableForm() {
    document.querySelectorAll('#paymentForm input, #paymentForm select, #paymentForm textarea')
        .forEach(el => el.disabled = true);
    creditPayInput.paymentID.disabled = false;
}

// =========================================================
// BUTTON HANDLERS
// =========================================================
function handleNewInvoice() {
    enableForm();
    clearForm();

    const receiptOn = document.getElementById("receiptOn");
    if (receiptOn) {
        receiptOn.value = new Date().toISOString().split("T")[0];
    }

    loadDefaultBank();
    document.getElementById('transactionType').value = "Credit";

    saveButton.dataset.mode = "insert";
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;
    addInvoiceDetailsButton.disabled = false;

    calculateTotals();
    calculateSuspenseAmount();
    paymentManager.clearDeletedLines();
}

function handleModifyInvoice() {
    enableForm();
    modifyButton.disabled = true;
    creditPayInput.transactionType.disabled = true;
    creditPayInput.paymentID.disabled = true;
    saveButton.disabled = false;
    addInvoiceDetailsButton.disabled = false;
}

// =========================================================
// UTILITY FUNCTIONS
// =========================================================
function safeNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN');
    } catch {
        return dateStr;
    }
}

function showToast(message) {
    // Implement your toast notification here
    alert(message);
}

// =========================================================
// EXPOSE FOR LEGACY COMPATIBILITY
// =========================================================
window.paymentManager = paymentManager;
window.creditPayInput = creditPayInput;
window.paymentIDTimer = null; // For backward compatibility