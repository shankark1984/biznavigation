let paymentIDTimer = null;
let allInvoices = [];
let invoiceMap = {};
let deletedPaymentLines = [];

const creditPayInput = {
    paymentID: document.getElementById("paymentID"),
    receiptOn: document.getElementById("receiptOn"),
    partyCode: document.getElementById("partyCode"),
    partyName: document.getElementById("partyName"),
    transactionType: document.getElementById("transactionType"),
    paymentMode: document.getElementById("paymentMode"),
    inputBankName: document.getElementById("inputBankName"),
    referenceNo: document.getElementById("referenceNo"),
    information: document.getElementById("information"),
    paymentAmount: document.getElementById("paymentAmount"),
    deductionAmount: document.getElementById("deductionAmount"),
};

document.addEventListener("DOMContentLoaded", async () => {
    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);
    const receiptOn = document.getElementById("receiptOn");
    if (receiptOn) {
        receiptOn.value = new Date().toISOString().split("T")[0];
    }
    loadDefaultBank();
    document.getElementById('transactionType').value = "Credit";
});

document.getElementById("saveButton").addEventListener("click", async () => {
    await saveUpdatedCreditPayments();
});

// ------------------------------------------
// GENERATE PAYMENT ID
// ------------------------------------------
async function generatePaymentID(companyID) {
    const { data, error } = await supabaseClient
        .rpc("generate_payment_id", {
            p_company_id: companyID
        });

    if (error) {
        console.error("PaymentID generation failed:", error);
        throw error;
    }

    return data; // e.g. COMP1_P000123
}

async function saveUpdatedCreditPayments() {
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
            console.log(
                "Insert Payload:",
                JSON.stringify(paymentPayload, null, 2)
            );
            ({ data: result, error } = await supabaseClient
                .from("PaymentDetails")
                .insert(paymentPayload)
                .select());

            if (error) throw error;
            saveButton.dataset.mode = "update";
            modifyButton.disabled = false;
            disableForm();

        } else if (saveButton.dataset.mode === "update") {

            paymentPayload.PaymentID =
                creditPayInput.paymentID.value.trim();

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
        // Save new rows
        await savePaymentLineItems(paymentPayload.PaymentID);

        // Delete removed rows
        await deleteRemovedLineItems();
        showToast("Payment saved successfully");
        // console.log("Payment saved successfully", result);
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

    if (
        creditPayInput.paymentMode.value !== "Cash" &&
        !creditPayInput.inputBankName.value.trim()
    ) {
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
    const paymentAmount =
        safeNumber(document.getElementById("paymentAmount").value);
    const deductionAmount =
        safeNumber(document.getElementById("deductionAmount").value);

    const totalAllocated =
        safeNumber(document.getElementById("totalAllocatedAmount").textContent);
    const totalOther =
        safeNumber(document.getElementById("totalOtherDeductionAmount").textContent);
    const totalTDS =
        safeNumber(document.getElementById("totalTDSDeductionAmount").textContent);

    const suspense =
        (paymentAmount + deductionAmount) -
        (totalAllocated + totalOther + totalTDS);

    const suspenseEl = document.getElementById("suspenseAmount");
    if (suspenseEl) {
        suspenseEl.textContent = suspense.toFixed(2);
        suspenseEl.classList.toggle("text-danger", suspense > 0);
        suspenseEl.classList.toggle("text-success", suspense <= 0);
    }

    return suspense; // 🔥 REQUIRED
}

// ------------------------------------------
// PAYMENT ID TYPEAHEAD
// ------------------------------------------
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

// ------------------------------------------
// EVENT LISTENERS
// ------------------------------------------
creditPayInput.paymentID.addEventListener("input", e => {
    clearTimeout(paymentIDTimer);

    paymentIDTimer = setTimeout(() => {
        loadPaymentIDSuggestions(
            CompanyID,
            e.target.value.trim()
        );
    }, 300);
});

creditPayInput.paymentID.addEventListener("change", async e => {
    const paymentID = e.target.value.trim();

    if (paymentID) {
        await loadPaymentDetails(paymentID);
    }
});

async function loadPaymentDetails(paymentID) {
    if (!paymentID) return;

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("*")
        .eq("company_id", CompanyID)
        .eq("PaymentID", paymentID)
        .eq("TransactionType", "Credit")
        .maybeSingle();

    if (error) {
        console.error("Load Payment Error:", error);
        return;
    }

    if (!data) {
        console.log("Payment not found:", paymentID);
        return;
    }
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

    saveButton.dataset.mode = "update";
    saveButton.innerHTML =
        '<i class="bi bi-pencil-square"></i> Update';
    saveButton.disabled = true;
    modifyButton.disabled = false;
    disableForm();
    calculateSuspenseAmount();
    await loadPaymentLineItems(data.PaymentID);
    renumberRows();
    calculateTotals();
    refreshBillDatalist();
    addInvoiceDetailsButton.disabled = true;
}

newButton.addEventListener("click", () => {
    enableForm();
    clearForm();
    const receiptOn = document.getElementById("receiptOn");
    if (receiptOn) {
        receiptOn.value = new Date().toISOString().split("T")[0];
    }
    loadDefaultBank();
    document.getElementById('transactionType').value = "Credit";
    saveButton.dataset.mode = "insert";
    saveButton.innerHTML =
        '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;
    document.querySelector("#paymentDetails tbody").innerHTML = "";
    calculateTotals();
    calculateSuspenseAmount();
    deletedPaymentLines = [];
})

modifyButton.addEventListener("click", () => {
    enableForm();
    modifyButton.disabled = true;
    creditPayInput.transactionType.disabled = true;
    creditPayInput.paymentID.disabled = true;
    saveButton.disabled = false;
    addInvoiceDetailsButton.disabled = false;

})

// ------------------------------------------
// LOAD PENDING INVOICES
// ------------------------------------------
async function getPendingInvoiceDetails(partyCode) {

    if (!partyCode) {
        allInvoices = [];
        invoiceMap = {};
        refreshBillDatalist();
        return;
    }

    const { data, error } = await supabaseClient
        .from("InvoicePaymentView")
        .select(`
            InvoiceNo,
            InvoiceDate,
            GrandTotalAmount,
            BalanceAmount
        `)
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("InvoiceDate", { ascending: false });

    if (error) {
        console.error("Invoice Load Error:", error);
        return;
    }

    allInvoices = data || [];
    invoiceMap = {};

    allInvoices.forEach(invoice => {
        invoiceMap[invoice.InvoiceNo] = invoice;
    });

    refreshBillDatalist();
}

// ------------------------------------------
// REFRESH INVOICE DATALIST
// ------------------------------------------
function refreshBillDatalist() {

    const datalist = document.getElementById("invoiceNumberList");
    datalist.innerHTML = "";

    const addedInvoices = new Set();

    document.querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {

            // Invoice No is column 1
            const invoiceNo = row.cells[1]?.textContent.trim();

            if (invoiceNo) {
                addedInvoices.add(invoiceNo);
            }
        });

    allInvoices.forEach(invoice => {

        if (!addedInvoices.has(invoice.InvoiceNo)) {

            const option = document.createElement("option");
            option.value = invoice.InvoiceNo;

            datalist.appendChild(option);
        }
    });
}
// ------------------------------------------
// FILTER DATALIST WHILE TYPING
// ------------------------------------------
document.getElementById("invoiceNumberInput").addEventListener("input", function () {

    const searchText = this.value.toLowerCase();

    const datalist =
        document.getElementById("invoiceNumberList");

    datalist.innerHTML = "";

    const addedInvoices = new Set();

    document
        .querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {

            const invoiceNo =
                row.cells[1]?.textContent?.trim();

            if (invoiceNo) {
                addedInvoices.add(invoiceNo);
            }
        });

    allInvoices
        .filter(inv =>
            inv.InvoiceNo
                .toLowerCase()
                .includes(searchText)
        )
        .forEach(inv => {

            if (!addedInvoices.has(inv.InvoiceNo)) {

                const option =
                    document.createElement("option");

                option.value = inv.InvoiceNo;

                datalist.appendChild(option);
            }
        });
});

// ------------------------------------------
// LOAD INVOICE DETAILS ON SELECTION
// ------------------------------------------
document.getElementById("invoiceNumberInput").addEventListener("change", function () {

    const invoiceNo = this.value.trim();

    const invoice = invoiceMap[invoiceNo];

    if (!invoice) {
        console.warn(
            "Invoice not found:",
            invoiceNo
        );
        return;
    }

    document.getElementById("invoiceDate").value =
        invoice.InvoiceDate
            ? invoice.InvoiceDate.split("T")[0]
            : "";

    document.getElementById("invoiceAmount").value =
        Number(invoice.GrandTotalAmount || 0)
            .toFixed(2);

    document.getElementById("invoiceBalance").value =
        Number(invoice.BalanceAmount || 0)
            .toFixed(2);

    console.log(
        "Invoice Selected:",
        invoice.InvoiceNo
    );
});

creditPayInput.partyName.addEventListener("change", async () => {
    const partyCode = creditPayInput.partyCode.value.trim();
    await getPendingInvoiceDetails(partyCode);
    await checkSuspensePayments(partyCode);
});

// ------------------------------------------
// add New Invoice details to table #paymentDetails
// ------------------------------------------
document.getElementById("addInvoiceDetailsButton").addEventListener("click", addInvoiceDetailRow);

function addInvoiceDetailRow() {

    const invoiceNo =
        document.getElementById("invoiceNumberInput").value.trim();

    if (!invoiceNo) {
        alert("Please select an Invoice");
        return;
    }

    const narration =
        document.getElementById("narration").value.trim();

    const allocatedAmount =
        parseFloat(document.getElementById("accountedAmount").value) || 0;

    const otherDeduction =
        parseFloat(document.getElementById("otherDeuctionAmount").value) || 0;

    const tdsDeduction =
        parseFloat(document.getElementById("tDSDeuctionAmount").value) || 0;

    const totalPayment =
        allocatedAmount + otherDeduction + tdsDeduction;

    const tbody =
        document.querySelector("#paymentDetails tbody");

    // Prevent duplicate invoice
    const exists = [...tbody.rows].some(
        row => row.cells[1]?.textContent.trim() === invoiceNo
    );

    if (exists) {
        alert("Invoice already added.");
        return;
    }

    const row = document.createElement("tr");

    row.dataset.status = "New";
    row.dataset.id = ""; // DB id will be empty

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

document.querySelector("#paymentDetails tbody").addEventListener("click", function (e) {

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

function renumberRows() {
    document
        .querySelectorAll("#paymentDetails tbody tr")
        .forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
}

function calculateTotals() {

    let allocated = 0;
    let other = 0;
    let tds = 0;
    let total = 0;

    document
        .querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {

            allocated += parseFloat(row.cells[3].textContent) || 0;
            other += parseFloat(row.cells[4].textContent) || 0;
            tds += parseFloat(row.cells[5].textContent) || 0;
            total += parseFloat(row.cells[6].textContent) || 0;
        });

    document.getElementById("totalAllocatedAmount").textContent = allocated.toFixed(2);

    document.getElementById("totalOtherDeductionAmount").textContent = other.toFixed(2);

    document.getElementById("totalTDSDeductionAmount").textContent = tds.toFixed(2);

    document.getElementById("totalPaymentAmount").textContent = total.toFixed(2);

    calculateSuspenseAmount();
}

function clearInvoiceInputs() {
    document.getElementById("invoiceNumberInput").value = "";
    document.getElementById("invoiceDate").value = "";
    document.getElementById("invoiceAmount").value = "";
    document.getElementById("invoiceBalance").value = "";
    document.getElementById("accountedAmount").value = "";
    document.getElementById("otherDeuctionAmount").value = "";
    document.getElementById("tDSDeuctionAmount").value = "";
    document.getElementById("narration").value = "";
    refreshBillDatalist();
}

async function savePaymentLineItems(paymentID) {

    const rows =
        document.querySelectorAll("#paymentDetails tbody tr");

    const records = [];

    rows.forEach(row => {

        if (row.dataset.status !== "New") return;

        records.push({
            PaymentID: paymentID,
            InvoiceNo: row.cells[1].textContent.trim(),
            Narration: row.cells[2].textContent.trim(),
            PaymentAmount: parseFloat(row.cells[3].textContent) || 0,
            OtherDeductionAmount: parseFloat(row.cells[4].textContent) || 0,
            TDSDeductionAmount: parseFloat(row.cells[5].textContent) || 0,
            // TotalPaymentAmount: parseFloat(row.cells[6].textContent) || 0,
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
    // Reload from DB so row IDs are available
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

    const tbody =
        document.querySelector("#paymentDetails tbody");

    const row = document.createElement("tr");

    row.dataset.status = "Old";
    row.dataset.id = item.id;

    row.innerHTML = `
        <td></td>
        <td>${item.InvoiceNo}</td>
        <td>${item.Narration || ""}</td>

        <td class="text-end">
            ${safeNumber(item.PaymentAmount).toFixed(2)}
        </td>

        <td class="text-end">
            ${safeNumber(item.OtherDeductionAmount).toFixed(2)}
        </td>

        <td class="text-end">
            ${safeNumber(item.TDSDeductionAmount).toFixed(2)}
        </td>

        <td class="text-end">
            ${(
            safeNumber(item.PaymentAmount) +
            safeNumber(item.OtherDeductionAmount) +
            safeNumber(item.TDSDeductionAmount)
        ).toFixed(2)}
        </td>

        <td>
    <button type="button" class="btn btn-sm btn-danger remove-row" title="Delete">
        <i class="bi bi-trash"></i>
    </button>
</td>
    `;

    tbody.appendChild(row);
}

creditPayInput.paymentAmount.addEventListener("input", calculateSuspenseAmount);
creditPayInput.deductionAmount.addEventListener("input", calculateSuspenseAmount);

function showSuspenseModal(rows) {
    const tbody = document.getElementById("suspenseTableBody");
    tbody.innerHTML = "";

    suspensePaymentSelected = false;

    rows.forEach(r => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${r.PaymentID}</td>
            <td>${formatDate(r.ReceiptOn) || ""}</td>
            <td>${r.ReferenceNo || ""}</td>
            <td class="text-end">${safeNumber(r.PaymentAmount).toFixed(2)}</td>
            <td class="text-end">${safeNumber(r.DeductionAmount).toFixed(2)}</td>
            <td class="text-end fw-bold text-danger">
                ${safeNumber(r.SuspenseAmount).toFixed(2)}
            </td>
            <td>
                <button class="btn btn-sm btn-primary">
                    Modify
                </button>
            </td>
        `;

        tr.querySelector("button").onclick = () => {
            selectSuspensePayment(r.PaymentID);
        };

        tbody.appendChild(tr);
    });

    new bootstrap.Modal(
        document.getElementById("suspenseModal"),
        { backdrop: "static", keyboard: false }
    ).show();
}

function selectSuspensePayment(paymentID) {
    suspensePaymentSelected = true;

    closeSuspenseModal();

    creditPayInput.paymentID.value = paymentID;

    // Trigger existing flow
    creditPayInput.paymentID.dispatchEvent(
        new Event("change", { bubbles: true })
    );

    showToast("Modify existing payment to clear suspense");
}

function updateSuspenseUI() {
    calculateSuspenseAmount(); // already updates UI
}

async function checkSuspensePayments(partyCode) {
    if (!partyCode) return;

    // 🔥 ALWAYS load invoices first
    await getPendingInvoiceDetails(partyCode);

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select(`
            PaymentID,
            ReceiptOn,
            ReferenceNo,
            PaymentAmount,
            DeductionAmount,
            SuspenseAmount
        `)
        .eq("PartyCode", partyCode)
        .eq("TransactionType", "Credit")
        .eq("company_id", CompanyID)
        .gt("SuspenseAmount", 0)
        .order("ReceiptOn", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (data && data.length > 0) {
        showSuspenseModal(data);
        disableNewEntry();   // 🔒 IMPORTANT
    } else {
        closeSuspenseModal();
        enableNewEntry();
    }
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

    if (modal) {
        modal.hide();
    }
}

const suspenseModalEl = document.getElementById("suspenseModal");

suspenseModalEl.addEventListener("hidden.bs.modal", () => {

    if (suspensePaymentSelected) {
        disableNewEntry();
    } else {
        enableNewEntry();
    }

    creditPayInput.paymentID.focus();
});