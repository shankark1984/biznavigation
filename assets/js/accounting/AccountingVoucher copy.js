//AccountingVoucher.js

let accountMaster = [];
let currentPartyTextbox = null;
let partyMaster = [];
let currentAccountTextbox;


const voucherBody = document.getElementById("voucherBody");
const totalDebitEl = document.getElementById("totalDebit");
const totalCreditEl = document.getElementById("totalCredit");

const transactionMode = document.getElementById("transactionMode");
const bankSection = document.getElementById("bankSection");
const instrumentSection = document.getElementById("instrumentSection");
const narrationSection = document.getElementById("narrationSection");

const btnAddRow = document.getElementById("btnAddRow");


document.addEventListener("DOMContentLoaded", async () => {
    const today = new Date();
    document.getElementById("voucherDate").value =
        today.toLocaleDateString("en-CA");

    calculateTotals();
    // bindEvents(voucherBody.rows[0]);
    await loadAccounts();
    await loadParties(CompanyID);
    await loadVoucherNumber();
    await loadBranches(CompanyID);
    await loadCostCenters(CompanyID);
    await loadBankAccounts(CompanyID, 'Bank');
});

/*==========================================================
    CALCULATE TOTALS
==========================================================*/

function calculateTotals() {

    let totalDebit = 0;
    let totalCredit = 0;
    let totalGST = 0;

    for (const row of voucherBody.rows) {
        totalDebit += Number(row.querySelector(".debit")?.value) || 0;
        totalCredit += Number(row.querySelector(".credit")?.value) || 0;
        totalGST += Number(row.querySelector(".gstAmount")?.value) || 0;
    }

    totalDebitEl.textContent = totalDebit.toFixed(2);
    totalCreditEl.textContent = totalCredit.toFixed(2);
    document.getElementById("totalGst").textContent = totalGST.toFixed(2);

    return {
        debit: totalDebit,
        credit: totalCredit,
        gst: totalGST,
        balance: totalDebit - totalCredit
    };

}



function updateGST(row) {
    const debit = Number(row.querySelector(".debit").value) || 0;
    const credit = Number(row.querySelector(".credit").value) || 0;
    const amount = debit > 0 ? debit : credit;
    const rate = Number(row.querySelector(".gstRate").value) || 0;
    const gstType = row.querySelector(".gstType")?.value ?? "Exclusive";
    const result = calculateGST(amount, rate, gstType);

    row.querySelector(".gstAmount").value = result.gst.toFixed(2);
    row.querySelector(".totalAmount").value = result.total.toFixed(2);

}

document.getElementById("voucherDate").addEventListener("change", async () => {
    await loadVoucherNumber();
});
function calculateGST(amount, rate, type) {

    amount = Number(amount) || 0;
    rate = Number(rate) || 0;

    if (rate <= 0) {
        return {
            taxable: amount,
            gst: 0,
            total: amount
        };
    }

    // GST Inclusive
    if (type === "Inclusive") {

        const taxable = amount / (1 + (rate / 100));
        const gst = amount - taxable;

        return {
            taxable: Number(taxable.toFixed(2)),
            gst: Number(gst.toFixed(2)),
            total: amount
        };
    }

    // GST Exclusive
    const gst = amount * rate / 100;

    return {
        taxable: amount,
        gst: Number(gst.toFixed(2)),
        total: Number((amount + gst).toFixed(2))
    };

}

async function loadVoucherNumber() {

    const voucherType = document.getElementById("voucherType").value;
    const voucherDate = document.getElementById("voucherDate").value;

    const { data, error } = await supabaseClient.rpc(
        "generate_voucher_no",
        {
            p_company_id: CompanyID,
            p_voucher_type: voucherType,
            p_date: voucherDate
        }
    );

    if (error) {
        console.error(error);
        return;
    }

    document.getElementById("voucherNo").value = data;
}

async function loadAccounts() {

    const { data, error } = await supabaseClient
        .from("ChartOfAccountsView")
        .select("*")
        .order("AccountName");
    if (error) {
        console.error(error);
        return;
    }

    accountMaster = data || [];
    renderAccounts(accountMaster);

}

function renderAccounts(data) {

    const tbody = document.getElementById("accountListBody");

    let html = "";

    data.forEach(acc => {
        html += `
            <tr data-code="${acc.AccountCode}">
                <td>${acc.AccountCode}</td>
                <td>${acc.AccountName}</td>
                <td>${acc.AccountType}</td>
            </tr>`;
    });

    tbody.innerHTML = html;

}

async function loadParties(companyId) {

    const { data, error } = await supabaseClient

        .from("AccountMasterView")

        .select(`
            AccountCode,
            AccountName,
            GSTNumber,
            State
        `)

        .eq("company_id", companyId)

        .order("AccountName");

    if (error) {

        console.error(error);

        return;

    }

    partyMaster = data;

    renderPartyList(data);
}

function renderPartyList(data) {

    const tbody = document.getElementById("partyListBody");

    tbody.innerHTML = "";

    data.forEach(p => {

        tbody.innerHTML += `

        <tr
            data-code="${p.AccountCode}">
            <td>${p.AccountCode}</td>
            <td>${p.AccountName}</td>
            <td>${p.GSTNumber ?? ""}</td>
            <td>${p.State ?? ""}</td>
        </tr>

        `;

    });

}

document.getElementById("partySearch").addEventListener("input", function () {
    const txt = this.value.toLowerCase();
    const filtered = partyMaster.filter(p =>
        p.AccountCode.toLowerCase().includes(txt)
        ||
        p.AccountName.toLowerCase().includes(txt)
        ||
        (p.GSTNumber || "").toLowerCase().includes(txt)
    );
    renderPartyList(filtered);
});

function openPartySearch(input) {
    currentPartyTextbox = input;
    const modal = new bootstrap.Modal(
        document.getElementById("partyModal")
    );
    modal.show();
    document.getElementById("partySearch").focus();
}

document.getElementById("partyListBody").addEventListener("click", function (e) {
    const row = e.target.closest("tr");
    if (!row) return;
    const code = row.dataset.code;
    const party = partyMaster.find(x =>
        x.AccountCode === code
    );
    currentPartyTextbox.value = party.AccountName;
    currentPartyTextbox.parentElement.querySelector(".partyCode").value = party.AccountCode;
    bootstrap.Modal.getInstance(
        document.getElementById("partyModal")
    ).hide();
});

document.addEventListener("click", function (e) {
    if (e.target.closest(".partySearch")) {
        const row = e.target.closest("tr");
        openPartySearch(
            row.querySelector(".partyName")
        );
    }
});

//==================================================
// Show/Hide Bank Details
//==================================================
function toggleTransactionFields() {

    const transactionMode = document.getElementById("transactionMode");
    const bankSection = document.getElementById("bankSection");
    const instrumentSection = document.getElementById("instrumentSection");
    const narrationSection = document.getElementById("narrationSection");
    const bankAccount = document.getElementById("bankAccount");
    const instrumentNo = document.getElementById("instrumentNo");

    if (!transactionMode) return;

    const mode = transactionMode.value;

    const showBankDetails = [
        "Bank",
        "Cheque",
        "NEFT",
        "RTGS",
        "IMPS",
        "UPI"
    ].includes(mode);

    // Show/Hide Bank Section
    if (bankSection) {
        bankSection.style.display = showBankDetails ? "" : "none";
    }

    // Show/Hide Instrument Section
    if (instrumentSection) {
        instrumentSection.style.display = showBankDetails ? "" : "none";
    }

    // Change Narration Width
    if (narrationSection) {
        narrationSection.classList.remove("col-5", "col-10");
        narrationSection.classList.add(showBankDetails ? "col-5" : "col-10");
    }

    // Clear values when hidden
    if (!showBankDetails) {
        if (bankAccount) bankAccount.value = "";
        if (instrumentNo) instrumentNo.value = "";
    }
}

//==================================================
// Event
//==================================================

if (transactionMode) {
    transactionMode.addEventListener("change", toggleTransactionFields);

    // Run once on page load
    toggleTransactionFields();
}



// Trigger on page load
transactionMode.dispatchEvent(new Event("change"));

document.addEventListener("keydown", function (e) {
    if (!["Enter", "F2"].includes(e.key)) return;
    const row = e.target.closest("tr");
    if (!row) return;
    if (e.target.classList.contains("accountName")) {
        e.preventDefault();
        row.querySelector(".accountSearch").click();
    }
    if (e.target.classList.contains("partyName")) {
        e.preventDefault();
        row.querySelector(".partySearch").click();
    }
});

// Trigger on input change of debit or credit amount field in voucher 
document.addEventListener("input", function (e) {
    if (e.target.classList.contains("debit") || e.target.classList.contains("credit")) {

        const row = e.target.closest("tr");
        const debit = row.querySelector(".debit");
        const credit = row.querySelector(".credit");

        if (e.target.classList.contains("debit")) {
            if (parseFloat(debit.value) > 0) {
                credit.value = 0;
                credit.disabled = true;
            } else {
                credit.disabled = false;
            }
        }

        if (e.target.classList.contains("credit")) {
            if (parseFloat(credit.value) > 0) {
                debit.value = 0;
                debit.disabled = true;
            } else {
                debit.disabled = false;
            }
        }
    }
});

document.getElementById("voucherType").addEventListener("change", async function () {

    clearVoucher();

    await loadVoucherNumber();

});

function clearVoucher() {

    voucherBody.innerHTML = "";

    addRow();

    document.getElementById("referenceNo").value = "";
    document.getElementById("narration").value = "";

    calculateTotals();

}

function addRow() {

    const row = voucherBody.insertRow();

    row.innerHTML = `
<td></td>

<td>
    <div class="input-group">
        <input type="text"
               class="form-control accountName"
               placeholder="Select Ledger"
               readonly>
        <input type="hidden" class="accountCode">

        <button type="button"
                class="btn btn-outline-secondary accountSearch">
            <i class="bi bi-search"></i>
        </button>
    </div>
</td>

<td>
    <div class="input-group">
        <input type="text"
               class="form-control partyName"
               placeholder="Select Party"
               readonly>

        <input type="hidden" class="partyCode">

        <button type="button"
                class="btn btn-outline-secondary partySearch">
            <i class="bi bi-search"></i>
        </button>
    </div>
</td>
<td><textarea class="form-control remarks" rows="1"></textarea></td>
<td>
    <input type="number"
           step="0.01"
           placeholder="0.00"
           class="form-control debit text-end">
</td>

<td>
    <input type="number"
           step="0.01"
           placeholder="0.00"
           class="form-control credit text-end">
</td>
<td>
    <select class="form-select gstType">
    <option value="Exclusive" selected>Exclusive</option>
    <option value="Inclusive">Inclusive</option>
    </select>
</td>
<td>
    <select class="form-select gstRate text-end">
        <option value="0">0%</option>
        <option value="5">5%</option>
        <option value="12">12%</option>
        <option value="18">18%</option>
        <option value="28">28%</option>
    </select>
</td>

<td>
    <input type="number"
           class="form-control gstAmount text-end"
           value="0"
           readonly>
</td>
<td><input type="number" class="form-control totalAmount text-end" readonly value="0"></td>

<td class="text-center">
    <button class="btn btn-danger btn-sm deleteRow">
        <i class="bi bi-trash"></i>
    </button>
</td>
`;

    renumberRows();
    row.querySelector(".accountName").focus();
}

function renumberRows() {
    [...voucherBody.rows].forEach((row, index) => {
        row.cells[0].innerText = index + 1;
        row.querySelector(".deleteRow").disabled =
            voucherBody.rows.length === 1;
    });
}

document.addEventListener("click", function (e) {

    if (e.target.closest(".accountSearch")) {

        const row = e.target.closest("tr");

        openAccountSearch(
            row.querySelector(".accountName")
        );

    }

});

document.getElementById("accountListBody").addEventListener("click", function (e) {

    const row = e.target.closest("tr");

    if (!row) return;

    selectAccount(row.dataset.code);

});
document.getElementById("accountSearch").addEventListener("input", function () {

    const txt = this.value.toLowerCase();

    const filtered =

        accountMaster.filter(a =>

            a.AccountCode.toLowerCase().includes(txt)

            ||

            a.AccountName.toLowerCase().includes(txt)

        );

    renderAccounts(filtered);

});

function openAccountSearch(input) {
    currentAccountTextbox = input;
    document.getElementById("accountSearch").value = "";
    renderAccounts(accountMaster);
    new bootstrap.Modal(
        document.getElementById("accountModal")
    ).show();
}

function selectAccount(code) {

    const acc = accountMaster.find(x => x.AccountCode === code);

    currentAccountTextbox.value = acc.AccountName;

    const row = currentAccountTextbox.closest("tr");

    row.querySelector(".accountCode").value = acc.AccountCode;

    // ==========================
    // Auto Fill GST Rate
    // ==========================
    if (acc.GSTRate) {
        row.querySelector(".gstRate").value = acc.GSTRate;
    }

    // Recalculate GST & Total Amount
    updateGST(row);
    calculateTotals();

    // Close modal
    bootstrap.Modal.getInstance(
        document.getElementById("accountModal")
    ).hide();

    // Move cursor to Party field
    row.querySelector(".partyName").focus();
}

voucherBody.addEventListener("blur", function (e) {

    if (
        e.target.classList.contains("debit") ||
        e.target.classList.contains("credit")
    ) {
        formatAmount(e.target);
    }

}, true);

btnAddRow.addEventListener("click", () => {
    addRow();
});

/*==========================================================
    SAVE VOUCHER
==========================================================*/

async function saveVoucher() {
    let header = null;
    try {

        setSaveButton(true);

        if (!validateVoucher())
            return;
        const voucher = buildVoucherHeader();
        header = await insertVoucherHeader(voucher);
        const voucherDetails = getVoucherLines(header.VoucherID);

        if (!voucherDetails.length)
            throw new Error("No voucher details found.");

        await insertVoucherDetails(voucherDetails);
        showSuccess(`Voucher ${voucher.VoucherNo} saved successfully.`);
        await resetVoucherForm();
    }
    catch (err) {

        if (typeof header !== "undefined")
            await rollbackVoucher(header.VoucherID);

        showError(err);

    }
    finally {

        setSaveButton(false);

    }

}

/*==========================================================
    GET VOUCHER DETAILS
==========================================================*/

function getVoucherLines(voucherID) {
    const rows = [];
    const voucherRows = document.querySelectorAll("#voucherBody tr");
    voucherRows.forEach((tr) => {

        // Cache Controls
        const accountCode = tr.querySelector(".accountCode")?.value.trim() || "";
        const partyCode = tr.querySelector(".partyCode")?.value.trim() || "";
        const debit = Number(tr.querySelector(".debit")?.value) || 0;
        const credit = Number(tr.querySelector(".credit")?.value) || 0;
        const gstType = tr.querySelector(".gstType")?.value || "Exclusive";
        const gstPercent = Number(tr.querySelector(".gstRate")?.value) || 0;
        const gstAmount = Number(tr.querySelector(".gstAmount")?.value) || 0;
        const totalAmount = gstAmount + debit + credit;
        const remarks = tr.querySelector(".remarks")?.value.trim() || "";

        // Skip Completely Empty Rows
        if (
            !accountCode &&
            !partyCode &&
            debit === 0 &&
            credit === 0 &&
            gstAmount === 0 &&
            remarks === ""
        ) {
            return;
        }

        rows.push({
            LineNo: rows.length + 1,
            VoucherID: voucherID,
            AccountCode: accountCode,
            PartyCode: partyCode || null,
            Debit: debit,
            Credit: credit,
            GSTType: gstType,
            GSTPercent: gstPercent,
            GSTAmount: gstAmount,
            TotalAmount: totalAmount,
            Remarks: remarks
        });
    });
    return rows;
}

/*==========================================================
    ROLLBACK VOUCHER
==========================================================*/

async function rollbackVoucher(voucherID) {

    if (!voucherID)
        return;

    try {

        // Delete Details First
        await supabaseClient
            .from("AccountingVoucherDetails")
            .delete()
            .eq("VoucherID", voucherID);

        // Delete Header
        const { error } = await supabaseClient
            .from("AccountingVoucher")
            .delete()
            .eq("VoucherID", voucherID);

        if (error)
            throw error;

    }
    catch (err) {

        console.error("Rollback Failed :", err);

    }

}

/*==========================================================
    SAVE BUTTON
==========================================================*/

function setSaveButton(isSaving = false) {

    const btn = document.getElementById("saveButton");

    btn.disabled = isSaving;

    btn.innerHTML = isSaving
        ? '<span class="spinner-border spinner-border-sm"></span> Saving...'
        : '<i class="bi bi-floppy"></i> Save';

}

/*==========================================================
    BUILD HEADER
==========================================================*/

function buildVoucherHeader() {
    return {
        CompanyID: CompanyID,
        VoucherNo: document.getElementById("voucherNo").value.trim(),
        VoucherDate: document.getElementById("voucherDate").value,
        VoucherType: document.getElementById("voucherType").value,
        ReferenceNo: document.getElementById("referenceNo").value.trim(),
        BranchID: document.getElementById("branch").value,
        CostCenter: document.getElementById("costCenter").value,
        TransactionMode: document.getElementById("transactionMode").value,
        BankAccountID: document.getElementById("bankAccount").value || null,
        ChequeUTRNo: document.getElementById("instrumentNo").value.trim(),
        Narration: document.getElementById("narration").value.trim(),
        CreatedBy: UserLoginID
    };

}

/*==========================================================
    INSERT HEADER
==========================================================*/

async function insertVoucherHeader(voucher) {
    const { data, error } = await supabaseClient
        .from("AccountingVoucher")
        .insert([voucher])
        .select()
        .single();
    if (error)
        throw error;
    return data;
}

/*==========================================================
    INSERT DETAILS
==========================================================*/

async function insertVoucherDetails(details) {
    const { error } = await supabaseClient
        .from("AccountingVoucherDetails")
        .insert(details);
    if (error)
        throw error;
}
/*==========================================================
    RESET VOUCHER
==========================================================*/

async function resetVoucherForm() {
    clearVoucher();
    await loadVoucherNumber();
}

/*==========================================================
    DEBUG
==========================================================*/

function logVoucher(header, details) {
    console.group("Voucher");
    console.table(header);
    console.table(details);
    console.groupEnd();
}

document.getElementById("saveButton").onclick = saveVoucher;

/*==========================================================
    VALIDATION
==========================================================*/

function validateVoucher() {

    calculateTotals();

    const totalDebit = Number(totalDebitEl.textContent) || 0;
    const totalCredit = Number(totalCreditEl.textContent) || 0;

    const branch = document.getElementById("branch");
    const costCenter = document.getElementById("costCenter");
    const transactionMode = document.getElementById("transactionMode");
    const bankAccount = document.getElementById("bankAccount");

    // Header Validation
    if (!branch.value) {
        alert("Please select a Branch.");
        branch.focus();
        return false;
    }

    if (!costCenter.value) {
        alert("Please select a Cost Center.");
        costCenter.focus();
        return false;
    }

    if (
        transactionMode.value &&
        transactionMode.value !== "Cash" &&
        !bankAccount.value
    ) {
        alert("Please select a Bank Account.");
        bankAccount.focus();
        return false;
    }

    if (totalDebit === 0 && totalCredit === 0) {
        alert("Voucher amount cannot be zero.");
        return false;
    }

    // Detail Validation
    const rows = document.querySelectorAll("#voucherBody tr");

    for (let i = 0; i < rows.length; i++) {

        const row = rows[i];

        const accountCode = row.querySelector(".accountCode").value.trim();
        const partyCode = row.querySelector(".partyCode").value.trim();

        const debit = Number(row.querySelector(".debit").value) || 0;
        const credit = Number(row.querySelector(".credit").value) || 0;

        const accountInput = row.querySelector(".accountName");
        const debitInput = row.querySelector(".debit");
        const creditInput = row.querySelector(".credit");

        // Skip completely empty rows
        if (!accountCode && debit === 0 && credit === 0)
            continue;

        if (!accountCode) {
            alert(`Please select Ledger in Row ${i + 1}.`);
            accountInput.focus();
            return false;
        }

        if (debit === 0 && credit === 0) {
            alert(`Please enter Debit or Credit in Row ${i + 1}.`);
            debitInput.focus();
            return false;
        }

        if (debit > 0 && credit > 0) {
            alert(`Both Debit and Credit cannot be entered in Row ${i + 1}.`);
            debitInput.focus();
            return false;
        }

        if (debit < 0 || credit < 0) {
            alert(`Negative amounts are not allowed in Row ${i + 1}.`);
            debitInput.focus();
            return false;
        }

    }

    return true;
}