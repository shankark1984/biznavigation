//AccountingVoucher.js


let accountMaster = [];
let currentPartyTextbox = null;
let partyMaster = [];

const voucherBody = document.getElementById("voucherBody");
const totalDebitEl = document.getElementById("totalDebit");
const totalCreditEl = document.getElementById("totalCredit");

const transactionMode = document.getElementById("transactionMode");
const bankSection = document.getElementById("bankSection");
const instrumentSection = document.getElementById("instrumentSection");
const narrationSection = document.getElementById("narrationSection");


document.addEventListener("DOMContentLoaded", async () => {
    const today = new Date();
    document.getElementById("voucherDate").value =
        today.toLocaleDateString("en-CA");

    calculateTotals();
    bindEvents(voucherBody.rows[0]);
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

function bindEvents(row) {

    row.querySelector(".deleteRow").addEventListener("click", function () {
        deleteRow(this);
    });
    row.querySelector(".debit").addEventListener("input", calculateTotals);
    row.querySelector(".credit").addEventListener("input", calculateTotals);
    row.querySelector(".gstRate").addEventListener("change", function () {
        updateGST(row);
        calculateTotals();

    });
}

function updateGST(row) {

    const amount = Number(row.querySelector(".debit").value || 0) ||
        Number(row.querySelector(".credit").value || 0);

    const rate = Number(row.querySelector(".gstRate").value || 0);

    row.querySelector(".gstAmount").value = calculateGST(amount, rate).toFixed(2);
    row.querySelector(".totalAmount").value = (amount + Number(row.querySelector(".gstAmount").value || 0)).toFixed(2);
}

document.getElementById("voucherDate").addEventListener("change", async () => {
    await loadVoucherNumber();
});
function calculateGST(amount, rate) {
    return (amount * rate) / 100;
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
    currentPartyTextbox.parentElement.querySelector(".partyCode").value = party.PartyCode;
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

// Trigger on input change of debit or credit amount field in voucher body
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