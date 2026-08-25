// bankAccountLedger.js
const CompanyID = localStorage.getItem('CompanyID');
let currentPage = 1;
const pageSize = 50;
let sortColumn = null;
let sortOrder = 'asc';

// 1. Cache DOM Elements to avoid repeated lookups
const els = {
    tbody: document.getElementById("ledgerTableBody"),
    totalDebit: document.getElementById("totalDebit"),
    totalCredit: document.getElementById("totalCredit"),
    bankAccountName: document.getElementById("bankAccountName"),
    financialYear: document.getElementById("financialYear"),
    dateRange: document.getElementById("dateRange"),
    searchBtn: document.getElementById("searchBtn"),
    exportExcelBtn: document.getElementById("exportExcelBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    spinner: document.getElementById("loadingSpinner"),
    pagination: document.getElementById("paginationControls"),
    bankAccountList: document.getElementById("bankAccountNameList"),
    financialYearList: document.getElementById("financialYearList")
};

document.addEventListener('DOMContentLoaded', async () => {
    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });

    els.searchBtn.addEventListener('click', () => {
        const bankAccountName = els.bankAccountName.value.trim();
        const financialYear = els.financialYear.value.trim();
        const dateRange = els.dateRange.value.trim();

        if (!bankAccountName) {
            alert("Please select a Bank Account.");
            els.bankAccountName.focus();
            return;
        }

        if (!financialYear && !dateRange) {
            alert("Please select either a Financial Year or a Date Range.");
            els.financialYear.focus();
            return;
        }

        currentPage = 1;
        loadTable(getFilters());
    });

    els.exportExcelBtn.addEventListener('click', exportToExcel);
    els.exportPdfBtn.addEventListener('click', exportToPdf);

    await loadReportSuggestions();
});

// 2. Optimized suggestions loading (Single O(n) pass)
async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('BankTransactionView')
        .select('BankAccountNo, TransactionDate') // Fetch only needed columns
        .eq('company_id', CompanyID);

    if (error) return console.error('Error fetching suggestions:', error);

    const bankAccounts = new Set();
    const financialYears = new Set();

    data.forEach(item => {
        if (item.BankAccountNo) bankAccounts.add(item.BankAccountNo);
        if (item.TransactionDate) {
            const d = new Date(item.TransactionDate);
            // April onwards belongs to current year, Jan-Mar belongs to previous FY
            const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
            financialYears.add(`${startYear}-${startYear + 1}`);
        }
    });

    populateArrayDatalist(Array.from(bankAccounts).sort(), els.bankAccountList);

    // Sort years descending
    const sortedYears = Array.from(financialYears).sort((a, b) => b.localeCompare(a));
    populateArrayDatalist(sortedYears, els.financialYearList);
}

function populateArrayDatalist(array, datalistEl) {
    if (!datalistEl) return;
    datalistEl.innerHTML = array.map(value => `<option value="${value}">`).join('');
}

function getFilters() {
    const filters = {
        bankAccountName: els.bankAccountName?.value.trim(),
        financialYear: els.financialYear?.value.trim(),
        startDate: "",
        endDate: ""
    };

    const dateRange = els.dateRange?.value.trim();
    if (dateRange) {
        const [startDate, endDate] = dateRange.split(" to ");
        filters.startDate = startDate || "";
        filters.endDate = endDate || startDate || "";
    }
    return filters;
}

// 3. Centralized Query Filter Logic
function applyFilters(query, filters) {
    if (filters.bankAccountName) query = query.ilike('BankAccountNo', `%${filters.bankAccountName}%`);
    if (filters.startDate) query = query.gte('TransactionDate', filters.startDate);
    if (filters.endDate) query = query.lte('TransactionDate', filters.endDate);
    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('TransactionDate', `${startYear}-04-01`).lte('TransactionDate', `${endYear}-03-31`);
    }
    return query;
}

function buildBaseQuery(selectStr = '*', options = {}) {
    let query = supabaseClient
        .from('BankTransactionView')
        .select(selectStr, options)
        .eq('company_id', CompanyID);

    // 1. Primary Sort (By Date)
    query = query.order(sortColumn || 'TransactionDate', { ascending: sortOrder === 'asc' });

    // 2. Secondary Sort (The Tie-Breaker)
    // IMPORTANT: Replace 'BankID' with your table's actual unique primary key if it is named differently (e.g., 'id')
    query = query.order('RowCount', { ascending: true });

    return query;
}

async function loadTable(filters = {}) {
    els.spinner.classList.remove("d-none");

    const offset = (currentPage - 1) * pageSize;

    // 1. Fetch standard Opening Balance (prior to date filters)
    const baseOpeningBalancePromise = getOpeningBalance(filters);

    // 2. Fetch all transactions inside the filter, but BEFORE the current page
    const prevPagesPromise = offset > 0
        ? applyFilters(buildBaseQuery('Debit, Credit'), filters).range(0, offset - 1)
        : Promise.resolve({ data: [] });

    // 3. Fetch the actual current page data
    let query = buildBaseQuery('*', { count: 'exact' });
    query = applyFilters(query, filters);
    const pageDataPromise = query.range(offset, offset + pageSize - 1);

    const [baseOb, prevPagesRes, pageRes] = await Promise.all([
        baseOpeningBalancePromise,
        prevPagesPromise,
        pageDataPromise
    ]);

    const { data, error, count } = pageRes;
    els.spinner.classList.add("d-none");

    if (error) return console.error(error);

    // Calculate Brought Forward Balance (Base OB + Previous Pages Net)
    const prevPagesDebit = (prevPagesRes.data || []).reduce((sum, row) => sum + Number(row.Debit || 0), 0);
    const prevPagesCredit = (prevPagesRes.data || []).reduce((sum, row) => sum + Number(row.Credit || 0), 0);

    const totalBfDebit = baseOb.debit + prevPagesDebit;
    const totalBfCredit = baseOb.credit + prevPagesCredit;
    const netBf = totalBfCredit - totalBfDebit;

    const broughtForwardBalance = {
        debit: totalBfDebit,
        credit: totalBfCredit,
        balance: Math.abs(netBf),
        balanceType: netBf < 0 ? "Dr" : netBf > 0 ? "Cr" : "",
        debitBalance: netBf < 0 ? Math.abs(netBf) : 0,
        creditBalance: netBf > 0 ? netBf : 0,
        isBroughtForward: currentPage > 1 // Flag for the UI
    };

    // Pass the Brought Forward balance to the table
    renderTable(data, broughtForwardBalance, filters);

    // Grand totals should still use the base opening balance
    loadGrandTotals(filters, baseOb);
    renderPagination(count, loadTable);
    updateHeaderSortIndicators();
}

function renderTable(data, openingBalance = {}, filters = {}) {
    const openingBalanceValue = Number(openingBalance.balance || 0);
    const openingDate = getOpeningBalanceDate(filters);
    const html = [];

    if (!data?.length) {
        els.tbody.innerHTML = buildOpeningBalanceRow(openingDate, openingBalance, openingBalanceValue) +
            `<tr><td colspan="7" class="text-center py-3">No transactions found.</td></tr>`;
        els.totalDebit.textContent = formatAmount(Number(openingBalance.debitBalance || 0));
        els.totalCredit.textContent = formatAmount(Number(openingBalance.creditBalance || 0));
        return;
    }

    html.push(buildOpeningBalanceRow(openingDate, openingBalance, openingBalanceValue));

    let runningBalance = openingBalance.balanceType === "Dr" ? -openingBalanceValue : openingBalanceValue;

    // 4. Use Array push instead of string concatenation for performance
    data.forEach((row, index) => {
        const debit = Number(row.Debit) || 0;
        const credit = Number(row.Credit) || 0;
        runningBalance += credit - debit;

        const balanceAmount = Math.abs(runningBalance);
        const balanceType = runningBalance < 0 ? "Dr" : runningBalance > 0 ? "Cr" : "";

        html.push(`
        <tr>
            <td class="text-center">${((currentPage - 1) * pageSize) + index + 1}</td>
            <td>${formatDate(row.TransactionDate)}</td>
            <td>${row.Narration || ""}</td>
            <td>${row.ReferenceNo || ""}</td>
            <td class="text-end">${debit ? formatAmount(debit) : ""}</td>
            <td class="text-end">${credit ? formatAmount(credit) : ""}</td>
            <td class="text-end fw-bold ${balanceType === 'Dr' ? 'text-danger' : 'text-success'}">
                ${balanceAmount ? `${formatAmount(balanceAmount)} ${balanceType}` : "0.00"}
            </td>
        </tr>`);
    });

    els.tbody.innerHTML = html.join('');
}

function buildOpeningBalanceRow(openingDate, ob, obValue) {
    const label = ob.isBroughtForward ? "Brought Forward" : "Opening Balance";
    const displayDate = ob.isBroughtForward ? "" : (openingDate ? formatDate(openingDate) : "");

    return `
    <tr class="table-warning fw-bold">
        <td class="text-center">-</td>
        <td>${displayDate}</td>
        <td>${label}</td>
        <td></td>
        <td class="text-end">${ob.balanceType === "Dr" ? formatAmount(obValue) : ""}</td>
        <td class="text-end">${ob.balanceType === "Cr" ? formatAmount(obValue) : ""}</td>
        <td class="text-end fw-bold ${ob.balanceType === 'Dr' ? 'text-danger' : 'text-success'}">
            ${obValue ? `${formatAmount(obValue)} ${ob.balanceType}` : "0.00"}
        </td>
    </tr>`;
}

async function getOpeningBalance(filters = {}) {
    let query = supabaseClient.from("BankTransactionView").select("Debit,Credit").eq("company_id", CompanyID);

    if (filters.bankAccountName) query = query.ilike("BankAccountNo", `%${filters.bankAccountName}%`);

    const openingDate = getOpeningBalanceDate(filters);
    if (openingDate) query = query.lt("TransactionDate", openingDate);

    const { data, error } = await query;

    if (error) {
        console.error("Opening Balance Error:", error);
        return { debit: 0, credit: 0, balance: 0, balanceType: "", debitBalance: 0, creditBalance: 0 };
    }

    const debit = data.reduce((sum, row) => sum + Number(row.Debit || 0), 0);
    const credit = data.reduce((sum, row) => sum + Number(row.Credit || 0), 0);
    const net = credit - debit;

    return {
        debit, credit,
        balance: Math.abs(net),
        balanceType: net < 0 ? "Dr" : net > 0 ? "Cr" : "",
        debitBalance: net < 0 ? Math.abs(net) : 0,
        creditBalance: net > 0 ? net : 0
    };
}

function getOpeningBalanceDate(filters = {}) {
    if (filters.startDate) {
        const d = new Date(filters.startDate);
        d.setDate(d.getDate() - 1);
        return d.toISOString().split("T")[0];
    }
    if (filters.financialYear) {
        const [startYear] = filters.financialYear.split("-").map(Number);
        const d = new Date(startYear, 3, 1);
        d.setDate(d.getDate() - 1);
        return d.toISOString().split("T")[0];
    }
    return "";
}

function renderPagination(totalCount, loadTableFn) {
    const totalPages = Math.ceil(totalCount / pageSize);
    els.pagination.innerHTML = '';
    const maxVisiblePages = 5;

    const createBtn = (label, disabled, onClick) => {
        const li = document.createElement('li');
        li.className = `page-item ${disabled ? 'disabled' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${label}</a>`;
        if (!disabled) {
            li.addEventListener('click', (e) => {
                e.preventDefault();
                onClick();
            });
        }
        return li;
    };

    els.pagination.appendChild(createBtn('Previous', currentPage === 1, () => {
        currentPage--;
        loadTableFn(getFilters());
    }));

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    startPage = Math.max(1, endPage - maxVisiblePages + 1);

    const addDots = () => els.pagination.insertAdjacentHTML('beforeend', `<li class="page-item disabled"><span class="page-link">...</span></li>`);

    if (startPage > 1) {
        els.pagination.appendChild(createBtn(1, false, () => { currentPage = 1; loadTableFn(getFilters()); }));
        if (startPage > 2) addDots();
    }

    for (let i = startPage; i <= endPage; i++) {
        const li = createBtn(i, false, () => { currentPage = i; loadTableFn(getFilters()); });
        if (i === currentPage) li.classList.add('active');
        els.pagination.appendChild(li);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) addDots();
        els.pagination.appendChild(createBtn(totalPages, false, () => { currentPage = totalPages; loadTableFn(getFilters()); }));
    }

    els.pagination.appendChild(createBtn('Next', currentPage === totalPages, () => {
        currentPage++;
        loadTableFn(getFilters());
    }));
}

async function loadGrandTotals(filters = {}, openingBalance = {}) {
    // Pass the specific columns needed
    let query = applyFilters(buildBaseQuery("Debit, Credit"), filters);
    const { data, error } = await query;

    if (error) return console.error(error);

    const { totalDebit, totalCredit } = data.reduce((totals, row) => {
        totals.totalDebit += Number(row.Debit || 0);
        totals.totalCredit += Number(row.Credit || 0);
        return totals;
    }, {
        totalDebit: Number(openingBalance.debitBalance || 0),
        totalCredit: Number(openingBalance.creditBalance || 0)
    });

    els.totalDebit.textContent = formatAmount(totalDebit);
    els.totalCredit.textContent = formatAmount(totalCredit);
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
        // Pass "*" to select everything for the export
        let query = applyFilters(buildBaseQuery("*"), filters).range(from, from + batchSize - 1);
        const { data, error } = await query;

        if (error) {
            console.error("Error fetching data:", error);
            break;
        }
        if (!data || data.length === 0) break;

        allData.push(...data);
        if (data.length < batchSize) hasMore = false;
        else from += batchSize;
    }
    return allData;
}

async function exportToExcel() {
    try {
        const filters = getFilters();
        const allData = await fetchAllFilteredData(filters);
        if (!allData.length) return alert("No data found.");

        await loadExportLibraries();

        const openingBalance = await getOpeningBalance(filters);
        const company = await getCompanyProfile(CompanyID);

        const bankAccountName = filters.bankAccountName || "All Bank Accounts"; // BUG FIX
        const openingDate = getOpeningBalanceDate(filters);
        const dateRange = filters.startDate && filters.endDate
            ? `${formatDate(filters.startDate)} To ${formatDate(filters.endDate)}`
            : filters.financialYear ? `Financial Year : ${filters.financialYear}` : "All Dates";

        const aoa = [
            [company?.company_name || ""],
            ["BANK ACCOUNTING LEDGER REPORT"],
            [`Bank Account : ${bankAccountName}`], // BUG FIX: Was bankAccount
            [`Period : ${dateRange}`],
            [],
            ["Voucher Date", "Voucher Type", "Voucher No", "Reference No", "Debit", "Credit"]
        ];

        let totalDebit = Number(openingBalance.debitBalance || 0);
        let totalCredit = Number(openingBalance.creditBalance || 0);

        aoa.push([openingDate ? formatDate(openingDate) : "", "Opening Balance", "", "", totalDebit, totalCredit]);

        allData.forEach(row => {
            const debit = Number(row.Debit || 0);
            const credit = Number(row.Credit || 0);
            totalDebit += debit;
            totalCredit += credit;
            aoa.push([formatDate(row.TransactionDate), row.VoucherType || "", row.VoucherNo || "", row.ReferenceNo || "", debit, credit]);
        });

        const net = totalCredit - totalDebit;
        const closingDebit = net < 0 ? Math.abs(net) : 0;
        const closingCredit = net > 0 ? net : 0;

        aoa.push(
            [],
            ["", "", "", "Total", totalDebit, totalCredit],
            ["", "", "", "Closing Balance", closingCredit, closingDebit],
            ["", "", "", "Grand Total", totalDebit + closingCredit, totalCredit + closingDebit]
        );

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }
        ];
        ws["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];

        const range = XLSX.utils.decode_range(ws["!ref"]);
        for (let R = 0; R <= range.e.r; R++) {
            [4, 5].forEach(C => {
                const cell = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[cell] && typeof ws[cell].v === "number") ws[cell].z = '#,##0.00';
            });
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Account Statement Report");
        XLSX.writeFile(wb, `AccountingLedger_${new Date().toISOString().slice(0, 10)}.xlsx`);

    } catch (err) {
        console.error(err);
        alert("Export failed.");
    }
}

async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    if (!allData.length) return alert("No data to export.");

    await loadPdfLibs();

    const openingBalance = await getOpeningBalance(filters);
    const company = await getCompanyProfile(CompanyID);

    const bankAccountName = filters.bankAccountName || "All Accounts"; // BUG FIX: Was filters.customerName
    const openingDate = getOpeningBalanceDate(filters);
    const dateRange = filters.startDate && filters.endDate
        ? `${formatDate(filters.startDate)} To ${formatDate(filters.endDate)}`
        : filters.financialYear ? `Financial Year : ${filters.financialYear}` : "All Dates";

    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const localFormatAmount = val => Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let totalDebit = Number(openingBalance.debitBalance || 0);
    let totalCredit = Number(openingBalance.creditBalance || 0);

    const rows = [
        [formatDate(openingDate), "Opening Balance", "", "", localFormatAmount(totalDebit), localFormatAmount(totalCredit)]
    ];

    allData.forEach(row => {
        const debit = Number(row.Debit || 0);
        const credit = Number(row.Credit || 0);
        totalDebit += debit;
        totalCredit += credit;
        rows.push([formatDate(row.TransactionDate), row.VoucherType || "", row.VoucherNo || "", row.ReferenceNo || "", localFormatAmount(debit), localFormatAmount(credit)]);
    });

    const net = totalCredit - totalDebit;
    const closingDebit = net < 0 ? Math.abs(net) : 0;
    const closingCredit = net > 0 ? net : 0;

    rows.push(
        ["", "", "", "Total", localFormatAmount(totalDebit), localFormatAmount(totalCredit)],
        ["", "", "", "Closing Balance", closingCredit ? localFormatAmount(closingCredit) : "", closingDebit ? localFormatAmount(closingDebit) : ""],
        ["", "", "", "Grand Total", localFormatAmount(totalDebit + closingCredit), localFormatAmount(totalCredit + closingDebit)]
    );

    doc.setFontSize(16);
    doc.text(company.company_name || "", 148, 12, { align: "center" });
    doc.setFontSize(13);
    doc.text("ACCOUNTING LEDGER REPORT", 148, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Account : ${bankAccountName}`, 14, 28);
    doc.text(`Period : ${dateRange}`, 14, 34);

    doc.autoTable({
        startY: 40,
        head: [["Voucher Date", "Voucher Type", "Voucher No", "Reference No", "Debit", "Credit"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, halign: "left" },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: "center" },
        columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
        didParseCell(data) {
            if (data.row.index >= rows.length - 3 && data.section === "body") {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [242, 242, 242];
            }
        },
        didDrawPage() {
            doc.setFontSize(9);
            doc.text(`Page ${doc.internal.getNumberOfPages()}`, 285, 200, { align: "right" });
        }
    });

    doc.save("AccountingLedger.pdf");
}