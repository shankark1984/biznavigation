let paymentIDTimer = null;
let allInvoices = [];
let invoiceMap = {};
let deletedPaymentLines = [];
let editingLineRow = null;

// ==========================================
// CACHE DOM ELEMENTS (Prevents Reference Errors)
// ==========================================
const addInvoiceDetailsButton = document.getElementById("addInvoiceDetailsButton");
const pModeEl = document.getElementById("paymentMode");
const invoiceNumInputEl = document.getElementById("invoiceNumberInput");

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

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);

    if (creditPayInput.receiptOn) {
        creditPayInput.receiptOn.value = new Date().toISOString().split("T")[0];
    }

    loadDefaultBank();
    toggleSettlementMode();

    if (creditPayInput.transactionType) {
        creditPayInput.transactionType.value = "Credit";
    }

    if (addInvoiceDetailsButton) {
        addInvoiceDetailsButton.disabled = false;
    }
});

if (saveButton) saveButton.addEventListener("click", async () => { await saveUpdatedCreditPayments(); });
if (pModeEl) pModeEl.addEventListener("change", toggleSettlementMode);
if (creditPayInput.paymentAmount) creditPayInput.paymentAmount.addEventListener("input", calculateSuspenseAmount);
if (creditPayInput.deductionAmount) creditPayInput.deductionAmount.addEventListener("input", calculateSuspenseAmount);

// Payment ID listeners
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

// Party Name Listener (Optimized)
if (creditPayInput.partyName) {
    creditPayInput.partyName.addEventListener("change", async () => {
        const partyCode = creditPayInput.partyCode.value.trim();

        if (!partyCode) {
            allInvoices = [];
            invoiceMap = {};
            refreshBillDatalist();
            return;
        }

        await getPendingInvoiceDetails(partyCode);

        // Only check for suspense payments if we are inserting a NEW payment
        if (saveButton && saveButton.dataset.mode !== "update") {
            await checkSuspensePayments(partyCode);
        }
    });
}

// New Button
if (newButton) {
    newButton.addEventListener("click", () => {
        enableForm();
        clearForm();
        if (creditPayInput.receiptOn) {
            creditPayInput.receiptOn.value = new Date().toISOString().split("T")[0];
        }
        loadDefaultBank();
        if (creditPayInput.transactionType) creditPayInput.transactionType.value = "Credit";

        saveButton.dataset.mode = "insert";
        saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
        saveButton.disabled = false;
        if (modifyButton) modifyButton.disabled = true;

        const tbody = document.querySelector("#paymentDetails tbody");
        if (tbody) tbody.innerHTML = "";

        calculateTotals();
        calculateSuspenseAmount();
        deletedPaymentLines = [];
        enableTableButtons(); // Ensure table buttons are unlocked
    });
}

// Modify Button
if (modifyButton) {
    modifyButton.addEventListener("click", () => {
        enableForm();
        modifyButton.disabled = true;
        creditPayInput.transactionType.disabled = true;
        creditPayInput.paymentID.disabled = true;

        if (saveButton) saveButton.disabled = false;
        if (addInvoiceDetailsButton) addInvoiceDetailsButton.disabled = false;

        enableTableButtons();
    });
}

// Invoice Listeners
if (invoiceNumInputEl) {
    // Filter datalist while typing
    invoiceNumInputEl.addEventListener("input", function () {
        const searchText = this.value.toLowerCase();
        const datalist = document.getElementById("invoiceNumberList");
        if (!datalist) return;

        datalist.innerHTML = "";
        const addedInvoices = new Set();

        document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
            const invoiceNo = row.cells[1]?.textContent?.trim();
            if (invoiceNo) addedInvoices.add(invoiceNo);
        });

        allInvoices
            .filter(inv => inv.InvoiceNo.toLowerCase().includes(searchText))
            .forEach(inv => {
                if (!addedInvoices.has(inv.InvoiceNo)) {
                    const option = document.createElement("option");
                    option.value = inv.InvoiceNo;
                    datalist.appendChild(option);
                }
            });
    });

    // Populate details on selection
    invoiceNumInputEl.addEventListener("change", function () {
        const invoiceNo = this.value.trim();
        const invoice = invoiceMap[invoiceNo];

        if (!invoice) return;

        document.getElementById("invoiceDate").value = invoice.InvoiceDate ? invoice.InvoiceDate.split("T")[0] : "";
        document.getElementById("invoiceAmount").value = Number(invoice.GrandTotalAmount || 0).toFixed(2);
        document.getElementById("invoiceBalance").value = Number(invoice.BalanceAmount || 0).toFixed(2);
    });
}

if (addInvoiceDetailsButton) {
    addInvoiceDetailsButton.addEventListener("click", addInvoiceDetailRow);
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

async function generatePaymentID(companyID) {
    const { data, error } = await supabaseClient.rpc("generate_payment_id", { p_company_id: companyID });
    if (error) {
        console.error("PaymentID generation failed:", error);
        throw error;
    }
    return data;
}

async function saveUpdatedCreditPayments() {
    if (!saveButton) return;
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
            if (modifyButton) modifyButton.disabled = false;
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
        if (modifyButton) modifyButton.disabled = false;

        disableTableButtons();
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
        alert("Customer is required");
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
        alert("Payment Amount must be greater than zero");
        creditPayInput.paymentAmount.focus();
        return false;
    }
    return true;
}

function calculateSuspenseAmount() {
    const paymentAmount = safeNumber(creditPayInput.paymentAmount.value);
    const deductionAmount = safeNumber(creditPayInput.deductionAmount.value);

    const totalAllocatedEl = document.getElementById("totalAllocatedAmount");
    const totalOtherEl = document.getElementById("totalOtherDeductionAmount");
    const totalTDSEl = document.getElementById("totalTDSDeductionAmount");

    const totalAllocated = totalAllocatedEl ? safeNumber(totalAllocatedEl.textContent) : 0;
    const totalOther = totalOtherEl ? safeNumber(totalOtherEl.textContent) : 0;
    const totalTDS = totalTDSEl ? safeNumber(totalTDSEl.textContent) : 0;

    const suspense = (paymentAmount + deductionAmount) - (totalAllocated + totalOther + totalTDS);

    const suspenseEl = document.getElementById("suspenseAmount");
    if (suspenseEl) {
        suspenseEl.textContent = suspense.toFixed(2);
        suspenseEl.classList.toggle("text-danger", suspense > 0);
        suspenseEl.classList.toggle("text-success", suspense <= 0);
    }
    return suspense;
}

async function loadPaymentIDSuggestions(companyID, inputVal = "") {
    const datalist = document.getElementById("paymentIDSuggestions");
    if (!datalist) return;
    datalist.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("PaymentID")
        .eq("company_id", companyID)
        .eq("TransactionType", "Credit")
        .ilike("PaymentID", `%${inputVal}%`)
        .order("PaymentID", { ascending: true })
        .limit(50);

    if (error) return console.error(error);

    data?.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.PaymentID;
        datalist.appendChild(opt);
    });
}

async function loadPaymentDetails(paymentID) {
    if (!paymentID) return;

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("*")
        .eq("company_id", CompanyID)
        .eq("PaymentID", paymentID)
        .eq("TransactionType", "Credit")
        .maybeSingle();

    if (error) return console.error("Load Payment Error:", error);
    if (!data) return console.log("Payment not found:", paymentID);

    const party = await getPartyDetailsByCode(data.PartyCode);

    creditPayInput.receiptOn.value = data.ReceiptOn ?? "";
    creditPayInput.partyCode.value = data.PartyCode ?? "";
    creditPayInput.partyName.value = party.PartyName || "";
    creditPayInput.transactionType.value = data.TransactionType ?? "";
    creditPayInput.paymentMode.value = data.PaymentMode ?? "";
    creditPayInput.inputBankName.value = data.BankName ?? "";
    creditPayInput.referenceNo.value = data.ReferenceNo ?? "";
    creditPayInput.paymentAmount.value = data.PaymentAmount ?? 0;
    creditPayInput.deductionAmount.value = data.DeductionAmount ?? 0;
    creditPayInput.information.value = data.Narration ?? "";

    if (saveButton) {
        saveButton.dataset.mode = "update";
        saveButton.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveButton.disabled = true;
    }

    if (modifyButton) modifyButton.disabled = false;

    disableForm();
    calculateSuspenseAmount();
    await loadPaymentLineItems(data.PaymentID);
    renumberRows();
    calculateTotals();
    refreshBillDatalist();

    if (addInvoiceDetailsButton) addInvoiceDetailsButton.disabled = true;
    disableTableButtons();
}

async function getPendingInvoiceDetails(partyCode) {
    if (!partyCode) {
        allInvoices = [];
        invoiceMap = {};
        refreshBillDatalist();
        return;
    }

    const { data, error } = await supabaseClient
        .from("InvoicePaymentView")
        .select(`InvoiceNo, InvoiceDate, GrandTotalAmount, BalanceAmount`)
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("InvoiceDate", { ascending: false });

    if (error) return console.error("Invoice Load Error:", error);

    allInvoices = data || [];
    invoiceMap = {};
    allInvoices.forEach(invoice => invoiceMap[invoice.InvoiceNo] = invoice);

    refreshBillDatalist();
}

function refreshBillDatalist() {
    const datalist = document.getElementById("invoiceNumberList");
    if (!datalist) return;
    datalist.innerHTML = "";

    const addedInvoices = new Set();
    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        const invoiceNo = row.cells[1]?.textContent.trim();
        if (invoiceNo) addedInvoices.add(invoiceNo);
    });

    allInvoices.forEach(invoice => {
        if (!addedInvoices.has(invoice.InvoiceNo)) {
            const option = document.createElement("option");
            option.value = invoice.InvoiceNo;
            datalist.appendChild(option);
        }
    });
}

function addInvoiceDetailRow() {
    const invoiceNoEl = document.getElementById("invoiceNumberInput");
    const narrationEl = document.getElementById("narration");
    const accountedAmountEl = document.getElementById("accountedAmount");

    if (!invoiceNoEl) return console.error("Error: 'invoiceNumberInput' not found.");

    const invoiceNo = invoiceNoEl.value.trim();
    if (!invoiceNo) return alert("Please select an Invoice");

    const narration = narrationEl ? narrationEl.value.trim() : "";
    const allocatedAmount = accountedAmountEl ? (parseFloat(accountedAmountEl.value) || 0) : 0;

    const otherDeductionInput = document.getElementById("otherDeductionAmount") || document.getElementById("otherDeuctionAmount");
    const tdsDeductionInput = document.getElementById("tdsDeductionAmount") || document.getElementById("tDSDeuctionAmount");

    const otherDeduction = parseFloat(otherDeductionInput?.value) || 0;
    const tdsDeduction = parseFloat(tdsDeductionInput?.value) || 0;

    const totalPayment = allocatedAmount + otherDeduction + tdsDeduction;
    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    if (editingLineRow) {
        const exists = [...tbody.rows].some(r => r !== editingLineRow && r.cells[1]?.textContent.trim() === invoiceNo);
        if (exists) return alert("Invoice already added in another row.");

        editingLineRow.cells[1].textContent = invoiceNo;
        editingLineRow.cells[2].textContent = narration;
        editingLineRow.cells[3].textContent = allocatedAmount.toFixed(2);
        editingLineRow.cells[4].textContent = otherDeduction.toFixed(2);
        editingLineRow.cells[5].textContent = tdsDeduction.toFixed(2);
        editingLineRow.cells[6].textContent = totalPayment.toFixed(2);

        if (editingLineRow.dataset.status === "Old") editingLineRow.dataset.status = "Modified";
    } else {
        const exists = [...tbody.rows].some(row => row.cells[1]?.textContent.trim() === invoiceNo);
        if (exists) return alert("Invoice already added.");

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
                <button type="button" class="btn btn-sm btn-primary edit-row me-1" title="Edit">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }

    renumberRows();
    calculateTotals();
    refreshBillDatalist();
    clearInvoiceInputs();
}

const paymentDetailsTbody = document.querySelector("#paymentDetails tbody");
if (paymentDetailsTbody) {
    paymentDetailsTbody.addEventListener("click", function (e) {
        const editBtn = e.target.closest(".edit-row");
        if (editBtn) {
            const row = editBtn.closest("tr");
            editingLineRow = row;

            document.getElementById("invoiceNumberInput").value = row.cells[1].textContent.trim();
            document.getElementById("narration").value = row.cells[2].textContent.trim();
            document.getElementById("accountedAmount").value = row.cells[3].textContent.trim();

            const otherDeductionInput = document.getElementById("otherDeductionAmount") || document.getElementById("otherDeuctionAmount");
            if (otherDeductionInput) otherDeductionInput.value = row.cells[4].textContent.trim();

            const tdsDeductionInput = document.getElementById("tdsDeductionAmount") || document.getElementById("tDSDeuctionAmount");
            if (tdsDeductionInput) tdsDeductionInput.value = row.cells[5].textContent.trim();

            if (addInvoiceDetailsButton) {
                addInvoiceDetailsButton.innerHTML = '<i class="bi bi-check-circle"></i> Update';
                addInvoiceDetailsButton.classList.replace("btn-primary", "btn-warning");
            }

            document.getElementById("invoiceNumberInput").dispatchEvent(new Event("change"));
            return;
        }

        const removeBtn = e.target.closest(".remove-row");
        if (removeBtn) {
            const row = removeBtn.closest("tr");
            if (editingLineRow === row) clearInvoiceInputs();

            if (row.dataset.status === "Old" && row.dataset.id) {
                deletedPaymentLines.push(row.dataset.id);
            }
            row.remove();
            renumberRows();
            calculateTotals();
            refreshBillDatalist();
        }
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
        allocated += parseFloat(row.cells[3]?.textContent) || 0;
        other += parseFloat(row.cells[4]?.textContent) || 0;
        tds += parseFloat(row.cells[5]?.textContent) || 0;
        total += parseFloat(row.cells[6]?.textContent) || 0;
    });

    const els = {
        allocatedEl: document.getElementById("totalAllocatedAmount"),
        otherEl: document.getElementById("totalOtherDeductionAmount"),
        tdsEl: document.getElementById("totalTDSDeductionAmount"),
        totalEl: document.getElementById("totalPaymentAmount")
    };

    if (els.allocatedEl) els.allocatedEl.textContent = allocated.toFixed(2);
    if (els.otherEl) els.otherEl.textContent = other.toFixed(2);
    if (els.tdsEl) els.tdsEl.textContent = tds.toFixed(2);
    if (els.totalEl) els.totalEl.textContent = total.toFixed(2);

    calculateSuspenseAmount();
}

function clearInvoiceInputs() {
    ["invoiceNumberInput", "invoiceDate", "invoiceAmount", "invoiceBalance",
        "accountedAmount", "otherDeductionAmount", "otherDeuctionAmount",
        "tdsDeductionAmount", "tDSDeuctionAmount", "narration"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

    editingLineRow = null;
    if (addInvoiceDetailsButton) {
        addInvoiceDetailsButton.innerHTML = "Add";
        addInvoiceDetailsButton.classList.remove("btn-warning");
        addInvoiceDetailsButton.classList.add("btn-primary");
    }
    refreshBillDatalist();
}

async function savePaymentLineItems(paymentID) {
    const rows = document.querySelectorAll("#paymentDetails tbody tr");
    const newRecords = [];
    const modifiedRecords = [];

    rows.forEach(row => {
        const status = row.dataset.status;
        if (status === "Old") return;

        const record = {
            PaymentID: paymentID,
            InvoiceNo: row.cells[1].textContent.trim(),
            Narration: row.cells[2].textContent.trim(),
            PaymentAmount: parseFloat(row.cells[3].textContent) || 0,
            OtherDeductionAmount: parseFloat(row.cells[4].textContent) || 0,
            TDSDeductionAmount: parseFloat(row.cells[5].textContent) || 0,
            company_id: CompanyID
        };

        if (status === "New") {
            record.created_by = UserLoginID;
            record.created_at = localtimeStamp;
            newRecords.push(record);
        } else if (status === "Modified") {
            record.id = row.dataset.id;
            modifiedRecords.push(record);
        }
    });

    if (newRecords.length > 0) {
        const { error } = await supabaseClient.from("PaymentLineItems").insert(newRecords);
        if (error) throw error;
    }

    if (modifiedRecords.length > 0) {
        for (const record of modifiedRecords) {
            const { id, ...updateData } = record;
            const { error } = await supabaseClient.from("PaymentLineItems").update(updateData).eq("id", id);
            if (error) throw error;
        }
    }
    await loadPaymentLineItems(paymentID);
}

async function deleteRemovedLineItems() {
    if (deletedPaymentLines.length === 0) return;
    const { error } = await supabaseClient.from("PaymentLineItems").delete().in("id", deletedPaymentLines);
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

    if (error) return console.error(error);

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
        <td>${item.Narration || ""}</td>
        <td class="text-end">${safeNumber(item.PaymentAmount).toFixed(2)}</td>
        <td class="text-end">${safeNumber(item.OtherDeductionAmount).toFixed(2)}</td>
        <td class="text-end">${safeNumber(item.TDSDeductionAmount).toFixed(2)}</td>
        <td class="text-end">${(safeNumber(item.PaymentAmount) + safeNumber(item.OtherDeductionAmount) + safeNumber(item.TDSDeductionAmount)).toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-primary edit-row me-1" title="Edit">
                <i class="bi bi-pencil-square"></i>
            </button>
            <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
}

// ==========================================
// SUSPENSE MODAL LOGIC
// ==========================================
function showSuspenseModal(rows) {
    const tbody = document.getElementById("suspenseTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    window.suspensePaymentSelected = false;

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
                <button class="btn btn-sm btn-primary">Modify</button>
            </td>
        `;
        tr.querySelector("button").onclick = () => selectSuspensePayment(r.PaymentID);
        tbody.appendChild(tr);
    });

    const suspenseModalEl = document.getElementById("suspenseModal");
    if (suspenseModalEl) {
        let modalInstance = bootstrap.Modal.getInstance(suspenseModalEl);
        if (!modalInstance) {
            modalInstance = new bootstrap.Modal(suspenseModalEl, { backdrop: "static", keyboard: false });
        }
        modalInstance.show();
    }
}

function selectSuspensePayment(paymentID) {
    window.suspensePaymentSelected = true;
    closeSuspenseModal();
    creditPayInput.paymentID.value = paymentID;
    creditPayInput.paymentID.dispatchEvent(new Event("change", { bubbles: true }));
    showToast("Modify existing payment to clear suspense");
}

async function checkSuspensePayments(partyCode) {
    if (!partyCode) return;

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select(`PaymentID, ReceiptOn, ReferenceNo, PaymentAmount, DeductionAmount, SuspenseAmount`)
        .eq("PartyCode", partyCode)
        .eq("TransactionType", "Credit")
        .eq("company_id", CompanyID)
        .gt("SuspenseAmount", 0)
        .order("ReceiptOn", { ascending: false });

    if (error) return console.error(error);

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
    if (addInvoiceDetailsButton) addInvoiceDetailsButton.disabled = true;
}

function enableNewEntry() {
    if (saveButton) saveButton.disabled = false;
    if (addInvoiceDetailsButton) addInvoiceDetailsButton.disabled = false;
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
        if (window.suspensePaymentSelected) {
            disableNewEntry();
        } else {
            enableNewEntry();
        }
        creditPayInput.paymentID.focus();
    });
}

function toggleSettlementMode() {
    if (!pModeEl) return;
    const paymentMode = pModeEl.value;
    const bankInput = document.getElementById("inputBankName");
    const referenceLabel = document.getElementById("referenceNoLabel");

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
// SEARCH MODAL & TABLE UTILS
// ==========================================

function disableTableButtons() {
    const buttons = document.querySelectorAll("#paymentDetails tbody .edit-row, #paymentDetails tbody .remove-row");
    buttons.forEach(btn => btn.disabled = true);
}

function enableTableButtons() {
    const buttons = document.querySelectorAll("#paymentDetails tbody .edit-row, #paymentDetails tbody .remove-row");
    buttons.forEach(btn => btn.disabled = false);
}

document.addEventListener("DOMContentLoaded", () => {
    const searchPaymentInput = document.getElementById("searchSavedPaymentInput");
    const btnTriggerSearch = document.getElementById("btnTriggerSearch");
    const searchPaymentTableBody = document.getElementById("searchPaymentTableBody");
    const searchPaymentModalEl = document.getElementById("searchPaymentModal");

    if (searchPaymentModalEl && searchPaymentTableBody && searchPaymentInput) {
        searchPaymentModalEl.addEventListener('show.bs.modal', () => {
            searchPaymentInput.value = "";
            searchPaymentTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted fst-italic py-3">
                        Enter search criteria to find payments...
                    </td>
                </tr>`;
            searchSavedPayments();
        });
    }

    if (btnTriggerSearch) btnTriggerSearch.addEventListener("click", searchSavedPayments);
    if (searchPaymentInput) {
        searchPaymentInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchSavedPayments();
            }
        });
    }

    if (searchPaymentTableBody) {
        searchPaymentTableBody.addEventListener("click", async (e) => {
            const btn = e.target.closest(".select-payment-btn");
            if (!btn) return;

            const paymentID = btn.dataset.id;
            if (searchPaymentModalEl) {
                const modalInstance = bootstrap.Modal.getInstance(searchPaymentModalEl);
                if (modalInstance) modalInstance.hide();
            }

            if (creditPayInput.paymentID) creditPayInput.paymentID.value = paymentID;
            await loadPaymentDetails(paymentID);
        });
    }
});

async function searchSavedPayments() {
    const searchPaymentInput = document.getElementById("searchSavedPaymentInput");
    const searchPaymentTableBody = document.getElementById("searchPaymentTableBody");
    if (!searchPaymentInput || !searchPaymentTableBody) return;

    const query = searchPaymentInput.value.trim();

    searchPaymentTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-muted py-3">
                <span class="spinner-border spinner-border-sm"></span> Searching...
            </td>
        </tr>`;

    const { data: paymentData, error } = await supabaseClient
        .from("PaymentDetails")
        .select("PaymentID, ReceiptOn, PartyCode, PaymentMode, PaymentAmount, ReferenceNo")
        .eq("company_id", CompanyID)
        .eq("TransactionType", "Credit")
        .or(`PaymentID.ilike.%${query}%,ReferenceNo.ilike.%${query}%,PartyCode.ilike.%${query}%`)
        .order("ReceiptOn", { ascending: false })
        .limit(50);

    if (error) {
        searchPaymentTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger fw-bold py-3">Error fetching data.</td></tr>`;
        return;
    }

    if (!paymentData || paymentData.length === 0) {
        searchPaymentTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted fst-italic py-3">No payments found matching "${query}".</td></tr>`;
        return;
    }

    const partyCodes = [...new Set(paymentData.map(item => item.PartyCode))];
    let partyNameMap = {};

    if (partyCodes.length > 0) {
        const { data: partyData } = await supabaseClient.from("PartyDetails").select("PartyCode, PartyName").eq("company_id", CompanyID).in("PartyCode", partyCodes);
        if (partyData) partyData.forEach(p => partyNameMap[p.PartyCode] = p.PartyName);
    }

    searchPaymentTableBody.innerHTML = "";
    paymentData.forEach(p => {
        const tr = document.createElement("tr");
        const partyNameDisplay = partyNameMap[p.PartyCode] || p.PartyCode;
        const displayDate = typeof formatDate === 'function' ? formatDate(p.ReceiptOn) : p.ReceiptOn;

        tr.innerHTML = `
            <td><span class="badge bg-secondary">${p.PaymentID}</span></td>
            <td>${displayDate || "-"}</td>
            <td class="text-start fw-bold">${partyNameDisplay}</td>
            <td>${p.PaymentMode || "-"}</td>
            <td class="text-end fw-bold text-success">${safeNumber(p.PaymentAmount).toFixed(2)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-success select-payment-btn" data-id="${p.PaymentID}">
                    <i class="bi bi-check2-circle"></i> Select
                </button>
            </td>
        `;
        searchPaymentTableBody.appendChild(tr);
    });
}