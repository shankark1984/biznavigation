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
    invoiceNumberInput: document.getElementById("invoiceNumberInput")
};



const accountedAmountInput = document.getElementById("accountedAmount");
const invoiceBalanceInput = document.getElementById("invoiceBalance");
const paymentAmountInput = document.getElementById("paymentAmount");

const invoiceDate = document.getElementById("invoiceDate");
const invoiceAmount = document.getElementById("invoiceAmount");
const addInvoiceDetailsButton = document.getElementById("addInvoiceDetailsButton");

// global buttons / title (assumed already present in DOM)
const pageTitle = document.getElementById("pageTitle");

// ------------------------------------------
// GLOBALS
// ------------------------------------------
let invoiceMap = {};
let paymentIDTimer = null;

// ------------------------------------------
// DOM LOADED
// ------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

    enableForm();
    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);
    updatePageTitle();
    resetForm();

    const suspenseModalEl = document.getElementById("suspenseModal");

    suspenseModalEl.addEventListener("hidden.bs.modal", function () {
        // 🔥 Move focus safely outside modal
        document.getElementById("paymentID")?.focus();

        if (!suspensePaymentSelected) {
            enableNewEntry();  // user closed without selecting
        }
    });
});

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

newButton.addEventListener("click", resetForm);

paymentFormElements.partyName.addEventListener("change", async () => {
    const partyCode = paymentFormElements.partyCode.value.trim();
    if (!partyCode) return;

    await checkSuspensePayments(partyCode);
});


paymentFormElements.transactionType.addEventListener("change", () => {
    if (!paymentFormElements.paymentID.value.trim()) {
        loadPaymentIDSuggestions(CompanyID, "");
    }
});

document.getElementById("paymentAmount")
    .addEventListener("input", calculateSuspenseAmount);

document.getElementById("deductionAmount")
    .addEventListener("input", calculateSuspenseAmount);

accountedAmountInput.addEventListener("input", validateAccountedAmount);

// ------------------------------------------
// INVOICE CHANGE (ONCE)
// ------------------------------------------
paymentFormElements.invoiceNumberInput.addEventListener("change", function () {
    const inv = invoiceMap[this.value];

    if (inv) {
        invoiceDate.value = inv.InvoiceDate || "";
        invoiceAmount.value = safeNumber(inv.GrandTotalAmount).toFixed(2);
        invoiceBalanceInput.value = safeNumber(inv.BalanceAmount).toFixed(2);
        accountedAmountInput.focus();
        addInvoiceDetailsButton.disabled = false;
    } else {
        invoiceDate.value = "";
        invoiceAmount.value = "";
        invoiceBalanceInput.value = "";
        addInvoiceDetailsButton.disabled = true;
    }
});

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
    addInvoiceDetailsButton.disabled = true;
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
        .eq("PaymentID", paymentID);

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

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${item.InvoiceNo}</td>
        <td>${item.Narration || ""}</td>
        <td class="allocatedAmount text-end">${safeNumber(
        item.PaymentAmount
    ).toFixed(2)}</td>
        <td class="otherDeduction text-end">${safeNumber(
        item.OtherDeductionAmount
    ).toFixed(2)}</td>
        <td class="tdsDeduction text-end">${safeNumber(
        item.TDSDeductionAmount
    ).toFixed(2)}</td>
        <td><button class="btn btn-sm btn-danger removeRowBtn">Delete</button></td>
    `;

    row.querySelector(".removeRowBtn").onclick = () => {
        row.remove();
        updateTotals();
    };

    tbody.appendChild(row);
}

// ------------------------------------------
// LOAD PARTY INVOICES
// ------------------------------------------
async function getPendingInvoiceDetails(partyCode) {
    if (!partyCode) return;

    const { data, error } = await supabaseClient
        .from("InvoicePaymentView")
        .select("InvoiceNo, InvoiceDate, GrandTotalAmount, BalanceAmount")
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID);

    if (error) {
        console.error(error);
        return;
    }

    invoiceMap = {};
    const datalist = document.getElementById("invoiceNumberList");
    if (!datalist) return;

    datalist.innerHTML = "";

    data?.forEach((inv) => {
        invoiceMap[inv.InvoiceNo] = inv;
        const opt = document.createElement("option");
        opt.value = inv.InvoiceNo;
        datalist.appendChild(opt);
    });
}

// ------------------------------------------
// ADD INVOICE ROW
// ------------------------------------------
addInvoiceDetailsButton.addEventListener("click", () => {
    const invoiceNo = paymentFormElements.invoiceNumberInput.value.trim();
    const accounted = safeNumber(accountedAmountInput.value);
    const other = safeNumber(
        document.getElementById("otherDeuctionAmount").value
    );
    const tds = safeNumber(document.getElementById("tDSDeuctionAmount").value);
    const narration = document.getElementById("narration").value.trim();

    if (!invoiceNo || !validateAccountedAmount() || accounted <= 0) {
        showToast("Invalid allocation data.");
        return;
    }

    const tbody = document.querySelector("#paymentDetails tbody");
    if (!tbody) return;

    // Prevent duplicate invoice rows
    if (
        [...tbody.rows].some(
            (r) => r.cells[0].textContent.trim() === invoiceNo
        )
    ) {
        showToast("Invoice already added.");
        return;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${invoiceNo}</td>
        <td>${narration}</td>
        <td class="allocatedAmount text-end">${accounted.toFixed(2)}</td>
        <td class="otherDeduction text-end">${other.toFixed(2)}</td>
        <td class="tdsDeduction text-end">${tds.toFixed(2)}</td>
        <td><button class="btn btn-sm btn-danger removeRowBtn">Delete</button></td>
    `;

    row.querySelector(".removeRowBtn").onclick = () => {
        row.remove();
        updateTotals();
    };

    tbody.appendChild(row);
    updateTotals();
    clearInvoiceInputs();
    paymentFormElements.invoiceNumberInput.focus();

});

// ------------------------------------------
// TOTALS
// ------------------------------------------
function updateTotals() {
    let totalAllocated = 0;
    let totalOtherDeduction = 0;
    let totalTDSDeduction = 0;

    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        totalAllocated += safeNumber(
            row.querySelector(".allocatedAmount")?.textContent
        );
        totalOtherDeduction += safeNumber(
            row.querySelector(".otherDeduction")?.textContent
        );
        totalTDSDeduction += safeNumber(
            row.querySelector(".tdsDeduction")?.textContent
        );
    });

    document.getElementById("totalAllocatedAmount").textContent =
        totalAllocated.toFixed(2);
    document.getElementById("totalOtherDeductionAmount").textContent =
        totalOtherDeduction.toFixed(2);
    document.getElementById("totalTDSDeductionAmount").textContent =
        totalTDSDeduction.toFixed(2);

    calculateSuspenseAmount();
}


// ------------------------------------------
// VALIDATION
// ------------------------------------------
function validateAccountedAmount() {
    const amt = safeNumber(accountedAmountInput.value);
    const paymentAmt = safeNumber(paymentAmountInput.value);
    const invoiceBal = safeNumber(invoiceBalanceInput.value);

    const invoiceNo = paymentFormElements.invoiceNumberInput.value.trim();

    let allocatedSoFar = 0;
    document.querySelectorAll("#paymentDetails tbody tr").forEach(r => {
        if (r.cells[0].textContent.trim() !== invoiceNo) {
            allocatedSoFar += safeNumber(r.querySelector(".allocatedAmount").textContent);
        }
    });

    if (amt <= 0 || amt > invoiceBal || amt + allocatedSoFar > paymentAmt) {
        accountedAmountInput.style.border = "2px solid red";
        return false;
    }

    accountedAmountInput.style.border = "";
    return true;
}

// ------------------------------------------
// HELPERS
// ------------------------------------------

function clearInvoiceInputs() {
    [
        "invoiceNumberInput",
        "invoiceDate",
        "invoiceAmount",
        "invoiceBalance",
        "accountedAmount",
        "otherDeuctionAmount",
        "tDSDeuctionAmount",
        "narration"
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

// ------------------------------------------
// RESET FORM
// ------------------------------------------
function updatePageTitle() {
    const type = new URLSearchParams(window.location.search).get("type");

    if (type && (type.toLowerCase() === "credit" || type.toLowerCase() === "debit")) {
        document.title = `Payment Details - ${type}`;
    } else {
        document.title = "Payment Details";
    }
}
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

    // ✅ Update browser title (single line)
    updatePageTitle();

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

    addInvoiceDetailsButton.disabled = false;

    enableForm();
    paymentFormElements.paymentID.focus();
}
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


// ------------------------------------------
// SAVE / UPDATE PAYMENT
// ------------------------------------------
saveButton.addEventListener("click", async function () {
    const isEditMode = saveButton.innerHTML.includes("Update");

    saveButton.disabled = true;
    if (!validateSuspenseBeforeSave()) {
        saveButton.disabled = false;
        return;
    }

    if (!paymentFormElements.receiptOn.value) {
        showToast("Receipt date is required");
        saveButton.disabled = false;
        return;
    }
    let PaymentID = paymentFormElements.paymentID.value.trim();
    const suspenseAmount = calculateSuspenseAmount();

    // Generate PaymentID ONLY for NEW
    if (!isEditMode) {
        PaymentID = await generatePaymentID(CompanyID);
        paymentFormElements.paymentID.value = PaymentID;
    }

    if (!PaymentID) {
        showToast("Payment ID is required");
        return;
    }

    const paymentPayload = {
        PaymentID,
        SuspenseAmount: suspenseAmount,
        PartyCode: paymentFormElements.partyCode.value.trim(),
        TransactionType: paymentFormElements.transactionType.value,
        PaymentMode: paymentFormElements.paymentMode.value,
        ReceiptOn: paymentFormElements.receiptOn.value,
        BankName: paymentFormElements.inputBankName.value,
        ReferenceNo: paymentFormElements.referenceNo.value,
        PaymentAmount:
            parseFloat(paymentFormElements.paymentAmount.value) || 0,
        DeductionAmount:
            parseFloat(paymentFormElements.deductionAmount.value) || 0,
        Narration: paymentFormElements.information.value,
        company_id: CompanyID
    };

    if (isEditMode) {
        paymentPayload.update_by = UserLoginID;
        paymentPayload.update_at = new Date().toISOString();
    } else {
        paymentPayload.created_by = UserLoginID;
        paymentPayload.created_at = new Date().toISOString();
    }

    try {
        let paymentResult;

        if (isEditMode) {
            // For update, optionally chain .select() if you need updated rows
            paymentResult = await supabaseClient
                .from("PaymentDetails")
                .update(paymentPayload)
                .eq("PaymentID", PaymentID)
                .eq("company_id", CompanyID)
                .select();
        } else {
            paymentResult = await supabaseClient
                .from("PaymentDetails")
                .insert(paymentPayload)
                .select();
        }

        if (paymentResult.error) {
            console.error(paymentResult.error);
            showToast("Failed to save Payment Details");
            saveButton.disabled = false;
            return;
        }

        // Delete old line items in edit mode
        if (isEditMode) {
            const { error: delError } = await supabaseClient
                .from("PaymentLineItems")
                .delete()
                .eq("PaymentID", PaymentID);

            if (delError) {
                console.error(delError);
                showToast("Failed to refresh invoice details");
                return;
            }
        }

        // Collect line items
        const lineItems = [];
        document
            .querySelectorAll("#paymentDetails tbody tr")
            .forEach((row) => {
                lineItems.push({
                    PaymentID,
                    InvoiceNo: row.cells[0].innerText.trim(),
                    Narration: row.cells[1].innerText.trim(),
                    PaymentAmount:
                        parseFloat(
                            row.querySelector(".allocatedAmount")?.innerText
                        ) || 0,
                    OtherDeductionAmount:
                        parseFloat(
                            row.querySelector(".otherDeduction")?.innerText
                        ) || 0,
                    TDSDeductionAmount:
                        parseFloat(
                            row.querySelector(".tdsDeduction")?.innerText
                        ) || 0,
                    created_by: UserLoginID,
                    created_at: new Date().toISOString()
                });
            });

        // Insert line items
        if (lineItems.length) {
            const { error: liError } = await supabaseClient
                .from("PaymentLineItems")
                .insert(lineItems);

            if (liError) {
                console.error(liError);
                showToast("Failed to save Invoice Details");
                return;
            }
        }

        // SUCCESS UI STATE
        disableForm();
        modifyButton.disabled = false;
        reportButton.disabled = false;
        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

        showToast(
            isEditMode
                ? "Payment updated successfully"
                : "Payment saved successfully"
        );
        reportButton.disabled = false;
    } catch (err) {
        console.error(err);
        showToast("Unexpected error occurred");
        saveButton.disabled = false; // 🔥
    }
});

// ------------------------------------------
// SUSPENSE / TOTAL HELPERS
// ------------------------------------------
function getAllocationTotals() {
    return {
        allocated:
            parseFloat(
                document.getElementById("totalAllocatedAmount").textContent
            ) || 0,
        otherDeduction:
            parseFloat(
                document.getElementById(
                    "totalOtherDeductionAmount"
                ).textContent
            ) || 0,
        tdsDeduction:
            parseFloat(
                document.getElementById(
                    "totalTDSDeductionAmount"
                ).textContent
            ) || 0
    };
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

// ------------------------------------------
// MODIFY MODE
// ------------------------------------------
modifyButton.addEventListener("click", function () {
    enableForm();

    // Enable delete buttons
    document
        .querySelectorAll("#paymentDetails tbody .removeRowBtn")
        .forEach(btn => btn.disabled = false);

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

    addInvoiceDetailsButton.disabled = false;

    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    modifyButton.disabled = true;
    deleteButton.disabled = false;
    reportButton.disabled = true;
    paymentFormElements.partyCode.disabled = true;
    paymentFormElements.partyName.disabled = true;

    paymentFormElements.invoiceNumberInput.focus();
});

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

    paymentFormElements.paymentID.value = paymentID;

    // Trigger existing flow
    paymentFormElements.paymentID.dispatchEvent(
        new Event("change", { bubbles: true })
    );

    showToast("Modify existing payment to clear suspense");
}

function disableNewEntry() {
    saveButton.disabled = true;
    addInvoiceDetailsButton.disabled = true;

    // paymentFormElements.invoiceNumberInput.disabled = true;
    // accountedAmountInput.disabled = true;
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

        // 🔥 After hidden, move focus to PaymentID
        modalEl.addEventListener("hidden.bs.modal", () => {
            paymentFormElements.paymentID.focus();
        }, { once: true });
    }
}

//report / PDF generation
reportButton.addEventListener("click", async () => {
    const paymentID = paymentFormElements.paymentID.value.trim();
    if (!paymentID) {
        showToast("Select payment first");
        return;
    }

    await downloadReceiptPDF(paymentID);
});

async function downloadReceiptPDF(paymentID) {

    const { data: header, error: hErr } = await supabaseClient
        .from("PaymentDetails")
        .select("*")
        .eq("PaymentID", paymentID)
        .eq("company_id", CompanyID)
        .single();

    if (hErr || !header) {
        showToast("Receipt header not found");
        return;
    }

    const { data: lines, error: lErr } = await supabaseClient
        .from("PaymentLineItems")
        .select("*")
        .eq("PaymentID", paymentID);

    if (lErr) {
        showToast("Receipt lines not found");
        return;
    }

    generateReceiptPDF(header, lines);
}

/* -------------------------------
   GENERATE RECEIPT PDF
-------------------------------- */
async function generateReceiptPDF(header, lines) {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    /* ==============================
       CONSTANTS
    ============================== */
    const PAGE = { x: 10, w: 190 };
    const FONT = { header: 14, title: 10, body: 8, small: 7 };

    let y = 10;

    /* ==============================
       SAFETY GUARDS
    ============================== */
    if (!Array.isArray(lines)) lines = [];

    /* ==============================
       COMPANY DETAILS (FROM DB)
    ============================== */
    const companyData = await getCompanyProfile(CompanyID);

    const company = {
        name: companyData?.company_name || "",
        address: [
            companyData?.address,
            companyData?.city && `${companyData.city} - ${companyData.pin_code}`,
            companyData?.state,
            companyData?.country
        ].filter(Boolean).join(", "),
        phone: companyData?.phone_no || "-",
        email: companyData?.e_mail || "-",
        gst: companyData?.gst_number || "-",
        pan: companyData?.pan_number || "-",
        logo: companyData?.logo_path
    };

    /* ==============================
       HEADER (LOGO + TEXT)
    ============================== */
    const headerH = 20;
    const logoW = PAGE.w * 0.20;
    const textW = PAGE.w * 0.75;

    safeRect(doc, PAGE.x, y, PAGE.w, headerH);

    /* ---- LOGO AUTO FIT ---- */
    const logoImg = await loadImage(company.logo);
    if (logoImg) {
        const maxW = logoW - 6;
        const maxH = headerH - 4;
        const ratio = logoImg.width / logoImg.height;

        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
            h = maxH;
            w = h * ratio;
        }

        doc.addImage(
            logoImg,
            "PNG",
            PAGE.x + (logoW - w) / 2,
            y + (headerH - h) / 2,
            w,
            h
        );
    }

    /* ---- HEADER TEXT ---- */
    const textX = PAGE.x + logoW + 4;
    const centerY = y + headerH / 2;

    doc.setFont("helvetica", "bold");
    let nameFont = FONT.header;
    while (doc.getTextWidth(company.name) > textW - 8 && nameFont > 9) {
        nameFont--;
        doc.setFontSize(nameFont);
    }

    doc.text(company.name, textX + textW / 2, centerY - 4, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT.body);
    doc.text(
        doc.splitTextToSize(company.address, textW - 8),
        textX + textW / 2,
        centerY + 1,
        { align: "center" }
    );

    doc.setFontSize(FONT.small);
    doc.text(
        `Ph: ${company.phone} | ${company.email} | GST: ${company.gst} | PAN: ${company.pan}`,
        textX + textW / 2,
        centerY + 7,
        { align: "center" }
    );

    y += headerH;

    /* ==============================
       RECEIPT TITLE
    ============================== */
    safeRect(doc, PAGE.x, y, PAGE.w, 6);
    doc.setFontSize(FONT.title);
    doc.text("PAYMENT RECEIPT", PAGE.x + PAGE.w / 2, y + 4, { align: "center" });
    y += 6;

    /* ==============================
       RECEIPT INFO
    ============================== */
    const infoH = 30;
    safeRect(doc, PAGE.x, y, PAGE.w, infoH);

    doc.setFontSize(FONT.body);
    let iy = y + 7;

    doc.text(`Receipt No: ${header?.PaymentID || "-"}`, PAGE.x + 5, iy);
    doc.text(`Date: ${formatDate(header?.ReceiptOn) || "-"}`, PAGE.x + 140, iy);


    iy += 6;
    doc.text(`Party: ${paymentFormElements?.partyName?.value || "-"}`, PAGE.x + 5, iy);
    doc.text(`Payment Amount: ${safeNumber(header?.PaymentAmount).toFixed(2)}`, PAGE.x + 140, iy);

    iy += 6;
    doc.text(`Payment Mode: ${header?.PaymentMode || "-"}`, PAGE.x + 5, iy);
    doc.text(`Deduction Amount: ${safeNumber(header?.DeductionAmount).toFixed(2)}`, PAGE.x + 140, iy);

    iy += 6;
    doc.text(`Reference No: ${header?.ReferenceNo || "-"}`, PAGE.x + 5, iy);

    y += infoH;

    /* ==============================
       INVOICE TABLE + TOTALS
    ============================== */
    let totalAllocated = 0;
    let totalOther = 0;
    let totalTDS = 0;

    lines.forEach(l => {
        totalAllocated += safeNumber(l?.PaymentAmount);
        totalOther += safeNumber(l?.OtherDeductionAmount);
        totalTDS += safeNumber(l?.TDSDeductionAmount);
    });

    doc.autoTable({
        startY: y,
        margin: { left: PAGE.x, right: PAGE.x },

        head: [["Sl", "Invoice No", "Allocated", "Other Deduction", "TDS Deduction"]],

        body: lines.map((l, i) => ([
            i + 1,
            l?.InvoiceNo || "",
            safeNumber(l?.PaymentAmount).toFixed(2),
            safeNumber(l?.OtherDeductionAmount).toFixed(2),
            safeNumber(l?.TDSDeductionAmount).toFixed(2)
        ])),

        foot: [[
            "",
            "TOTAL",
            totalAllocated.toFixed(2),
            totalOther.toFixed(2),
            totalTDS.toFixed(2)
        ]],

        styles: {
            fontSize: FONT.body,
            cellPadding: 2,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            textColor: [0, 0, 0]
        },

        headStyles: { fontStyle: "bold", halign: "center" },
        footStyles: { fontStyle: "bold", halign: "right" },

        columnStyles: {
            0: { halign: "center", cellWidth: 12 },
            1: { halign: "right", cellWidth: 60 },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" }
        }
    });

    y = doc.lastAutoTable.finalY;
    safeRect(doc, PAGE.x, y - doc.lastAutoTable.height, PAGE.w, doc.lastAutoTable.height);

    /* ==============================
       TOTAL SUMMARY
    ============================== */
    safeRect(doc, PAGE.x, y, PAGE.w, 22);
    doc.text(`Payment Amount: ${safeNumber(header?.PaymentAmount).toFixed(2)}`, PAGE.x + 5, y + 6);
    doc.text(`Deduction Amount: ${safeNumber(header?.DeductionAmount).toFixed(2)}`, PAGE.x + 5, y + 12);
    doc.text(`Suspense Amount: ${safeNumber(header?.SuspenseAmount).toFixed(2)}`, PAGE.x + 5, y + 18);

    y += 22;

    /* ==============================
       FOOTER (AUTO HEIGHT – SINGLE LINE)
    ============================== */
    const footerText = "Thank you for your payment!";
    doc.setFontSize(9);

    const lineHeight = doc.getLineHeight(footerText) / doc.internal.scaleFactor;
    const paddingY = 4;
    const footerH = lineHeight + paddingY * 2;

    safeRect(doc, PAGE.x, y, PAGE.w, footerH);

    doc.text(
        footerText,
        PAGE.x + PAGE.w / 2,
        y + footerH / 2,
        { align: "center", baseline: "middle" }
    );

    /* ==============================
       DOWNLOAD
    ============================== */
    doc.save(`Payment_Receipt_${header?.PaymentID || "NA"}.pdf`);
}



