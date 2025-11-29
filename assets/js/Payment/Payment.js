// ------------------------------------------
//  FORM ELEMENTS
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

// ------------------------------------------
//  DOM LOADED
// ------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

    const accessGranted = await checkAccess(UserLoginID, 'PaymentDetailsCredit');

    if (!accessGranted) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }

    if (perWrite) saveButton.disabled = false;

    enableForm();
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await resetForm();
});

// ------------------------------------------
//  LOAD PAYMENT ID SUGGESTIONS (TYPEAHEAD)
// ------------------------------------------
async function loadPaymentIDSuggestions(companyID, inputVal = "") {
    const datalist = document.getElementById("paymentIDSuggestions");
    const transactionType = paymentFormElements.transactionType.value?.trim() || '';

    if (!datalist) {
        console.warn('Datalist element "paymentIDSuggestions" not found.');
        return;
    }

    datalist.innerHTML = ""; // Clear old options
    console.log("Fetching PaymentID suggestions:", inputVal);

    try {
        const { data, error } = await supabaseClient
            .from("PaymentDetails")
            .select("PaymentID")
            .eq("company_id", companyID)
            .eq("TransactionType", transactionType)
            .ilike("PaymentID", `%${inputVal}%`)
            .order("PaymentID", { ascending: true })
            .limit(50);

        if (error) {
            console.error("Error loading Payment IDs:", error.message);
            return;
        }

        data?.forEach(item => {
            const option = document.createElement("option");
            option.value = item.PaymentID;
            datalist.appendChild(option);
        });

    } catch (err) {
        console.error("Error loading suggestions:", err.message);
    }
}

// ------------------------------------------
//  EVENT LISTENERS
// ------------------------------------------
paymentFormElements.paymentID.addEventListener("input", function () {
    loadPaymentIDSuggestions(CompanyID, this.value);
});

paymentFormElements.paymentID.addEventListener("change", function (e) {
    fetchPaymentDetails(e);
});

paymentFormElements.invoiceNumberInput.addEventListener("input", async function () {
    const partyCode = paymentFormElements.partyCode.value.trim();
    await getPendingInvoiceDetails(partyCode);
});

paymentFormElements.partyName.addEventListener("input", function () {
    getPendingInvoiceDetails(paymentFormElements.partyCode.value.trim());
});

paymentFormElements.partyName.addEventListener("change", function () {
    getPendingInvoiceDetails(paymentFormElements.partyCode.value.trim());
});

// ------------------------------------------
//  RESET FORM
// ------------------------------------------
async function resetForm() {
    Object.values(paymentFormElements).forEach(el => {
        if (!el) return;
        if ("value" in el) el.value = "";
        if (el.classList.contains("form-control")) el.disabled = false;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get("type");

    if (type === "Credit" || type === "Debit") {
        paymentFormElements.transactionType.value = type;
        paymentFormElements.transactionType.disabled = true;
        pageTitle.textContent = `Payment Details - ${type}`;
    } else {
        paymentFormElements.transactionType.value = "";
        paymentFormElements.transactionType.disabled = false;
        pageTitle.textContent = "Payment Details";
    }

    paymentFormElements.paymentID.disabled = false;

    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    saveButton.disabled = false;
    modifyButton.disabled = true;
}

// ------------------------------------------
//  FETCH PAYMENT DETAILS
// ------------------------------------------
async function fetchPaymentDetails(e) {
    const selectedPaymentID = e.target.value.trim();
    if (!selectedPaymentID) return;

    console.log("Fetching details for PaymentID:", selectedPaymentID);

    try {
        const { data, error } = await supabaseClient
            .from("PaymentDetails")
            .select("*")
            .eq("PaymentID", selectedPaymentID)
            .eq("company_id", CompanyID)
            .maybeSingle();

        if (error || !data) return;

        await populateFormWithPaymentData(data);
        await loadPaymentLineItems(selectedPaymentID, CompanyID);

        await handlePostFetchActions();

    } catch (err) {
        console.error("Unexpected error:", err);
        alert("An unexpected error occurred. Please try again later.");
    }
}

// ------------------------------------------
//  SAFE NUMBER
// ------------------------------------------
function safeNumber(value) {
    return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
}

// ------------------------------------------
//  POPULATE FORM FIELDS
// ------------------------------------------
async function populateFormWithPaymentData(data) {
    const partyData = await getPartyDetailsByCode(data.PartyCode);

    paymentFormElements.receiptOn.value = data.ReceiptOn || '';
    paymentFormElements.partyCode.value = data.PartyCode || '';
    paymentFormElements.partyName.value = partyData?.PartyName || '';
    paymentFormElements.transactionType.value = data.TransactionType || '';
    paymentFormElements.paymentMode.value = data.PaymentMode || '';
    paymentFormElements.inputBankName.value = data.BankName || '';
    paymentFormElements.referenceNo.value = data.ReferenceNo || '';
    paymentFormElements.information.value = data.Narration || '';
    paymentFormElements.paymentAmount.value = safeNumber(data.PaymentAmount).toFixed(2);
    paymentFormElements.deductionAmount.value = safeNumber(data.DeductionAmount).toFixed(2);
}

// ------------------------------------------
//  POST FETCH ACTIONS
// ------------------------------------------
async function handlePostFetchActions() {
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;

    paymentFormElements.paymentID.disabled = true;

    modifyButton.disabled = false;

    disableForm();
}

// ------------------------------------------
//  LOAD PAYMENT LINE ITEMS
// ------------------------------------------
async function loadPaymentLineItems(paymentID) {
    const tableBody = document.querySelector("#paymentDetails tbody");

    if (!tableBody) return;

    tableBody.innerHTML = ""; // Clear previous rows

    try {
        const { data, error } = await supabaseClient
            .from("PaymentLineItems")
            .select("*")
            .eq("PaymentID", paymentID)
            .order("InvoiceNo", { ascending: true });

        if (error) {
            console.error("Error fetching line items:", error.message);
            return;
        }

        let totalAllocated = 0;
        let totalOtherDeduction = 0;
        let totalTDS = 0;

        data.forEach(item => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${item.InvoiceNo || ""}</td>
                <td>${item.Narration || ""}</td>
                <td class="text-end">${safeNumber(item.PaymentAmount).toFixed(2)}</td>
                <td class="text-end">${safeNumber(item.OtherDeductionAmount).toFixed(2)}</td>
                <td class="text-end">${safeNumber(item.TDSDeductionAmount).toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteLineItem('${item.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);

            // update totals
            totalAllocated += safeNumber(item.PaymentAmount);
            totalOtherDeduction += safeNumber(item.OtherDeductionAmount);
            totalTDS += safeNumber(item.TDSDeductionAmount);
        });

        // update footer totals
        document.getElementById("totalAllocatedAmount").textContent = totalAllocated.toFixed(2);
        document.getElementById("totalOtherDeductionAmount").textContent = totalOtherDeduction.toFixed(2);
        document.getElementById("totalTDSDeductionAmount").textContent = totalTDS.toFixed(2);

    } catch (err) {
        console.error("Unexpected error:", err.message);
    }
}

// ------------------------------------------
//GET PARTY CODE WISE INVOICE DETAILS FROM InvoiceDetails TABLE 
// ------------------------------------------

async function getPendingInvoiceDetails(partyCode) {
    // Fetch invoices from Supabase
    const { data, error } = await supabaseClient
        .from("InvoicePaymentView")
        .select("InvoiceNo, InvoiceDate, GrandTotalAmount, BalanceAmount") // fetch extra fields
        .neq("PaymentStatus", "Paid")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("InvoiceNo", { ascending: true });

    if (error) {
        console.error("Error fetching invoices:", error);
        return;
    }

    // Store invoice details in a map for quick lookup when user selects an invoice
    const invoiceMap = {};
    data.forEach(inv => {
        invoiceMap[inv.InvoiceNo] = {
            InvoiceDate: inv.InvoiceDate,
            GrandTotalAmount: inv.GrandTotalAmount,
            BalanceAmount: inv.BalanceAmount
        };
    });

    // Populate the datalist
    const datalist = document.getElementById("invoiceNumberList");
    datalist.innerHTML = ""; // clear previous options

    data.forEach(invoice => {
        const option = document.createElement("option");
        option.value = invoice.InvoiceNo;
        datalist.appendChild(option);
    });

    // Listen for user selecting an invoice
    const invoiceInput = document.getElementById("invoiceNumberInput");
    invoiceInput.addEventListener("change", function () {
        const selectedInvoice = invoiceInput.value;
        if (invoiceMap[selectedInvoice]) {
            document.getElementById("invoiceDate").value = invoiceMap[selectedInvoice].InvoiceDate;
            document.getElementById("invoiceAmount").value = invoiceMap[selectedInvoice].GrandTotalAmount;
            document.getElementById("invoiceBalance").value = invoiceMap[selectedInvoice].BalanceAmount;
        } else {
            // Clear fields if invoice not found
            document.getElementById("invoiceDate").value = "";
            document.getElementById("invoiceAmount").value = "";
            document.getElementById("invoiceBalance").value = "";
        }
    });

    // console.log("Invoices loaded:", data);
}

// ------------------------------------------
// ADD INVOICE DETAILS TO PAYMENT DETAILS TABLE
// ------------------------------------------

document.getElementById("addInvoiceDetailsButton").addEventListener("click", function () {
    // Get input values
    const invoiceNo = document.getElementById("invoiceNumberInput").value.trim();
    const accountedAmount = parseFloat(document.getElementById("accountedAmount").value) || 0;
    const otherDeduction = parseFloat(document.getElementById("otherDeuctionAmount").value) || 0;
    const tdsDeduction = parseFloat(document.getElementById("tDSDeuctionAmount").value) || 0;
    const narration = document.getElementById("narration").value.trim();

    if (!invoiceNo) {
        alert("Please select an invoice.");
        return;
    }

    // Reference table body
    const tbody = document.querySelector("#paymentDetails tbody");

    // Create new row
    const row = document.createElement("tr");

    row.innerHTML = `
        <td>${invoiceNo}</td>
        <td>${narration}</td>
        <td class="allocatedAmount text-end">${accountedAmount.toFixed(2)}</td>
        <td class="otherDeduction text-end">${otherDeduction.toFixed(2)}</td>
        <td class="tdsDeduction text-end">${tdsDeduction.toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger removeRowBtn">Delete</button>
        </td>
    `;

    tbody.appendChild(row);

    // Update totals
    updateTotals();

    // Clear inputs
    document.getElementById("invoiceNumberInput").value = "";
    document.getElementById("invoiceDate").value = "";
    document.getElementById("invoiceAmount").value = "";
    document.getElementById("invoiceBalance").value = "";
    document.getElementById("accountedAmount").value = "";
    document.getElementById("otherDeuctionAmount").value = "";
    document.getElementById("tDSDeuctionAmount").value = "";
    document.getElementById("narration").value = "";

    // Handle row deletion
    row.querySelector(".removeRowBtn").addEventListener("click", function () {
        row.remove();
        updateTotals();
    });
});

// Function to update totals
function updateTotals() {
    let totalAllocated = 0;
    let totalOtherDeduction = 0;
    let totalTDSDeduction = 0;

    document.querySelectorAll("#paymentDetails tbody tr").forEach(row => {
        totalAllocated += parseFloat(row.querySelector(".allocatedAmount").textContent) || 0;
        totalOtherDeduction += parseFloat(row.querySelector(".otherDeduction").textContent) || 0;
        totalTDSDeduction += parseFloat(row.querySelector(".tdsDeduction").textContent) || 0;
    });

    document.getElementById("totalAllocatedAmount").textContent = totalAllocated.toFixed(2);
    document.getElementById("totalOtherDeductionAmount").textContent = totalOtherDeduction.toFixed(2);
    document.getElementById("totalTDSDeductionAmount").textContent = totalTDSDeduction.toFixed(2);
}



// ------------------------------------------