/* ==========================================================
   AccountingVoucher.js
   Logistics ERP
========================================================== */

const voucherBody = document.getElementById("voucherBody");
const totalDebitEl = document.getElementById("totalDebit");
const totalCreditEl = document.getElementById("totalCredit");
const differenceEl = document.getElementById("difference");

const btnAddRow = document.getElementById("btnAddRow");

document.addEventListener("DOMContentLoaded", async () => {
    await initVoucher();
});

/*==========================================================
    INITIALIZE
==========================================================*/

async function initVoucher() {

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
}

/*==========================================================
    ADD ROW
==========================================================*/

btnAddRow.addEventListener("click", () => {
    addRow();
});

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

<td>
    <input type="number"
           step="0.01"
           value="0"
           class="form-control debit text-end">
</td>

<td>
    <input type="number"
           step="0.01"
           value="0"
           class="form-control credit text-end">
</td>

<td>
    <select class="form-select gstRate">
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
<td><input type="number" class="form-control totalAmount text-end" readonly></td>
<td><input class="form-control remarks"></td>

<td class="text-center">
    <button class="btn btn-danger btn-sm deleteRow">
        <i class="bi bi-trash"></i>
    </button>
</td>
`;

    renumberRows();
    bindEvents(row);
    row.querySelector(".accountName").focus();
}

/*==========================================================
    DELETE ROW
==========================================================*/

function deleteRow(button) {
    if (voucherBody.rows.length === 1) {
        alert("Minimum one row required.");
        return;
    }

    button.closest("tr").remove();
    renumberRows();
    calculateTotals();
}

/*==========================================================
    RENUMBER
==========================================================*/

function renumberRows() {
    [...voucherBody.rows].forEach((row, index) => {
        row.cells[0].innerText = index + 1;
        row.querySelector(".deleteRow").disabled =
            voucherBody.rows.length === 1;
    });
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

/*==========================================================
    TOTALS
==========================================================*/

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

    const difference = debit - credit;

    differenceEl.innerText = difference.toFixed(2);

    differenceEl.classList.toggle("balance-ok", difference === 0);
    differenceEl.classList.toggle("balance-error", difference !== 0);

}

/*==========================================================
    VALIDATION
==========================================================*/

function validateVoucher() {

    const debit = parseFloat(totalDebitEl.textContent) || 0;
    const credit = parseFloat(totalCreditEl.textContent) || 0;

    console.log({
        totalDebit: debit,
        totalCredit: credit
    });

    // console.log({
    //     rowDebit: debitAmt,
    //     rowCredit: creditAmt
    // });
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

/*==========================================================
    DELETE BUTTON
==========================================================*/

document.getElementById("deleteButton").addEventListener("click", () => {
    alert("Delete module coming next.");
});

/*==========================================================
    PRINT BUTTON
==========================================================*/

document.getElementById("reportButton").addEventListener("click", () => {
    window.print();
});

renumberRows();
calculateTotals();

/*==========================================================
    BIND KEYBOARD EVENTS
==========================================================*/

function bindKeyboardEvents(row) {
    const controls = row.querySelectorAll("input,select");
    controls.forEach((control, index) => {
        control.addEventListener("keydown", function (e) {
            /*-------------------------------------
              ENTER = NEXT FIELD
            -------------------------------------*/
            if (e.key === "Enter") {
                e.preventDefault();
                if (index < controls.length - 1) {
                    controls[index + 1].focus();
                    controls[index + 1].select?.();
                }
                else {
                    moveToNextRow(row);
                }
            }

            /*-------------------------------------
              DOWN ARROW
            -------------------------------------*/

            if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = row.nextElementSibling;
                if (next) {
                    next.querySelectorAll("input,select")[index].focus();
                }
            }
            /*-------------------------------------
              UP ARROW
            -------------------------------------*/

            if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev = row.previousElementSibling;
                if (prev) {
                    prev.querySelectorAll("input,select")[index].focus();
                }
            }
        });
    });

}

/*==========================================================
    MOVE TO NEXT ROW
==========================================================*/

function moveToNextRow(currentRow) {
    const nextRow = currentRow.nextElementSibling;
    if (nextRow) {
        nextRow.querySelector(".accountName").focus();
        return;
    }
    addRow();
}

/*==========================================================
    DEBIT/CREDIT RULE
==========================================================*/

function bindDebitCreditRule(row) {
    const debit = row.querySelector(".debit");
    const credit = row.querySelector(".credit");
    debit.addEventListener("input", function () {
        if (Number(this.value) > 0) {
            credit.value = 0;
        }
        updateGST(row);
        calculateTotals();
    });
    credit.addEventListener("input", function () {
        if (Number(this.value) > 0) {
            debit.value = 0;
        }
        updateGST(row);
        calculateTotals();
    });
}

/*==========================================================
    DELETE EMPTY ROW
==========================================================*/

document.addEventListener("keydown", function (e) {

    if (e.key !== "Delete") return;
    const row = document.activeElement.closest("tr");
    if (!row) return;
    if (voucherBody.rows.length === 1) return;
    const debit = Number(row.querySelector(".debit").value);
    const credit = Number(row.querySelector(".credit").value);

    if (debit === 0 && credit === 0) {
        row.remove();
        renumberRows();
        calculateTotals();
    }
});

/*==========================================================
    CTRL + S
==========================================================*/

document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey && e.key.toLowerCase() === "s")) return;
    e.preventDefault();
    document.getElementById("saveButton").click();
});

/*==========================================================
    CTRL + D
    COPY PREVIOUS ACCOUNT & PARTY
==========================================================*/

document.addEventListener("keydown", function (e) {

    if (!(e.ctrlKey && e.key.toLowerCase() === "d")) return;
    const row = document.activeElement.closest("tr");
    if (!row) return;
    const prev = row.previousElementSibling;
    if (!prev) return;
    e.preventDefault();

    row.querySelector(".accountName").value = prev.querySelector(".accountName").value;
    row.querySelector(".partyName").value = prev.querySelector(".partyName").value;

    row.querySelector(".accountCode").value = prev.querySelector(".accountCode").value;
    row.querySelector(".partyCode").value = prev.querySelector(".partyCode").value;

});

/*==========================================================
    OVERRIDE bindEvents()
==========================================================*/

const oldBindEvents = bindEvents;

bindEvents = function (row) {

    oldBindEvents(row);

    bindKeyboardEvents(row);

    bindDebitCreditRule(row);

};


let accountMaster = [];

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
document.getElementById("accountListBody")
    .addEventListener("click", function (e) {

        const row = e.target.closest("tr");

        if (!row) return;

        selectAccount(row.dataset.code);

    });

document
    .getElementById("accountSearch")
    .addEventListener("input", function () {

        const txt = this.value.toLowerCase();

        const filtered =

            accountMaster.filter(a =>

                a.AccountCode.toLowerCase().includes(txt)

                ||

                a.AccountName.toLowerCase().includes(txt)

            );

        renderAccounts(filtered);

    });

let currentAccountTextbox;

function openAccountSearch(input) {

    currentAccountTextbox = input;

    document.getElementById("accountSearch").value = "";

    renderAccounts(accountMaster);

    new bootstrap.Modal(
        document.getElementById("accountModal")
    ).show();

}

function selectAccount(code) {

    const acc =

        accountMaster.find(x => x.AccountCode === code);

    currentAccountTextbox.value =

        acc.AccountName;

    currentAccountTextbox.parentElement

        .querySelector(".accountCode")

        .value =

        acc.AccountCode;

    bootstrap.Modal.getInstance(

        document.getElementById("accountModal")

    ).hide();

}

document.addEventListener("click", function (e) {

    if (e.target.closest(".accountSearch")) {

        const row = e.target.closest("tr");

        openAccountSearch(
            row.querySelector(".accountName")
        );

    }

});

let partyMaster = [];

async function loadParties(companyId) {

    const { data, error } = await supabaseClient

        .from("PartyDetails")

        .select(`
            PartyCode,
            PartyName,
            GSTNumber,
            State
        `)

        .eq("company_id", companyId)

        .order("PartyName");

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
            data-code="${p.PartyCode}">
            <td>${p.PartyCode}</td>
            <td>${p.PartyName}</td>
            <td>${p.GSTNumber ?? ""}</td>
            <td>${p.State ?? ""}</td>
        </tr>

        `;

    });

}

document
    .getElementById("partySearch")
    .addEventListener("input", function () {

        const txt = this.value.toLowerCase();

        const filtered = partyMaster.filter(p =>

            p.PartyCode.toLowerCase().includes(txt)

            ||

            p.PartyName.toLowerCase().includes(txt)

            ||

            (p.GSTNumber || "").toLowerCase().includes(txt)

        );

        renderPartyList(filtered);

    });

let currentPartyTextbox = null;

function openPartySearch(input) {

    currentPartyTextbox = input;

    const modal = new bootstrap.Modal(
        document.getElementById("partyModal")
    );

    modal.show();

    document.getElementById("partySearch").focus();

}


document
    .getElementById("partyListBody")
    .addEventListener("click", function (e) {

        const row = e.target.closest("tr");

        if (!row) return;

        const code = row.dataset.code;

        const party = partyMaster.find(x =>
            x.PartyCode === code
        );

        currentPartyTextbox.value =
            party.PartyName;

        currentPartyTextbox
            .parentElement
            .querySelector(".partyCode")
            .value =
            party.PartyCode;

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

function calculateGST(amount, rate) {
    return (amount * rate) / 100;
}

document.addEventListener("input", function (e) {

    if (!e.target.classList.contains("gstRate"))
        return;

    const row = e.target.closest("tr");

    const amount = Number(

        row.querySelector(".debit").value ||

        row.querySelector(".credit").value

    );
    const rate = Number(e.target.value);
    row.querySelector(".gstAmount").value =
        calculateGST(amount, rate);
    calculateTotals();
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

function getVoucherLines() {

    const rows = [];

    document.querySelectorAll("#voucherBody tr").forEach((tr, index) => {

        rows.push({
            lineNo: index + 1,
            accountCode: tr.querySelector(".accountCode").value,
            partyCode: tr.querySelector(".partyCode").value,
            debit: Number(tr.querySelector(".debit").value || 0),
            credit: Number(tr.querySelector(".credit").value || 0),
            gstPercent: Number(tr.querySelector(".gstRate").value || 0),
            gstAmount: Number(tr.querySelector(".gstAmount").value || 0),
            remarks: tr.querySelector(".remarks").value
        });

    });

    return rows;
}

async function saveVoucher() {
    const saveButton = document.getElementById("saveButton");
    saveButton.disabled = true;
    saveButton.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Saving...';
    try {
        calculateTotals();
        if (!validateVoucher())
            return;

        const voucher = {
            company_id: CompanyID,
            voucher_no: document.getElementById("voucherNo").value,
            voucher_date: document.getElementById("voucherDate").value,
            voucher_type: document.getElementById("voucherType").value,
            reference_no: document.getElementById("referenceNo").value,
            narration: document.getElementById("narration").value,
            created_by: UserLoginID,
            details: getVoucherLines()
        };

        const { data, error } = await supabaseClient.rpc(
            "save_accounting_voucher",
            {
                voucher_data: voucher
            }
        );

        if (error) {
            alert(error.message);
            return;
        }

        alert("Voucher Saved Successfully");
        clearVoucher();

        await loadVoucherNumber();

    } catch (err) {

        console.error(err);

    }
    finally {

        saveButton.disabled = false;
        saveButton.innerHTML =
            '<i class="bi bi-floppy"></i> Save';

    }
}

document.getElementById("saveButton").onclick = saveVoucher;

document.getElementById("voucherType").addEventListener("change", async function () {

    console.log("Voucher Type:", this.value);

    clearVoucher();

    await loadVoucherNumber();

});

document.getElementById("voucherDate")
    .addEventListener("change", async () => {
        await loadVoucherNumber();
    });
function updateGST(row) {

    const amount = Number(row.querySelector(".debit").value || 0) ||
        Number(row.querySelector(".credit").value || 0);

    const rate = Number(row.querySelector(".gstRate").value || 0);

    row.querySelector(".gstAmount").value = calculateGST(amount, rate).toFixed(2);
    row.querySelector(".totalAmount").value = (amount + Number(row.querySelector(".gstAmount").value || 0)).toFixed(2);
}

function clearVoucher() {

    voucherBody.innerHTML = "";

    addRow();

    document.getElementById("referenceNo").value = "";
    document.getElementById("narration").value = "";

    calculateTotals();

}

document.addEventListener("blur", function (e) {

    if (e.target.classList.contains("debit") ||
        e.target.classList.contains("credit")) {

        e.target.value =
            Number(e.target.value || 0).toFixed(2);

    }

}, true);


const transactionMode = document.getElementById("transactionMode");
const bankSection = document.getElementById("bankSection");
const instrumentSection = document.getElementById("instrumentSection");
const narrationSection = document.getElementById("narrationSection");

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