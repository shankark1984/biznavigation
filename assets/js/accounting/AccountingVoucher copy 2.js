/*=========================================================
    GLOBAL VARIABLES
=========================================================*/
let accountMaster = [];
let currentAccountTextbox = null;
let partyMaster = [];
let currentPartyTextbox = null;
let selectedAccountIndex = -1;
let filteredAccounts = [];
let filteredParty = [];
let selectedPartyIndex = -1;
let companyProfile = null;

const partyModalEl = document.getElementById("partyModal");
const partySearchInput = document.getElementById("partySearch");
const partyListBody = document.getElementById("partyListBody");
const accountModalEl = document.getElementById("accountModal");
const accountSearchInput = document.getElementById("accountSearch");
const accountListBody = document.getElementById("accountListBody");
const transactionMode = document.getElementById("transactionMode");
const bankSection = document.getElementById("bankSection");
const instrumentSection = document.getElementById("instrumentSection");
const narrationSection = document.getElementById("narrationSection");
const bankAccount = document.getElementById("bankAccount");
const instrumentNo = document.getElementById("instrumentNo");
const partyGST = document.getElementById("partyGST");


/*=========================================================
    INITIAL LOAD
=========================================================*/
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await Promise.all([
            loadBranches(CompanyID),
            loadCostCenters(CompanyID),
            loadBankAccounts(CompanyID, "Bank"),
            loadAccounts(),
            loadParties(CompanyID),

        ]);
        // Apply on initial page load
        toggleTransactionFields()
        companyProfile = await getCompanyProfile(CompanyID)
    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

/*=========================================================
    LOAD ACCOUNTS
=========================================================*/
async function loadAccounts() {

    const { data, error } = await supabaseClient
        .from("ChartOfAccountsView")
        .select("*")
        .order("AccountName");

    if (error) {
        console.error("Load Accounts:", error);
        return;
    }

    accountMaster = data ?? [];
    renderAccounts(accountMaster);
}

/*=========================================================
    RENDER ACCOUNT LIST
=========================================================*/
function renderAccounts(accounts) {

    filteredAccounts = accounts;
    selectedAccountIndex = accounts.length ? 0 : -1;

    accountListBody.innerHTML = accounts.map((acc, index) => `
        <tr data-code="${acc.AccountCode}"
            class="${index === selectedAccountIndex ? "table-primary" : ""}">
            <td>${acc.AccountCode}</td>
            <td>${acc.AccountName}</td>
            <td>${acc.AccountType ?? ""}</td>
        </tr>
    `).join("");

    highlightSelectedAccount();
}

function highlightSelectedAccount() {

    const rows = accountListBody.querySelectorAll("tr");

    rows.forEach((row, index) => {
        row.classList.toggle("table-primary", index === selectedAccountIndex);
    });

    if (rows[selectedAccountIndex]) {
        rows[selectedAccountIndex].scrollIntoView({
            block: "nearest"
        });
    }

}

/*=========================================================
    OPEN ACCOUNT SEARCH
=========================================================*/
function openAccountSearch(input) {

    currentAccountTextbox = input;

    accountSearchInput.value = "";
    renderAccounts(accountMaster);

    const modal = bootstrap.Modal.getOrCreateInstance(accountModalEl);

    // Focus search box after modal is fully visible
    accountModalEl.addEventListener("shown.bs.modal", function onShown() {
        accountSearchInput.focus();
        accountSearchInput.select();   // Optional: select existing text
        accountModalEl.removeEventListener("shown.bs.modal", onShown);
    });

    modal.show();

}

/*=========================================================
    SELECT ACCOUNT
=========================================================*/
function selectAccount(code) {

    const account = accountMaster.find(a => String(a.AccountCode) === String(code));

    if (!account || !currentAccountTextbox) return;

    const card = currentAccountTextbox.closest(".entry-card");
    if (!card) return;

    currentAccountTextbox.value = account.AccountName;

    card.querySelector(".accountCode").value = account.AccountCode;

    const gstInput = card.querySelector(".gstRate");
    if (gstInput)
        gstInput.value = account.GSTRate ?? "";

    bootstrap.Modal.getOrCreateInstance(accountModalEl).hide();

    card.querySelector(".partyName")?.focus();
}

/*=========================================================
    KEYBOARD SHORTCUTS
=========================================================*/
document.addEventListener("keydown", e => {

    if (!["Enter", "F2"].includes(e.key))
        return;

    const card = e.target.closest(".entry-card");
    if (!card)
        return;

    if (e.target.classList.contains("accountName")) {
        e.preventDefault();
        card.querySelector(".accountSearch")?.click();
    }

    if (e.target.classList.contains("partyName")) {
        e.preventDefault();
        card.querySelector(".partySearch")?.click();
    }

});

/*=========================================================
    OPEN ACCOUNT MODAL
=========================================================*/
document.addEventListener("click", e => {

    const btn = e.target.closest(".accountSearch");
    if (!btn)
        return;

    const input = btn.closest(".entry-card")?.querySelector(".accountName");
    if (input)
        openAccountSearch(input);

});

/*=========================================================
    SEARCH ACCOUNT
=========================================================*/
accountSearchInput.addEventListener("keydown", function (e) {

    const rows = accountListBody.querySelectorAll("tr");

    if (!rows.length)
        return;

    switch (e.key) {

        case "ArrowDown":

            e.preventDefault();

            if (selectedAccountIndex < rows.length - 1)
                selectedAccountIndex++;

            highlightSelectedAccount();
            break;

        case "ArrowUp":

            e.preventDefault();

            if (selectedAccountIndex > 0)
                selectedAccountIndex--;

            highlightSelectedAccount();
            break;

        case "Enter":

            e.preventDefault();

            if (selectedAccountIndex >= 0) {
                const code = rows[selectedAccountIndex].dataset.code;
                selectAccount(code);
            }
            break;

    }

});

accountSearchInput.addEventListener("input", function () {

    const keyword = this.value.trim().toLowerCase();

    if (!keyword) {
        renderAccounts(accountMaster);
        return;
    }

    const filtered = accountMaster.filter(acc =>
        String(acc.AccountCode).toLowerCase().includes(keyword) ||
        String(acc.AccountName).toLowerCase().includes(keyword) ||
        String(acc.AccountType ?? "").toLowerCase().includes(keyword)
    );

    renderAccounts(filtered);

});
/*=========================================================
    ACCOUNT SELECT
=========================================================*/
accountListBody.addEventListener("click", e => {

    const tr = e.target.closest("tr");
    if (!tr)
        return;

    selectAccount(tr.dataset.code);

});

/*=========================================================
    LOAD PARTIES
=========================================================*/
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
        console.error("Load Parties:", error);
        return;
    }

    partyMaster = data ?? [];
    renderPartyList(partyMaster);
}

/*=========================================================
    RENDER PARTY LIST
=========================================================*/
function renderPartyList(parties) {

    filteredParty = parties;
    selectedPartyIndex = parties.length ? 0 : -1;
    partyListBody.innerHTML = parties.map((p, index) => `
        <tr data-code="${p.AccountCode}"
        class="${index === selectedPartyIndex ? "table-primary" : ""}">
            <td>${p.AccountCode}</td>
            <td>${p.AccountName}</td>
            <td>${p.GSTNumber ?? ""}</td>
            <td>${p.State ?? ""}</td>
        </tr>
    `).join("");

    highlightSelectedParty();

}

function highlightSelectedParty() {

    const rows = partyListBody.querySelectorAll("tr");

    rows.forEach((row, index) => {
        row.classList.toggle("table-primary", index === selectedPartyIndex);
    });

    if (rows[selectedPartyIndex]) {
        rows[selectedPartyIndex].scrollIntoView({
            block: "nearest"
        });
    }

}

/*=========================================================
    OPEN PARTY SEARCH
=========================================================*/
function openPartySearch(input) {
    currentPartyTextbox = input;
    partySearchInput.value = "";
    renderPartyList(partyMaster);

    const modal = bootstrap.Modal.getOrCreateInstance(partyModalEl);

    partyModalEl.addEventListener("shown.bs.modal", function onShown() {
        partySearchInput.focus();
        partySearchInput.select();   // Optional: select existing text
        partyModalEl.removeEventListener("shown.bs.modal", onShown);
    }, { once: true });

    modal.show();
}

/*=========================================================
    SELECT PARTY
=========================================================*/
function selectParty(code) {

    const party = partyMaster.find(
        p => String(p.AccountCode) === String(code)
    );

    if (!party || !currentPartyTextbox) return;

    const card = currentPartyTextbox.closest(".entry-card");
    if (!card) return;

    currentPartyTextbox.value = party.AccountName;
    card.querySelector(".partyCode").value = party.AccountCode;

    // Update Party GST (outside the entry card)
    document.getElementById("partyGST").value = party.GSTNumber || "";

    // Update Party GST (inside the entry card, if present)
    const gstInput = card.querySelector(".partyGST");
    if (gstInput) {
        gstInput.value = party.GSTNumber || "";
    }

    const stateInput = card.querySelector(".partyState");
    if (stateInput) {
        stateInput.value = party.State || "";
    }

    // Recalculate GST for this row
    updateGST(card);


    bootstrap.Modal.getOrCreateInstance(partyModalEl).hide();
    card.querySelector(".debit")?.focus();
}
/*=========================================================
    PARTY SEARCH
=========================================================*/
partySearchInput.addEventListener("input", function () {
    const keyword = this.value.trim().toLowerCase();
    if (!keyword) {
        renderPartyList(partyMaster);
        return;
    }
    const filtered = partyMaster.filter(p =>
        String(p.AccountCode).toLowerCase().includes(keyword) ||
        String(p.AccountName).toLowerCase().includes(keyword) ||
        String(p.GSTNumber ?? "").toLowerCase().includes(keyword) ||
        String(p.State ?? "").toLowerCase().includes(keyword)
    );
    renderPartyList(filtered);

});

partySearchInput.addEventListener("keydown", function (e) {

    const rows = partyListBody.querySelectorAll("tr");

    if (!rows.length)
        return;

    switch (e.key) {

        case "ArrowDown":

            e.preventDefault();

            if (selectedPartyIndex < rows.length - 1)
                selectedPartyIndex++;

            highlightSelectedParty();
            break;

        case "ArrowUp":

            e.preventDefault();

            if (selectedPartyIndex > 0)
                selectedPartyIndex--;

            highlightSelectedParty();
            break;

        case "Enter":

            e.preventDefault();

            if (selectedPartyIndex >= 0) {
                const code = rows[selectedPartyIndex].dataset.code;
                selectParty(code);
            }
            break;

    }

});
/*=========================================================
    PARTY SELECT
=========================================================*/
partyListBody.addEventListener("click", function (e) {
    const row = e.target.closest("tr");
    if (!row)
        return;
    selectParty(row.dataset.code);
});

/*=========================================================
    OPEN PARTY MODAL
=========================================================*/
document.addEventListener("click", function (e) {
    const btn = e.target.closest(".partySearch");
    if (!btn) return;
    const card = btn.closest(".entry-card");
    if (!card) return;
    const input = card.querySelector(".partyName");
    if (input) openPartySearch(input);
});

/*=========================================================
    TOGGLE TRANSACTION FIELDS
=========================================================*/

const BANK_MODES = new Set([
    "Bank",
    "Cheque",
    "NEFT",
    "RTGS",
    "IMPS",
    "UPI"
]);

function toggleTransactionFields() {

    if (!transactionMode) return;

    const showBankDetails = BANK_MODES.has(transactionMode.value);

    bankSection.classList.toggle("d-none", !showBankDetails);
    instrumentSection.classList.toggle("d-none", !showBankDetails);

    // Set narration width
    narrationSection.className =
        showBankDetails
            ? "col-12 col-lg-7"
            : "col-12";

    // Clear hidden fields
    if (!showBankDetails) {
        bankAccount.value = "";
        instrumentNo.value = "";
    }

}

transactionMode?.addEventListener("change", toggleTransactionFields);

// Initialize on page load
toggleTransactionFields();

// Debit / Credit Mutual Exclusive + GST Calculation
document.addEventListener("input", function (e) {

    const row = e.target.closest(".entry-card");
    if (!row) return;

    const debit = row.querySelector(".debit");
    const credit = row.querySelector(".credit");

    if (e.target.classList.contains("debit")) {

        const value = parseFloat(debit.value) || 0;

        credit.disabled = value > 0;

        if (value > 0)
            credit.value = "0.00";
    }

    if (e.target.classList.contains("credit")) {

        const value = parseFloat(credit.value) || 0;

        debit.disabled = value > 0;

        if (value > 0)
            debit.value = "0.00";
    }

    if (e.target.matches(".debit,.credit,.gstRate,.gstType")) {

        updateGST(row);

        // calculateTotals();
    }

});

function updateGST(row) {

    if (!row) return;

    const debit = row.querySelector(".debit");
    const credit = row.querySelector(".credit");

    const companyGSTNo = (companyProfile?.gst_number || "")
        .trim()
        .substring(0, 2);

    const partyGSTNo = (
        document.getElementById("partyGST")?.value ||
        companyGSTNo
    )
        .trim()
        .substring(0, 2);

    const amount =
        (parseFloat(debit?.value) || 0) +
        (parseFloat(credit?.value) || 0);

    const rate =
        parseFloat(row.querySelector(".gstRate")?.value) || 0;

    const type =
        row.querySelector(".gstType")?.value || "Exclusive";

    const gst = calculateGST(amount, rate, type);

    const gstAmount = Number(gst.gst || 0);
    const totalAmount = Number(gst.total || amount);

    const cgstAmount = row.querySelector(".cgstAmount");
    const sgstAmount = row.querySelector(".sgstAmount");
    const igstAmount = row.querySelector(".igstAmount");
    const gstAmountInput = row.querySelector(".gstAmount");
    const totalAmountInput = row.querySelector(".totalAmount");

    if (companyGSTNo === partyGSTNo) {

        if (cgstAmount) cgstAmount.value = (gstAmount / 2).toFixed(2);
        if (sgstAmount) sgstAmount.value = (gstAmount / 2).toFixed(2);
        if (igstAmount) igstAmount.value = "0.00";

    } else {

        if (cgstAmount) cgstAmount.value = "0.00";
        if (sgstAmount) sgstAmount.value = "0.00";
        if (igstAmount) igstAmount.value = gstAmount.toFixed(2);

    }

    if (gstAmountInput) gstAmountInput.value = gstAmount.toFixed(2);
    if (totalAmountInput) totalAmountInput.value = totalAmount.toFixed(2);
}

// document.querySelectorAll(".entry-card").forEach(updateGST);

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

    // Inclusive GST
    if (type === "Inclusive") {

        const taxable = amount / (1 + rate / 100);
        const gst = amount - taxable;

        return {
            taxable: Number(taxable.toFixed(2)),
            gst: Number(gst.toFixed(2)),
            total: amount
        };
    }

    // Exclusive GST
    const gst = amount * rate / 100;

    return {
        taxable: amount,
        gst: Number(gst.toFixed(2)),
        total: Number((amount + gst).toFixed(2))
    };
}

document.addEventListener("keydown", function (e) {

    if (e.key !== "Delete") return;

    if (e.target.classList.contains("accountName")) {

        const row = e.target.closest(".entry-card");

        e.target.value = "";
        row.querySelector(".accountCode").value = "";

        e.preventDefault();
    }

    if (e.target.classList.contains("partyName")) {

        const row = e.target.closest(".entry-card");

        e.target.value = "";
        row.querySelector(".partyCode").value = "";
        document.getElementById("partyGST").value = "";

        updateGST(row);

        e.preventDefault();
    }

});

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



async function saveUpdateAccountingVoucher() {
    
}




