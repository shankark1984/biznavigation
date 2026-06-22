let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';
let partyNameCache = {};

document.addEventListener('DOMContentLoaded', async () => {

    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });

    document.getElementById("searchBtn").addEventListener("click", async () => {
        currentPage = 1;

        await loadTable(getFilters());

        const filterSection = document.getElementById("filterSection");
        bootstrap.Collapse.getOrCreateInstance(filterSection).hide();
    });

    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    setDefaultDateRange();

    await loadReportSuggestions();
    await loadTable(getFilters());

    enableSortableHeaders();
});

function setDefaultDateRange() {
    const dateRangeInput = document.getElementById("dateRange");
    if (!dateRangeInput) return;

    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);

    const formatDate = (date) => {
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
    };

    const startDate = formatDate(twoMonthsAgo);
    const endDate = formatDate(today);

    // Set flatpickr input value
    dateRangeInput.value = `${startDate} to ${endDate}`;
}

function getFilters() {
    const filters = {
        billReferenceNo: document.getElementById("billReferenceNo")?.value.trim() || "",
        vendorName: document.getElementById("vendorName")?.value.trim() || "",
        expenseType: document.getElementById("expenseType")?.value.trim() || "",
        expenseFor: document.getElementById("expenseFor")?.value.trim() || "",
        billNo: document.getElementById("billNo")?.value.trim() || "",
        billingMonth: document.getElementById("billingMonth")?.value || "",
        billingYear: document.getElementById("billingYear")?.value.trim() || "",
        financialYear: document.getElementById("financialYear")?.value.trim() || "",
        paymentStatus: document.getElementById("paymentStatus")?.value.trim() || ""
    };

    const dateRange = document.getElementById("dateRange")?.value.trim();
    if (dateRange) {
        const [startDate, endDate] = dateRange.split(" to ");
        filters.startDate = startDate || "";
        filters.endDate = endDate || startDate || "";
    } else {
        filters.startDate = "";
        filters.endDate = "";
    }

    return filters;
}

function enableSortableHeaders() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-key');
            if (sortColumn === key) {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = key;
                sortOrder = 'asc';
            }
            loadTable(getFilters());
        });
    });
}

let reportSuggestionData = [];

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('VendorBillPaymentView')
        .select('BillReferenceNo,AccountedDate,ExpenseType,ExpenseFor, PartyCode, PartyName,BillNo, PaymentStatus')
        .eq('company_id', CompanyID);

    if (error) return console.error('Error fetching suggestions:', error);

    reportSuggestionData = data || [];

    populateDatalists(reportSuggestionData, 'BillReferenceNo', 'billReferenceNoList');
    populateDatalists(reportSuggestionData, 'BillNo', 'billNoList');
    populateDatalists(reportSuggestionData, 'ExpenseType', 'expenseTypeList');
    populateDatalists(reportSuggestionData, 'ExpenseFor', 'expenseForList');
    populateDatalists(reportSuggestionData, 'PartyName', 'vendorNameList');
    populateDatalists(reportSuggestionData, 'PaymentStatus', 'paymentStatusList');

    const financialYears = [...new Set(reportSuggestionData
        .map(item => item.AccountedDate)
        .filter(Boolean)
        .map(date => {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        })
    )].sort();

    populateArrayDatalist(financialYears, 'financialYearList');

    attachSuggestionFilters();
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

function attachSuggestionFilters() {
    attachDatalistFilter('billReferenceNo', 'billReferenceNoList', 'BillReferenceNo');
    attachDatalistFilter('vendorName', 'vendorNameList', 'PartyName');
    attachDatalistFilter('expenseType', 'expenseTypeList', 'ExpenseType');
    attachDatalistFilter('expenseFor', 'expenseForList', 'ExpenseFor');
    attachDatalistFilter('billNo', 'billNoList', 'BillNo');
    attachDatalistFilter('paymentStatus', 'paymentStatusList', 'PaymentStatus');
}

function attachDatalistFilter(inputId, datalistId, field) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);

    if (!input || !datalist) return;

    input.addEventListener('input', function () {
        let searchText = this.value.trim().toLowerCase();

        // optional: remove % if user types Shar%
        searchText = searchText.replace(/%/g, '');

        const matchedValues = [...new Set(
            reportSuggestionData
                .map(item => item[field])
                .filter(Boolean)
                .filter(value => value.toLowerCase().startsWith(searchText))
        )].sort((a, b) => a.localeCompare(b));

        datalist.innerHTML = matchedValues
            .slice(0, 50) // limit suggestions
            .map(value => `<option value="${value}">`)
            .join('');
    });
}

function populateArrayDatalist(array, datalistId) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = array.map(value => `<option value="${value}">`).join('');
}

async function loadTable(filters = {}) {
    const spinner = document.getElementById('loadingSpinner');
    const tbody = document.querySelector('#bookingTable tbody');

    spinner.style.display = 'block';

    // Show processing message in table
    tbody.innerHTML = `
        <tr>
            <td colspan="18" class="text-center text-primary fw-bold py-4">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Processing data, please wait...
            </td>
        </tr>
    `;

    try {
        let pageQuery = buildQuery(filters);

        if (sortColumn) {
            pageQuery = pageQuery.order(sortColumn, { ascending: sortOrder === 'asc' });
        }

        const from = (currentPage - 1) * pageSize;
        const to = currentPage * pageSize - 1;

        const { data: pageData, error: pageError, count } = await pageQuery.range(from, to);

        if (pageError) {
            console.error('Error loading table:', pageError);
            tbody.innerHTML = `
                <tr>
                    <td colspan="18" class="text-center text-danger py-4">
                        Failed to load data
                    </td>
                </tr>
            `;
            return;
        }

        let totalQuery = buildQuery(filters);

        if (sortColumn) {
            totalQuery = totalQuery.order(sortColumn, { ascending: sortOrder === 'asc' });
        }

        const cumulativeTo = currentPage * pageSize - 1;

        const { data: cumulativeData, error: totalError } = await totalQuery.range(0, cumulativeTo);

        if (totalError) {
            console.error('Error loading cumulative totals:', totalError);
        }

        await renderTable(pageData || []);
        updateCumulativeTotals(cumulativeData || []);
        renderPagination(count || 0, loadTable);
        updateHeaderSortIndicators();

    } catch (err) {
        console.error("Unexpected loadTable error:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="18" class="text-center text-danger py-4">
                    Something went wrong while loading data
                </td>
            </tr>
        `;
    } finally {
        spinner.style.display = 'none';
    }
}

function buildQuery(filters = {}) {
    let query = supabaseClient
        .from('VendorBillPaymentView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID)
        .order('BillReferenceNo', { ascending: false });

    // text filters
    if (filters.billReferenceNo) {
        query = query.ilike('BillReferenceNo', `%${filters.billReferenceNo}%`);
    }

    if (filters.vendorName) {
        query = query.ilike('PartyName', `%${filters.vendorName}%`);
    }

    if (filters.billNo) {
        query = query.ilike('BillNo', `%${filters.billNo}%`);
    }

    if (filters.expenseType) {
        query = query.ilike('ExpenseType', `%${filters.expenseType}%`);
    }

    if (filters.expenseFor) {
        query = query.ilike('ExpenseFor', `%${filters.expenseFor}%`);
    }

    if (filters.paymentStatus) {
        query = query.ilike('PaymentStatus', `%${filters.paymentStatus}%`);
    }

    const hasExplicitDateFilter =
        !!filters.startDate ||
        !!filters.endDate ||
        !!filters.billingMonth ||
        !!filters.billingYear ||
        !!filters.financialYear;

    const onlyVendorNameSelected =
        !!filters.vendorName &&
        !filters.billReferenceNo &&
        !filters.billNo &&
        !filters.expenseType &&
        !filters.expenseFor &&
        !filters.paymentStatus &&
        !hasExplicitDateFilter;

    // only vendor selected => current FY
    if (onlyVendorNameSelected) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        let fyStartYear, fyEndYear;

        if (currentMonth >= 4) {
            fyStartYear = currentYear;
            fyEndYear = currentYear + 1;
        } else {
            fyStartYear = currentYear - 1;
            fyEndYear = currentYear;
        }

        query = query
            .gte('AccountedDate', `${fyStartYear}-04-01`)
            .lte('AccountedDate', `${fyEndYear}-03-31`);

        return query;
    }

    // financial year
    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);

        if (!isNaN(startYear) && !isNaN(endYear)) {
            query = query
                .gte('AccountedDate', `${startYear}-04-01`)
                .lte('AccountedDate', `${endYear}-03-31`);
        }
        return query;
    }

    // year
    if (filters.billingYear) {
        const year = parseInt(filters.billingYear, 10);

        if (!isNaN(year)) {
            query = query
                .gte('AccountedDate', `${year}-01-01`)
                .lte('AccountedDate', `${year}-12-31`);
        }
        return query;
    }

    // month
    if (filters.billingMonth) {
        const [yearStr, monthStr] = filters.billingMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];

            query = query
                .gte('AccountedDate', start)
                .lte('AccountedDate', end);
        }
        return query;
    }

    // date range
    if (filters.startDate || filters.endDate) {
        if (filters.startDate) {
            query = query.gte('AccountedDate', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('AccountedDate', filters.endDate);
        }

        return query;
    }

    // default last 2 months
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);

    query = query
        .gte('AccountedDate', twoMonthsAgo.toISOString().split('T')[0])
        .lte('AccountedDate', today.toISOString().split('T')[0]);

    return query;
}

function updateHeaderSortIndicators() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        th.textContent = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
        if (key === sortColumn) {
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

async function renderTable(data) {
    const tbody = document.querySelector('#bookingTable tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="18" class="text-center text-muted">No records found</td>
            </tr>
        `;
        return;
    }

    for (let idx = 0; idx < data.length; idx++) {
        const row = data[idx];
        const tr = document.createElement("tr");

        let partyName = '';
        if (row.PartyCode) {
            if (partyNameCache[row.PartyCode]) {
                partyName = partyNameCache[row.PartyCode];
            } else {
                const details = await getPartyDetailsByCode(row.PartyCode);
                if (details?.PartyName) {
                    partyName = details.PartyName;
                    partyNameCache[row.PartyCode] = partyName;
                }
            }
        }
        tr.innerHTML = `
            <td>${(currentPage - 1) * pageSize + idx + 1}</td>
            <td>${row.BillReferenceNo || ''}</td>
            <td>${formatDate(row.AccountedDate) || ''}</td>
            <td>${row.ExpenseType || ''}</td>
            <td>${row.ExpenseFor || ''}</td>
            <td>${row.PartyName || ''}</td>
            <td>${row.BillNo || ''}</td>
            <td>${row.BillDate || ''}</td>
            <td class="text-end">${formatAmount(row.NonTaxableAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.TaxableAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.CGSTAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.SGSTAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.IGSTAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.TotalGSTAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.TotalAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.PaymentAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.OtherDeductionAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.TDSDeductionAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.PaymentTotalAmount || '0')}</td>
            <td class="text-end">${formatAmount(row.BalanceAmount || '0')}</td>
            <td>${row.PaymentStatus || ''}</td>
        `;
        tbody.appendChild(tr);
    }
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

async function exportToExcel() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    if (allData.length === 0) return alert('No data to export.');

    let tableHtml = `<table><thead><tr>
        <th>Sr No</th><th>Bill Reference No</th><th>Accounted Date</th><th>Expense Type</th><th>Expense For</th>
        <th>Vendor Name</th><th>Non-Taxable Amount/th><th>Taxable Amount</th><th>CGST Amount</th><th>SGST Amount</th>
        <th>IGST Amount</th><th>Total GST Amount</th><th>Grand Total Amount</th><th>Collected Amount</th>
        <th>Other Deduction Amount</th><th>TDS Deduction Amount</th><th>Total Payment Amount</th>
        <th>Balance Amount</th><th>Payment Status</th></tr></thead><tbody>`;

    for (let i = 0; i < allData.length; i++) {
        const row = allData[i];

        tableHtml += `<tr>
            <td>${i + 1}</td>
            <td>${row.BillReferenceNo || ''}</td>
            <td>${row.AccountedDate || ''}</td>
            <td>${row.ExpenseType || ''}</td>
            <td>${row.ExpenseFor}</td>
            <td>${row.PartyName}</td>
            td>${row.BillNo || ''}</td>
            <td>${row.BillDate || ''}</td>
            td>${row.DueDate || '0'}</td>
            <td>${row.NonTaxableAmount || '0'}</td>
            <td>${row.TaxableAmount || '0'}</td>
            <td>${row.CGSTAmount || '0'}</td>
            <td>${row.SGSTAmount || '0'}</td>
            <td>${row.IGSTAmount || '0'}</td>
            <td>${row.TotalGSTAmount || '0'}</td>
            <td>${row.TotalAmount || '0'}</td>
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
    const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: "Vendor Billing" });
    XLSX.writeFile(wb, 'vendorBilling.xlsx');
}

// PDF Export Function with PartyName
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
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

async function fetchAllFilteredData(filters = {}) {
    let allData = [], batchSize = 1000, from = 0, to = batchSize - 1, hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from('VendorBillPaymentView')
            .select('*')
            .eq('company_id', CompanyID)
            .order('BillReferenceNo', { ascending: true });

        if (filters.billReferenceNo) query = query.ilike('BillReferenceNo', `%${filters.billReferenceNo}%`);
        if (filters.vendorName) query = query.ilike('PartyName', filters.vendorName);
        if (filters.billNo) query = query.ilike('BillNo', filters.billNo);
        if (filters.expenseType) query = query.ilike('ExpenseType', filters.expenseType);
        if (filters.expenseFor) query = query.ilike('ExpenseFor', filters.expenseFor);
        if (filters.paymentStatus) query = query.ilike('PaymentStatus', filters.paymentStatus);
        if (filters.startDate) query = query.gte('AccountedDate', filters.startDate);
        if (filters.endDate) query = query.lte('AccountedDate', filters.endDate);
        //Month filters
        if (filters.billingMonth) {
            let [monthStr, yearStr] = filters.billingMonth.split('-');
            // Fallback if format is "YYYY-MM"
            if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

            const month = parseInt(monthStr);
            const year = parseInt(yearStr);

            if (!isNaN(year) && !isNaN(month)) {
                const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const end = new Date(year, month, 0).toISOString().split('T')[0];
                query = query.gte('AccountedDate', start).lte('AccountedDate', end);
            }
        }
        //Year filters
        // Else fallback to full year range if only invoiceYear is set
        if (!filters.billingMonth && filters.billingYear) {
            const year = parseInt(filters.billingYear);
            if (!isNaN(year)) {
                const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
                const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
                query = query.gte('AccountedDate', start).lte('AccountedDate', end);
            }
        }

        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split('-').map(Number);
            query = query.gte('AccountedDate', `${startYear}-04-01`).lte('AccountedDate', `${endYear}-03-31`);
        }

        const { data, error } = await query.range(from, to);
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

    return allData;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    return parseFloat(String(value).replace(/,/g, "")) || 0;
}

function formatAmount(value) {
    return toNumber(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function updateCumulativeTotals(allData) {
    const totals = {
        NonTaxableAmount: 0,
        TaxableAmount: 0,
        CGSTAmount: 0,
        SGSTAmount: 0,
        IGSTAmount: 0,
        TotalGSTAmount: 0,
        TotalAmount: 0,
        PaymentAmount: 0,
        OtherDeductionAmount: 0,
        TDSDeductionAmount: 0,
        PaymentTotalAmount: 0,
        BalanceAmount: 0
    };

    const toNumber = (val) => parseFloat(val || 0) || 0;

    // page 1 to current page rows count
    const endIndex = currentPage * pageSize;

    const cumulativeRows = allData.slice(0, endIndex);

    cumulativeRows.forEach(row => {
        totals.NonTaxableAmount += toNumber(row.NonTaxableAmount);
        totals.TaxableAmount += toNumber(row.TaxableAmount);
        totals.CGSTAmount += toNumber(row.CGSTAmount);
        totals.SGSTAmount += toNumber(row.SGSTAmount);
        totals.IGSTAmount += toNumber(row.IGSTAmount);
        totals.TotalGSTAmount += toNumber(row.TotalGSTAmount);
        totals.TotalAmount += toNumber(row.TotalAmount);
        totals.PaymentAmount += toNumber(row.PaymentAmount);
        totals.OtherDeductionAmount += toNumber(row.OtherDeductionAmount);
        totals.TDSDeductionAmount += toNumber(row.TDSDeductionAmount);
        totals.PaymentTotalAmount += toNumber(row.PaymentTotalAmount);
        totals.BalanceAmount += toNumber(row.BalanceAmount);
    });

    document.getElementById("totalNonTaxableAmount").textContent = formatAmount(totals.NonTaxableAmount);
    document.getElementById("totalTaxableAmount").textContent = formatAmount(totals.TaxableAmount);
    document.getElementById("totalCGSTAmount").textContent = formatAmount(totals.CGSTAmount);
    document.getElementById("totalSGSTAmount").textContent = formatAmount(totals.SGSTAmount);
    document.getElementById("totalIGSTAmount").textContent = formatAmount(totals.IGSTAmount);
    document.getElementById("totalGSTAmount").textContent = formatAmount(totals.TotalGSTAmount);
    document.getElementById("totalGrandTotal").textContent = formatAmount(totals.TotalAmount);
    document.getElementById("totalCollected").textContent = formatAmount(totals.PaymentAmount);
    document.getElementById("totalOtherDeduction").textContent = formatAmount(totals.OtherDeductionAmount);
    document.getElementById("totalTDSDeduction").textContent = formatAmount(totals.TDSDeductionAmount);
    document.getElementById("totalPayment").textContent = formatAmount(totals.PaymentTotalAmount);
    document.getElementById("totalBalance").textContent = formatAmount(totals.BalanceAmount);
}

