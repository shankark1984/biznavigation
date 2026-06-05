let toggleAttached = false;
async function loadExportLibraries() {
    if (!window.XLSX) {
        await import(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
        );
    }
}

async function fetchPayments() {

    const today = new Date();

    const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const lastDay = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
    );

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
        .eq("company_id", CompanyID)
        .gte("ReceiptOn", firstDay.toISOString().split("T")[0])
        .lte("ReceiptOn", lastDay.toISOString().split("T")[0])
        .order("ReceiptOn", { ascending: true });

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
    <td>
    ${p.ReceiptOn
                ? new Date(p.ReceiptOn).toLocaleDateString("en-GB")
                : "-"}
</td>

    <td title="${p.PartyDetails?.PartyName || ""}">
        ${p.PartyDetails?.PartyName || "-"}
    </td>

    <td>${p.ReferenceNo || "-"}</td>

    <td class="text-end text-success">
        ${formatAmount(creditValue)}
    </td>

    <td class="text-end text-danger">
        ${formatAmount(debitValue)}
    </td>

    <td class="text-end fw-bold">
       ${formatAmount(runningTotal)}
    </td>
`;

        tbody.appendChild(tr);

        // ================= DETAIL ROW =================
        const detailTr = document.createElement("tr");
        detailTr.id = mainRowId;
        detailTr.style.display = "none";

        const childRows =
            p.PaymentLineItems?.length
                ? p.PaymentLineItems.map(item => `
            <tr>
                <td>${item.InvoiceNo || "-"}</td>
                <td>${item.Narration || "-"}</td>
                <td class="text-end">${formatAmount(item.PaymentAmount)}</td>
                <td class="text-end">${formatAmount(item.OtherDeductionAmount)}</td>
                <td class="text-end">${formatAmount(item.TDSDeductionAmount)}</td>
            </tr>
        `).join("")
                : `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    No Invoice Details
                </td>
            </tr>
        `;


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

}
function attachToggle() {
    if (toggleAttached) return;

    toggleAttached = true;
    document
        .querySelector("#paymentTable tbody")
        .addEventListener("click", function (e) {

            const btn = e.target.closest(".toggle-btn");
            if (!btn) return;

            const targetId = btn.dataset.target;
            const targetRow = document.getElementById(targetId);
            const icon = btn.querySelector("i");

            document.querySelectorAll("tr[id^='row-']")
                .forEach(row => {
                    if (row.id !== targetId) {
                        row.style.display = "none";
                    }
                });

            document.querySelectorAll(".toggle-btn i")
                .forEach(i => {
                    i.classList.remove("bi-dash-circle");
                    i.classList.add("bi-plus-circle");
                });

            const isOpen =
                targetRow.style.display === "table-row";

            if (isOpen) {
                targetRow.style.display = "none";
            } else {
                targetRow.style.display = "table-row";
                icon.classList.remove("bi-plus-circle");
                icon.classList.add("bi-dash-circle");
            }
        });
}
document.addEventListener("DOMContentLoaded", () => {

    const today = new Date();

    document.getElementById("bookedMonth").value =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    attachToggle();
    renderTable();
});