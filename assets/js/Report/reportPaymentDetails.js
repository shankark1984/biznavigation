async function loadExportLibraries() {
    if (!window.XLSX) {
        await import(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
        );
    }
}

async function fetchPayments() {
    const { data, error } = await supabaseClient
        .from("PaymentDetails")
        .select(`
            id,
            PaymentID,
            ReceiptOn,
            PartyCode,
            TransactionType,
            SuspenseAmount,
            ReferenceNo,
            PaymentAmount,
            DeductionAmount,

            PartyDetails (
                PartyName
            ),

            PaymentLineItems!PaymentLineItems_PaymentID_fkey (
                InvoiceNo,
                PaymentAmount,
                OtherDeductionAmount,
                TDSDeductionAmount,
                Narration
            )
        `)
        .order("ReceiptOn", { ascending: false });

    if (error) {
        console.error("FETCH ERROR:", error);
        return [];
    }

    return data;
}
async function renderTable() {
    const tbody = document.querySelector("#paymentTable tbody");
    tbody.innerHTML = "";

    const payments = await fetchPayments();

    // ✅ RUNNING TOTAL INIT
    let runningTotal = 0;

    payments.forEach((p, index) => {

        const mainRowId = `row-${p.id}`;

        const isCredit = p.TransactionType === "Credit";
        const isDebit = p.TransactionType === "Debit";

        const creditValue = isCredit ? (p.PaymentAmount || 0) : 0;
        const debitValue = isDebit ? (p.PaymentAmount || 0) : 0;

        // ✅ Running total calculation
        runningTotal = runningTotal + creditValue - debitValue;

        const tr = document.createElement("tr");

        tr.innerHTML = `
    <td class="text-center">
        <button class="btn btn-sm btn-link toggle-btn" data-target="${mainRowId}">
            <i class="bi bi-plus-circle"></i>
        </button>
        ${index + 1}
    </td>

    <td>${p.PaymentID || "-"}</td>
    <td>${p.ReceiptOn || "-"}</td>

    <td title="${p.PartyDetails?.PartyName || ""}">
        ${p.PartyDetails?.PartyName || "-"}
    </td>

    <td>${p.ReferenceNo || "-"}</td>

    <td class="text-end text-success">
        ${creditValue.toFixed(2)}
    </td>

    <td class="text-end text-danger">
        ${debitValue.toFixed(2)}
    </td>

    <td class="text-end fw-bold">
        ${runningTotal.toFixed(2)}
    </td>
`;

        tbody.appendChild(tr);

        // ================= DETAIL ROW =================
        const detailTr = document.createElement("tr");
        detailTr.id = mainRowId;
        detailTr.style.display = "none";

        let childRows = "";

        (p.PaymentLineItems || []).forEach(item => {
            childRows += `
                <tr>
                    <td>${item.InvoiceNo || "-"}</td>
                    <td>${item.Narration || "-"}</td>
                    <td class="text-end">${item.PaymentAmount || 0}</td>
                    <td class="text-end">${item.OtherDeductionAmount || 0}</td>
                    <td class="text-end">${item.TDSDeductionAmount || 0}</td>
                </tr>
            `;
        });

        detailTr.innerHTML = `
            <td colspan="8">
                <div class="p-2 bg-light border rounded">

                    <table class="table table-sm table-bordered mb-0"
                           style="table-layout: fixed; width: 100%;">

                        <thead class="table-secondary">
                            <tr>
                                <th style="width: 15%;">Invoice No</th>
                                <th style="width: 40%;">Narration</th>
                                <th style="width: 15%;" class="text-end">Amount</th>
                                <th style="width: 15%;" class="text-end">Other Deduction</th>
                                <th style="width: 15%;" class="text-end">TDS</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${childRows}
                        </tbody>

                    </table>

                </div>
            </td>
        `;

        tbody.appendChild(detailTr);
    });

    attachToggle();
}
function attachToggle() {
    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.addEventListener("click", function () {

            const targetId = this.getAttribute("data-target");
            const targetRow = document.getElementById(targetId);
            const icon = this.querySelector("i");

            // 👉 STEP 1: collapse ALL other detail rows
            document.querySelectorAll("tr[id^='row-']").forEach(row => {
                if (row.id !== targetId) {
                    row.style.display = "none";
                }
            });

            // 👉 STEP 2: reset all icons
            document.querySelectorAll(".toggle-btn i").forEach(i => {
                i.classList.remove("bi-dash-circle");
                i.classList.add("bi-plus-circle");
            });

            // 👉 STEP 3: toggle current row
            const isOpen = targetRow.style.display === "table-row";

            if (isOpen) {
                targetRow.style.display = "none";
                icon.classList.remove("bi-dash-circle");
                icon.classList.add("bi-plus-circle");
            } else {
                targetRow.style.display = "table-row";
                icon.classList.remove("bi-plus-circle");
                icon.classList.add("bi-dash-circle");
            }
        });
    });
}
document.addEventListener("DOMContentLoaded", () => {
    renderTable();
});