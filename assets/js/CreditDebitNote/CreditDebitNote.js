document.addEventListener("DOMContentLoaded", async () => {
    await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);
    loadTaxData();
});

const referenceType = document.getElementById("referenceType");
const referenceInvoice = document.getElementById("referenceInvoice");
const suggestionBox = document.getElementById("referenceSuggestions");

const fullAmount = document.getElementById("fullAmount");
const partyDefaultTax = document.getElementById("partyDefaultTax");
const totalAmount = document.getElementById("totalAmount");

const addCreditDebitRow = document.getElementById("addCreditDebitRow");
const creditDebitTable = document.getElementById("creditDebitTable");

let currentTable = "";
let currentColumn = "";

// Change Reference Type
referenceType.addEventListener("change", function () {

    referenceInvoice.value = "";
    suggestionBox.innerHTML = "";
    suggestionBox.style.display = "none";

    switch (this.value) {

        case "Customer Invoice":
            currentTable = "InvoicePaymentView";
            currentColumn = "InvoiceNo";
            break;

        case "Vendor Bill":
            currentTable = "VendorBillPaymentView";
            currentColumn = "BillReferenceNo";
            break;

        default:
            currentTable = "";
            currentColumn = "";
    }
});

// Search while typing
referenceInvoice.addEventListener("input", function () {

    clearTimeout(debounceTimer);

    const search = this.value.trim();

    if (!currentTable || search.length < 2) {
        suggestionBox.style.display = "none";
        return;
    }

    debounceTimer = setTimeout(() => {
        searchReferences(search);
    }, 300);

});

async function searchReferences(searchText) {
    const PartyCode = document.getElementById("partyCode").value;
    const { data, error } = await supabaseClient
        .from(currentTable)
        .select(currentColumn)
        .eq("PartyCode", PartyCode)
        .eq("company_id", CompanyID)
        .neq("PaymentStatus", "Paid")
        .ilike(currentColumn, `%${searchText}%`)
        .order(currentColumn)
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    renderSuggestions(data);
}

function renderSuggestions(data) {

    suggestionBox.innerHTML = "";

    if (!data.length) {
        suggestionBox.style.display = "none";
        return;
    }

    data.forEach(row => {

        const value = row[currentColumn];

        const item = document.createElement("button");
        item.type = "button";
        item.className = "list-group-item list-group-item-action";
        item.textContent = value;

        item.onclick = () => {
            referenceInvoice.value = value;
            suggestionBox.style.display = "none";
        };

        suggestionBox.appendChild(item);

    });

    suggestionBox.style.display = "block";
}

// Hide dropdown when clicking outside
document.addEventListener("click", function (e) {

    if (
        !referenceInvoice.contains(e.target) &&
        !suggestionBox.contains(e.target)
    ) {
        suggestionBox.style.display = "none";
    }

});

document.getElementById("addCreditDebitRow").addEventListener("click", async function () {
    addCreditDebitRow.disabled = false;
    const referenceInvoice = document.getElementById("referenceInvoice").value.trim();
    const item = document.getElementById("item").value.trim();
    const description = document.getElementById("description").value.trim();
    const hsnCode = document.getElementById("hsnCode").value.trim();

    const quantity = parseFloat(document.getElementById("quantity").value) || 0;
    const taxableAmount = parseFloat(document.getElementById("fullAmount").value) || 0;

    const taxId = partyDefaultTax.value;

    // ===========================
    // Validation
    // ===========================
    if (!referenceInvoice) {
        alert("Please select Reference Invoice.");
        referenceInvoice.focus();
        return;
    }

    if (!item) {
        alert("Please select Item.");
        document.getElementById("item").focus();
        return;
    }

    if (!description) {
        alert("Please enter Description.");
        document.getElementById("description").focus();
        return;
    }

    if (!hsnCode) {
        alert("Please enter HSN Code.");
        document.getElementById("hsnCode").focus();
        return;
    }

    if (quantity <= 0) {
        alert("Please enter Quantity.");
        document.getElementById("quantity").focus();
        return;
    }

    if (taxableAmount <= 0) {
        alert("Please enter Amount.");
        document.getElementById("fullAmount").focus();
        return;
    }

    if (!taxId) {
        alert("Please select Tax.");
        partyDefaultTax.focus();
        return;
    }

    // ===========================
    // Get Tax Details
    // ===========================
    const taxRates = await getTaxRatesById(taxId);

    const cgstPercent = parseFloat(taxRates.cgst || 0);
    const sgstPercent = parseFloat(taxRates.sgst || 0);
    const igstPercent = parseFloat(taxRates.igst || 0);
    const cessPercent = parseFloat(taxRates.cess || 0);
    const gstPercent = parseFloat(taxRates.tax_rate || 0);

    // ===========================
    // Calculate Tax
    // ===========================
    const cgstAmount = taxableAmount * cgstPercent / 100;
    const sgstAmount = taxableAmount * sgstPercent / 100;
    const igstAmount = taxableAmount * igstPercent / 100;
    const cessAmount = taxableAmount * cessPercent / 100;

    const totalGST = cgstAmount + sgstAmount + igstAmount + cessAmount;

    const grandTotal = taxableAmount + totalGST;
    let nonTaxableAmount = 0;
    if (totalGST <= 0) {
        nonTaxableAmount = taxableAmount;
    }

    // ===========================
    // Add Row
    // ===========================
    const tbody = document.querySelector("#creditDebitTable tbody");

    const srNo = tbody.rows.length + 1;

    const row = tbody.insertRow();

    row.innerHTML = `
        <td>${srNo}</td>
        <td>${referenceInvoice}</td>
        <td>${item}</td>
        <td>${description}</td>
        <td>${hsnCode}</td>
        <td class="text-end">${gstPercent.toFixed(2)}%</td>
        <td class="text-end">${cessPercent.toFixed(2)}%</td>
        <td class="text-end">${quantity.toFixed(2)}</td>
        <td class="text-end">${nonTaxableAmount.toFixed(2)}</td>
        <td class="text-end">${taxableAmount.toFixed(2)}</td>
        <td class="text-end">${sgstAmount.toFixed(2)}</td>
        <td class="text-end">${cgstAmount.toFixed(2)}</td>
        <td class="text-end">${igstAmount.toFixed(2)}</td>
        <td class="text-end">${cessAmount.toFixed(2)}</td>
        <td class="text-end">${totalGST.toFixed(2)}</td>
        <td class="text-end">${grandTotal.toFixed(2)}</td>

        <td class="text-center">
            <button type="button" class="btn btn-danger btn-sm removeRow">
                <i class="bi bi-trash"></i>
            </button>
        </td>

        <td class="d-none">${cgstPercent}</td>
        <td class="d-none">${sgstPercent}</td>
        <td class="d-none">${igstPercent}</td>
        <td class="d-none">${taxId}</td>
    `;

    // ===========================
    // Update Totals
    // ===========================
    updateCreditDebitTotals();

    // ===========================
    // Clear Controls
    // ===========================
    document.getElementById("referenceInvoice").value = "";
    document.getElementById("item").value = "";
    document.getElementById("description").value = "";
    document.getElementById("hsnCode").value = "";
    document.getElementById("quantity").value = "";
    document.getElementById("fullAmount").value = "";
    document.getElementById("totalAmount").value = "";
    partyDefaultTax.selectedIndex = 0;

    addCreditDebitRow.disabled = false;
});

document.querySelector("#creditDebitTable tbody").addEventListener("click", function (e) {

    const btn = e.target.closest(".removeRow");

    if (!btn) return;

    btn.closest("tr").remove();

    // Re-number Sr No
    [...document.querySelectorAll("#creditDebitTable tbody tr")].forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });

    updateCreditDebitTotals();
});

function updateCreditDebitTotals() {

    let nonTax = 0;
    let tax = 0;
    let sgst = 0;
    let cgst = 0;
    let igst = 0;
    let cess = 0;
    let gst = 0;
    let grand = 0;

    document.querySelectorAll("#creditDebitTable tbody tr").forEach(row => {

        nonTax += parseFloat(row.cells[8].textContent) || 0;
        tax += parseFloat(row.cells[9].textContent) || 0;
        sgst += parseFloat(row.cells[10].textContent) || 0;
        cgst += parseFloat(row.cells[11].textContent) || 0;
        igst += parseFloat(row.cells[12].textContent) || 0;
        cess += parseFloat(row.cells[13].textContent) || 0;
        gst += parseFloat(row.cells[14].textContent) || 0;
        grand += parseFloat(row.cells[15].textContent) || 0;
    });

    document.getElementById("totalNonTaxAmt").textContent = nonTax.toFixed(2);
    document.getElementById("totalTaxAmt").textContent = tax.toFixed(2);
    document.getElementById("totalSGST").textContent = sgst.toFixed(2);
    document.getElementById("totalCGST").textContent = cgst.toFixed(2);
    document.getElementById("totalIGST").textContent = igst.toFixed(2);
    document.getElementById("totalCESSAmt").textContent = cess.toFixed(2);
    document.getElementById("totalGST").textContent = gst.toFixed(2);
    document.getElementById("totalGrand").textContent = grand.toFixed(2);
}

async function calculateTotalAmount() {

    const amount = parseFloat(fullAmount.value) || 0;
    if (!partyDefaultTax.value) {
        totalAmount.value = fullAmount.value || "";
        return;
    }
    const taxRates = await getTaxRatesById(partyDefaultTax.value); // This should contain a string like "CGST 9%, SGST 9%"

    // Read tax percentages from option data attributes
    const cgst = parseFloat(taxRates.cgst || 0);
    const sgst = parseFloat(taxRates.sgst || 0);
    const igst = parseFloat(taxRates.igst || 0);
    const cess = parseFloat(taxRates.cess || 0);

    const taxPercent = cgst + sgst + igst + cess;

    const taxAmount = amount * taxPercent / 100;
    const grandTotal = amount + taxAmount;

    totalAmount.value = grandTotal.toFixed(2);
}

// Recalculate whenever amount or tax changes
fullAmount.addEventListener("input", calculateTotalAmount);
partyDefaultTax.addEventListener("change", calculateTotalAmount);

document.getElementById("partyCode").addEventListener("change", () => {

    referenceInvoice.value = "";
    suggestionBox.innerHTML = "";
    suggestionBox.style.display = "none";

});

document.getElementById("saveButton").addEventListener("click", async () => {
    await saveUpdateCreditDebitNote();
});

async function generateNewCreditDebitNoteNo() {
    const { data, error } = await supabaseClient.rpc(
        "generate_document_no",
        {
            p_company_id: CompanyID,
            p_document_type: "credit_debit_notes"
        }
    );

    if (error) {
        console.error(error);
    } else {
        document.getElementById("noteNo").value = data;
    }
}

async function saveUpdateCreditDebitNote() {

    const btnSave = document.getElementById("saveButton");
    btnSave.disabled = true;

    try {

        const noteId = document.getElementById("noteNo").value.trim();
        const now = localtimeStamp;

        if (!document.getElementById("noteType").value) {
            alert("Please select Note Type.");
            btnSave.disabled = false;
            document.getElementById("noteType").focus();
            return;
        }

        if (!document.getElementById("noteDate").value) {
            alert("Please select note date.");
            btnSave.disabled = false;
            document.getElementById("noteDate").focus();
            return;
        }

        if (!document.getElementById("partyName").value) {
            alert("Please select Party Name.");
            btnSave.disabled = false;
            document.getElementById("partyName").focus();
            return;
        }

        if (!document.getElementById("referenceType").value) {
            alert("Please select Reference Type.");
            btnSave.disabled = false;
            document.getElementById("referenceType").focus();
            return;
        }
        if (!document.querySelector("#creditDebitTable tbody tr")) {
            alert("Please add at least one item.");
            return;
        }
        // Generate Note No only for new record
        if (!noteId) {
            await generateNewCreditDebitNoteNo();
        }

        const record = {
            company_id: CompanyID,
            note_no: document.getElementById("noteNo").value.trim(),
            note_date: document.getElementById("noteDate").value,
            note_type: document.getElementById("noteType").value,
            party_id: document.getElementById("partyCode").value.trim(),
            party_name: document.getElementById("partyName").value.trim(),
            reference_type: document.getElementById("referenceType").value.trim(),
            reason: document.getElementById("reason").value.trim(),
            remarks: document.getElementById("remarks").value.trim(),

            taxable_amount: Number(document.getElementById("totalTaxAmt").value) || 0,
            non_taxable_amount: Number(document.getElementById("totalNonTaxAmt").textContent) || 0,
            sgst_amount: Number(document.getElementById("totalSGST").textContent) || 0,
            cgst_amount: Number(document.getElementById("totalCGST").textContent) || 0,
            igst_amount: Number(document.getElementById("totalIGST").textContent) || 0,
            cess_amount: Number(document.getElementById("totalCESSAmt").textContent) || 0,
            total_gst: Number(document.getElementById("totalGST").textContent) || 0,
            total_amount: Number(document.getElementById("totalGrand").textContent) || 0,

            updated_by: UserLoginID,
            updated_at: now
        };
        console.log(record);
        let header;

        if (noteId) {

            record.updated_by = UserLoginID;
            record.updated_at = now;

            const { data, error } = await supabaseClient
                .from("credit_debit_notes")
                .update(record)
                .eq("note_no", noteId)
                .eq("company_id", CompanyID)
                .select()
                .single();

            if (error) throw error;

            header = data;

            // Delete old items
            const { error: deleteError } = await supabaseClient
                .from("credit_debit_note_items")
                .delete()
                .eq("note_id", noteId)
                .eq("company_id", CompanyID);

            if (deleteError) throw deleteError;

            alert("Credit Debit Note updated successfully.");

        } else {

            record.created_by = UserLoginID;
            record.created_at = now;

            const { data, error } = await supabaseClient
                .from("credit_debit_notes")
                .insert(record)
                .select()
                .single();

            if (error) throw error;

            header = data;

            document.getElementById("tempFormID").value = header.id;

            alert("Credit Debit Note saved successfully.");
        }

        // Save Detail Rows
        await saveCreditDebitNoteItems(header.id);

        console.log("Saved Successfully", header);
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="bi bi-save"></i> Update';
        modifyButton.disabled = false;
        disableForm();
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
    finally {
        btnSave.disabled = false;
    }
}

async function saveCreditDebitNoteItems(noteId) {

    const rows = document.querySelectorAll("#creditDebitTable tbody tr");

    if (!rows.length) return;

    const items = [];

    rows.forEach((row, index) => {

        items.push({
            note_id: noteId,
            line_no: index + 1,

            item_id: row.cells[1].textContent.trim(),
            item_name: row.cells[2].textContent.trim(),
            description: row.cells[3].textContent.trim(),
            hsn_sac: row.cells[4].textContent.trim(),

            unit_id: null,

            qty: Number(row.cells[7].textContent) || 0,
            rate: 0,

            non_taxable_amount: Number(row.cells[8].textContent) || 0,
            taxable_amount: Number(row.cells[9].textContent) || 0,

            gst_percent: Number(row.cells[5].textContent.replace("%", "")) || 0,
            cess_percent: Number(row.cells[6].textContent.replace("%", "")) || 0,

            cgst_percent: Number(row.cells[17].textContent) || 0,
            sgst_percent: Number(row.cells[18].textContent) || 0,
            igst_percent: Number(row.cells[19].textContent) || 0,

            cgst_amount: Number(row.cells[11].textContent) || 0,
            sgst_amount: Number(row.cells[10].textContent) || 0,
            igst_amount: Number(row.cells[12].textContent) || 0,
            cess_amount: Number(row.cells[13].textContent) || 0,

            line_total: Number(row.cells[15].textContent) || 0
        });

    });

    const { error } = await supabaseClient
        .from("credit_debit_note_items")
        .insert(items);

    if (error) throw error;
}

const noteNoInput = document.getElementById("noteNo");
const noteNoSuggestions = document.getElementById("noteNoSuggestions");

let noteDebounce;

noteNoInput.addEventListener("input", function () {

    clearTimeout(noteDebounce);

    const search = this.value.trim();

    if (search.length < 2) {
        noteNoSuggestions.innerHTML = "";
        return;
    }

    noteDebounce = setTimeout(() => {
        loadNoteNoSuggestions(search);
    }, 300);

});

async function loadNoteNoSuggestions(searchText) {

    const { data, error } = await supabaseClient
        .from("credit_debit_notes")
        .select("id, note_no")
        .eq("company_id", CompanyID)
        .ilike("note_no", `%${searchText}%`)
        .order("note_no")
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    noteNoSuggestions.innerHTML = "";

    data.forEach(row => {

        const option = document.createElement("option");
        option.value = row.note_no;
        option.dataset.id = row.id;

        noteNoSuggestions.appendChild(option);

    });

}
noteNoInput.addEventListener("change", async function () {

    const noteNo = this.value.trim();

    if (!noteNo) return;

    const { data, error } = await supabaseClient
        .from("credit_debit_notes")
        .select("*")
        .eq("company_id", CompanyID)
        .eq("note_no", noteNo)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    // Save database ID for updates
    document.getElementById("tempFormID").value = data.id;

    // Fill form
    document.getElementById("noteDate").value = data.note_date;
    document.getElementById("noteType").value = data.note_type;
    document.getElementById("partyCode").value = data.party_code;
    document.getElementById("partyName").value = data.party_name;

    document.getElementById("referenceInvoice").value = data.reference_invoice;
    document.getElementById("noteNo").value = data.note_no;
    document.getElementById("noteNo").disabled = true;

    // Load item rows
    await loadCreditDebitNoteItems(data.id);

});

async function loadCreditDebitNoteItems(noteId) {

    const tbody = document.querySelector("#creditDebitTable tbody");
    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("credit_debit_note_items")
        .select("*")
        .eq("note_id", noteId)
        .order("line_no");

    if (error) {
        console.error(error);
        return;
    }

    data.forEach((item, index) => {

        const totalGST =
            Number(item.cgst_amount || 0) +
            Number(item.sgst_amount || 0) +
            Number(item.igst_amount || 0) +
            Number(item.cess_amount || 0);

        const row = tbody.insertRow();

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.item_id ?? ""}</td>
            <td>${item.item_name ?? ""}</td>
            <td>${item.description ?? ""}</td>
            <td>${item.hsn_sac ?? ""}</td>

            <td class="text-end">${Number(item.gst_percent).toFixed(2)}%</td>
            <td class="text-end">${Number(item.cess_percent).toFixed(2)}%</td>

            <td class="text-end">${Number(item.qty).toFixed(3)}</td>
            <td class="text-end">${Number(item.non_taxable_amount).toFixed(2)}</td>
            <td class="text-end">${Number(item.taxable_amount).toFixed(2)}</td>

            <td class="text-end">${Number(item.sgst_amount).toFixed(2)}</td>
            <td class="text-end">${Number(item.cgst_amount).toFixed(2)}</td>
            <td class="text-end">${Number(item.igst_amount).toFixed(2)}</td>
            <td class="text-end">${Number(item.cess_amount).toFixed(2)}</td>

            <td class="text-end">${totalGST.toFixed(2)}</td>
            <td class="text-end">${Number(item.line_total).toFixed(2)}</td>

            <td class="text-center">
                <button type="button" class="btn btn-danger btn-sm removeRow">
                    <i class="bi bi-trash"></i>
                </button>
            </td>

            <td class="d-none">${Number(item.cgst_percent).toFixed(2)}</td>
            <td class="d-none">${Number(item.sgst_percent).toFixed(2)}</td>
            <td class="d-none">${Number(item.igst_percent).toFixed(2)}</td>
            <td class="d-none"></td>
        `;
    });

    updateCreditDebitTotals();
}