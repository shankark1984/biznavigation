let suspensePaymentSelected = false;

// ------------------------------------------
// FORM ELEMENTS
// ------------------------------------------
const paymentFormElements = {
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
    billNumberInput: document.getElementById("billNumberInput")
};

const accountedAmountInput = document.getElementById("accountedAmount");
const billBalanceInput = document.getElementById("billBalance");
const paymentAmountInput = document.getElementById("paymentAmount");

const billDate = document.getElementById("billDate");
const billAmount = document.getElementById("billAmount");

const addBillDetailsButton = document.getElementById("addBillDetailsButton");

// ------------------------------------------
// GLOBALS
// ------------------------------------------
let invoiceMap = {};
let allBills = [];
let paymentIDTimer = null;


// ------------------------------------------
// DOM LOADED
// ------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);


    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get("type");

    if (type) {
        document.getElementById("transactionType").value = type;
        document.title = `Payment Details - ${type}`;
    }
    await loadAllBanks();

    document.getElementById('receiptOn').value = new Date().toISOString().split('T')[0];

    const suspenseModalEl = document.getElementById("suspenseModal");

    suspenseModalEl.addEventListener("hidden.bs.modal", function () {
        // 🔥 Move focus safely outside modal
        document.getElementById("paymentID")?.focus();

        if (!suspensePaymentSelected) {
            enableNewEntry();  // user closed without selecting
        }
    });
});


async function getPendingInvoiceDetails(partyCode) {
    if (!partyCode) return;

    const { data, error } = await supabaseClient
        .from("VendorBillPaymentView")
        .select(`
            BillReferenceNo,
            BillNo,
            AccountedDate,
            TotalAmount,
            BalanceAmount
        `)
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("AccountedDate", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    invoiceMap = {};
    allBills = data || [];

    allBills.forEach(bill => {
        invoiceMap[bill.BillReferenceNo] = bill;
    });

    refreshBillDatalist();
}

function refreshBillDatalist() {

    const datalist = document.getElementById("billNumberList");
    datalist.innerHTML = "";

    // Get all bill references already added to table
    const addedBills = new Set();

    document.querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {
            const billRef =
                row.cells[1]?.textContent.trim();

            if (billRef) {
                addedBills.add(billRef);
            }
        });

    // Show only bills not already added
    allBills.forEach(bill => {

        if (!addedBills.has(bill.BillReferenceNo)) {

            const option = document.createElement("option");
            option.value =
                `${bill.BillReferenceNo} - (${bill.BillNo})`;

            datalist.appendChild(option);
        }
    });
}

document.getElementById("billNumberInput").addEventListener("change", function () {

    const selectedValue = this.value;

    const billReferenceNo = selectedValue.split(" - ")[0].trim();

    const bill = invoiceMap[billReferenceNo];

    if (!bill) return;

    document.getElementById("billDate").value =
        bill.AccountedDate
            ? bill.AccountedDate.split("T")[0]
            : "";

    document.getElementById("billAmount").value =
        Number(bill.TotalAmount || 0).toFixed(2);

    document.getElementById("billBalance").value =
        Number(bill.BalanceAmount || 0).toFixed(2);
});

// ------------------------------------------
// GENERATE PAYMENT ID
// ------------------------------------------
async function generatePaymentID(companyID) {

    const { data, error } = await supabaseClient.rpc(
        "generate_payment_id",
        {
            p_company_id: companyID
        }
    );

    console.log("data =", data);
    console.log("error =", error);

    return data;
}

paymentFormElements.paymentMode.addEventListener("change", () => {
    paymentFormElements.inputBankName.required =
        paymentFormElements.paymentMode.value !== "Cash";
});

// ------------------------------------------
// VALIDATION
// ------------------------------------------
function validateAccountedAmount() {

    const amt = safeNumber(accountedAmountInput.value);
    const otherDeduction = safeNumber(
        document.getElementById("otherDeductionAmount").value
    );
    const tdsDeduction = safeNumber(
        document.getElementById("tdsDeductionAmount").value
    );

    const paymentAmt = safeNumber(paymentAmountInput.value);
    const billBal = safeNumber(billBalanceInput.value);

    let totalAllocated = 0;

    document.querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {

            totalAllocated += safeNumber(
                row.querySelector(".allocatedAmount")?.textContent || 0
            );
        });

    // Total against current bill
    const totalForBill =
        amt + otherDeduction + tdsDeduction;

    // Bill balance validation
    if (
        amt <= 0 ||
        totalForBill > billBal
    ) {
        accountedAmountInput.style.border = "2px solid red";

        showToast(
            `Bill Balance (${billBal.toFixed(2)}) cannot be less than Accounted + Other Deduction + TDS (${totalForBill.toFixed(2)})`
        );

        return false;
    }

    // Payment amount validation
    if ((totalAllocated + amt) > paymentAmt) {

        accountedAmountInput.style.border = "2px solid red";

        showToast(
            `Available Allocation Amount: ${(paymentAmt - totalAllocated).toFixed(2)}`
        );

        return false;
    }

    accountedAmountInput.style.border = "";
    return true;
}

// ------------------------------------------
// ADD BILL ROW
// ------------------------------------------
document.getElementById("addBillDetailsButton").addEventListener("click", () => {

    const selectedBill = document.getElementById("billNumberInput").value.trim();

    if (!selectedBill) {
        showToast("Select Bill No");
        return;
    }

    const billReferenceNo = selectedBill.split(" - ")[0].trim();

    const billInfo = invoiceMap[billReferenceNo];

    if (!billInfo) {
        showToast("Invalid Bill");
        return;
    }

    if (!validateAccountedAmount()) {
        return;
    }

    const accountedAmount = safeNumber(document.getElementById("accountedAmount").value);
    const otherDeduction = safeNumber(document.getElementById("otherDeductionAmount").value);
    const tdsDeduction = safeNumber(document.getElementById("tdsDeductionAmount").value);
    const narration = document.getElementById("narration").value.trim();
    const totalPayment = accountedAmount + otherDeduction + tdsDeduction;
    const tbody = document.querySelector("#paymentDetails tbody");
    const row = document.createElement("tr");

    row.innerHTML = `
    <td></td>
    <td>${billInfo.BillReferenceNo}</td>
    <td>${billInfo.BillNo}</td>
    <td>${narration}</td>
    <td class="allocatedAmount text-end">${accountedAmount.toFixed(2)}</td>
    <td class="otherDeduction text-end">${otherDeduction.toFixed(2)}</td>
    <td class="tdsDeduction text-end">${tdsDeduction.toFixed(2)}</td>
    <td class="totalPayment text-end">${totalPayment.toFixed(2)}</td>
    <td><button type="button" class="btn btn-sm btn-danger removeRowBtn">Delete</button></td>
`;

    row.querySelector(".removeRowBtn").addEventListener("click", () => {

        row.remove();

        updateRowNumbers();
        updateTotals();

        // Show bill again in datalist
        refreshBillDatalist();
    });

    tbody.appendChild(row);

    updateRowNumbers();
    updateTotals();

    clearBillInputs();

    // Remove added bill from datalist
    refreshBillDatalist();
});

function updateTotals() {

    let totalAllocated = 0;
    let totalOtherDeduction = 0;
    let totalTDSDeduction = 0;
    let totalPayments = 0;

    document.querySelectorAll("#paymentDetails tbody tr")
        .forEach(row => {
            totalAllocated += safeNumber(row.querySelector(".allocatedAmount").textContent);
            totalOtherDeduction += safeNumber(row.querySelector(".otherDeduction").textContent);
            totalTDSDeduction += safeNumber(row.querySelector(".tdsDeduction").textContent);
            totalPayments += safeNumber(row.querySelector(".totalPayment").textContent);
        });

    document.getElementById("totalAllocatedAmount").textContent = totalAllocated.toFixed(2);
    document.getElementById("totalOtherDeductionAmount").textContent = totalOtherDeduction.toFixed(2);
    document.getElementById("totalTDSDeductionAmount").textContent = totalTDSDeduction.toFixed(2);
    document.getElementById("totalPayments").textContent = totalPayments.toFixed(2);

    const paymentAmount = safeNumber(document.getElementById("paymentAmount").value);

    calculateSuspenseAmount();
}

function updateRowNumbers() {

    document.querySelectorAll("#paymentDetails tbody tr")
        .forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
}

function clearBillInputs() {
    console.log("clearBillInputs");
    document.getElementById("billNumberInput").value = "";
    document.getElementById("billDate").value = "";
    document.getElementById("billAmount").value = "";
    document.getElementById("billBalance").value = "";

    document.getElementById("accountedAmount").value = "0.00";
    document.getElementById("otherDeductionAmount").value = "0.00";
    document.getElementById("tdsDeductionAmount").value = "0.00";

    document.getElementById("narration").value = "";
    document.getElementById("billNumberInput").focus();
}

saveButton.addEventListener("click", async function () {

    try {

        saveButton.disabled = true;

        const isEditMode =
            saveButton.innerHTML.includes("Update");

        if (!validateSuspenseBeforeSave()) {
            return;
        }
        if (!paymentFormElements.partyCode.value.trim()) {
            showToast("Select Vendor");
            saveButton.disabled = false;
            return;
        }

        if (!paymentFormElements.receiptOn.value) {
            showToast("Receipt date is required");
            return;
        }
        if (
            safeNumber(paymentFormElements.paymentAmount.value) <= 0
        ) {
            showToast("Payment Amount must be greater than zero");
            saveButton.disabled = false;
            return;
        }
        let PaymentID = paymentFormElements.paymentID.value.trim();

        if (!isEditMode) {
            PaymentID = await generatePaymentID(CompanyID);
            if (!PaymentID) {
                throw new Error("Unable to generate Payment ID");
            }
            paymentFormElements.paymentID.value = PaymentID;
        }

        if (!PaymentID) {
            showToast("Payment ID is required");
            saveButton.disabled = false;
            return;
        }

        const suspenseAmount = calculateSuspenseAmount();

        const paymentPayload = {
            PaymentID,
            SuspenseAmount: suspenseAmount,
            PartyCode: paymentFormElements.partyCode.value.trim(),
            TransactionType: paymentFormElements.transactionType.value,
            PaymentMode: paymentFormElements.paymentMode.value,
            ReceiptOn: paymentFormElements.receiptOn.value,
            BankName: paymentFormElements.inputBankName.value,
            ReferenceNo: paymentFormElements.referenceNo.value,
            PaymentAmount: parseFloat(paymentFormElements.paymentAmount.value) || 0,
            DeductionAmount: parseFloat(paymentFormElements.deductionAmount.value) || 0,
            Narration: paymentFormElements.information.value, company_id: CompanyID
        };

        if (isEditMode) {
            paymentPayload.update_by = UserLoginID;
            paymentPayload.update_at = localtimeStamp;
        } else {
            paymentPayload.created_by = UserLoginID;
            paymentPayload.created_at = localtimeStamp;
        }

        let paymentResult;

        if (isEditMode) {
            paymentResult = await supabaseClient
                .from("PaymentDetails")
                .update(paymentPayload)
                .eq("PaymentID", PaymentID)
                .eq("company_id", CompanyID);

        } else {

            paymentResult = await supabaseClient
                .from("PaymentDetails")
                .insert(paymentPayload);
        }

        if (paymentResult.error) {
            throw paymentResult.error;
        }

        if (isEditMode) {

            const { error } = await supabaseClient
                .from("PaymentLineItems")
                .delete()
                .eq("PaymentID", PaymentID)
                .eq("company_id", CompanyID);

            if (error) throw error;
        }

        const rowCount = document.querySelectorAll("#paymentDetails tbody tr").length;

        if (rowCount === 0) {
            // showToast("Add at least one bill");
            saveButton.disabled = false;
            return;
        }
        const lineItems = [];

        document.querySelectorAll("#paymentDetails tbody tr")
            .forEach(row => {

                lineItems.push({
                    PaymentID,
                    InvoiceNo: row.cells[1].innerText.trim(),
                    VendorBillNo: row.cells[2].innerText.trim(),
                    Narration: row.cells[3].innerText.trim(),
                    PaymentAmount: parseFloat(row.querySelector(".allocatedAmount")?.textContent) || 0,
                    OtherDeductionAmount: parseFloat(row.querySelector(".otherDeduction")?.textContent) || 0,
                    TDSDeductionAmount: parseFloat(row.querySelector(".tdsDeduction")?.textContent) || 0,
                    company_id: CompanyID,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                });
            });

        if (lineItems.length > 0) {

            const { error } = await supabaseClient
                .from("PaymentLineItems")
                .insert(lineItems);

            if (error) throw error;
        }

        disableForm();

        modifyButton.disabled = false;
        reportButton.disabled = false;

        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

        showToast(
            isEditMode
                ? "Payment updated successfully"
                : "Payment saved successfully"
        );

    } catch (err) {
        console.error(err);
        showToast(err.message || "Unexpected error occurred");

    } finally {
        saveButton.disabled = false;
    }
});

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

    const suspense = (paymentAmount + deductionAmount) - (totalAllocated + totalOther + totalTDS);

    const suspenseEl = document.getElementById("suspenseAmount");
    if (suspenseEl) {
        suspenseEl.textContent = suspense.toFixed(2);
        suspenseEl.classList.toggle("text-danger", suspense > 0);
        suspenseEl.classList.toggle("text-success", suspense <= 0);
    }

    return suspense; // 🔥 REQUIRED
}

function validateSuspenseBeforeSave() {
    const suspenseAmount = calculateSuspenseAmount();

    if (suspenseAmount < 0) {
        showToast(
            "Allocated amount exceeds received amount. Please correct allocations."
        );
        return false;
    }

    return true;
}
function enableNewEntry() {

    saveButton.disabled = false;
    addBillDetailsButton.disabled = false;

    paymentFormElements.partyName.disabled = false;
    paymentFormElements.paymentAmount.disabled = false;
    paymentFormElements.deductionAmount.disabled = false;
}
function closeSuspenseModal() {

    const modalEl =
        document.getElementById("suspenseModal");

    const modal =
        bootstrap.Modal.getInstance(modalEl);

    if (modal) {
        modal.hide();
    }
}

function updateSuspenseUI() {
    calculateSuspenseAmount(); // already updates UI
}

async function checkSuspensePayments(partyCode) {

    if (!partyCode) return;

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
        .eq("company_id", CompanyID)
        .gt("SuspenseAmount", 0)
        .order("ReceiptOn", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (data?.length) {

        disableNewEntry();

        showSuspenseModal(data);

    } else {

        suspensePaymentSelected = false;

        closeSuspenseModal();

        enableNewEntry();
    }
}

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

    paymentFormElements.paymentID.value =
        paymentID;

    enableNewEntry();

    paymentFormElements.paymentID.dispatchEvent(
        new Event("change", {
            bubbles: true
        })
    );

    showToast(
        "Existing suspense payment loaded for modification."
    );
}

paymentFormElements.partyName.addEventListener("change", async () => {

    const partyCode =
        paymentFormElements.partyCode.value.trim();

    if (!partyCode) return;

    await checkSuspensePayments(partyCode);
});
function disableNewEntry() {

    saveButton.disabled = true;
    addBillDetailsButton.disabled = true;

    paymentFormElements.partyName.disabled = true;
    paymentFormElements.paymentAmount.disabled = true;
    paymentFormElements.deductionAmount.disabled = true;
}


// ------------------------------------------
// PAYMENT ID TYPEAHEAD
// ------------------------------------------
async function loadPaymentIDSuggestions(companyID, inputVal = "") {
    const datalist = document.getElementById("paymentIDSuggestions");
    if (!datalist) return;

    datalist.innerHTML = "";

    const transactionType = paymentFormElements.transactionType.value || "";

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("PaymentID")
        .eq("company_id", companyID)
        .eq("TransactionType", transactionType)
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
paymentFormElements.paymentID.addEventListener("input", e => {
    clearTimeout(paymentIDTimer);
    paymentIDTimer = setTimeout(() => {
        loadPaymentIDSuggestions(CompanyID, e.target.value);
    }, 300);
});
paymentFormElements.paymentID.addEventListener("change", fetchPaymentDetails);
// ------------------------------------------
// FETCH PAYMENT DETAILS
// ------------------------------------------
async function fetchPaymentDetails(e) {
    const paymentID = e.target.value.trim();
    if (!paymentID) return;

    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select("*")
        .eq("PaymentID", paymentID)
        .eq("company_id", CompanyID)
        .maybeSingle();

    if (error) {
        console.error(error);
        return;
    }
    if (!data) return;

    await populateFormWithPaymentData(data);
    await getPendingInvoiceDetails(data.PartyCode);
    await loadPaymentLineItems(paymentID);
    // disable all delete buttons in view mode
    document
        .querySelectorAll("#paymentDetails tbody .removeRowBtn")
        .forEach(btn => btn.disabled = true);

    saveButton.innerHTML = "Update";
    saveButton.disabled = true;
    modifyButton.disabled = false;
    reportButton.disabled = false;
    paymentFormElements.paymentID.disabled = true;
    addBillDetailsButton.disabled = true;
    disableForm();
}


// ------------------------------------------
// POPULATE FORM
// ------------------------------------------
async function populateFormWithPaymentData(data) {
    const party = await getPartyDetailsByCode(data.PartyCode);

    paymentFormElements.receiptOn.value = data.ReceiptOn || "";
    paymentFormElements.partyCode.value = data.PartyCode || "";
    paymentFormElements.partyName.value = party?.PartyName || "";
    paymentFormElements.transactionType.value = data.TransactionType || "";
    paymentFormElements.paymentMode.value = data.PaymentMode || "";
    paymentFormElements.inputBankName.value = data.BankName || "";
    paymentFormElements.referenceNo.value = data.ReferenceNo || "";
    paymentFormElements.information.value = data.Narration || "";
    paymentFormElements.paymentAmount.value =
        safeNumber(data.PaymentAmount).toFixed(2);
    paymentFormElements.deductionAmount.value =
        safeNumber(data.DeductionAmount).toFixed(2);
}

// ------------------------------------------
// LOAD LINE ITEMS
// ------------------------------------------
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
    updateTotals();
}

function addRowFromDB(item) {

    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;
    const allocatedAmount = safeNumber(item.PaymentAmount);
    const otherDeduction = safeNumber(item.OtherDeductionAmount);
    const tdsDeduction = safeNumber(item.TDSDeductionAmount);

    const totalPayment = allocatedAmount + otherDeduction + tdsDeduction;

    const row = document.createElement("tr");

    row.innerHTML = `
        <td></td>
        <td>${item.InvoiceNo || ""}</td>
        <td>${item.VendorBillNo || ""}</td>
        <td>${item.Narration || ""}</td>

        <td class="allocatedAmount text-end">
            ${allocatedAmount.toFixed(2)}
        </td>

        <td class="otherDeduction text-end">
            ${otherDeduction.toFixed(2)}
        </td>

        <td class="tdsDeduction text-end">
            ${tdsDeduction.toFixed(2)}
        </td>

        <td class="totalPayment text-end">
            ${totalPayment.toFixed(2)}
        </td>

        <td>
            <button type="button"
                class="btn btn-sm btn-danger removeRowBtn">
                Delete
            </button>
        </td>
    `;

    row.querySelector(".removeRowBtn").addEventListener("click", () => {

        row.remove();

        updateRowNumbers();
        updateTotals();

        // Add bill back to datalist
        refreshBillDatalist();
    });

    tbody.appendChild(row);

    updateRowNumbers();
    updateTotals();

    // Remove loaded bill from datalist
    refreshBillDatalist();
}

// ------------------------------------------
// MODIFY MODE
// ------------------------------------------
modifyButton.addEventListener("click", function () {
    enableForm();

    // Enable delete buttons
    document.querySelectorAll("#paymentDetails tbody .removeRowBtn").forEach(btn => btn.disabled = false);

    // Lock PaymentID permanently
    paymentFormElements.paymentID.disabled = true;

    // Enable invoice inputs
    [
        "invoiceNumberInput",
        "accountedAmount",
        "otherDeuctionAmount",
        "tDSDeuctionAmount",
        "narration"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });

    addBillDetailsButton.disabled = false;

    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    modifyButton.disabled = true;
    deleteButton.disabled = false;
    reportButton.disabled = true;
    paymentFormElements.partyCode.disabled = true;
    paymentFormElements.partyName.disabled = true;

    paymentFormElements.billNumberInput.focus();
});

newButton.addEventListener("click", resetForm);

function resetForm() {
    document.querySelector("form")?.reset();
    document.querySelector("#paymentDetails tbody").innerHTML = "";
    updateTotals();

    document.getElementById("totalAllocatedAmount").textContent = "0.00";
    document.getElementById("totalOtherDeductionAmount").textContent = "0.00";
    document.getElementById("totalTDSDeductionAmount").textContent = "0.00";

    // Transaction Type from URL
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get("type");

    // Set transaction type
    if (type === "Credit" || type === "Debit") {
        paymentFormElements.transactionType.value = type;
        paymentFormElements.transactionType.disabled = true;

        loadPaymentIDSuggestions(CompanyID, "");
    } else {
        paymentFormElements.transactionType.value = "";
        paymentFormElements.transactionType.disabled = false;
    }

    // Button states
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;
    deleteButton.disabled = true;
    reportButton.disabled = true;

    // Enable inputs
    paymentFormElements.paymentID.disabled = false;
    paymentFormElements.paymentID.value = "";

    const paymentList = document.getElementById("paymentIDSuggestions");
    if (paymentList) paymentList.innerHTML = "";

    invoiceMap = {};

    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.value = "New";

    addBillDetailsButton.disabled = false;

    enableForm();
    paymentFormElements.paymentID.focus();
}