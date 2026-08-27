let paymentIDTimer = null;
let allBills = [];
let billsMap = {};
let deletedPaymentLines = [];
let suspensePaymentSelected = false;

// ------------------------------------------
// DOM ELEMENTS CACHE
// ------------------------------------------
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

// Explicit button definitions to prevent implicit global variable bugs
const addBillDetailsButton = document.getElementById("addBillDetailsButton");

// ------------------------------------------
// INITIALIZATION
// ------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);
    if (creditPayInput.receiptOn) {
        creditPayInput.receiptOn.value = new Date().toISOString().split("T")[0];
    }
    loadDefaultBank();
    toggleSettlementMode();
    if (creditPayInput.transactionType) {
        creditPayInput.transactionType.value = "Debit";
    }
});

// ------------------------------------------
// EVENT LISTENERS
// ------------------------------------------
if (saveButton) {
    saveButton.addEventListener("click", async () => {
        await saveUpdatedDebitPayments();
    });
}

if (creditPayInput.paymentMode) {
    creditPayInput.paymentMode.addEventListener("change", toggleSettlementMode);
}

if (newButton) {
    newButton.addEventListener("click", () => {
        enableForm();
        clearForm();
        if (creditPayInput.receiptOn) {
            creditPayInput.receiptOn.value = new Date().toISOString().split("T")[0];
        }
        loadDefaultBank();
        creditPayInput.transactionType.value = "Debit";
        saveButton.dataset.mode = "insert";
        saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
        saveButton.disabled = false;
        modifyButton.disabled = true;

        const tbody = document.querySelector("#paymentDetails tbody");
        if (tbody) tbody.innerHTML = "";

        calculateTotals();
        calculateSuspenseAmount();
        deletedPaymentLines = [];
    });
}

if (modifyButton) {
    modifyButton.addEventListener("click", () => {
        enableForm();
        modifyButton.disabled = true;
        creditPayInput.transactionType.disabled = true;
        creditPayInput.paymentID.disabled = true;
        saveButton.disabled = false;
        addBillDetailsButton.disabled = false;
    });
}

if (creditPayInput.partyName) {
    creditPayInput.partyName.addEventListener("change", async () => {
        const partyCode = creditPayInput.partyCode.value.trim();
        await getPendingInvoiceDetails(partyCode);
        await checkSuspensePayments(partyCode);
    });
}

if (creditPayInput.paymentAmount) {
    creditPayInput.paymentAmount.addEventListener("input", calculateSuspenseAmount);
}

if (creditPayInput.deductionAmount) {
    creditPayInput.deductionAmount.addEventListener("input", calculateSuspenseAmount);
}

if (addBillDetailsButton) {
    addBillDetailsButton.addEventListener("click", addBillDetailRow);
}

// ------------------------------------------
// GENERATE PAYMENT ID
// ------------------------------------------
async function generatePaymentID(companyID) {
    const { data, error } = await supabaseClient.rpc("generate_payment_id", {
        p_company_id: companyID
    });

    if (error) {
        console.error("PaymentID generation failed:", error);
        throw error;
    }
    return data;
}

// ------------------------------------------
// SAVE PAYMENTS
// ------------------------------------------
async function saveUpdatedDebitPayments() {
    const originalText = saveButton.innerHTML;

    try {
        if (!validatePaymentForm()) return;

        const suspenseAmount = calculateSuspenseAmount();

        if (suspenseAmount < 0) {
            alert("Allocated amount exceeds Payment Amount.");
            return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const paymentPayload = {
            ReceiptOn: creditPayInput.receiptOn.value,
            SuspenseAmount: suspenseAmount || 0,
            PartyCode: creditPayInput.partyCode.value.trim(),
            TransactionType: creditPayInput.transactionType.value,
            PaymentMode: creditPayInput.paymentMode.value,
            BankName: creditPayInput.inputBankName.value,
            BankID: creditPayInput.bankID.value,
            ReferenceNo: creditPayInput.referenceNo.value,
            PaymentAmount: parseFloat(creditPayInput.paymentAmount.value) || 0,
            DeductionAmount: parseFloat(creditPayInput.deductionAmount.value) || 0,
            Narration: creditPayInput.information.value,
            company_id: CompanyID
        };

        let result, error;

        if (saveButton.dataset.mode === "insert") {
            const paymentID = await generatePaymentID(CompanyID);
            creditPayInput.paymentID.value = paymentID;
            paymentPayload.PaymentID = paymentID;
            paymentPayload.created_by = UserLoginID;
            paymentPayload.created_at = localtimeStamp;

            ({ data: result, error } = await supabaseClient
                .from("PaymentDetails")
                .insert(paymentPayload)
                .select());

            if (error) throw error;

            saveButton.dataset.mode = "update";
            modifyButton.disabled = false;
            disableForm();
        } else if (saveButton.dataset.mode === "update") {
            paymentPayload.PaymentID = creditPayInput.paymentID.value.trim();
            paymentPayload.update_by = UserLoginID;
            paymentPayload.update_at = localtimeStamp;

            ({ data: result, error } = await supabaseClient
                .from("PaymentDetails")
                .update(paymentPayload)
                .eq("PaymentID", paymentPayload.PaymentID)
                .eq("company_id", CompanyID)
                .select());
        }

        if (error) throw error;

        await savePaymentLineItems(paymentPayload.PaymentID);
        await deleteRemovedLineItems();

        showToast("Payment saved successfully");

        deletedPaymentLines = [];
        disableForm();
        saveButton.disabled = true;
        modifyButton.disabled = false;

        return result;

    } catch (err) {
        console.error("Save failed:", err);
        alert(`Save failed: ${err.message}`);
        saveButton.disabled = false;
        return null;
    } finally {
        saveButton.innerHTML = originalText;
        if (saveButton.dataset.mode === "insert") {
            saveButton.disabled = false;
        }
    }
}

function validatePaymentForm() {
    if (!creditPayInput.receiptOn.value) {
        alert("Receipt On is required");
        creditPayInput.receiptOn.focus();
        return false;
    }
    if (!creditPayInput.partyCode.value.trim()) {
        alert("Vendor is required");
        creditPayInput.partyName.focus();
        return false;
    }
    if (!creditPayInput.transactionType.value) {
        alert("Transaction Type is required");
        creditPayInput.transactionType.focus();
        return false;
    }
    if (!creditPayInput.paymentMode.value) {
        alert("Payment Mode is required");
        creditPayInput.paymentMode.focus();
        return false;
    }
    if (creditPayInput.paymentMode.value !== "Cash" && !creditPayInput.inputBankName.value.trim()) {
        alert("Bank Name is required");
        creditPayInput.inputBankName.focus();
        return false;
    }
    if ((parseFloat(creditPayInput.paymentAmount.value) || 0) <= 0) {
        alert("Debit Amount must be greater than zero");
        creditPayInput.paymentAmount.focus();
        return false;
    }
    return true;
}

function calculateSuspenseAmount() {
    const paymentAmount = safeNumber(creditPayInput.paymentAmount.value);
    const deductionAmount = safeNumber(creditPayInput.deductionAmount.value);

    const allocatedEl = document.getElementById("totalAllocatedAmount");
    const otherEl = document.getElementById("totalOtherDeductionAmount");
    const tdsEl = document.getElementById("totalTDSDeductionAmount");

    const totalAllocated = allocatedEl ? safeNumber(allocatedEl.textContent) : 0;
    const totalOther = otherEl ? safeNumber(otherEl.textContent) : 0;
    const totalTDS = tdsEl ? safeNumber(tdsEl.textContent) : 0;

    const suspense = (paymentAmount + deductionAmount) - (totalAllocated + totalOther + totalTDS);
    const suspenseEl = document.getElementById("suspenseAmount");

    if (suspenseEl) {
        suspenseEl.textContent = suspense.toFixed(2);
        suspenseEl.classList.toggle("text-danger", suspense > 0);
        suspenseEl.classList.toggle("text-success", suspense <= 0);
    }
    return suspense;
}

// ------------------------------------------
// PAYMENT ID TYPEAHEAD & LOADING
// ------------------------------------------
async function loadPaymentIDSuggestions(companyID, inputVal = "") {
    const datalist = document.getElementById("paymentIDSuggestions");
    if (!datalist) return;

    datalist.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("PaymentID")
        .eq("company_id", companyID)
        .eq("TransactionType", "Debit")
        .ilike("PaymentID", `%${inputVal}%`)
        .order("PaymentID", { ascending: true })
        .limit(50);

    if (error) {
        console.error(error);
        return;
    }

    data?.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.PaymentID;
        datalist.appendChild(opt);
    });
}

if (creditPayInput.paymentID) {
    creditPayInput.paymentID.addEventListener("input", e => {
        clearTimeout(paymentIDTimer);
        paymentIDTimer = setTimeout(() => {
            loadPaymentIDSuggestions(CompanyID, e.target.value.trim());
        }, 300);
    });

    creditPayInput.paymentID.addEventListener("change", async e => {
        const paymentID = e.target.value.trim();
        if (paymentID) {
            await loadPaymentDetails(paymentID);
        }
    });
}

async function loadPaymentDetails(paymentID) {
    if (!paymentID) return;

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("*")
        .eq("company_id", CompanyID)
        .eq("PaymentID", paymentID)
        .eq("TransactionType", "Debit")
        .maybeSingle();

    if (error) {
        console.error("Load Payment Error:", error);
        return;
    }
    if (!data) return;

    const party = await getPartyDetailsByCode(data.PartyCode);

    creditPayInput.receiptOn.value = data.ReceiptOn ?? "";
    creditPayInput.partyCode.value = data.PartyCode ?? "";
    creditPayInput.partyName.value = party?.PartyName || "";
    creditPayInput.transactionType.value = data.TransactionType ?? "";
    creditPayInput.paymentMode.value = data.PaymentMode ?? "";
    creditPayInput.inputBankName.value = data.BankName ?? "";
    creditPayInput.referenceNo.value = data.ReferenceNo ?? "";
    creditPayInput.paymentAmount.value = data.PaymentAmount ?? 0;
    creditPayInput.deductionAmount.value = data.DeductionAmount ?? 0;
    creditPayInput.information.value = data.Narration ?? "";

    saveButton.dataset.mode = "update";
    saveButton.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
    saveButton.disabled = true;
    modifyButton.disabled = false;
    disableForm();
    calculateSuspenseAmount();

    await loadPaymentLineItems(data.PaymentID);
    addBillDetailsButton.disabled = true;
}

// ------------------------------------------
// LOAD & MANAGE PENDING INVOICES
// ------------------------------------------
async function getPendingInvoiceDetails(partyCode) {
    if (!partyCode) {
        allBills = [];
        billsMap = {};
        refreshBillDatalist();
        return;
    }

    const { data, error } = await supabaseClient
        .from("VendorBillPaymentView")
        .select(`BillReferenceNo, BillNo, AccountedDate, ChargeTotalAmount, BalanceAmount`)
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("AccountedDate", { ascending: false });

    if (error) {
        console.error("Bills Load Error:", error);
        return;
    }

    allBills = data || [];
    billsMap = {};
    allBills.forEach(bill => {
        billsMap[bill.BillReferenceNo] = bill;
    });

    refreshBillDatalist();
}

// Helper to get currently loaded bills in the table to prevent duplicates in datalist
function getAddedBills() {
    const addedBills = new Set();
    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        const referenceNo = row.cells[1]?.textContent?.trim();
        if (referenceNo) addedBills.add(referenceNo);
    });
    return addedBills;
}

function refreshBillDatalist(searchText = "") {
    const datalist = document.getElementById("billNumberList");
    if (!datalist) return;

    datalist.innerHTML = "";
    const addedBills = getAddedBills();

    allBills.forEach(bill => {
        if (!addedBills.has(bill.BillReferenceNo)) {
            // Apply text filter if provided
            if (!searchText || (bill.BillReferenceNo || "").toLowerCase().includes(searchText)) {
                const option = document.createElement("option");
                option.value = bill.BillReferenceNo;
                datalist.appendChild(option);
            }
        }
    });
}

const billNumberInput = document.getElementById("billNumberInput");
if (billNumberInput) {
    billNumberInput.addEventListener("input", function () {
        refreshBillDatalist(this.value.toLowerCase().trim());
    });

    billNumberInput.addEventListener("change", function () {
        const referenceNo = this.value.trim();
        const bill = billsMap[referenceNo];

        if (!bill) {
            console.warn("Bill not found:", referenceNo);
            return;
        }

        const billDateEl = document.getElementById("billDate");
        const billAmountEl = document.getElementById("billAmount");
        const billBalanceEl = document.getElementById("billBalance");

        if (billDateEl) billDateEl.value = bill.AccountedDate ? bill.AccountedDate.split("T")[0] : "";
        if (billAmountEl) billAmountEl.value = Number(bill.ChargeTotalAmount || 0).toFixed(2);
        if (billBalanceEl) billBalanceEl.value = Number(bill.BalanceAmount || 0).toFixed(2);
    });
}

// ------------------------------------------
// INVOICE TABLE ROW MANAGEMENT
// ------------------------------------------
function addBillDetailRow() {
    const selectedBill = document.getElementById("billNumberInput").value.trim();
    if (!selectedBill) {
        showToast("Select Bill No");
        return;
    }

    const billReferenceNo = selectedBill.split(" - ")[0].trim();
    const billInfo = billsMap[billReferenceNo];

    if (!billInfo) {
        showToast("Invalid Bill");
        return;
    }

    const accountedAmount = safeNumber(document.getElementById("accountedAmount").value);
    if (accountedAmount <= 0) {
        showToast("Accounted Amount must be greater than 0");
        return;
    }

    const otherDeduction = safeNumber(document.getElementById("otherDeductionAmount").value);
    const tdsDeduction = safeNumber(document.getElementById("tdsDeductionAmount").value);
    const narration = document.getElementById("narration").value.trim();
    const totalPayment = accountedAmount + otherDeduction + tdsDeduction;

    const tbody = document.querySelector("#paymentDetails tbody");
    const row = document.createElement("tr");

    row.dataset.status = "New";
    row.innerHTML = `
        <td></td>
        <td>${billInfo.BillReferenceNo}</td>
        <td>${billInfo.BillNo}</td>
        <td>${narration}</td>
        <td class="text-end">${accountedAmount.toFixed(2)}</td>
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
    clearInvoiceInputs();
}

const paymentDetailsTbody = document.querySelector("#paymentDetails tbody");
if (paymentDetailsTbody) {
    paymentDetailsTbody.addEventListener("click", function (e) {
        const btn = e.target.closest(".remove-row");
        if (!btn) return;

        const row = btn.closest("tr");
        const status = row.dataset.status;
        const id = row.dataset.id;

        if (status === "Old" && id) {
            deletedPaymentLines.push(id);
        }

        row.remove();
        renumberRows();
        calculateTotals();
        refreshBillDatalist();
    });
}

function renumberRows() {
    document.querySelectorAll("#paymentDetails tbody tr").forEach((row, index) => {
        if (row.cells[0]) row.cells[0].textContent = index + 1;
    });
}

function calculateTotals() {
    let allocated = 0, other = 0, tds = 0, total = 0;

    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        allocated += parseFloat(row.cells[4]?.textContent) || 0;
        other += parseFloat(row.cells[5]?.textContent) || 0;
        tds += parseFloat(row.cells[6]?.textContent) || 0;
        total += parseFloat(row.cells[7]?.textContent) || 0;
    });

    const allocatedEl = document.getElementById("totalAllocatedAmount");
    const otherEl = document.getElementById("totalOtherDeductionAmount");
    const tdsEl = document.getElementById("totalTDSDeductionAmount");
    const totalEl = document.getElementById("totalPayments");

    if (allocatedEl) allocatedEl.textContent = allocated.toFixed(2);
    if (otherEl) otherEl.textContent = other.toFixed(2);
    if (tdsEl) tdsEl.textContent = tds.toFixed(2);
    if (totalEl) totalEl.textContent = total.toFixed(2);

    calculateSuspenseAmount();
}

function clearInvoiceInputs() {
    const idsToClear = [
        "billNumberInput", "billDate", "billAmount", "billBalance",
        "narration"
    ];

    idsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Reset numerical inputs to 0.00 specifically
    ["accountedAmount", "otherDeductionAmount", "tdsDeductionAmount"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "0.00";
    });

    refreshBillDatalist();
}

// ------------------------------------------
// DATABASE LINE ITEM SYNCING
// ------------------------------------------
async function savePaymentLineItems(paymentID) {
    const rows = document.querySelectorAll("#paymentDetails tbody tr");
    const records = [];

    rows.forEach(row => {
        if (row.dataset.status !== "New") return;

        records.push({
            PaymentID: paymentID,
            InvoiceNo: row.cells[1].textContent.trim(),
            VendorBillNo: row.cells[2].textContent.trim(),
            Narration: row.cells[3].textContent.trim(),
            PaymentAmount: parseFloat(row.cells[4].textContent) || 0,
            OtherDeductionAmount: parseFloat(row.cells[5].textContent) || 0,
            TDSDeductionAmount: parseFloat(row.cells[6].textContent) || 0,
            company_id: CompanyID,
            created_by: UserLoginID,
            created_at: localtimeStamp
        });
    });

    if (records.length === 0) return;

    const { error } = await supabaseClient.from("PaymentLineItems").insert(records).select();
    if (error) throw error;

    await loadPaymentLineItems(paymentID);
}

async function deleteRemovedLineItems() {
    if (deletedPaymentLines.length === 0) return;

    const { error } = await supabaseClient
        .from("PaymentLineItems")
        .delete()
        .in("id", deletedPaymentLines);

    if (error) throw error;
    deletedPaymentLines = [];
}

async function loadPaymentLineItems(paymentID) {
    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("PaymentLineItems")
        .select("*")
        .eq("PaymentID", paymentID)
        .eq("company_id", CompanyID);

    if (error) {
        console.error(error);
        return;
    }

    data?.forEach(addRowFromDB);
    renumberRows();
    calculateTotals();
    refreshBillDatalist();
}

function addRowFromDB(item) {
    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    const row = document.createElement("tr");
    row.dataset.status = "Old";
    row.dataset.id = item.id;

    row.innerHTML = `
        <td></td>
        <td>${item.InvoiceNo}</td>
        <td>${item.VendorBillNo}</td>
        <td>${item.Narration || ""}</td>
        <td class="text-end">${safeNumber(item.PaymentAmount).toFixed(2)}</td>
        <td class="text-end">${safeNumber(item.OtherDeductionAmount).toFixed(2)}</td>
        <td class="text-end">${safeNumber(item.TDSDeductionAmount).toFixed(2)}</td>
        <td class="text-end">${(safeNumber(item.PaymentAmount) + safeNumber(item.OtherDeductionAmount) + safeNumber(item.TDSDeductionAmount)).toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
}

// ------------------------------------------
// SUSPENSE MODAL MANAGEMENT
// ------------------------------------------
function showSuspenseModal(rows) {
    const tbody = document.getElementById("suspenseTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    suspensePaymentSelected = false;

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.PaymentID}</td>
            <td>${typeof formatDate === 'function' ? formatDate(r.ReceiptOn) : (r.ReceiptOn || "")}</td>
            <td>${r.ReferenceNo || ""}</td>
            <td class="text-end">${safeNumber(r.PaymentAmount).toFixed(2)}</td>
            <td class="text-end">${safeNumber(r.DeductionAmount).toFixed(2)}</td>
            <td class="text-end fw-bold text-danger">${safeNumber(r.SuspenseAmount).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-primary modify-suspense-btn">Modify</button>
            </td>
        `;
        tr.querySelector(".modify-suspense-btn").onclick = () => selectSuspensePayment(r.PaymentID);
        tbody.appendChild(tr);
    });

    const modalEl = document.getElementById("suspenseModal");
    if (modalEl) {
        new bootstrap.Modal(modalEl, { backdrop: "static", keyboard: false }).show();
    }
}

function selectSuspensePayment(paymentID) {
    suspensePaymentSelected = true;
    closeSuspenseModal();

    creditPayInput.paymentID.value = paymentID;
    creditPayInput.paymentID.dispatchEvent(new Event("change", { bubbles: true }));
    showToast("Modify existing payment to clear suspense");
}

async function checkSuspensePayments(partyCode) {
    if (!partyCode) return;

    await getPendingInvoiceDetails(partyCode);

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select(`PaymentID, ReceiptOn, ReferenceNo, PaymentAmount, DeductionAmount, SuspenseAmount`)
        .eq("PartyCode", partyCode)
        .eq("TransactionType", "Debit")
        .eq("company_id", CompanyID)
        .gt("SuspenseAmount", 0)
        .order("ReceiptOn", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (data && data.length > 0) {
        showSuspenseModal(data);
        disableNewEntry();
    } else {
        closeSuspenseModal();
        enableNewEntry();
    }
}

function disableNewEntry() {
    if (saveButton) saveButton.disabled = true;
    if (addBillDetailsButton) addBillDetailsButton.disabled = true;
}

function enableNewEntry() {
    if (saveButton) saveButton.disabled = false;
    if (addBillDetailsButton) addBillDetailsButton.disabled = false;
}

function closeSuspenseModal() {
    const modalEl = document.getElementById("suspenseModal");
    if (!modalEl) return;
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
}

const suspenseModalEl = document.getElementById("suspenseModal");
if (suspenseModalEl) {
    suspenseModalEl.addEventListener("hidden.bs.modal", () => {
        if (suspensePaymentSelected) {
            disableNewEntry();
        } else {
            enableNewEntry();
        }
        if (creditPayInput.paymentID) creditPayInput.paymentID.focus();
    });
}

function toggleSettlementMode() {
    const paymentModeEl = document.getElementById("paymentMode");
    const bankInput = document.getElementById("inputBankName");
    const referenceLabel = document.getElementById("referenceNoLabel");

    if (!paymentModeEl) return;
    const paymentMode = paymentModeEl.value;

    if (paymentMode === "Net Settlement") {
        if (bankInput) {
            bankInput.value = "";
            bankInput.disabled = true;
            bankInput.required = false;
        }
        if (referenceLabel) referenceLabel.textContent = "Settlement Ref No";
    } else {
        if (bankInput) {
            bankInput.disabled = false;
            bankInput.required = true;
        }
        if (referenceLabel) referenceLabel.textContent = "Reference No";
    }
}


// ==========================================
// SEARCH SAVED PAYMENTS MODAL LOGIC
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const searchPaymentInput = document.getElementById("searchSavedPaymentInput");
    const btnTriggerSearch = document.getElementById("btnTriggerSearch");
    const searchPaymentTableBody = document.getElementById("searchPaymentTableBody");
    const searchPaymentModalEl = document.getElementById("searchPaymentModal");

    // Reset modal when opened
    if (searchPaymentModalEl && searchPaymentTableBody && searchPaymentInput) {
        searchPaymentModalEl.addEventListener('show.bs.modal', () => {
            searchPaymentInput.value = "";
            searchPaymentTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted fst-italic py-3">
                        Enter search criteria to find payments...
                    </td>
                </tr>`;
            // Optionally trigger an empty search to load the top 50 recent payments immediately
            searchSavedPayments();
        });
    }

    // Search Button Click
    if (btnTriggerSearch) {
        btnTriggerSearch.addEventListener("click", searchSavedPayments);
    }

    // Pressing Enter in the Search Input
    if (searchPaymentInput) {
        searchPaymentInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchSavedPayments();
            }
        });
    }

    // Event Delegation for "Select" Buttons inside the Search Table
    if (searchPaymentTableBody) {
        searchPaymentTableBody.addEventListener("click", async (e) => {
            const btn = e.target.closest(".select-payment-btn");
            if (!btn) return;

            const paymentID = btn.dataset.id;

            // 1. Close the modal
            if (searchPaymentModalEl) {
                const modalInstance = bootstrap.Modal.getInstance(searchPaymentModalEl);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }

            // 2. Load the payment details into the main UI
            if (creditPayInput.paymentID) {
                creditPayInput.paymentID.value = paymentID;
            }
            await loadPaymentDetails(paymentID);
        });
    }
});

// Fetch and render data
async function searchSavedPayments() {
    const searchPaymentInput = document.getElementById("searchSavedPaymentInput");
    const searchPaymentTableBody = document.getElementById("searchPaymentTableBody");

    if (!searchPaymentInput || !searchPaymentTableBody) return;

    const query = searchPaymentInput.value.trim();

    // Show loading spinner
    searchPaymentTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-muted py-3">
                <span class="spinner-border spinner-border-sm"></span> Searching...
            </td>
        </tr>`;

    // Query PaymentDetails based on input (matching PaymentID, ReferenceNo, or PartyCode)
    const { data: paymentData, error } = await supabaseClient
        .from("PaymentDetails")
        .select("PaymentID, ReceiptOn, PartyCode, PaymentMode, PaymentAmount, ReferenceNo")
        .eq("company_id", CompanyID)
        .eq("TransactionType", "Debit") // Specifically searching for Debit payments
        .or(`PaymentID.ilike.%${query}%,ReferenceNo.ilike.%${query}%,PartyCode.ilike.%${query}%`)
        .order("ReceiptOn", { ascending: false })
        .limit(50);

    if (error) {
        console.error("Search Error:", error);
        searchPaymentTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger fw-bold py-3">
                    Error fetching data.
                </td>
            </tr>`;
        return;
    }

    if (!paymentData || paymentData.length === 0) {
        searchPaymentTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted fst-italic py-3">
                    No payments found matching "${query}".
                </td>
            </tr>`;
        return;
    }

    // Fetch PartyNames for display
    const partyCodes = [...new Set(paymentData.map(item => item.PartyCode))];
    let partyNameMap = {};

    if (partyCodes.length > 0) {
        const { data: partyData } = await supabaseClient
            .from("PartyDetails")
            .select("PartyCode, PartyName")
            .eq("company_id", CompanyID)
            .in("PartyCode", partyCodes);

        if (partyData) {
            partyData.forEach(p => {
                partyNameMap[p.PartyCode] = p.PartyName;
            });
        }
    }

    // Render results in the table
    searchPaymentTableBody.innerHTML = "";

    paymentData.forEach(p => {
        const tr = document.createElement("tr");
        const partyNameDisplay = partyNameMap[p.PartyCode] || p.PartyCode;

        // Ensure formatDate function exists in your utils.js, if not, fallback to p.ReceiptOn
        const displayDate = typeof formatDate === 'function' ? formatDate(p.ReceiptOn) : p.ReceiptOn;

        tr.innerHTML = `
            <td><span class="badge bg-secondary">${p.PaymentID}</span></td>
            <td>${displayDate || "-"}</td>
            <td class="text-start fw-bold">${partyNameDisplay}</td>
            <td>${p.PaymentMode || "-"}</td>
            <td class="text-end fw-bold text-danger">${safeNumber(p.PaymentAmount).toFixed(2)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-success select-payment-btn" data-id="${p.PaymentID}">
                    <i class="bi bi-check2-circle"></i> Select
                </button>
            </td>
        `;
        searchPaymentTableBody.appendChild(tr);
    });
}