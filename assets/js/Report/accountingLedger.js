// accountingLedger.js
let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';
let partyNameCache = {};

const elements = {
    tbody: document.getElementById("ledgerTableBody"),
    totalDebit: document.getElementById("totalDebit"),
    totalCredit: document.getElementById("totalCredit"),
    closingDebit: document.getElementById("closingBalanceDebit"),
    closingCredit: document.getElementById("closingBalanceCredit"),
    balanceDebit: document.getElementById("balanceDebit"),
    balanceCredit: document.getElementById("balanceCredit")
};

document.addEventListener('DOMContentLoaded', async () => {

    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });

    document.getElementById('searchBtn').addEventListener('click', () => {

        const customerName = document.getElementById('customerName').value.trim();
        const financialYear = document.getElementById('financialYear').value.trim();
        const dateRange = document.getElementById('dateRange').value.trim();

        if (!customerName) {
            alert("Please select a Customer Name.");
            document.getElementById('customerName').focus();
            return;
        }

        // At least one of Financial Year or Date Range is required
        if (!financialYear && !dateRange) {
            alert("Please select either a Financial Year or a Date Range.");
            document.getElementById('financialYear').focus();
            return;
        }

        currentPage = 1;
        loadTable(getFilters());
    });

    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    await loadReportSuggestions();

});

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('AccountingLedgerView')
        .select('PartyCode, PartyName,  VoucherDate')
        .eq('company_id', CompanyID);

    if (error) return console.error('Error fetching suggestions:', error);


    populateDatalists(data, 'PartyName', 'customerNameList');


    const financialYears = [...new Set(
        data
            .filter(item => item.VoucherDate)
            .map(item => {
                const d = new Date(item.VoucherDate);
                const startYear = d.getMonth() >= 3
                    ? d.getFullYear()      // April onwards
                    : d.getFullYear() - 1; // Jan-Mar belongs to previous FY

                return `${startYear}-${startYear + 1}`;
            })
    )]
        .sort((a, b) => {
            const yearA = parseInt(a.split('-')[0], 10);
            const yearB = parseInt(b.split('-')[0], 10);
            return yearB - yearA; // Latest financial year first
        });

    populateArrayDatalist(financialYears, 'financialYearList');
}
function populateArrayDatalist(array, datalistId) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = array.map(value => `<option value="${value}">`).join('');
}
function populateDatalists(data, field, datalistId) {
    const uniqueValues = [...new Set(
        data
            .map(item => item[field])
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)); // A to Z sorting

    const datalist = document.getElementById(datalistId);

    datalist.innerHTML = uniqueValues
        .map(value => `<option value="${value}">`)
        .join('');
}

async function loadTable(filters = {}) {

    const spinner = document.getElementById('loadingSpinner');
    spinner.classList.remove("d-none");

    const [openingBalance] = await Promise.all([
        getOpeningBalance(filters)
    ]);

    let query = buildQuery(filters);

    const { data, error, count } = await query.range(
        (currentPage - 1) * pageSize,
        currentPage * pageSize - 1
    );

    spinner.classList.add("d-none");

    if (error) {
        console.error(error);
        return;
    }

    renderTable(data, openingBalance);

    loadGrandTotals(filters, openingBalance);

    renderPagination(count, loadTable);

    updateHeaderSortIndicators();
}

function getFilters() {
    const filters = {
        customerName: document.getElementById("customerName")?.value.trim(),
        financialYear: document.getElementById("financialYear")?.value.trim(),
    };

    const dateRange = document.getElementById("dateRange")?.value.trim();
    if (dateRange) {
        const [startDate, endDate] = dateRange.split(" to ");
        filters.startDate = startDate || "";
        filters.endDate = endDate || startDate || "";
    }

    return filters;
}

async function getOpeningBalance(filters = {}) {

    let query = supabaseClient
        .from("AccountingLedgerView")
        .select("Debit,Credit")
        .eq("company_id", CompanyID);

    // Customer Filter
    if (filters.customerName) {
        query = query.ilike("PartyName", `%${filters.customerName}%`);
    }

    // Determine Opening Date
    let openingDate = "";

    if (filters.startDate) {
        openingDate = filters.startDate;
    } else if (filters.financialYear) {
        const [startYear] = filters.financialYear.split("-").map(Number);
        openingDate = `${startYear}-04-01`;
    }

    // Transactions before report start date
    if (openingDate) {
        query = query.lt("VoucherDate", openingDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Opening Balance Error:", error);
        return {
            debit: 0,
            credit: 0,
            balance: 0,
            balanceType: "",
            debitBalance: 0,
            creditBalance: 0
        };
    }

    const debit = data.reduce((sum, row) => sum + Number(row.Debit || 0), 0);
    const credit = data.reduce((sum, row) => sum + Number(row.Credit || 0), 0);

    const net = credit - debit;

    return {
        debit,
        credit,

        // Absolute balance
        balance: Math.abs(net),

        // Balance Type
        balanceType: net < 0 ? "Dr" : net > 0 ? "Cr" : "",

        // Accounting Balance Columns
        debitBalance: net < 0 ? Math.abs(net) : 0,
        creditBalance: net > 0 ? net : 0
    };
}

function buildQuery(filters = {}) {
    let query = supabaseClient
        .from('AccountingLedgerView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (sortColumn) {
        query = query.order(sortColumn, {
            ascending: sortOrder === 'asc'
        });
    } else {
        query = query.order('VoucherDate', {
            ascending: true
        });
    }

    if (filters.customerName) query = query.ilike('PartyName', `%${filters.customerName}%`);
    if (filters.startDate) query = query.gte('VoucherDate', filters.startDate);
    if (filters.endDate) query = query.lte('VoucherDate', filters.endDate);


    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('VoucherDate', `${startYear}-04-01`).lte('VoucherDate', `${endYear}-03-31`);
    }

    return query;
}

function renderTable(data, openingBalance = {}) {

    const tbody = document.getElementById("ledgerTableBody");
    tbody.innerHTML = "";

    const totalDebitEl = document.getElementById("totalDebit");
    const totalCreditEl = document.getElementById("totalCredit");
    const closingBalanceDebitEl = document.getElementById("closingBalanceDebit");
    const closingBalanceCreditEl = document.getElementById("closingBalanceCredit");
    const balanceDebitEl = document.getElementById("balanceDebit");
    const balanceCreditEl = document.getElementById("balanceCredit");

    const openingDebit = Number(openingBalance.debitBalance || 0);
    const openingCredit = Number(openingBalance.creditBalance || 0);
    const openingBalanceValue = Number(openingBalance.balance || 0);

    if (!data?.length) {

        tbody.innerHTML = `
        <tr>
            <td colspan="9" class="text-center py-4">
                No records found
            </td>
        </tr>`;

        totalDebitEl.textContent = "0.00";
        totalCreditEl.textContent = "0.00";
        closingBalanceDebitEl.textContent = "0.00";
        closingBalanceCreditEl.textContent = "0.00";
        balanceDebitEl.textContent = "0.00";
        balanceCreditEl.textContent = "0.00";
        return;
    }

    let runningBalance =
        openingBalance.balanceType === "Dr"
            ? -openingBalanceValue
            : openingBalanceValue;


    const openingDate = getOpeningBalanceDate(getFilters());

    let html = `
    <tr class="table-warning fw-bold">
        <td></td>
        <td>${openingDate ? formatDate(openingDate) : ""}</td>
        <td>Opening Balance</td>
        <td></td>
        <td></td>
        <td class="text-end">${openingDebit ? formatAmount(openingDebit) : ""}</td>
        <td class="text-end">${openingCredit ? formatAmount(openingCredit) : ""}</td>
        <td class="text-end">
            ${openingBalanceValue
            ? `${formatAmount(openingBalanceValue)} ${openingBalance.balanceType}`
            : "0.00"}
        </td>
        <td></td>
    </tr>`;

    data.forEach((row, index) => {

        const debit = Number(row.Debit) || 0;
        const credit = Number(row.Credit) || 0;

        runningBalance += credit - debit;

        const balanceAmount = Math.abs(runningBalance);
        const balanceType = runningBalance < 0 ? "Dr" : runningBalance > 0 ? "Cr" : "";

        html += `
        <tr>
            <td class="text-center">${((currentPage - 1) * pageSize) + index + 1}</td>
            <td>${formatDate(row.VoucherDate)}</td>
            <td>${row.VoucherType || ""}</td>
            <td>${row.VoucherNo || ""}</td>
            <td>${row.ReferenceNo || ""}</td>
            <td class="text-end">${debit ? formatAmount(debit) : ""}</td>
            <td class="text-end">${credit ? formatAmount(credit) : ""}</td>
            <td class="text-end fw-bold">
                ${balanceAmount ? `${formatAmount(balanceAmount)} ${balanceType}` : "0.00"}
            </td>
            <td>${row.Narration || ""}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

function getOpeningBalanceDate(filters = {}) {

    // If Date Range is selected → previous day of Start Date
    if (filters.startDate) {
        const d = new Date(filters.startDate);
        d.setDate(d.getDate() - 1);

        return d.toISOString().split("T")[0];
    }

    // If only Financial Year is selected
    if (filters.financialYear) {

        const [startYear] = filters.financialYear.split("-").map(Number);

        // Previous date of FY start (01-Apr-YYYY => 31-Mar-YYYY)
        const d = new Date(startYear, 3, 1); // April = 3
        d.setDate(d.getDate() - 1);

        return d.toISOString().split("T")[0];
    }

    return "";
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

async function loadGrandTotals(filters = {}, openingBalance = {}) {

    const query = buildQuery(filters).select("Debit,Credit");

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return;
    }

    // totalDebit = Number(openingBalance.debitBalance || 0);
    // totalCredit = Number(openingBalance.creditBalance || 0);

    const {
        totalDebit,
        totalCredit
    } = data.reduce((totals, row) => {

        totals.totalDebit += Number(row.Debit || 0);
        totals.totalCredit += Number(row.Credit || 0);

        return totals;

    }, {
        totalDebit: Number(openingBalance.debitBalance || 0),
        totalCredit: Number(openingBalance.creditBalance || 0)
    });

    document.getElementById("totalDebit").textContent = formatAmount(totalDebit);
    document.getElementById("totalCredit").textContent = formatAmount(totalCredit);

    // Closing Balance
    const net = totalCredit - totalDebit;

    const closingDebit = net < 0 ? Math.abs(net) : 0;
    const closingCredit = net > 0 ? net : 0;

    document.getElementById("closingBalanceDebit").textContent =
        closingDebit ? formatAmount(closingDebit) : "";

    document.getElementById("closingBalanceCredit").textContent =
        closingCredit ? formatAmount(closingCredit) : "";

    // Final Balance (both sides equal)
    document.getElementById("balanceDebit").textContent =
        formatAmount(totalDebit + closingCredit);

    document.getElementById("balanceCredit").textContent =
        formatAmount(totalCredit + closingDebit);
}

function updateHeaderSortIndicators() {
    document.querySelectorAll('#ledgerTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        th.textContent = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
        if (key === sortColumn) {
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
    });
}





async function fetchAllFilteredData(filters = {}) {
    let allData = [], batchSize = 1000, from = 0, to = batchSize - 1, hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from('AccountingLedgerView')
            .select('*')
            .eq('company_id', CompanyID)
            .order('VoucherDate', { ascending: true });

        if (filters.customerName) query = query.ilike('PartyName', `%${filters.customerName}%`);
        if (filters.startDate) query = query.gte('VoucherDate', filters.startDate);
        if (filters.endDate) query = query.lte('VoucherDate', filters.endDate);


        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split('-').map(Number);
            query = query.gte('VoucherDate', `${startYear}-04-01`).lte('VoucherDate', `${endYear}-03-31`);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching data for export:', error);
            break;
        }

        if (data.length > 0) {
            allData = allData.concat(data);
            from += batchSize;
            to += batchSize;
        } else {
            hasMore = false;
        }
    }
    console.log(`Fetched ${allData.length} records for export.`, allData);

    return allData;
}

async function exportToExcel() {
    console.log("Exporting to Excel...");
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    loadExportLibraries();
    if (allData.length === 0) return alert('No data to export.');

    let tableHtml = `<table><thead><tr>
        <th>Voucher Date</th><th>Voucher Type</th><th>Voucher No</th><th>Reference No</th><th>Debit</th><th>Credit</th>`;

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
            <td>${row.VoucherDate || ''}</td>
            <td>${row.VoucherType || ''}</td>
            <td>${row.VoucherNo || ''}</td>
            <td>${row.ReferenceNo || ''}</td>
            <td>${row.Debit || '0'}</td>
            <td>${row.Credit || '0'}</td>
        </tr>`;
    }

    tableHtml += `</tbody></table>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: "Bookings" });
    XLSX.writeFile(wb, 'AccountingLedger.xlsx');
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