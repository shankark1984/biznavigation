let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';
let partyNameCache = {};

document.addEventListener('DOMContentLoaded', async () => {

    flatpickr("#dateRange", { mode: "range", dateFormat: "Y-m-d" });

    document.getElementById('searchBtn').addEventListener('click', () => {
        currentPage = 1;
        loadTable(getFilters());
    });

    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    await loadReportSuggestions();
    await loadTable();

    enableSortableHeaders();
});

function getFilters() {
    let dateRange = document.getElementById('dateRange').value.split(' to ');
    return {
        invoiceNo: document.getElementById('invoiceNo').value.trim(),
        startDate: dateRange[0]?.trim() || null,
        endDate: dateRange[1]?.trim() || null,
        customerName: document.getElementById('customerName').value.trim(),
        invoiceType: document.getElementById('invoiceType').value.trim(),
        invoiceMonth: document.getElementById('invoiceMonth').value.trim(),
        invoiceYear: document.getElementById('invoiceYear').value.trim(),
        financialYear: document.getElementById('financialYear').value.trim(),
        paymentStatus: document.getElementById('paymentStatus').value.trim(),
    };
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

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('InvoicePaymentView')
        .select('InvoiceNo, PartyCode, PartyName, InvoiceType, PaymentStatus, InvoiceDate');

    if (error) return console.error('Error fetching suggestions:', error);

    populateDatalists(data, 'InvoiceNo', 'invoiceNoList');
    populateDatalists(data, 'PartyName', 'customerNameList');
    populateDatalists(data, 'InvoiceType', 'invoiceTypeList');
    populateDatalists(data, 'PaymentStatus', 'paymentStatusList');

    const financialYears = [...new Set(data.map(item => {
        const year = new Date(item.InvoiceDate).getFullYear();
        return `${year}-${year + 1}`;
    }))];

    populateArrayDatalist(financialYears, 'financialYearList');
}

function populateDatalists(data, field, datalistId) {
    const uniqueValues = [...new Set(data.map(item => item[field]).filter(Boolean))];
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = uniqueValues.map(value => `<option value="${value}">`).join('');
}

function populateArrayDatalist(array, datalistId) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = array.map(value => `<option value="${value}">`).join('');
}

async function loadTable(filters = {}) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = 'block';

    let query = buildQuery(filters);

    if (sortColumn) {
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
    }

    const { data, error, count } = await query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    spinner.style.display = 'none';
    if (error) return console.error('Error loading table:', error);

    renderTable(data);
    renderPagination(count, loadTable);
    updateHeaderSortIndicators();
}

function buildQuery(filters = {}) {
    let query = supabaseClient
        .from('InvoicePaymentView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (filters.invoiceNo) query = query.ilike('InvoiceNo', `%${filters.invoiceNo}%`);
    if (filters.customerName) query = query.ilike('PartyName', filters.customerName);
    if (filters.invoiceType) query = query.ilike('InvoiceType', filters.invoiceType);
    if (filters.paymentStatus) query = query.ilike('PaymentStatus', filters.paymentStatus);
    if (filters.startDate) query = query.gte('InvoiceDate', filters.startDate);
    if (filters.endDate) query = query.lte('InvoiceDate', filters.endDate);
    //Month filters
    if (filters.invoiceMonth) {
        let [monthStr, yearStr] = filters.invoiceMonth.split('-');
        // Fallback if format is "YYYY-MM"
        if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('InvoiceDate', start).lte('InvoiceDate', end);
        }
    }
    //Year filters
    // Else fallback to full year range if only invoiceYear is set
    if (!filters.invoiceMonth && filters.invoiceYear) {
        const year = parseInt(filters.invoiceYear);
        if (!isNaN(year)) {
            const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
            const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
            query = query.gte('InvoiceDate', start).lte('InvoiceDate', end);
        }
    }

    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('InvoiceDate', `${startYear}-04-01`).lte('InvoiceDate', `${endYear}-03-31`);
    }

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
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.InvoiceDate || ''}</td>
            <td>${row.InvoiceType || ''}</td>
            <td>${partyName || ''}</td>
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
        `;

        tbody.appendChild(tr);
    }
}

function renderPagination(totalCount, loadTableFn) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = document.getElementById('paginationControls');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', () => {
            currentPage = i;
            loadTableFn(getFilters());
        });
        pagination.appendChild(li);
    }
}

async function exportToExcel() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
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
            .from('InvoicePaymentView')
            .select('*')
            .eq('company_id', CompanyID);

        if (filters.invoiceNo) query = query.ilike('InvoiceNo', `%${filters.invoiceNo}%`);
        if (filters.customerName) query = query.ilike('PartyName', filters.customerName);
        if (filters.invoiceType) query = query.ilike('InvoiceType', filters.invoiceType);
        if (filters.paymentStatus) query = query.ilike('PaymentStatus', filters.paymentStatus);
        if (filters.startDate) query = query.gte('InvoiceDate', filters.startDate);
        if (filters.endDate) query = query.lte('InvoiceDate', filters.endDate);
        //Month filters
        if (filters.invoiceMonth) {
            let [monthStr, yearStr] = filters.invoiceMonth.split('-');
            // Fallback if format is "YYYY-MM"
            if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

            const month = parseInt(monthStr);
            const year = parseInt(yearStr);

            if (!isNaN(year) && !isNaN(month)) {
                const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const end = new Date(year, month, 0).toISOString().split('T')[0];
                query = query.gte('InvoiceDate', start).lte('InvoiceDate', end);
            }
        }
        //Year filters
        // Else fallback to full year range if only invoiceYear is set
        if (!filters.invoiceMonth && filters.invoiceYear) {
            const year = parseInt(filters.invoiceYear);
            if (!isNaN(year)) {
                const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
                const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
                query = query.gte('InvoiceDate', start).lte('InvoiceDate', end);
            }
        }

        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split('-').map(Number);
            query = query.gte('InvoiceDate', `${startYear}-04-01`).lte('InvoiceDate', `${endYear}-03-31`);
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