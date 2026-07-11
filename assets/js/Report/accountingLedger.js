let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';
let partyNameCache = {};

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

    // document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    // document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    await loadReportSuggestions();

});

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('AccountingLedgerView')
        .select('VoucherNo, PartyCode, PartyName, VoucherType, VoucherDate')
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
    spinner.style.display = 'block';

    const openingBalance = await getOpeningBalance(filters);

    let query = buildQuery(filters);

    const { data, error, count } = await query.range(
        (currentPage - 1) * pageSize,
        currentPage * pageSize - 1
    );

    spinner.style.display = 'none';

    if (error) {
        console.error(error);
        return;
    }

    renderTable(data, openingBalance);

    await loadGrandTotals(filters, openingBalance);

    renderPagination(count, loadTable);

    updateHeaderSortIndicators();
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

    console.log("filters data", query);
    if (filters.customerName) query = query.ilike('PartyName', `%${filters.customerName}%`);
    if (filters.startDate) query = query.gte('VoucherDate', filters.startDate);
    if (filters.endDate) query = query.lte('VoucherDate', filters.endDate);


    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('VoucherDate', `${startYear}-04-01`).lte('VoucherDate', `${endYear}-03-31`);
    }

    console.log('Query:', query);

    return query;
}

function renderTable(data, openingBalance = { debit: 0, credit: 0, balance: 0 }) {

    const tbody = document.querySelector("#ledgerTable tbody");
    tbody.innerHTML = "";

    // Footer elements
    const totalDebitEl = document.getElementById("totalDebit");
    const totalCreditEl = document.getElementById("totalCredit");

    let totalDebit = 0;
    let totalCredit = 0;

    if (!data || data.length === 0) {

        totalDebitEl.textContent = formatAmount(0);
        totalCreditEl.textContent = formatAmount(0);

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">
                    No records found
                </td>
            </tr>`;
        return;
    }

    let runningBalance = openingBalance.balance;
    const openingDate = getOpeningBalanceDate(getFilters());

    tbody.insertAdjacentHTML("beforeend", `
        <tr class="table-warning fw-bold">
            <td></td>
            <td>${openingDate ? formatDate(openingDate) : ""}</td>
            <td>Opening Balance</td>
            <td></td>
            <td></td>
            <td class="text-end">${openingBalance.debit ? formatAmount(openingBalance.debit) : "0.00"}</td>
            <td class="text-end">${openingBalance.credit ? formatAmount(openingBalance.credit) : "0.00"}</td>
            <td class="text-end">${formatAmount(openingBalance.balance)}
            </td>
                <td></td>
        </tr>
    `);

    data.forEach((row, index) => {

        const debit = Number(row.Debit || 0);
        const credit = Number(row.Credit || 0);

        // Totals
        totalDebit += debit;
        totalCredit += credit;

        runningBalance += credit - debit;

        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td class="text-center">${((currentPage - 1) * pageSize) + index + 1}</td>
                <td>${formatDate(row.VoucherDate)}</td>
                <td>${row.VoucherType ?? ""}</td>
                <td>${row.VoucherNo ?? ""}</td>
                <td>${row.ReferenceNo ?? ""}</td>
                <td class="text-end">${debit ? formatAmount(debit) : ""}</td>
                <td class="text-end">${credit ? formatAmount(credit) : ""}</td>
                <td class="text-end fw-bold">${formatAmount(runningBalance)}</td>
                <td>${row.Narration ?? ""}</td>
            </tr>
        `);
    });
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
    document.querySelectorAll('#ledgerTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        th.textContent = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
        if (key === sortColumn) {
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

async function getOpeningBalance(filters = {}) {

    let query = supabaseClient
        .from("AccountingLedgerView")
        .select("Debit,Credit,VoucherDate")
        .eq("company_id", CompanyID);

    // Customer Filter
    if (filters.customerName) {
        query = query.ilike("PartyName", `%${filters.customerName}%`);
    }

    // Financial Year Filter
    if (filters.financialYear) {

        const [startYear] = filters.financialYear.split("-").map(Number);

        const fyStartDate = `${startYear}-04-01`;

        // Opening should start from FY beginning
        query = query.gte("VoucherDate", fyStartDate);
    }

    // Calculate only till one day before selected Start Date
    if (filters.startDate) {
        query = query.lt("VoucherDate", filters.startDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return {
            debit: 0,
            credit: 0,
            balance: 0
        };
    }

    let debit = 0;
    let credit = 0;

    data.forEach(row => {
        debit += Number(row.Debit || 0);
        credit += Number(row.Credit || 0);
    });

    return {
        debit,
        credit,
        balance: credit - debit
    };
}

async function loadGrandTotals(filters = {}, openingBalance = { debit: 0, credit: 0 }) {

    let query = buildQuery(filters);

    const { data, error } = await query;

    if (error) return console.error(error);

    let totalDebit = Number(openingBalance.debit || 0);
    let totalCredit = Number(openingBalance.credit || 0);

    data.forEach(row => {
        totalDebit += Number(row.Debit || 0);
        totalCredit += Number(row.Credit || 0);
    });

    document.getElementById("totalDebit").textContent = formatAmount(totalDebit);
    document.getElementById("totalCredit").textContent = formatAmount(totalCredit);
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