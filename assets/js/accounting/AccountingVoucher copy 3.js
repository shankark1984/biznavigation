/* AccountingVoucher.js
=========================================================
    GLOBAL VARIABLES
=========================================================*/

let accountMaster = [];
let filteredAccounts = [];
let selectedAccountIndex = -1;

let partyMaster = [];
let filteredParty = [];
let selectedPartyIndex = -1;

let companyProfile = null;

let voucherMaster = [];
let voucherModal;


let voucherPage = 1;
const voucherPageSize = 10;
let voucherTotalRecords = 0;

/*=========================================================
    COMMON CONTROLS
=========================================================*/

const voucherType = document.getElementById("voucherType");
const voucherNo = document.getElementById("voucherNo");
const voucherDate = document.getElementById("voucherDate");

const branch = document.getElementById("branch");
const costCenter = document.getElementById("costCenter");

const transactionMode = document.getElementById("transactionMode");
const bankSection = document.getElementById("bankSection");
const instrumentSection = document.getElementById("instrumentSection");
const narrationSection = document.getElementById("narrationSection");

const bankAccount = document.getElementById("bankAccount");
const instrumentNo = document.getElementById("instrumentNo");
const narration = document.getElementById("narration");

/*=========================================================
    ACCOUNT CONTROLS
=========================================================*/

const accountName = document.getElementById("accountName");
const accountCode = document.getElementById("accountCode");

const accountModalEl = document.getElementById("accountModal");
const accountSearchInput = document.getElementById("accountSearch");
const accountListBody = document.getElementById("accountListBody");

/*=========================================================
    PARTY CONTROLS
=========================================================*/

partyName = document.getElementById("partyName");
partyCode = document.getElementById("partyCode");
const partyGST = document.getElementById("partyGSTIN");

const partyModalEl = document.getElementById("partyModal");
const partySearchInput = document.getElementById("partySearch");
const partyListBody = document.getElementById("partyListBody");

/*=========================================================
    INITIAL LOAD
=========================================================*/

document.addEventListener("DOMContentLoaded", async () => {
    const today = new Date();
    document.getElementById("voucherDate").value =
        today.toLocaleDateString("en-CA");

    voucherModal = new bootstrap.Modal(
        document.getElementById("voucherModal")
    );

    try {
        await Promise.all([
            loadBranches(CompanyID),
            loadCostCenters(CompanyID),
            loadBankAccounts(CompanyID, "Bank"),
            loadAccounts(),
            loadParties(CompanyID),
            loadVoucherList()
        ]);
        document
            .getElementById("voucherSearch")
            .addEventListener("input", filterVoucherList);
        companyProfile = await getCompanyProfile(CompanyID);
        toggleTransactionFields();
        await loadVoucherNumber();
    }
    catch (err) {

        console.error("Initialization Error :", err);

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
        console.error(error);
        return;
    }
    accountMaster = data || [];
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
            <td>${acc.AccountType || ""}</td>
        </tr>

    `).join("");
    highlightSelectedAccount();
}


/*=========================================================
    HIGHLIGHT ACCOUNT
=========================================================*/

function highlightSelectedAccount() {
    const rows = accountListBody.querySelectorAll("tr");
    rows.forEach((row, index) => {
        row.classList.toggle(
            "table-primary",
            index === selectedAccountIndex
        );
    });
    rows[selectedAccountIndex]?.scrollIntoView({
        block: "nearest"
    });
}


/*=========================================================
    OPEN ACCOUNT SEARCH
=========================================================*/

function openAccountSearch() {
    accountSearchInput.value = "";
    renderAccounts(accountMaster);
    const modal = bootstrap.Modal.getOrCreateInstance(accountModalEl);
    accountModalEl.addEventListener(
        "shown.bs.modal",
        function onShown() {
            accountSearchInput.focus();
            accountSearchInput.select();
            accountModalEl.removeEventListener(

                "shown.bs.modal",

                onShown

            );
        }
    );
    modal.show();
}

/*=========================================================
    ACCOUNT BUTTON
=========================================================*/

document.getElementById("btnAccountSearch").addEventListener("click", openAccountSearch);

/*=========================================================
    ACCOUNT TEXTBOX
=========================================================*/

accountName.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        openAccountSearch();
    }
});

/*=========================================================
    SELECT ACCOUNT
=========================================================*/

function selectAccount(code) {
    const account = accountMaster.find(
        x => String(x.AccountCode) === String(code)
    );

    if (!account)
        return;
    accountName.value = account.AccountName;
    accountCode.value = account.AccountCode;
    document.getElementById("gstRate").value = account.GSTRate || 0;

    bootstrap.Modal
        .getOrCreateInstance(accountModalEl)
        .hide();
    updateGST();
    partyName.focus();
}

/*=========================================================
    ACCOUNT SEARCH
=========================================================*/

accountSearchInput.addEventListener("input", function () {

    const keyword = this.value
        .trim()
        .toLowerCase();

    if (!keyword) {
        renderAccounts(accountMaster);
        return;
    }

    renderAccounts(accountMaster.filter(acc =>
        String(acc.AccountCode)
            .toLowerCase()
            .includes(keyword)
        ||
        String(acc.AccountName)
            .toLowerCase()
            .includes(keyword)
        ||

        String(acc.AccountType || "")
            .toLowerCase()
            .includes(keyword)
    ));
});

/*=========================================================
    ACCOUNT KEYBOARD
=========================================================*/

accountSearchInput.addEventListener("keydown", function (e) {

    const rows = accountListBody.querySelectorAll("tr");

    if (!rows.length)
        return;

    switch (e.key) {
        case "ArrowDown":
            e.preventDefault();
            if (
                selectedAccountIndex
                < rows.length - 1
            )
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
                selectAccount(
                    rows[selectedAccountIndex]
                        .dataset.code
                );
            }
            break;
    }
});

/*=========================================================
    ACCOUNT GRID CLICK
=========================================================*/

accountListBody.addEventListener("click", function (e) {

    const row = e.target.closest("tr");
    if (!row) return;
    selectAccount(
        row.dataset.code
    );
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
        console.error("Load Parties :", error);
        return;
    }

    partyMaster = data || [];
    renderPartyList(partyMaster);

}

/*=========================================================
    RENDER PARTY LIST
=========================================================*/
function renderPartyList(parties) {

    filteredParty = parties;

    selectedPartyIndex = parties.length ? 0 : -1;

    partyListBody.innerHTML = parties.map((party, index) => `
        <tr data-code="${party.AccountCode}"
            class="${index === selectedPartyIndex ? "table-primary" : ""}">
            <td>${party.AccountCode}</td>
            <td>${party.AccountName}</td>
            <td>${party.GSTNumber ?? ""}</td>
            <td>${party.State ?? ""}</td>
        </tr>
    `).join("");

    highlightSelectedParty();
}

/*=========================================================
    HIGHLIGHT PARTY
=========================================================*/
function highlightSelectedParty() {

    const rows = partyListBody.querySelectorAll("tr");
    rows.forEach((row, index) => {
        row.classList.toggle(
            "table-primary",
            index === selectedPartyIndex
        );
    });

    rows[selectedPartyIndex]?.scrollIntoView({
        block: "nearest"
    });
}

/*=========================================================
    OPEN PARTY SEARCH
=========================================================*/
function openPartySearch() {

    partySearchInput.value = "";
    renderPartyList(partyMaster);
    const modal = bootstrap.Modal.getOrCreateInstance(partyModalEl);
    accountModalEl?.blur();
    partyModalEl.addEventListener(
        "shown.bs.modal",
        function onShown() {
            partySearchInput.focus();
            partySearchInput.select();
            partyModalEl.removeEventListener(
                "shown.bs.modal",
                onShown
            );
        },
        { once: true }
    );
    modal.show();
}

/*=========================================================
    PARTY BUTTON
=========================================================*/
document.getElementById("btnPartySearch").addEventListener("click", openPartySearch);

/*=========================================================
    PARTY TEXTBOX
=========================================================*/
partyName.addEventListener("keydown", function (e) {

    if (e.key === "Enter" || e.key === "F3") {
        e.preventDefault();
        openPartySearch();
    }
});

/*=========================================================
    SELECT PARTY
=========================================================*/
function selectParty(code) {

    const party = partyMaster.find(
        x => String(x.AccountCode) === String(code)
    );

    if (!party) return;

    partyName.value = party.AccountName;
    partyCode.value = party.AccountCode;
    partyGST.value = party.GSTNumber || "";
    const stateControl = document.getElementById("partyState");
    if (stateControl) {
        stateControl.value = party.State || "";
    }

    bootstrap.Modal
        .getOrCreateInstance(partyModalEl)
        .hide();

    updateGST();

    document.getElementById("debit").focus();
}

/*=========================================================
    PARTY SEARCH
=========================================================*/
partySearchInput.addEventListener("input", function () {

    const keyword = this.value
        .trim()
        .toLowerCase();

    if (!keyword) {
        renderPartyList(partyMaster);
        return;
    }

    renderPartyList(partyMaster.filter(p =>
        String(p.AccountCode)
            .toLowerCase()
            .includes(keyword)
        ||
        String(p.AccountName)
            .toLowerCase()
            .includes(keyword)

        ||
        String(p.GSTNumber ?? "")
            .toLowerCase()
            .includes(keyword)
        ||
        String(p.State ?? "")
            .toLowerCase()
            .includes(keyword)
    )
    );
});

/*=========================================================
    PARTY KEYBOARD
=========================================================*/
partySearchInput.addEventListener("keydown", function (e) {
    const rows = partyListBody.querySelectorAll("tr");

    if (!rows.length) return;

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
                selectParty(
                    rows[selectedPartyIndex]
                        .dataset.code
                );
            }
            break;
    }
});

/*=========================================================
    PARTY GRID CLICK
=========================================================*/
partyListBody.addEventListener("click", function (e) {

    const row = e.target.closest("tr");
    if (!row) return;
    selectParty(row.dataset.code);
});

/*=========================================================
    DELETE KEY SUPPORT
=========================================================*/
document.addEventListener("keydown", function (e) {

    if (e.key !== "Delete") return;

    if (document.activeElement === accountName) {
        accountName.value = "";
        accountCode.value = "";
        updateGST();
        e.preventDefault();
    }

    if (document.activeElement === partyName) {
        partyName.value = "";
        partyCode.value = "";
        partyGST.value = "";
        const stateControl = document.getElementById("partyState");
        if (stateControl) {
            stateControl.value = "";
        }
        updateGST();
        e.preventDefault();
    }
});

/*=========================================================
    GST CONTROLS
=========================================================*/

const debit = document.getElementById("debit");
const credit = document.getElementById("credit");

const gstType = document.getElementById("gstType");
const gstRate = document.getElementById("gstRate");

const cgstAmount = document.getElementById("cgstAmount");
const sgstAmount = document.getElementById("sgstAmount");
const igstAmount = document.getElementById("igstAmount");

const gstAmount = document.getElementById("gstAmount");
const totalAmount = document.getElementById("totalAmount");


/*=========================================================
    TRANSACTION MODE
=========================================================*/

const BANK_MODES = new Set([
    "Bank",
    "Cheque",
    "NEFT",
    "RTGS",
    "IMPS",
    "UPI",
    "Card"
]);

function toggleTransactionFields() {
    const showBank = BANK_MODES.has(transactionMode.value);
    bankSection.classList.toggle("d-none", !showBank);
    instrumentSection.classList.toggle("d-none", !showBank);
    narrationSection.className =
        showBank
            ? "col-12 col-lg-6"
            : "col-10";

    if (!showBank) {
        bankAccount.value = "";
        instrumentNo.value = "";
    }
}

transactionMode.addEventListener("change", toggleTransactionFields);

/*=========================================================
    DEBIT / CREDIT
=========================================================*/

function toggleDebitCredit() {

    const dr = Number(debit.value) || 0;
    const cr = Number(credit.value) || 0;
    if (dr > 0) {
        credit.value = "";
        credit.disabled = true;
    } else {
        credit.disabled = false;
    }

    if (cr > 0) {
        debit.value = "";
        debit.disabled = true;
    } else {
        debit.disabled = false;
    }
    updateGST();
}

debit.addEventListener("input", toggleDebitCredit);

credit.addEventListener("input", toggleDebitCredit);

/*=========================================================
    GST EVENTS
=========================================================*/

gstRate.addEventListener("change", updateGST);

gstType.addEventListener("change", updateGST);

/*=========================================================
    GST CALCULATION
=========================================================*/

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

    if (type === "Inclusive") {
        const taxable = amount / (1 + rate / 100);
        const gst = amount - taxable;
        return {
            taxable: Number(taxable.toFixed(2)),
            gst: Number(gst.toFixed(2)),
            total: amount
        };
    }

    const gst = amount * rate / 100;
    return {
        taxable: amount,
        gst: Number(gst.toFixed(2)),
        total: Number((amount + gst).toFixed(2))
    };
}

/*=========================================================
    UPDATE GST
=========================================================*/

function updateGST() {

    const amount = (Number(debit.value) || 0) + (Number(credit.value) || 0);
    const rate = Number(gstRate.value) || 0;
    const type = gstType.value;
    const result = calculateGST(amount, rate, type);

    const companyState = (companyProfile?.gst_number || "").substring(0, 2);

    const partyState = (partyGST.value || companyState).substring(0, 2);

    if (companyState === partyState) {
        cgstAmount.value = (result.gst / 2).toFixed(2);
        sgstAmount.value = (result.gst / 2).toFixed(2);
        igstAmount.value = "0.00";
    } else {
        cgstAmount.value = "0.00";
        sgstAmount.value = "0.00";
        igstAmount.value =
            result.gst.toFixed(2);
    }

    gstAmount.value = result.gst.toFixed(2);
    totalAmount.value = result.total.toFixed(2);
}

/*=========================================================
    KEYBOARD SHORTCUTS
=========================================================*/

document.addEventListener("keydown", function (e) {

    /* Ctrl+S */
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveUpdateAccountingVoucher();
    }

    /* Ctrl+N */
    if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        clearVoucher();
    }

    /* F2 */

    if (e.key === "F2") {
        e.preventDefault();
        openAccountSearch();
    }

    /* F3 */

    if (e.key === "F3") {
        e.preventDefault();
        openPartySearch();
    }
    /* F4 */

    if (e.key === "F4") {
        e.preventDefault();
        openVoucherSearch();
    }
});

/*=========================================================
    ENTER KEY NAVIGATION
=========================================================*/

document.addEventListener("keydown", function (e) {

    if (e.key !== "Enter")
        return;
    if (
        e.target.tagName === "TEXTAREA"
    )
        return;
    e.preventDefault();
    const controls = [accountName, partyName, debit, credit, gstType, gstRate, narration];

    const index = controls.indexOf(document.activeElement);

    if (
        index >= 0 && index < controls.length - 1
    ) {
        controls[index + 1].focus();
    }
});
/*=========================================================
    LOAD VOUCHER NUMBER
=========================================================*/
async function loadVoucherNumber() {

    if (saveButton.dataset.mode === "update") {
        console.log("Skipped because Update mode");
        return;
    }

    const { data, error } = await supabaseClient.rpc(
        "generate_voucher_no",
        {
            p_company_id: CompanyID,
            p_voucher_type: voucherType.value,
            p_date: voucherDate.value
        }
    );

    if (error) {
        console.error(error);
        return;
    }

    voucherNo.value = data;
}

/*=========================================================
    VALIDATION
=========================================================*/

function validateVoucher() {

    if (!voucherDate.value) {
        showAlert("Select Voucher Date");
        voucherDate.focus();
        return false;
    }

    if (!branch.value) {
        showAlert("Select Branch");
        branch.focus();
        return false;
    }

    if (!costCenter.value) {
        showAlert("Select Cost Center");
        costCenter.focus();
        return false;
    }

    if (!accountCode.value) {
        showAlert("Select Account");
        accountName.focus();
        return false;
    }

    const dr = Number(debit.value) || 0;
    const cr = Number(credit.value) || 0;

    if (dr <= 0 && cr <= 0) {
        showAlert("Enter Debit or Credit Amount");
        debit.focus();
        return false;
    }

    return true;

}

/*=========================================================
    SAVE / UPDATE
=========================================================*/

async function saveUpdateAccountingVoucher() {

    if (!validateVoucher())
        return;
    const mode = saveButton.dataset.mode;
    const gstAmountValue = Number(gstAmount.value) || 0;

    let debitValue = Number(debit.value) || 0;
    let creditValue = Number(credit.value) || 0;

    // If GST is Inclusive, store the amount excluding GST
    if (gstType.value === "Inclusive" && mode === "insert") {
        if (debitValue > 0) {
            debitValue -= gstAmountValue;
        }

        if (creditValue > 0) {
            creditValue -= gstAmountValue;
        }
    }
    const data = {
        VoucherNo: voucherNo.value,
        VoucherDate: voucherDate.value,
        VoucherType: voucherType.value,
        CompanyID: CompanyID,
        BranchID: branch.value,
        ReferenceNo: instrumentNo.value,
        Narration: narration.value,
        CreatedBy: UserLoginID,
        Status: true,
        CostCenter: costCenter.value,
        TransactionMode: transactionMode.value,
        BankAccountID: Number(bankAccount.value) || null,
        ChequeUTRNo: instrumentNo.value,
        AccountCode: accountCode.value,
        PartyCode: partyCode.value || null,
        GSTType: gstType.value,
        Debit: debitValue,
        Credit: creditValue,
        GSTPercent: Number(gstRate.value),
        CGSTAmount: Number(cgstAmount.value),
        SGSTAmount: Number(sgstAmount.value),
        IGSTAmount: Number(igstAmount.value),
        TotalGSTAmount: gstAmountValue,
        TotalAmount: Number(totalAmount.value)
    };


    let response;
    const payload = JSON.parse(JSON.stringify(data));

    console.log(payload);
    if (mode === "insert") {

        response = await supabaseClient
            .from("AccountingVoucher")
            .insert([payload])
            .select();
    } else {

        response = await supabaseClient
            .from("AccountingVoucher")
            .update({
                ...data,
                update_by: UserLoginID,
                update_at: localtimeStamp
            })

            .eq(
                "VoucherID",
                voucherID.value
            );
    }

    if (response.error) {
        console.error(response.error);
        showAlert(response.error.message);
        return;
    }

    showAlert(
        mode === "insert"
            ? "Voucher Saved"
            : "Voucher Updated"
    );
    saveButton.dataset.mode = "insert";
    clearVoucher();
}

/*=========================================================
    LOAD FOR MODIFY
=========================================================*/

async function loadVoucher(voucherId) {

    const { data, error } = await supabaseClient
        .from("AccountingVoucher")
        .select("*")
        .eq("VoucherID", voucherId)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    voucherID.value = data.VoucherID;
    voucherNo.value = data.VoucherNo;
    voucherDate.value = data.VoucherDate;
    voucherType.value = data.VoucherType;
    branch.value = data.BranchID;
    costCenter.value = data.CostCenter;
    transactionMode.value = data.TransactionMode;
    bankAccount.value = data.BankAccountID;
    instrumentNo.value = data.ChequeUTRNo;
    narration.value = data.Narration;
    accountCode.value = data.AccountCode;
    partyCode.value = data.PartyCode;
    debit.value = data.Debit;
    credit.value = data.Credit;
    gstType.value = data.GSTType;
    gstRate.value = data.GSTPercent;
    cgstAmount.value = data.CGSTAmount;
    sgstAmount.value = data.SGSTAmount;
    igstAmount.value = data.IGSTAmount;
    gstAmount.value = data.TotalGSTAmount;
    totalAmount.value = data.TotalAmount;

    const acc = accountMaster.find(
        x => x.AccountCode === data.AccountCode
    );
    if (acc)
        accountName.value = acc.AccountName;

    const party = partyMaster.find(
        x => x.AccountCode === data.PartyCode
    );

    if (party) {
        partyName.value = party.AccountName;
        partyGST.value = party.GSTNumber;
    }
    modifyButton.disabled = false;
    saveButton.dataset.mode = "update";
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    disableForm();
    toggleTransactionFields();
}

/*=========================================================
    DELETE
=========================================================*/

async function deleteVoucher() {

    if (!voucherID.value)
        return;

    if (!confirm("Delete Voucher ?"))
        return;

    const { error } = await supabaseClient
        .from("AccountingVoucher")
        .update({
            Status: false,
            update_by: UserLoginID,
            update_at:
                new Date()
        })
        .eq("VoucherID", voucherID.value);

    if (error) {
        console.error(error);
        return;
    }

    showAlert("Voucher Deleted");
    clearVoucher();
}

/*=========================================================
    CLEAR FORM
=========================================================*/

async function clearVoucher() {
    saveButton.dataset.mode = "insert";
    voucherForm.reset();
    voucherID.value = "";
    accountCode.value = "";
    partyCode.value = "";
    partyGST.value = "";
    debit.disabled = false;
    credit.disabled = false;
    cgstAmount.value = "0.00";
    sgstAmount.value = "0.00";
    igstAmount.value = "0.00";
    gstAmount.value = "0.00";
    totalAmount.value = "0.00";
    voucherDate.value = new Date().toISOString().substring(0, 10);
    toggleTransactionFields();
    await loadVoucherNumber();
    accountName.focus();
    voucherNoSearch.disabled = false;
    modifyButton.disabled = true;
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    enableForm();
}

/*=========================================================
    BUTTON EVENTS
=========================================================*/

saveButton.addEventListener("click", saveUpdateAccountingVoucher);

newButton.addEventListener("click", async () => {
    await clearVoucher();
});

deleteButton.addEventListener("click", deleteVoucher);

voucherType.addEventListener("change", loadVoucherNumber);

voucherDate.addEventListener("change", loadVoucherNumber);


// =====================================================
// VOUCHER SEARCH
// =====================================================


//======================================================
// LOAD VOUCHERS
//======================================================

async function loadVoucherList(page = 1) {

    voucherPage = page;

    const from = (page - 1) * voucherPageSize;
    const to = from + voucherPageSize - 1;

    const { data, error, count } = await supabaseClient
        .from("AccountingVoucherView")
        .select(`
            VoucherID,
            VoucherNo,
            VoucherDate,
            VoucherType,
            BranchID,
            BranchName,
            CostCenterName,
            BankAccountName,
            Amount,
            AmountType
        `, { count: "exact" })
        .eq("CompanyID", CompanyID)
        .eq("Status", true)
        .order("VoucherDate", { ascending: false })
        .range(from, to);

    if (error) {
        console.error(error);
        return;
    }

    voucherMaster = data || [];
    voucherTotalRecords = count || 0;

    renderVoucherList(voucherMaster);
    renderVoucherPagination();
}

//======================================================
// RENDER LIST
//======================================================

function renderVoucherList(list) {

    const tbody = document.getElementById("voucherListBody");

    tbody.innerHTML = "";

    document.getElementById("partyCount").innerText =
        `${list.length} Records`;

    if (!list.length) {

        tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center text-muted py-3">
                No Voucher Found
            </td>
        </tr>
        `;

        return;
    }

    list.forEach(v => {

        tbody.insertAdjacentHTML("beforeend", `

        <tr class="voucher-row"
            data-id="${v.VoucherID}">
            <td>${v.VoucherNo ?? ""}</td>
            <td>
                ${v.VoucherDate
                ? new Date(v.VoucherDate).toLocaleDateString("en-GB")
                : ""}
            </td>
            <td>${v.BranchID ?? ""}</td>
            <td>${v.CostCenterName ?? ""}</td>
            <td>${v.BankAccountName ?? ""}</td>
<td class="text-end ${v.AmountType === 'Dr' ? 'text-danger fw-bold' : 'text-success fw-bold'}">
    ${Number(v.Amount || 0).toFixed(2)} ${v.AmountType || ""}
</td>
        </tr>

        `);

    });

}

function renderVoucherPagination() {

    const totalPages = Math.ceil(voucherTotalRecords / voucherPageSize);

    const container = document.getElementById("voucherPagination");

    if (!container) return;

    container.innerHTML = "";

    if (totalPages <= 1) return;

    container.insertAdjacentHTML("beforeend", `
        <button class="btn btn-sm btn-outline-secondary me-2"
            ${voucherPage === 1 ? "disabled" : ""}
            onclick="loadVoucherList(${voucherPage - 1})">
            Previous
        </button>

        <span class="mx-2">
            Page ${voucherPage} of ${totalPages}
        </span>

        <button class="btn btn-sm btn-outline-secondary ms-2"
            ${voucherPage === totalPages ? "disabled" : ""}
            onclick="loadVoucherList(${voucherPage + 1})">
            Next
        </button>
    `);
}
//======================================================
// SEARCH
//======================================================

function filterVoucherList() {

    const text = document
        .getElementById("voucherSearch")
        .value
        .toLowerCase()
        .trim();

    if (!text) {

        renderVoucherList(voucherMaster);
        return;
    }
    const filtered = voucherMaster.filter(v =>
        (v.VoucherNo || "").toLowerCase().includes(text) ||
        (v.VoucherType || "").toLowerCase().includes(text) ||
        (v.BranchID || "").toLowerCase().includes(text) ||
        (v.CostCenter || "").toLowerCase().includes(text) ||
        (v.BankAccount || "").toLowerCase().includes(text)
    );
    renderVoucherList(filtered);
}

//======================================================
// OPEN MODAL
//======================================================

function openVoucherSearch() {
    document.getElementById("voucherSearch").value = "";
    renderVoucherList(voucherMaster);
    voucherModal.show();
    setTimeout(() => {
        document.getElementById("voucherSearch").focus();
    }, 200);
}

//======================================================
// ROW CLICK
//======================================================

document.addEventListener("click", function (e) {
    const row = e.target.closest(".voucher-row");
    if (!row) return;
    const voucherId = row.dataset.id;
    selectVoucher(voucherId);
});

//======================================================
// SELECT VOUCHER
//======================================================

async function selectVoucher(voucherId) {

    voucherModal.hide();

    // console.log("Selected Voucher :", voucherId);

    // Load voucher for editing
    await loadVoucher(voucherId);

}

document.getElementById("voucherNoSearch").addEventListener("click", () => {
    openVoucherSearch();
});

voucherNo.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === "F4") {
        e.preventDefault();
        openVoucherSearch();
    }
});

modifyButton.addEventListener("click", async () => {
    enableForm();
    saveButton.disabled = false;
    voucherNoSearch.disabled = true;
    modifyButton.disabled = true;
    deleteButton.disabled = false;
});
voucherNoSearch.addEventListener("click", () => {
    openVoucherSearch();
});