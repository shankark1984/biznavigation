let allPayments = [];
let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';
let partyNameCache = {};
let toggleAttached = false; // <-- Add this

document.addEventListener("DOMContentLoaded", async () => {

    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });
    allPayments = await fetchPayments();
    attachToggle();
    // preprocess once
    allPayments.forEach(p => {
        p._partyName = (p.PartyDetails?.PartyName || "").toLowerCase();
        p._paymentId = (p.PaymentID || "").toLowerCase();
        p._receiptDate = p.ReceiptOn ? new Date(p.ReceiptOn) : null;
    });

    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    populateFilters(allPayments);

    renderTable(allPayments);
});

function renderTable(payments = []) {

    const tbody = document.querySelector("#paymentTable tbody");

    // Pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPayments = payments.slice(startIndex, endIndex);

    let html = "";
    let runningTotal = 0;

    // Running balance should include previous pages
    for (let i = 0; i < startIndex; i++) {
        const p = payments[i];

        const credit =
            p.TransactionType === "Credit"
                ? Number(p.PaymentAmount || 0)
                : 0;

        const debit =
            p.TransactionType === "Debit"
                ? Number(p.PaymentAmount || 0)
                : 0;

        runningTotal += credit - debit;
    }

    paginatedPayments.forEach((p, index) => {

        const rowId = `row-${p.id}`;

        const credit =
            p.TransactionType === "Credit"
                ? Number(p.PaymentAmount || 0)
                : 0;

        const debit =
            p.TransactionType === "Debit"
                ? Number(p.PaymentAmount || 0)
                : 0;

        runningTotal += credit - debit;

        // Existing row HTML...
        html += `
            <tr>
                <td>
                    <button
                        class="btn btn-sm btn-link toggle-btn"
                        data-target="${rowId}">
                        <i class="bi bi-plus-circle"></i>
                    </button>
                    ${startIndex + index + 1}
                </td>
                <td>${p.PaymentID || "-"}</td>
                <td>${formatDate(p.ReceiptOn)}</td>
                <td>${p.PartyDetails?.PartyName || "-"}</td>
                <td>${p.ReferenceNo || "-"}</td>
                <td class="text-end text-success">${formatAmount(credit)}</td>
                <td class="text-end text-danger">${formatAmount(debit)}</td>
                <td class="text-end fw-bold">${formatAmount(runningTotal)}</td>
            </tr>

            <tr id="${rowId}" style="display:none">
                <td colspan="8">
                    <div class="p-2 bg-light border rounded">
                        <table class="table table-sm table-bordered mb-0">
                            <thead>
                                <tr>
                                    <th>Invoice No</th>
                                    <th>Narration</th>
                                    <th class="text-end">Amount</th>
                                    <th class="text-end">Other Deduction</th>
                                    <th class="text-end">TDS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${p.PaymentLineItems?.length
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
                                        `
            }
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Render pagination
    renderPagination(payments.length, () => {
        renderTable(payments);
    });
}
function populateFilters(payments) {

    const customers = new Set();
    const paymentNos = new Set();
    const invoices = new Set();

    payments.forEach(p => {

        if (p.PartyDetails?.PartyName)
            customers.add(p.PartyDetails.PartyName);

        if (p.PaymentID)
            paymentNos.add(p.PaymentID);

        p.PaymentLineItems?.forEach(item => {
            if (item.InvoiceNo)
                invoices.add(item.InvoiceNo);
        });
    });

    document.getElementById("customerNameList").innerHTML =
        [...customers]
            .map(v => `<option value="${v}">`)
            .join("");

    document.getElementById("paymentNoList").innerHTML =
        [...paymentNos]
            .map(v => `<option value="${v}">`)
            .join("");

    document.getElementById("invoiceNoList").innerHTML =
        [...invoices]
            .map(v => `<option value="${v}">`)
            .join("");
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
        .order("ReceiptOn", { ascending: true });

    if (error) {
        console.error("FETCH ERROR:", error);
        return [];
    }

    return data;
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

function renderPagination(totalCount, loadTableFn) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = document.getElementById('paginationControls');

    pagination.innerHTML = '';

    const maxVisiblePages = 5;

    // Previous Button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;

    prevLi.addEventListener('click', (e) => {
        e.preventDefault();

        if (currentPage > 1) {
            currentPage--;
            loadTableFn(getFilters());
        }
    });

    pagination.appendChild(prevLi);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if near end
    startPage = Math.max(1, endPage - maxVisiblePages + 1);

    // First page + dots
    if (startPage > 1) {
        addPageButton(1);

        if (startPage > 2) {
            addDots();
        }
    }

    // Visible Pages
    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i);
    }

    // Last page + dots
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            addDots();
        }

        addPageButton(totalPages);
    }

    // Next Button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;

    nextLi.addEventListener('click', (e) => {
        e.preventDefault();

        if (currentPage < totalPages) {
            currentPage++;
            loadTableFn(getFilters());
        }
    });

    pagination.appendChild(nextLi);

    // Helper function
    function addPageButton(page) {
        const li = document.createElement('li');

        li.className = `page-item ${page === currentPage ? 'active' : ''}`;

        li.innerHTML = `<a class="page-link" href="#">${page}</a>`;

        li.addEventListener('click', (e) => {
            e.preventDefault();

            currentPage = page;
            loadTableFn(getFilters());
        });

        pagination.appendChild(li);
    }

    // Dots (...)
    function addDots() {
        const li = document.createElement('li');

        li.className = 'page-item disabled';

        li.innerHTML = `<span class="page-link">...</span>`;

        pagination.appendChild(li);
    }
}

function updateHeaderSortIndicators() {
    document.querySelectorAll('#paymentTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        th.textContent = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
        if (key === sortColumn) {
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

function getFilters() {
    let dateRange = document.getElementById('dateRange').value.split(' to ');
    return {
        paymentNo: document.getElementById('paymentNo').value.trim(),
        invoiceNo: document.getElementById('invoiceNo').value.trim(),
        startDate: dateRange[0]?.trim() || null,
        endDate: dateRange[1]?.trim() || null,
        customerName: document.getElementById('customerName').value.trim(),
        paymentMonth: document.getElementById('paymentMonth').value.trim(),
        paymentYear: document.getElementById('paymentYear').value.trim(),
        financialYear: document.getElementById('financialYear').value.trim(),
    };
}

function applyFilters() {
    const filters = getFilters();

    let filtered = [...allPayments];

    // Customer Name
    if (filters.customerName) {
        const customer = filters.customerName.toLowerCase();

        filtered = filtered.filter(p =>
            (p.PartyDetails?.PartyName || "")
                .toLowerCase()
                .includes(customer)
        );
    }

    // Payment No
    if (filters.paymentNo) {
        const paymentNo = filters.paymentNo.toLowerCase();

        filtered = filtered.filter(p =>
            (p.PaymentID || "")
                .toLowerCase()
                .includes(paymentNo)
        );
    }

    // Invoice No
    if (filters.invoiceNo) {
        const invoiceNo = filters.invoiceNo.toLowerCase();

        filtered = filtered.filter(p =>
            p.PaymentLineItems?.some(item =>
                (item.InvoiceNo || "")
                    .toLowerCase()
                    .includes(invoiceNo)
            )
        );
    }

    // Date Range
    if (filters.startDate) {
        const startDate = new Date(filters.startDate);

        filtered = filtered.filter(p =>
            p.ReceiptOn &&
            new Date(p.ReceiptOn) >= startDate
        );
    }

    if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);

        filtered = filtered.filter(p =>
            p.ReceiptOn &&
            new Date(p.ReceiptOn) <= endDate
        );
    }
    // Payment Month
    if (filters.paymentMonth) {

        const [year, month] = filters.paymentMonth
            .split('-')
            .map(Number);

        filtered = filtered.filter(p => {

            if (!p.ReceiptOn) return false;

            const receiptDate = new Date(p.ReceiptOn);

            return (
                receiptDate.getFullYear() === year &&
                receiptDate.getMonth() + 1 === month
            );
        });
    }

    // Payment Year
    if (filters.paymentYear) {
        const year = Number(filters.paymentYear);

        filtered = filtered.filter(p => {
            if (!p.ReceiptOn) return false;

            return (
                new Date(p.ReceiptOn).getFullYear() === year
            );
        });
    }

    // Financial Year (Format: 2025-2026)
    if (filters.financialYear) {
        const [startFY, endFY] =
            filters.financialYear.split("-").map(Number);

        filtered = filtered.filter(p => {
            if (!p.ReceiptOn) return false;

            const date = new Date(p.ReceiptOn);

            const fy =
                date.getMonth() >= 3
                    ? date.getFullYear()
                    : date.getFullYear() - 1;

            return fy === startFY;
        });
    }

    currentPage = 1;
    renderTable(filtered);
}

document.getElementById("searchBtn").addEventListener("click", applyFilters);

async function loadPdfLibs() {
    if (!window.jspdf) {
        await import(
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        );
    }
}
async function loadExportLibraries() {
    if (!window.XLSX) {
        await import(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
        );
    }
}

async function exportToExcel() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    loadExportLibraries();
    if (allData.length === 0) return alert('No data to export.');

    let tableHtml = `<table><thead><tr>
        <th>Sr No</th><th>Invoice No</th><th>Invoice Date</th><th>Invoice Type</th><th>Customer Name</th>
        <th>Basic Amount</th><th>Other Amount</th><th>CGST Amount</th><th>SGST Amount</th><th>IGST Amount</th>
        <th>Total GST Amount</th><th>Grand Total Amount</th><th>Collected Amount</th><th>Other Deduction Amount</th>
        <th>TDS Deduction Amount</th><th>Total Payment Amount</th><th>Balance Amount</th><th>Payment Status</th></tr></thead><tbody>`;

    for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        let partyName = '';
        if (row.PartyCode) {
            if (partyNameCache[row.PartyCode]) {
                partyName = partyNameCache[row.PartyCode];
            } else {
                const details = await getPartyDetailsByCode(row.PartyCode);
                partyName = details?.PartyName || '';
                partyNameCache[row.PartyCode] = partyName;
            }
        }

        tableHtml += `<tr>
            <td>${i + 1}</td>
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.InvoiceDate || ''}</td>
            <td>${row.InvoiceType || ''}</td>
            <td>${partyName}</td>
            <td>${row.BasicAmount || '0'}</td>
            <td>${row.OtherAmount || '0'}</td>
            <td>${row.CGSTAmount || '0'}</td>
            <td>${row.SGSTAmount || '0'}</td>
            <td>${row.IGSTAmount || '0'}</td>
            <td>${row.TotalGSTAmount || '0'}</td>
            <td>${row.GrandTotalAmount || '0'}</td>
            <td>${row.PaymentAmount || '0'}</td>
            <td>${row.OtherDeductionAmount || '0'}</td>
            <td>${row.TDSDeductionAmount || '0'}</td>
            <td>${row.PaymentTotalAmount || '0'}</td>
            <td>${row.BalanceAmount || '0'}</td>
            <td>${row.PaymentStatus || ''}</td>
        </tr>`;
    }

    tableHtml += `</tbody></table>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: "Bookings" });
    XLSX.writeFile(wb, 'InternationalBookings.xlsx');
}

// PDF Export Function with PartyName
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    loadPdfLibs();
    if (!allData.length) return alert('No data to export.');

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const headers = [
        'Sr No', 'Invoice No', 'Invoice Date', 'Invoice Type', 'Customer Name', 'Basic Amount', 'Other Amount',
        'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total GST Amount', 'Grand Total Amount', 'Collected Amount',
        'Other Deduction Amount', 'TDS Deduction Amount', 'Total Payment Amount', 'Balance Amount', 'Payment Status'
    ];

    const formatNumber = (value) => typeof value === 'number' ? value.toFixed(2) : (parseFloat(value) || 0).toFixed(2);
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date) ? '' : date.toLocaleDateString();
    };

    // Step 1: Get unique PartyCodes
    const uniqueCodes = [...new Set(allData.map(r => r.PartyCode).filter(Boolean))];

    // Step 2: Build PartyCode -> PartyName map
    const partyNameMap = {};
    for (const code of uniqueCodes) {
        const details = await getPartyDetailsByCode(code);
        partyNameMap[code] = details?.PartyName || code;
    }

    // Step 3: Prepare rows
    const rows = allData.map((row, i) => [
        i + 1,
        row.InvoiceNo || '',
        formatDate(row.InvoiceDate),
        row.InvoiceType || '',
        partyNameMap[row.PartyCode] || row.PartyCode || '',
        formatNumber(row.BasicAmount),
        formatNumber(row.OtherAmount),
        formatNumber(row.CGSTAmount),
        formatNumber(row.SGSTAmount),
        formatNumber(row.IGSTAmount),
        formatNumber(row.TotalGSTAmount),
        formatNumber(row.GrandTotalAmount),
        formatNumber(row.PaymentAmount),
        formatNumber(row.OtherDeductionAmount),
        formatNumber(row.TDSDeductionAmount),
        formatNumber(row.PaymentTotalAmount),
        formatNumber(row.BalanceAmount),
        row.PaymentStatus || ''
    ]);

    // Step 4: Export
    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        margin: { left: 10, right: 10 },
        styles: { fontSize: 6.5, overflow: 'linebreak', cellPadding: 1.2 },
        headStyles: { fillColor: [0, 123, 255] },
        didDrawPage: function (data) {
            doc.setFontSize(10);
            doc.text("Customer Invoice Report", data.settings.margin.left, 10);
        },
        pageBreak: 'auto'
    });

    doc.save('CustomerInvoiceReport.pdf');
}