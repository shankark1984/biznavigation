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

const debitInput = document.querySelector(".debit");
const creditInput = document.querySelector(".credit");

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

function calculateTotals() {

    let debit = 0;
    let credit = 0;
    let gst = 0;

    [...voucherBody.rows].forEach(row => {

        debit += Number(row.querySelector(".debit").value || 0);
        credit += Number(row.querySelector(".credit").value || 0);
        gst += Number(row.querySelector(".gstAmount").value || 0);

    });

    totalDebitEl.innerText = debit.toFixed(2);
    totalCreditEl.innerText = credit.toFixed(2);

    document.getElementById("totalGst").innerText = gst.toFixed(2);
}

/*==========================================================
    EVENTS
==========================================================*/

voucherBody.addEventListener("input", function (e) {

    const row = e.target.closest("tr");
    if (!row) return;

    if (
        e.target.classList.contains("debit") ||
        e.target.classList.contains("credit")
    ) {
        updateGST(row);
        calculateTotals();
    }

});

voucherBody.addEventListener("change", function (e) {

    const row = e.target.closest("tr");
    if (!row) return;

    if (
        e.target.classList.contains("gstRate") ||
        e.target.classList.contains("gstType")
    ) {
        updateGST(row);
        calculateTotals();
    }

});

voucherBody.addEventListener("click", function (e) {

    const btn = e.target.closest(".deleteRow");
    if (!btn) return;

    deleteRow(btn);

});

function updateGST(row) {

    const debit = Number(row.querySelector(".debit").value) || 0;
    const credit = Number(row.querySelector(".credit").value) || 0;

    const amount = debit > 0 ? debit : credit;

    const rate = Number(row.querySelector(".gstRate").value) || 0;

    const gstType = row.querySelector(".gstType").value;

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

    tbody.innerHTML = "";

    data.forEach(acc => {

        tbody.innerHTML += `
<tr data-code="${acc.AccountCode}">
    <td>${acc.AccountCode}</td>
    <td>${acc.AccountName}</td>
    <td>${acc.AccountType}</td>
</tr>`;

    });

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

transactionMode.addEventListener("change", () => {
    const mode = transactionMode.value;
    const showBankDetails = [
        "Bank",
        "Cheque",
        "NEFT",
        "RTGS",
        "IMPS",
        "UPI"
    ].includes(mode);

    if (showBankDetails) {
        bankSection.style.display = "";
        instrumentSection.style.display = "";
        // Narration occupies 5 columns
        narrationSection.classList.remove("col-10");
        narrationSection.classList.add("col-5");

    } else {

        bankSection.style.display = "none";
        instrumentSection.style.display = "none";
        document.getElementById("bankAccount").value = "";
        document.getElementById("instrumentNo").value = "";
        // Narration occupies full width
        narrationSection.classList.remove("col-5");
        narrationSection.classList.add("col-10");
    }
});

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

    console.log("Voucher Type:", this.value);

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

debitInput.addEventListener("blur", function () {
    formatAmount(this);
    const row = this.closest("tr");
    updateGST(row);
    calculateTotals();
});

creditInput.addEventListener("blur", function () {
    formatAmount(this);
    const row = this.closest("tr");
    updateGST(row);
    calculateTotals();
});

btnAddRow.addEventListener("click", () => {
    addRow();
});

async function saveVoucher() {
    const saveButton = document.getElementById("saveButton");
    saveButton.disabled = true;
    saveButton.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Saving...';
    try {
        if (!validateVoucher())
            return;
        calculateTotals();

        const voucher = {
            CompanyID: CompanyID,
            VoucherNo: document.getElementById("voucherNo").value,
            VoucherDate: document.getElementById("voucherDate").value,
            VoucherType: document.getElementById("voucherType").value,
            ReferenceNo: document.getElementById("referenceNo").value,
            BranchID: document.getElementById("branch").value,
            CostCenter: document.getElementById("costCenter").value,
            TransactionMode: document.getElementById("transactionMode").value,
            BankAccountID: document.getElementById("bankAccount").value,
            ChequeUTRNo: document.getElementById("instrumentNo").value,
            Narration: document.getElementById("narration").value,
            CreatedBy: UserLoginID,
        };
        const { data, error } = await supabaseClient
            .from("AccountingVoucher")
            .insert([voucher])
            .select()
            .single();


        if (error) {
            alert(error.message);
            return;
        }
        const voucherID = data.VoucherID;
        const voucherDetails = getVoucherLines(voucherID);

        const { error: detailError } = await supabaseClient
            .from("AccountingVoucherDetails")
            .insert(voucherDetails);

        if (detailError) {

            const { error: rollbackError } = await supabaseClient
                .from("AccountingVoucher")
                .delete()
                .eq("VoucherID", voucherID);

            if (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            alert(detailError.message);
            return;
        }


        alert("Voucher Saved Successfully");
        clearVoucher();

        await loadVoucherNumber();

    } catch (err) {

        console.error(err);
        alert(err.message || "Unexpected error occurred.");

    }
    finally {

        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="bi bi-floppy"></i> Save';

    }
}

function getVoucherLines(voucherID) {

    const rows = [];

    document.querySelectorAll("#voucherBody tr").forEach((tr, index) => {

        rows.push({
            LineNo: index + 1,
            VoucherID: voucherID,
            AccountCode: tr.querySelector(".accountCode").value,
            PartyCode: tr.querySelector(".partyCode").value,
            Debit: Number(tr.querySelector(".debit").value || 0),
            Credit: Number(tr.querySelector(".credit").value || 0),
            GSTType: tr.querySelector(".gstType").value,
            GSTPercent: Number(tr.querySelector(".gstRate").value || 0),
            GSTAmount: Number(tr.querySelector(".gstAmount").value || 0),
            Remarks: tr.querySelector(".remarks").value
        });

    });

    return rows;
}

document.getElementById("saveButton").onclick = saveVoucher;

/*==========================================================
    VALIDATION
==========================================================*/

function validateVoucher() {

    const debit = parseFloat(totalDebitEl.textContent) || 0;
    const credit = parseFloat(totalCreditEl.textContent) || 0;
    const branch = document.getElementById("branch").value;
    const costCenter = document.getElementById("costCenter").value;
    const transactionMode = document.getElementById("transactionMode").value;

    console.log({
        totalDebit: debit,
        totalCredit: credit
    });

    if (!branch) {
        alert("Please select a branch.");
        document.getElementById("branch").focus();
        return false;
    }
    if (!costCenter) {
        alert("Please select a cost center.");
        document.getElementById("costCenter").focus();
        return false;
    }

    if (transactionMode === "Bank") {
        const bank = document.getElementById("bankAccount").value;
        if (!bank) {
            alert("Please select a bank account.");
            document.getElementById("bankAccount").focus();
            return false;
        }
    }

    if (debit === 0 && credit === 0) {
        alert("Enter either a Debit or Credit amount.");
        return false;
    }

    if (debit !== credit) {
        alert("Voucher is not balanced.");
        return false;
    }

    // Validate each row
    for (const row of voucherBody.rows) {

        const accountCode = row.querySelector(".accountCode")?.value || "";

        if (!accountCode) {
            alert("Please select an account.");
            row.querySelector(".accountSearch").focus();
            return false;
        }

        const debitAmt = parseFloat(row.querySelector(".debit")?.value) || 0;

        const creditAmt = parseFloat(row.querySelector(".credit")?.value) || 0;

        if (debitAmt === 0 && creditAmt === 0) {
            alert("Enter a debit or credit amount.");
            row.querySelector(".debit").focus();
            return false;
        }

        if (debitAmt > 0 && creditAmt > 0) {
            alert("A row cannot contain both Debit and Credit.");
            row.querySelector(".debit").focus();
            return false;
        }
    }

    return true;
}