/* ==========================================================
   AccountingVoucher.js - Logistics ERP
   Optimized Version
========================================================== */

// ===========================================================
// DOM CACHE & STATE
// ===========================================================
const DOM = {
    voucherBody: document.getElementById("voucherBody"),
    totalDebit: document.getElementById("totalDebit"),
    totalCredit: document.getElementById("totalCredit"),
    totalGst: document.getElementById("totalGst"),
    difference: document.getElementById("difference"),
    voucherNo: document.getElementById("voucherNo"),
    voucherDate: document.getElementById("voucherDate"),
    voucherType: document.getElementById("voucherType"),
    referenceNo: document.getElementById("referenceNo"),
    narration: document.getElementById("narration"),
    saveButton: document.getElementById("saveButton"),
    transactionMode: document.getElementById("transactionMode"),
    bankSection: document.getElementById("bankSection"),
    instrumentSection: document.getElementById("instrumentSection"),
    narrationSection: document.getElementById("narrationSection"),
    bankAccount: document.getElementById("bankAccount"),
    instrumentNo: document.getElementById("instrumentNo"),
    accountSearch: document.getElementById("accountSearch"),
    partySearch: document.getElementById("partySearch"),
    accountListBody: document.getElementById("accountListBody"),
    partyListBody: document.getElementById("partyListBody"),
    accountModal: document.getElementById("accountModal"),
    partyModal: document.getElementById("partyModal")
};

const STATE = {
    accountMaster: [],
    partyMaster: [],
    currentAccountTextbox: null,
    currentPartyTextbox: null,
    isSaving: false
};

// ===========================================================
// INITIALIZATION
// ===========================================================
document.addEventListener("DOMContentLoaded", async () => {
    await initVoucher();
    setupEventListeners();
});

async function initVoucher() {
    // Set today's date
    DOM.voucherDate.value = new Date().toLocaleDateString("en-CA");

    // Load master data in parallel
    await Promise.all([
        loadAccounts(),
        loadParties(CompanyID),
        loadVoucherNumber(),
        loadBranches(CompanyID),
        loadCostCenters(CompanyID),
        loadBankAccounts(CompanyID, 'Bank')
    ]);

    // Initialize first row
    addRow();
    calculateTotals();
    updateTransactionMode();
}

// ===========================================================
// ROW MANAGEMENT
// ===========================================================
function createRowHTML(index) {
    return `
        <td>${index + 1}</td>
        <td>
            <div class="input-group">
                <input type="text" class="form-control accountName" placeholder="Select Ledger" readonly>
                <input type="hidden" class="accountCode">
                <button type="button" class="btn btn-outline-secondary accountSearch">
                    <i class="bi bi-search"></i>
                </button>
            </div>
        </td>
        <td>
            <div class="input-group">
                <input type="text" class="form-control partyName" placeholder="Select Party" readonly>
                <input type="hidden" class="partyCode">
                <button type="button" class="btn btn-outline-secondary partySearch">
                    <i class="bi bi-search"></i>
                </button>
            </div>
        </td>
        <td><input type="number" step="0.01" value="0" class="form-control debit text-end"></td>
        <td><input type="number" step="0.01" value="0" class="form-control credit text-end"></td>
        <td>
            <select class="form-select gstRate">
                ${[0, 5, 12, 18, 28].map(rate =>
        `<option value="${rate}">${rate}%</option>`
    ).join('')}
            </select>
        </td>
        <td><input type="number" class="form-control gstAmount text-end" value="0" readonly></td>
        <td><input type="number" class="form-control totalAmount text-end" readonly></td>
        <td><input class="form-control remarks"></td>
        <td class="text-center">
            <button class="btn btn-danger btn-sm deleteRow" ${DOM.voucherBody.rows.length === 1 ? 'disabled' : ''}>
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
}

function addRow() {
    const row = DOM.voucherBody.insertRow();
    row.innerHTML = createRowHTML(DOM.voucherBody.rows.length - 1);

    bindRowEvents(row);
    renumberRows();
    row.querySelector(".accountName").focus();
    calculateTotals();

    return row;
}

function deleteRow(button) {
    const row = button.closest("tr");
    if (DOM.voucherBody.rows.length === 1) {
        alert("Minimum one row required.");
        return;
    }
    row.remove();
    renumberRows();
    calculateTotals();
}

function renumberRows() {
    const rows = DOM.voucherBody.rows;
    Array.from(rows).forEach((row, index) => {
        row.cells[0].textContent = index + 1;
        const deleteBtn = row.querySelector(".deleteRow");
        if (deleteBtn) deleteBtn.disabled = rows.length === 1;
    });
}

function clearVoucher() {
    DOM.voucherBody.innerHTML = "";
    addRow();
    DOM.referenceNo.value = "";
    DOM.narration.value = "";
    calculateTotals();
}

// ===========================================================
// EVENT BINDING
// ===========================================================
function setupEventListeners() {
    // Add Row
    document.getElementById("btnAddRow").addEventListener("click", addRow);

    // Save
    DOM.saveButton.addEventListener("click", saveVoucher);

    // Print
    document.getElementById("reportButton").addEventListener("click", () => window.print());

    // Delete
    document.getElementById("deleteButton").addEventListener("click", () => alert("Delete module coming next."));

    // Voucher Type change
    DOM.voucherType.addEventListener("change", async () => {
        clearVoucher();
        await loadVoucherNumber();
    });

    // Voucher Date change
    DOM.voucherDate.addEventListener("change", loadVoucherNumber);

    // Transaction Mode
    DOM.transactionMode.addEventListener("change", updateTransactionMode);

    // Account Search
    DOM.accountSearch.addEventListener("input", filterAccounts);
    DOM.accountListBody.addEventListener("click", handleAccountSelection);

    // Party Search
    DOM.partySearch.addEventListener("input", filterParties);
    DOM.partyListBody.addEventListener("click", handlePartySelection);

    // Global keyboard shortcuts
    document.addEventListener("keydown", handleGlobalKeys);

    // Account/Party search buttons (delegated)
    document.addEventListener("click", handleSearchButtons);

    // GST calculation (delegated)
    document.addEventListener("change", handleGSTRateChange);

    // Blur formatting
    document.addEventListener("blur", handleInputBlur, true);
}

function bindRowEvents(row) {
    // Delete button
    row.querySelector(".deleteRow").addEventListener("click", function () {
        deleteRow(this);
    });

    // Debit/Credit inputs
    row.querySelectorAll(".debit, .credit").forEach(input => {
        input.addEventListener("input", () => {
            calculateTotals();
            updateRowGST(row);
        });
    });

    // GST Rate
    row.querySelector(".gstRate").addEventListener("change", () => {
        updateRowGST(row);
        calculateTotals();
    });

    // Keyboard navigation
    bindKeyboardEvents(row);

    // Debit/Credit mutual exclusivity
    bindDebitCreditRule(row);
}

// ===========================================================
// KEYBOARD NAVIGATION
// ===========================================================
function bindKeyboardEvents(row) {
    const controls = row.querySelectorAll("input,select");
    controls.forEach((control, index) => {
        control.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "Enter":
                    e.preventDefault();
                    if (index < controls.length - 1) {
                        controls[index + 1].focus();
                        controls[index + 1].select?.();
                    } else {
                        moveToNextRow(row);
                    }
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    const next = row.nextElementSibling;
                    if (next) {
                        const nextControls = next.querySelectorAll("input,select");
                        if (nextControls[index]) nextControls[index].focus();
                    }
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    const prev = row.previousElementSibling;
                    if (prev) {
                        const prevControls = prev.querySelectorAll("input,select");
                        if (prevControls[index]) prevControls[index].focus();
                    }
                    break;
            }
        });
    });
}

function moveToNextRow(currentRow) {
    const nextRow = currentRow.nextElementSibling;
    if (nextRow) {
        nextRow.querySelector(".accountName").focus();
    } else {
        addRow();
    }
}

function bindDebitCreditRule(row) {
    const debit = row.querySelector(".debit");
    const credit = row.querySelector(".credit");

    debit.addEventListener("input", function () {
        if (Number(this.value) > 0) credit.value = 0;
    });
    credit.addEventListener("input", function () {
        if (Number(this.value) > 0) debit.value = 0;
    });
}

// ===========================================================
// CALCULATIONS
// ===========================================================
function calculateTotals() {
    let totalDebit = 0, totalCredit = 0, totalGST = 0;

    Array.from(DOM.voucherBody.rows).forEach(row => {
        totalDebit += Number(row.querySelector(".debit")?.value || 0);
        totalCredit += Number(row.querySelector(".credit")?.value || 0);
        totalGST += Number(row.querySelector(".gstAmount")?.value || 0);
    });

    DOM.totalDebit.textContent = totalDebit.toFixed(2);
    DOM.totalCredit.textContent = totalCredit.toFixed(2);
    DOM.totalGst.textContent = totalGST.toFixed(2);

    const diff = totalDebit - totalCredit;
    DOM.difference.textContent = diff.toFixed(2);
    DOM.difference.classList.toggle("balance-ok", diff === 0);
    DOM.difference.classList.toggle("balance-error", diff !== 0);
}

function updateRowGST(row) {
    const amount = Number(row.querySelector(".debit")?.value || 0) ||
        Number(row.querySelector(".credit")?.value || 0);
    const rate = Number(row.querySelector(".gstRate")?.value || 0);
    const gst = (amount * rate) / 100;

    row.querySelector(".gstAmount").value = gst.toFixed(2);
    row.querySelector(".totalAmount").value = (amount + gst).toFixed(2);
}

// ===========================================================
// VALIDATION
// ===========================================================
function validateVoucher() {
    const debit = parseFloat(DOM.totalDebit.textContent) || 0;
    const credit = parseFloat(DOM.totalCredit.textContent) || 0;

    if (debit === 0 && credit === 0) {
        alert("Enter either a Debit or Credit amount.");
        return false;
    }

    // if (debit !== credit) {
    //     alert("Voucher is not balanced.");
    //     return false;
    // }

    for (const row of DOM.voucherBody.rows) {
        const accountCode = row.querySelector(".accountCode")?.value;
        if (!accountCode) {
            alert("Please select an account.");
            row.querySelector(".accountSearch")?.focus();
            return false;
        }

        const debitAmt = parseFloat(row.querySelector(".debit")?.value) || 0;
        const creditAmt = parseFloat(row.querySelector(".credit")?.value) || 0;

        if (debitAmt === 0 && creditAmt === 0) {
            alert("Enter a debit or credit amount.");
            row.querySelector(".debit")?.focus();
            return false;
        }

        if (debitAmt > 0 && creditAmt > 0) {
            alert("A row cannot contain both Debit and Credit.");
            row.querySelector(".debit")?.focus();
            return false;
        }
    }

    return true;
}

// ===========================================================
// ACCOUNT MANAGEMENT
// ===========================================================
async function loadAccounts() {
    const { data, error } = await supabaseClient
        .from("ChartOfAccountsView")
        .select("*")
        .order("AccountName");

    if (error) {
        console.error("Error loading accounts:", error);
        return;
    }

    STATE.accountMaster = data || [];
    renderAccounts(STATE.accountMaster);
}

function renderAccounts(data) {
    DOM.accountListBody.innerHTML = data.map(acc => `
        <tr data-code="${acc.AccountCode}">
            <td>${acc.AccountCode}</td>
            <td>${acc.AccountName}</td>
            <td>${acc.AccountType}</td>
        </tr>
    `).join('');
}

function filterAccounts() {
    const search = DOM.accountSearch.value.toLowerCase();
    const filtered = STATE.accountMaster.filter(acc =>
        acc.AccountCode.toLowerCase().includes(search) ||
        acc.AccountName.toLowerCase().includes(search)
    );
    renderAccounts(filtered);
}

function handleAccountSelection(e) {
    const row = e.target.closest("tr");
    if (!row) return;
    selectAccount(row.dataset.code);
}

function selectAccount(code) {
    const acc = STATE.accountMaster.find(x => x.AccountCode === code);
    if (!acc) return;

    STATE.currentAccountTextbox.value = acc.AccountName;
    STATE.currentAccountTextbox.parentElement
        .querySelector(".accountCode").value = acc.AccountCode;

    bootstrap.Modal.getInstance(DOM.accountModal)?.hide();
}

function openAccountSearch(input) {
    STATE.currentAccountTextbox = input;
    DOM.accountSearch.value = "";
    renderAccounts(STATE.accountMaster);
    new bootstrap.Modal(DOM.accountModal).show();
}

// ===========================================================
// PARTY MANAGEMENT
// ===========================================================
async function loadParties(companyId) {
    const { data, error } = await supabaseClient
        .from("PartyDetails")
        .select("PartyCode, PartyName, GSTNumber, State")
        .eq("company_id", companyId)
        .order("PartyName");

    if (error) {
        console.error("Error loading parties:", error);
        return;
    }

    STATE.partyMaster = data;
    renderPartyList(data);
}

function renderPartyList(data) {
    DOM.partyListBody.innerHTML = data.map(p => `
        <tr data-code="${p.PartyCode}">
            <td>${p.PartyCode}</td>
            <td>${p.PartyName}</td>
            <td>${p.GSTNumber || ""}</td>
            <td>${p.State || ""}</td>
        </tr>
    `).join('');
}

function filterParties() {
    const search = DOM.partySearch.value.toLowerCase();
    const filtered = STATE.partyMaster.filter(p =>
        p.PartyCode.toLowerCase().includes(search) ||
        p.PartyName.toLowerCase().includes(search) ||
        (p.GSTNumber || "").toLowerCase().includes(search)
    );
    renderPartyList(filtered);
}

function handlePartySelection(e) {
    const row = e.target.closest("tr");
    if (!row) return;

    const party = STATE.partyMaster.find(x => x.PartyCode === row.dataset.code);
    if (!party) return;

    STATE.currentPartyTextbox.value = party.PartyName;
    STATE.currentPartyTextbox.parentElement
        .querySelector(".partyCode").value = party.PartyCode;

    bootstrap.Modal.getInstance(DOM.partyModal)?.hide();
}

function openPartySearch(input) {
    STATE.currentPartyTextbox = input;
    DOM.partySearch.value = "";
    renderPartyList(STATE.partyMaster);
    new bootstrap.Modal(DOM.partyModal).show();
}

// ===========================================================
// VOUCHER NUMBER
// ===========================================================
async function loadVoucherNumber() {
    try {
        const { data, error } = await supabaseClient.rpc("generate_voucher_no", {
            p_company_id: CompanyID,
            p_voucher_type: DOM.voucherType.value,
            p_date: DOM.voucherDate.value
        });

        if (error) throw error;
        DOM.voucherNo.value = data;
    } catch (error) {
        console.error("Error loading voucher number:", error);
    }
}

// ===========================================================
// SAVE VOUCHER
// ===========================================================
async function saveVoucher() {
    if (STATE.isSaving) return;

    calculateTotals();
    if (!validateVoucher()) return;

    STATE.isSaving = true;
    DOM.saveButton.disabled = true;
    DOM.saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        const voucher = {
            company_id: CompanyID,
            voucher_no: DOM.voucherNo.value,
            voucher_date: DOM.voucherDate.value,
            voucher_type: DOM.voucherType.value,
            reference_no: DOM.referenceNo.value,
            narration: DOM.narration.value,
            created_by: UserLoginID,
            details: getVoucherLines()
        };

        const { data, error } = await supabaseClient.rpc(
            "save_accounting_voucher",
            { voucher_data: voucher }
        );

        if (error) throw error;

        alert("Voucher Saved Successfully");
        clearVoucher();
        await loadVoucherNumber();

    } catch (error) {
        console.error("Save error:", error);
        alert(error.message);
    } finally {
        STATE.isSaving = false;
        DOM.saveButton.disabled = false;
        DOM.saveButton.innerHTML = '<i class="bi bi-floppy"></i> Save';
    }
}

function getVoucherLines() {
    return Array.from(DOM.voucherBody.rows).map((row, index) => ({
        lineNo: index + 1,
        accountCode: row.querySelector(".accountCode").value,
        partyCode: row.querySelector(".partyCode").value,
        debit: Number(row.querySelector(".debit")?.value || 0),
        credit: Number(row.querySelector(".credit")?.value || 0),
        gstPercent: Number(row.querySelector(".gstRate")?.value || 0),
        gstAmount: Number(row.querySelector(".gstAmount")?.value || 0),
        remarks: row.querySelector(".remarks")?.value || ""
    }));
}

// ===========================================================
// TRANSACTION MODE
// ===========================================================
function updateTransactionMode() {
    const mode = DOM.transactionMode.value;
    const showBank = ["Bank", "Cheque", "NEFT", "RTGS", "IMPS", "UPI"].includes(mode);

    DOM.bankSection.style.display = showBank ? "" : "none";
    DOM.instrumentSection.style.display = showBank ? "" : "none";
    DOM.narrationSection.className = showBank ? "col-5" : "col-10";

    if (!showBank) {
        DOM.bankAccount.value = "";
        DOM.instrumentNo.value = "";
    }
}

// ===========================================================
// GLOBAL EVENT HANDLERS
// ===========================================================
function handleSearchButtons(e) {
    const accountBtn = e.target.closest(".accountSearch");
    if (accountBtn) {
        const row = accountBtn.closest("tr");
        openAccountSearch(row.querySelector(".accountName"));
        return;
    }

    const partyBtn = e.target.closest(".partySearch");
    if (partyBtn) {
        const row = partyBtn.closest("tr");
        openPartySearch(row.querySelector(".partyName"));
    }
}

function handleGSTRateChange(e) {
    if (!e.target.classList.contains("gstRate")) return;
    const row = e.target.closest("tr");
    if (row) updateRowGST(row);
}

function handleInputBlur(e) {
    if (e.target.classList.contains("debit") || e.target.classList.contains("credit")) {
        e.target.value = Number(e.target.value || 0).toFixed(2);
    }
}

function handleGlobalKeys(e) {
    const activeElement = document.activeElement;
    const row = activeElement?.closest?.("tr");

    // Delete empty row
    if (e.key === "Delete" && row) {
        if (DOM.voucherBody.rows.length > 1) {
            const debit = Number(row.querySelector(".debit")?.value || 0);
            const credit = Number(row.querySelector(".credit")?.value || 0);
            if (debit === 0 && credit === 0) {
                row.remove();
                renumberRows();
                calculateTotals();
            }
        }
    }

    // Ctrl+S - Save
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        DOM.saveButton.click();
    }

    // Ctrl+D - Copy previous row
    if (e.ctrlKey && e.key.toLowerCase() === "d" && row) {
        const prev = row.previousElementSibling;
        if (prev) {
            e.preventDefault();
            const fields = ["accountName", "partyName", "accountCode", "partyCode"];
            fields.forEach(field => {
                const prevVal = prev.querySelector(`.${field}`)?.value;
                if (prevVal) row.querySelector(`.${field}`).value = prevVal;
            });
        }
    }

    // Enter/F2 - Open search
    if (["Enter", "F2"].includes(e.key) && row) {
        if (e.target.classList.contains("accountName")) {
            e.preventDefault();
            row.querySelector(".accountSearch")?.click();
        }
        if (e.target.classList.contains("partyName")) {
            e.preventDefault();
            row.querySelector(".partySearch")?.click();
        }
    }
}

// ===========================================================
// INITIAL LOAD
// ===========================================================
// Initial call to renumber and calculate
renumberRows();
calculateTotals();
updateTransactionMode();

// Export for debugging if needed
window.__app = { DOM, STATE, addRow, saveVoucher };