// ==========================================
// Cache DOM Elements for Performance
// ==========================================
const els = {
    noteNo: document.getElementById("noteNo"),
    noteDate: document.getElementById("noteDate"),
    noteType: document.getElementById("noteType"),
    partyName: document.getElementById("partyName"),
    partyCode: document.getElementById("partyCode"),
    referenceType: document.getElementById("referenceType"),
    referenceInvoice: document.getElementById("referenceInvoice"),
    suggestionBox: document.getElementById("referenceSuggestions"),
    reason: document.getElementById("reason"),
    remarks: document.getElementById("remarks"),
    item: document.getElementById("item"),
    description: document.getElementById("description"),
    hsnCode: document.getElementById("hsnCode"),
    quantity: document.getElementById("quantity"),
    fullAmount: document.getElementById("fullAmount"),
    partyDefaultTax: document.getElementById("partyDefaultTax"),
    totalAmount: document.getElementById("totalAmount"),
    addCreditDebitRow: document.getElementById("addCreditDebitRow"),
    tbody: document.querySelector("#creditDebitTable tbody"),
    saveButton: document.getElementById("saveButton"),
    noteNoSuggestions: document.getElementById("noteNoSuggestions"),
    tempFormID: document.getElementById("tempFormID")
};

let currentTable = "";
let currentColumn = "";
let referenceDebounceTimer;
let noteDebounceTimer;

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (typeof loadSuggestions === "function") {
            await loadSuggestions("partySuggestions", "PartyDetails", CompanyID);
        }
        if (typeof loadTaxData === "function") {
            loadTaxData();
        }
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

// ==========================================
// Event Listeners
// ==========================================

// Change Reference Type
els.referenceType.addEventListener("change", function () {
    els.referenceInvoice.value = "";
    els.suggestionBox.innerHTML = "";
    els.suggestionBox.style.display = "none";

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

// Search Reference Invoice while typing
els.referenceInvoice.addEventListener("input", function () {
    clearTimeout(referenceDebounceTimer);
    const search = this.value.trim();

    if (!currentTable || search.length < 2) {
        els.suggestionBox.style.display = "none";
        return;
    }

    referenceDebounceTimer = setTimeout(() => {
        searchReferences(search);
    }, 300);
});

async function searchReferences(searchText) {
    const PartyCode = els.partyCode.value;

    try {
        const { data, error } = await supabaseClient
            .from(currentTable)
            .select(currentColumn)
            .eq("PartyCode", PartyCode)
            .eq("company_id", CompanyID)
            .neq("PaymentStatus", "Paid")
            .ilike(currentColumn, `%${searchText}%`)
            .order(currentColumn)
            .limit(20);

        if (error) throw error;
        renderSuggestions(data);
    } catch (error) {
        console.error("Error fetching references:", error);
    }
}

function renderSuggestions(data) {
    els.suggestionBox.innerHTML = "";

    if (!data || !data.length) {
        els.suggestionBox.style.display = "none";
        return;
    }

    data.forEach(row => {
        const value = row[currentColumn];
        const itemBtn = document.createElement("button");
        itemBtn.type = "button";
        itemBtn.className = "list-group-item list-group-item-action";
        itemBtn.textContent = value;

        itemBtn.onclick = () => {
            els.referenceInvoice.value = value;
            els.suggestionBox.style.display = "none";
        };

        els.suggestionBox.appendChild(itemBtn);
    });

    els.suggestionBox.style.display = "block";
}

// Hide dropdown when clicking outside
document.addEventListener("click", function (e) {
    if (!els.referenceInvoice.contains(e.target) && !els.suggestionBox.contains(e.target)) {
        els.suggestionBox.style.display = "none";
    }
});

// Clear reference when Party changes
els.partyCode.addEventListener("change", () => {
    els.referenceInvoice.value = "";
    els.suggestionBox.innerHTML = "";
    els.suggestionBox.style.display = "none";
});

// Calculate total on amount or tax change
els.fullAmount.addEventListener("input", calculateTotalAmount);
els.partyDefaultTax.addEventListener("change", calculateTotalAmount);

async function calculateTotalAmount() {
    const amount = parseFloat(els.fullAmount.value) || 0;
    const taxId = els.partyDefaultTax.value;

    if (!taxId) {
        els.totalAmount.value = amount ? amount.toFixed(2) : "";
        return;
    }

    try {
        const taxRates = await getTaxRatesById(taxId);
        const cgst = parseFloat(taxRates.cgst || 0);
        const sgst = parseFloat(taxRates.sgst || 0);
        const igst = parseFloat(taxRates.igst || 0);
        const cess = parseFloat(taxRates.cess || 0);

        const taxPercent = cgst + sgst + igst + cess;
        const taxAmount = (amount * taxPercent) / 100;

        els.totalAmount.value = (amount + taxAmount).toFixed(2);
    } catch (error) {
        console.error("Error calculating tax:", error);
    }
}

// ==========================================
// Item Row Management
// ==========================================

els.addCreditDebitRow.addEventListener("click", async function () {
    els.addCreditDebitRow.disabled = true;

    const refInvoiceVal = els.referenceInvoice.value.trim();
    const itemVal = els.item.value.trim();
    const descVal = els.description.value.trim();
    const hsnVal = els.hsnCode.value.trim();
    const quantityVal = parseFloat(els.quantity.value) || 0;
    const taxableAmount = parseFloat(els.fullAmount.value) || 0;
    const taxId = els.partyDefaultTax.value;

    // Validations
    if (!refInvoiceVal) return alertFocus("Please select Reference Invoice.", els.referenceInvoice);
    if (!itemVal) return alertFocus("Please select Item.", els.item);
    if (!descVal) return alertFocus("Please enter Description.", els.description);
    if (!hsnVal) return alertFocus("Please enter HSN Code.", els.hsnCode);
    if (quantityVal <= 0) return alertFocus("Please enter a valid Quantity.", els.quantity);
    if (taxableAmount <= 0) return alertFocus("Please enter a valid Amount.", els.fullAmount);
    if (!taxId) return alertFocus("Please select Tax Rate.", els.partyDefaultTax);

    try {
        const taxRates = await getTaxRatesById(taxId);

        const cgstPercent = parseFloat(taxRates.cgst || 0);
        const sgstPercent = parseFloat(taxRates.sgst || 0);
        const igstPercent = parseFloat(taxRates.igst || 0);
        const cessPercent = parseFloat(taxRates.cess || 0);
        const gstPercent = parseFloat(taxRates.tax_rate || 0);

        const cgstAmount = (taxableAmount * cgstPercent) / 100;
        const sgstAmount = (taxableAmount * sgstPercent) / 100;
        const igstAmount = (taxableAmount * igstPercent) / 100;
        const cessAmount = (taxableAmount * cessPercent) / 100;

        const totalGST = cgstAmount + sgstAmount + igstAmount + cessAmount;
        const grandTotal = taxableAmount + totalGST;
        const nonTaxableAmount = totalGST <= 0 ? taxableAmount : 0;

        const srNo = els.tbody.rows.length + 1;
        const row = els.tbody.insertRow();

        row.innerHTML = `
            <td>${srNo}</td>
            <td>-</td> <!-- Item No placeholder -->
            <td>${itemVal}</td>
            <td>${descVal}</td>
            <td>${hsnVal}</td>
            <td class="text-end">${gstPercent.toFixed(2)}%</td>
            <td class="text-end">${cessPercent.toFixed(2)}%</td>
            <td class="text-end">${quantityVal.toFixed(2)}</td>
            <td class="text-end">${nonTaxableAmount.toFixed(2)}</td>
            <td class="text-end">${taxableAmount.toFixed(2)}</td>
            <td class="text-end">${sgstAmount.toFixed(2)}</td>
            <td class="text-end">${cgstAmount.toFixed(2)}</td>
            <td class="text-end">${igstAmount.toFixed(2)}</td>
            <td class="text-end">${cessAmount.toFixed(2)}</td>
            <td class="text-end">${totalGST.toFixed(2)}</td>
            <td class="text-end">${grandTotal.toFixed(2)}</td>
            <td class="text-center">
                <button type="button" class="btn btn-danger btn-sm removeRow"><i class="bi bi-trash"></i></button>
            </td>
            <!-- Hidden Data Columns -->
            <td class="d-none">${cgstPercent}</td>
            <td class="d-none">${sgstPercent}</td>
            <td class="d-none">${igstPercent}</td>
            <td class="d-none">${taxId}</td>
            <td class="d-none ref-invoice-col">${refInvoiceVal}</td>
        `;

        updateCreditDebitTotals();
        clearItemDetails();

    } catch (error) {
        console.error("Error adding row:", error);
    } finally {
        els.addCreditDebitRow.disabled = false;
    }
});

// Remove Row Delegation
els.tbody.addEventListener("click", function (e) {
    const btn = e.target.closest(".removeRow");
    if (!btn) return;

    btn.closest("tr").remove();

    // Re-number Sr No
    [...els.tbody.rows].forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });

    updateCreditDebitTotals();
});

function updateCreditDebitTotals() {
    let totals = { nonTax: 0, tax: 0, sgst: 0, cgst: 0, igst: 0, cess: 0, gst: 0, grand: 0 };

    [...els.tbody.rows].forEach(row => {
        totals.nonTax += parseFloat(row.cells[8].textContent) || 0;
        totals.tax += parseFloat(row.cells[9].textContent) || 0;
        totals.sgst += parseFloat(row.cells[10].textContent) || 0;
        totals.cgst += parseFloat(row.cells[11].textContent) || 0;
        totals.igst += parseFloat(row.cells[12].textContent) || 0;
        totals.cess += parseFloat(row.cells[13].textContent) || 0;
        totals.gst += parseFloat(row.cells[14].textContent) || 0;
        totals.grand += parseFloat(row.cells[15].textContent) || 0;
    });

    document.getElementById("totalNonTaxAmt").textContent = totals.nonTax.toFixed(2);
    document.getElementById("totalTaxAmt").textContent = totals.tax.toFixed(2);
    document.getElementById("totalSGST").textContent = totals.sgst.toFixed(2);
    document.getElementById("totalCGST").textContent = totals.cgst.toFixed(2);
    document.getElementById("totalIGST").textContent = totals.igst.toFixed(2);
    document.getElementById("totalCESSAmt").textContent = totals.cess.toFixed(2);
    document.getElementById("totalGST").textContent = totals.gst.toFixed(2);
    document.getElementById("totalGrand").textContent = totals.grand.toFixed(2);
}

// ==========================================
// Saving / Updating Operations
// ==========================================

els.saveButton.addEventListener("click", saveUpdateCreditDebitNote);

async function generateNewCreditDebitNoteNo() {
    try {
        const { data, error } = await supabaseClient.rpc("generate_document_no", {
            p_company_id: CompanyID,
            p_document_type: "credit_debit_notes"
        });
        if (error) throw error;
        els.noteNo.value = data;
    } catch (error) {
        console.error("Error generating Note No:", error);
    }
}

async function saveUpdateCreditDebitNote() {
    els.saveButton.disabled = true;

    try {
        const noteId = els.noteNo.value.trim();

        // Header validations
        if (!els.noteType.value) return alertFocus("Please select Note Type.", els.noteType);
        if (!els.noteDate.value) return alertFocus("Please select Note Date.", els.noteDate);
        if (!els.partyCode.value) return alertFocus("Please select a valid Party Name.", els.partyName);
        if (!els.referenceType.value) return alertFocus("Please select Reference Type.", els.referenceType);
        if (els.tbody.rows.length === 0) return alert("Please add at least one item.");

        if (!noteId) await generateNewCreditDebitNoteNo();

        const record = {
            company_id: CompanyID,
            note_no: els.noteNo.value.trim(),
            note_date: els.noteDate.value,
            note_type: els.noteType.value,
            party_id: els.partyCode.value.trim(),
            party_name: els.partyName.value.trim(),
            reference_type: els.referenceType.value.trim(),
            reason: els.reason.value.trim(),
            remarks: els.remarks.value.trim(),
            taxable_amount: parseFloat(document.getElementById("totalTaxAmt").textContent) || 0,
            non_taxable_amount: parseFloat(document.getElementById("totalNonTaxAmt").textContent) || 0,
            sgst_amount: parseFloat(document.getElementById("totalSGST").textContent) || 0,
            cgst_amount: parseFloat(document.getElementById("totalCGST").textContent) || 0,
            igst_amount: parseFloat(document.getElementById("totalIGST").textContent) || 0,
            cess_amount: parseFloat(document.getElementById("totalCESSAmt").textContent) || 0,
            total_gst: parseFloat(document.getElementById("totalGST").textContent) || 0,
            total_amount: parseFloat(document.getElementById("totalGrand").textContent) || 0,
            updated_by: UserLoginID,
            updated_at: localtimeStamp
        };

        let headerID;

        if (noteId && els.tempFormID.value) {
            // Update
            const { data, error } = await supabaseClient
                .from("credit_debit_notes")
                .update(record)
                .eq("note_no", noteId)
                .eq("company_id", CompanyID)
                .select()
                .single();

            if (error) throw error;
            headerID = data.id;

            // Clear old items
            await supabaseClient
                .from("credit_debit_note_items")
                .delete()
                .eq("note_id", headerID)
                .eq("company_id", CompanyID);

        } else {
            // Insert
            record.created_by = UserLoginID;
            record.created_at = localtimeStamp;

            const { data, error } = await supabaseClient
                .from("credit_debit_notes")
                .insert(record)
                .select()
                .single();

            if (error) throw error;
            headerID = data.id;
            els.tempFormID.value = headerID;
        }

        // Save line items
        await saveCreditDebitNoteItems(headerID);

        alert("Credit Debit Note saved successfully.");
        els.saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
        disableForm(); // Lock form after save

    } catch (error) {
        console.error("Save Error:", error);
        alert(error.message || "An error occurred while saving.");
    } finally {
        els.saveButton.disabled = false;
    }
}

async function saveCreditDebitNoteItems(noteDbId) {
    if (!els.tbody.rows.length) return;

    const items = [...els.tbody.rows].map((row, index) => ({
        note_id: noteDbId,
        company_id: CompanyID,
        line_no: index + 1,

        reference_invoice: row.cells[21].textContent.trim(), // Hidden Ref Invoice column
        item_id: row.cells[1].textContent.trim() !== "-" ? row.cells[1].textContent.trim() : null,
        item_name: row.cells[2].textContent.trim(),
        description: row.cells[3].textContent.trim(),
        hsn_sac: row.cells[4].textContent.trim(),

        qty: parseFloat(row.cells[7].textContent) || 0,
        rate: 0,
        non_taxable_amount: parseFloat(row.cells[8].textContent) || 0,
        taxable_amount: parseFloat(row.cells[9].textContent) || 0,

        gst_percent: parseFloat(row.cells[5].textContent.replace("%", "")) || 0,
        cess_percent: parseFloat(row.cells[6].textContent.replace("%", "")) || 0,
        cgst_percent: parseFloat(row.cells[17].textContent) || 0,
        sgst_percent: parseFloat(row.cells[18].textContent) || 0,
        igst_percent: parseFloat(row.cells[19].textContent) || 0,

        sgst_amount: parseFloat(row.cells[10].textContent) || 0,
        cgst_amount: parseFloat(row.cells[11].textContent) || 0,
        igst_amount: parseFloat(row.cells[12].textContent) || 0,
        cess_amount: parseFloat(row.cells[13].textContent) || 0,

        line_total: parseFloat(row.cells[15].textContent) || 0
    }));

    const { error } = await supabaseClient.from("credit_debit_note_items").insert(items);
    if (error) throw error;
}

// ==========================================
// Note Number Search & Form Loading
// ==========================================

els.noteNo.addEventListener("input", function () {
    clearTimeout(noteDebounceTimer);
    const search = this.value.trim();

    if (search.length < 2) {
        els.noteNoSuggestions.innerHTML = "";
        return;
    }

    noteDebounceTimer = setTimeout(() => {
        loadNoteNoSuggestions(search);
    }, 300);
});

async function loadNoteNoSuggestions(searchText) {
    try {
        const { data, error } = await supabaseClient
            .from("credit_debit_notes")
            .select("id, note_no")
            .eq("company_id", CompanyID)
            .ilike("note_no", `%${searchText}%`)
            .order("note_no")
            .limit(20);

        if (error) throw error;

        els.noteNoSuggestions.innerHTML = "";
        data.forEach(row => {
            const option = document.createElement("option");
            option.value = row.note_no;
            option.dataset.id = row.id;
            els.noteNoSuggestions.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching note numbers:", error);
    }
}

els.noteNo.addEventListener("change", async function () {
    const noteNoStr = this.value.trim();
    if (!noteNoStr) return;

    try {
        const { data, error } = await supabaseClient
            .from("credit_debit_notes")
            .select("*")
            .eq("company_id", CompanyID)
            .eq("note_no", noteNoStr)
            .maybeSingle(); // <-- Change .single() to .maybeSingle()

        if (error) throw error;

        // If no data is found (0 rows), it's a new or invalid Note No.
        // We just exit the function gracefully instead of crashing.
        if (!data) {
            console.log("No existing note found for this number. Ready for new entry.");
            els.tempFormID.value = ""; // Clear ID so it saves as a new record
            return;
        }

        // --- If data IS found, populate the form ---
        els.tempFormID.value = data.id;
        els.noteDate.value = data.note_date;
        els.noteType.value = data.note_type;
        els.partyCode.value = data.party_id;
        els.partyName.value = data.party_name;
        els.referenceType.value = data.reference_type;
        els.reason.value = data.reason || "";
        els.remarks.value = data.remarks || "";
        els.noteNo.disabled = true;

        await loadCreditDebitNoteItems(data.id);

        els.saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    } catch (error) {
        console.error("Error loading note:", error);
    }
});

async function loadCreditDebitNoteItems(noteId) {
    els.tbody.innerHTML = "";

    try {
        const { data, error } = await supabaseClient
            .from("credit_debit_note_items")
            .select("*")
            .eq("note_id", noteId)
            .order("line_no");

        if (error) throw error;

        data.forEach((item, index) => {
            const totalGST =
                (parseFloat(item.cgst_amount) || 0) +
                (parseFloat(item.sgst_amount) || 0) +
                (parseFloat(item.igst_amount) || 0) +
                (parseFloat(item.cess_amount) || 0);

            const row = els.tbody.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.item_id || "-"}</td>
                <td>${item.item_name || ""}</td>
                <td>${item.description || ""}</td>
                <td>${item.hsn_sac || ""}</td>
                <td class="text-end">${parseFloat(item.gst_percent || 0).toFixed(2)}%</td>
                <td class="text-end">${parseFloat(item.cess_percent || 0).toFixed(2)}%</td>
                <td class="text-end">${parseFloat(item.qty || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.non_taxable_amount || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.taxable_amount || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.sgst_amount || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.cgst_amount || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.igst_amount || 0).toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.cess_amount || 0).toFixed(2)}</td>
                <td class="text-end">${totalGST.toFixed(2)}</td>
                <td class="text-end">${parseFloat(item.line_total || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-danger btn-sm removeRow"><i class="bi bi-trash"></i></button>
                </td>
                <td class="d-none">${parseFloat(item.cgst_percent || 0).toFixed(2)}</td>
                <td class="d-none">${parseFloat(item.sgst_percent || 0).toFixed(2)}</td>
                <td class="d-none">${parseFloat(item.igst_percent || 0).toFixed(2)}</td>
                <td class="d-none"></td>
                <td class="d-none ref-invoice-col">${item.reference_invoice || ""}</td>
            `;
        });

        updateCreditDebitTotals();
    } catch (error) {
        console.error("Error loading items:", error);
    }
}

// ==========================================
// Helper Functions
// ==========================================

function clearItemDetails() {
    els.referenceInvoice.value = "";
    els.item.value = "";
    els.description.value = "";
    els.hsnCode.value = "";
    els.quantity.value = "";
    els.fullAmount.value = "";
    els.totalAmount.value = "";
    els.partyDefaultTax.selectedIndex = 0;
}

function alertFocus(msg, element) {
    alert(msg);
    if (element && typeof element.focus === 'function') {
        element.focus();
    }
    // Re-enable save button if validation fails
    if (els.saveButton.disabled) els.saveButton.disabled = false;
}

function disableForm() {
    // Disable primary inputs to prevent further editing until Modify is clicked
    els.noteDate.disabled = true;
    els.noteType.disabled = true;
    els.partyName.disabled = true;
    els.referenceType.disabled = true;
    els.reason.disabled = true;
    els.remarks.disabled = true;

    // Manage Action Buttons (Assuming global modifyButton exists based on original HTML)
    const modifyButton = document.getElementById("modifyButton");
    if (modifyButton) modifyButton.disabled = false;
    els.saveButton.disabled = true;
}

function enableForm() {
    els.noteDate.disabled = false;
    els.noteType.disabled = false;
    els.partyName.disabled = false;
    els.referenceType.disabled = false;
    els.reason.disabled = false;
    els.remarks.disabled = false;
    els.noteNo.disabled = false;
    els.saveButton.disabled = false;
}