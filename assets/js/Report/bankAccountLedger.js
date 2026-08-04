// bankAccountLedger.js
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
};

document.addEventListener('DOMContentLoaded', async () => {

    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });

    document.getElementById('searchBtn').addEventListener('click', () => {

        const bankAccountName = document.getElementById('bankAccountName').value.trim();
        const financialYear = document.getElementById('financialYear').value.trim();
        const dateRange = document.getElementById('dateRange').value.trim();

        if (!bankAccountName) {
            alert("Please select a Bank Account.");
            document.getElementById('bankAccountName').focus();
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
        .from('BankTransactionView')
        .select('BankID,BankAccountNo, BankName,  TransactionDate')
        .eq('company_id', CompanyID);

    if (error) return console.error('Error fetching suggestions:', error);


    populateDatalists(data, 'BankAccountNo', 'bankAccountNameList');


    const financialYears = [...new Set(
        data
            .filter(item => item.TransactionDate)
            .map(item => {
                const d = new Date(item.TransactionDate);
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
        bankAccountName: document.getElementById("bankAccountName")?.value.trim(),
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


function buildQuery(filters = {}) {
    let query = supabaseClient
        .from('BankTransactionView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (sortColumn) {
        query = query.order(sortColumn, {
            ascending: sortOrder === 'asc'
        });
    } else {
        query = query.order('TransactionDate', {
            ascending: true
        });
    }

    if (filters.bankAccountName) query = query.ilike('BankAccountNo', `%${filters.bankAccountName}%`);
    if (filters.startDate) query = query.gte('TransactionDate', filters.startDate);
    if (filters.endDate) query = query.lte('TransactionDate', filters.endDate);


    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('TransactionDate', `${startYear}-04-01`).lte('TransactionDate', `${endYear}-03-31`);
    }

    return query;
}

function renderTable(data, openingBalance = {}) {

    const tbody = document.getElementById("ledgerTableBody");
    tbody.innerHTML = "";

    const totalDebitEl = document.getElementById("totalDebit");
    const totalCreditEl = document.getElementById("totalCredit");

    const openingBalanceValue = Number(openingBalance.balance || 0);

    let html = "";

    if (!data?.length) {

        tbody.innerHTML = `
        <tr class="table-warning fw-bold">
            <td class="text-center">-</td>
            <td>${getOpeningBalanceDate(getFilters()) ? formatDate(getOpeningBalanceDate(getFilters())) : ""}</td>
            <td>Opening Balance</td>
            <td></td>
            <td class="text-end">
                ${openingBalance.balanceType === "Dr"
                ? formatAmount(openingBalanceValue)
                : ""}
            </td>
            <td class="text-end">
                ${openingBalance.balanceType === "Cr"
                ? formatAmount(openingBalanceValue)
                : ""}
            </td>
            <td class="text-end fw-bold">
                ${openingBalanceValue
                ? `${formatAmount(openingBalanceValue)} ${openingBalance.balanceType}`
                : "0.00"}
            </td>
        </tr>

        <tr>
            <td colspan="7" class="text-center py-3">
                No transactions found.
            </td>
        </tr>`;

        totalDebitEl.textContent = formatAmount(Number(openingBalance.debitBalance || 0));
        totalCreditEl.textContent = formatAmount(Number(openingBalance.creditBalance || 0));
        return;
    }

    // Opening Balance Row
    html += `
    <tr class="table-warning fw-bold">
        <td class="text-center">-</td>
        <td>${getOpeningBalanceDate(getFilters()) ? formatDate(getOpeningBalanceDate(getFilters())) : ""}</td>
        <td>Opening Balance</td>
        <td></td>
        <td class="text-end">
            ${openingBalance.balanceType === "Dr"
            ? formatAmount(openingBalanceValue)
            : ""}
        </td>
        <td class="text-end">
            ${openingBalance.balanceType === "Cr"
            ? formatAmount(openingBalanceValue)
            : ""}
        </td>
        <td class="text-end fw-bold">
            ${openingBalanceValue
            ? `${formatAmount(openingBalanceValue)} ${openingBalance.balanceType}`
            : "0.00"}
        </td>
    </tr>`;

    // Initialize Running Balance
    let runningBalance =
        openingBalance.balanceType === "Dr"
            ? -openingBalanceValue
            : openingBalanceValue;

    // Transaction Rows
    data.forEach((row, index) => {

        const debit = Number(row.Debit) || 0;
        const credit = Number(row.Credit) || 0;

        runningBalance += credit - debit;

        const balanceAmount = Math.abs(runningBalance);
        const balanceType =
            runningBalance < 0 ? "Dr" :
                runningBalance > 0 ? "Cr" : "";

        html += `
        <tr>
            <td class="text-center">${((currentPage - 1) * pageSize) + index + 1}</td>
            <td>${formatDate(row.TransactionDate)}</td>
            <td>${row.Narration || ""}</td>
            <td>${row.ReferenceNo || ""}</td>
            <td class="text-end">${debit ? formatAmount(debit) : ""}</td>
            <td class="text-end">${credit ? formatAmount(credit) : ""}</td>
            <td class="text-end fw-bold">
                ${balanceAmount
                ? `${formatAmount(balanceAmount)} ${balanceType}`
                : "0.00"}
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

async function getOpeningBalance(filters = {}) {

    let query = supabaseClient
        .from("BankTransactionView")
        .select("Debit,Credit")
        .eq("company_id", CompanyID);

    // console.log(filters);
    // Customer Filter
    if (filters.bankAccountName) {
        query = query.ilike("BankAccountNo", `%${filters.bankAccountName}%`);
    }
    // console.log(query);
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
        query = query.lt("TransactionDate", openingDate);
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
    // console.log(net);
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

    let query = buildQuery(filters);
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
    let allData = [];
    const batchSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {

        let query = supabaseClient
            .from("BankTransactionView")
            .select("*")
            .eq("company_id", CompanyID)
            .order("TransactionDate", { ascending: true })
            .range(from, from + batchSize - 1);

        if (filters.bankAccountName) {
            query = query.ilike("BankAccountNo", `%${filters.bankAccountName}%`);
        }

        if (filters.startDate) {
            query = query.gte("TransactionDate", filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte("TransactionDate", filters.endDate);
        }

        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split("-").map(Number);

            query = query
                .gte("TransactionDate", `${startYear}-04-01`)
                .lte("TransactionDate", `${endYear}-03-31`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching data:", error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        allData.push(...data);

        if (data.length < batchSize) {
            hasMore = false;
        } else {
            from += batchSize;
        }
    }

    console.log(`Fetched ${allData.length} records.`);
    return allData;
}

async function exportToExcel() {
    try {
        const filters = getFilters();

        const allData = await fetchAllFilteredData(filters);

        if (!allData.length) {
            alert("No data found.");
            return;
        }

        await loadExportLibraries();

        const openingBalance = await getOpeningBalance(filters);
        const company = await getCompanyProfile(CompanyID);

        const bankAccountName = filters.bankAccountName || "All Bank Accounts";
        const openingDate = getOpeningBalanceDate(filters);

        const dateRange =
            filters.startDate && filters.endDate
                ? `${formatDate(filters.startDate)} To ${formatDate(filters.endDate)}`
                : filters.financialYear
                    ? `Financial Year : ${filters.financialYear}`
                    : "All Dates";

        const aoa = [];

        //=========================
        // Header
        //=========================

        aoa.push([company?.company_name || ""]);
        aoa.push(["BANK ACCOUNTING LEDGER REPORT"]);
        aoa.push([`Bank Account : ${bankAccount}`]);
        aoa.push([`Period : ${dateRange}`]);
        aoa.push([]);

        //=========================
        // Column Header
        //=========================

        aoa.push([
            "Voucher Date",
            "Voucher Type",
            "Voucher No",
            "Reference No",
            "Debit",
            "Credit"
        ]);

        //=========================
        // Opening Balance
        //=========================

        let totalDebit = Number(openingBalance.debitBalance || 0);
        let totalCredit = Number(openingBalance.creditBalance || 0);

        aoa.push([
            openingDate ? formatDate(openingDate) : "",
            "Opening Balance",
            "",
            "",
            totalDebit,
            totalCredit
        ]);

        //=========================
        // Transactions
        //=========================

        allData.forEach(row => {

            const debit = Number(row.Debit || 0);
            const credit = Number(row.Credit || 0);

            totalDebit += debit;
            totalCredit += credit;

            aoa.push([
                formatDate(row.TransactionDate),
                row.VoucherType || "",
                row.VoucherNo || "",
                row.ReferenceNo || "",
                debit,
                credit
            ]);

        });

        //=========================
        // Summary
        //=========================

        const net = totalCredit - totalDebit;

        const closingDebit = net < 0 ? Math.abs(net) : 0;
        const closingCredit = net > 0 ? net : 0;

        aoa.push([]);

        aoa.push([
            "",
            "",
            "",
            "Total",
            totalDebit,
            totalCredit
        ]);

        aoa.push([
            "",
            "",
            "",
            "Closing Balance",
            closingCredit,
            closingDebit
        ]);

        aoa.push([
            "",
            "",
            "",
            "Grand Total",
            totalDebit + closingCredit,
            totalCredit + closingDebit
        ]);

        //=========================
        // Workbook
        //=========================

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Merge Company Header
        ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }
        ];

        // Column Widths
        ws["!cols"] = [
            { wch: 15 },
            { wch: 30 },
            { wch: 22 },
            { wch: 22 },
            { wch: 18 },
            { wch: 18 }
        ];

        // Apply Number Format
        const range = XLSX.utils.decode_range(ws["!ref"]);

        for (let R = 0; R <= range.e.r; R++) {

            // Debit
            const dCell = XLSX.utils.encode_cell({ r: R, c: 4 });

            if (ws[dCell] && typeof ws[dCell].v === "number") {
                ws[dCell].z = '#,##0.00';
            }

            // Credit
            const cCell = XLSX.utils.encode_cell({ r: R, c: 5 });

            if (ws[cCell] && typeof ws[cCell].v === "number") {
                ws[cCell].z = '#,##0.00';
            }
        }

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            "Account Statement Report"
        );

        XLSX.writeFile(
            wb,
            `AccountingLedger_${new Date().toISOString().slice(0, 10)}.xlsx`
        );

    } catch (err) {

        console.error(err);

        alert("Export failed.");

    }
}

// PDF Export Function with PartyName
async function exportToPdf() {

    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);

    if (!allData.length) {
        alert("No data to export.");
        return;
    }

    await loadPdfLibs();

    const openingBalance = await getOpeningBalance(filters);
    const company = await getCompanyProfile(CompanyID);

    const partyName = filters.customerName || "All Parties";
    const openingDate = getOpeningBalanceDate(filters);

    const dateRange =
        filters.startDate && filters.endDate
            ? `${formatDate(filters.startDate)} To ${formatDate(filters.endDate)}`
            : filters.financialYear
                ? `Financial Year : ${filters.financialYear}`
                : "All Dates";

    const doc = new jspdf.jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const formatAmount = value =>
        Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    // Running totals
    let totalDebit = Number(openingBalance.debitBalance || 0);
    let totalCredit = Number(openingBalance.creditBalance || 0);

    const rows = [];

    // Opening Balance
    rows.push([
        formatDate(openingDate),
        "Opening Balance",
        "",
        "",
        formatAmount(totalDebit),
        formatAmount(totalCredit)
    ]);

    // Ledger Rows
    allData.forEach(row => {

        const debit = Number(row.Debit || 0);
        const credit = Number(row.Credit || 0);

        totalDebit += debit;
        totalCredit += credit;

        rows.push([
            formatDate(row.TransactionDate),
            row.VoucherType || "",
            row.VoucherNo || "",
            row.ReferenceNo || "",
            formatAmount(debit),
            formatAmount(credit)
        ]);

    });

    // Closing Balance
    const net = totalCredit - totalDebit;

    const closingDebit = net < 0 ? Math.abs(net) : 0;
    const closingCredit = net > 0 ? net : 0;

    // Totals
    rows.push([
        "",
        "",
        "",
        "Total",
        formatAmount(totalDebit),
        formatAmount(totalCredit)
    ]);

    rows.push([
        "",
        "",
        "",
        "Closing Balance",
        closingCredit ? formatAmount(closingCredit) : "",
        closingDebit ? formatAmount(closingDebit) : ""
    ]);

    rows.push([
        "",
        "",
        "",
        "Grand Total",
        formatAmount(totalDebit + closingCredit),
        formatAmount(totalCredit + closingDebit)
    ]);

    doc.setFontSize(16);
    doc.text(company.company_name || "", 148, 12, { align: "center" });

    doc.setFontSize(13);
    doc.text("ACCOUNTING LEDGER REPORT", 148, 20, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Party : ${partyName}`, 14, 28);
    doc.text(`Period : ${dateRange}`, 14, 34);

    doc.autoTable({

        startY: 40,

        head: [[
            "Voucher Date",
            "Voucher Type",
            "Voucher No",
            "Reference No",
            "Debit",
            "Credit"
        ]],

        body: rows,

        theme: "grid",

        styles: {
            fontSize: 8,
            cellPadding: 2,
            halign: "left"
        },

        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            halign: "center"
        },

        columnStyles: {
            4: { halign: "right" },
            5: { halign: "right" }
        },

        didParseCell(data) {

            if (
                data.row.index >= rows.length - 3 &&
                data.section === "body"
            ) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [242, 242, 242];
            }

        },

        didDrawPage(data) {

            doc.setFontSize(9);

            doc.text(
                `Page ${doc.internal.getNumberOfPages()}`,
                285,
                200,
                { align: "right" }
            );

        }

    });

    doc.save("AccountingLedger.pdf");

}