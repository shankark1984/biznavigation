let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');
let sortColumn = null;
let sortOrder = 'asc';

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
        JobID: document.getElementById('jobNo').value.trim(),
        bLAWBNo: document.getElementById('bLAWBNo').value.trim(),
        bENo: document.getElementById('bENo').value.trim(),
        startDate: dateRange[0]?.trim() || null,
        endDate: dateRange[1]?.trim() || null,
        customerName: document.getElementById('customerName').value.trim(),
        movementType: document.getElementById('movementType').value.trim(),
        modeType: document.getElementById('modeType').value.trim(),
        bookedMonth: document.getElementById('bookedMonth').value.trim(),
        bookedYear: document.getElementById('bookedYear').value.trim(),
        financialYear: document.getElementById('financialYear').value.trim(),
        invoiceStatus: document.getElementById('invoiceStatus').value.trim(),
        customsBroker: document.getElementById('customsBroker').value.trim(),
        transitType: document.getElementById('transitType').value.trim(),
        clearanceCountry: document.getElementById('clearanceCountry').value.trim(),
        clearancePort: document.getElementById('clearancePort').value.trim(),
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
        .from('CustomsClearanceView')
        .select('JobID, PartyName, BLAWBNo, BENo, MovementType, TransitType, ModeType, Origin, Destination, ClearancePort, CustomsBroker, InvoiceStatus, JobDate');

    if (error) return console.error('Error fetching suggestions:', error);

    populateDatalists(data, 'JobID', 'jobNoList');
    populateDatalists(data, 'BLAWBNo', 'bLAWBNoList');
    populateDatalists(data, 'BENo', 'bENoList');
    populateDatalists(data, 'CustomerName', 'customerNameList');
    populateDatalists(data, 'MovementType', 'movementTypeList');
    populateDatalists(data, 'TransitType', 'transitTypeList');
    populateDatalists(data, 'ModeType', 'modeTypeList');
    populateDatalists(data, 'Origin', 'originList');
    populateDatalists(data, 'Destination', 'destinationList');
    populateDatalists(data, 'ClearancePort', 'clearancePortList');
    populateDatalists(data, 'InvoiceStatus', 'invoiceStatusList');
    populateDatalists(data, 'CustomsBroker', 'customsBrokerList');

    const financialYears = [...new Set(data.map(item => {
        const year = new Date(item.JobDate).getFullYear();
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

    let query = supabaseClient
        .from('CustomsClearanceView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (filters.JobID) query = query.ilike('JobID', `%${filters.jobNo}%`);
    if (filters.bLAWBNo) query = query.ilike('BLAWBNo', `%${filters.bLAWBNo}%`);
    if (filters.bENo) query = query.ilike('BENo', `%${filters.bENo}%`);
    if (filters.customerName) query = query.ilike('PartyName', `%${filters.customerName}%`);
    if (filters.movementType) query = query.ilike('MovementType', `%${filters.movementType}%`);
    if (filters.transitType) query = query.ilike('TransitType', `%${filters.transitType}%`);
    if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
    if (filters.customsBroker) query = query.ilike('CustomsBroker', `%${filters.customsBroker}%`);
    if (filters.clearanceCountry) query = query.ilike('ClearanceCountry', `%${filters.clearanceCountry}%`);
    if (filters.clearancePort) query = query.ilike('ClearancePort', `%${filters.clearancePort}%`);
    if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
    if (filters.startDate) query = query.gte('JobDate', filters.startDate);
    if (filters.endDate) query = query.lte('JobDate', filters.endDate);

    // If invoiceMonth is set (format: MM-YYYY or YYYY-MM)
    if (filters.bookedMonth) {
        let [monthStr, yearStr] = filters.bookedMonth.split('-');
        if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('JobDate', start).lte('JobDate', end);
        }
    }

    // Else fallback to full year range if only invoiceYear is set
    if (!filters.bookedMonth && filters.bookedYear) {
        const year = parseInt(filters.bookedYear);
        if (!isNaN(year)) {
            const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
            const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
            query = query.gte('JobDate', start).lte('JobDate', end);
        }
    }

    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('JobDate', `${startYear}-04-01`).lte('JobDate', `${endYear}-03-31`);
    }
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
function updateHeaderSortIndicators() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        th.textContent = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
        if (key === sortColumn) {
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

function renderTable(data) {
    const tbody = document.querySelector('#bookingTable tbody');
    tbody.innerHTML = data.map((row, idx) => `
        <tr>
            <td>${(currentPage - 1) * pageSize + idx + 1}</td>
            <td>${row.JobID || ''}</td>
            <td>${row.JobDate || ''}</td>
            <td>${row.PartyName || ''}</td>
            <td>${row.BLAWBNo || ''}</td>
            <td>${row.BLAWBDate || ''}</td>
            <td>${row.BENo || ''}</td>
            <td>${row.BEDate || ''}</td>
            <td>${row.MovementType || ''}</td>
            <td>${row.TransitType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.Consignor || ''}</td>
            <td>${row.Origin || ''}</td>
            <td>${row.Destination || ''}</td>
            <td>${row.ClearancePort || ''}</td>
            <td>${row.CustomsBroker || ''}</td>
            <td>${row.Quantity || ''}</td>
            <td>${row.CargoWeight || ''}</td>
            <td>${row.ClearanceMode || ''}</td>
            <td>${row.Commodity || ''}</td>
            <td>${row.AnyInformation || ''}</td>
            <td>${row.TotalAmount || '0'}</td>
            <td>${row.SGSTAmt || '0'}</td>
            <td>${row.CGSTAmt || '0'}</td>
            <td>${row.IGSTAmt || '0'}</td>
            <td>${row.TotalGSTAmt || ''}</td>
            <td>${row.GrandTotalAmt || ''}</td>
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.InvoiceStatus || ''}</td>
        </tr>
    `).join('');
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
        <th>Sr No</th><th>Job No</th><th>Job Date</th><th>Customer Name</th><th>BL / AWB No</th><th>BL / AWB Date</th>
        <th>BE No</th><th>BE Date</th><th>Movement Type</th><th>Transit Type</th><th>Mode Type</th><th>Consignee</th>
        <th>Customs Broker</th><th>Clearance Port</th><th>Clearance Country</th><th>Quantity</th><th>Cargo Weight</th>
        <th>Clearance Mode</th><th>Commodity</th><th>Any Information</th><th>Total Amount</th><th>SGST</th><th>CGST</th>
        <th>IGST</th><th>Total GST</th><th>Grand Total</th><th>Invoice Number</th><th>Invoice Status</th>`;

    allData.forEach((row, idx) => {
        tableHtml += `<tr>
            <td>${idx + 1}</td>
            <td>${row.JobID || ''}</td>
            <td>${row.JobDate || ''}</td>
            <td>${row.PartyName || ''}</td>
            <td>${row.BLAWBNo || ''}</td>
            <td>${row.BLAWBDate || ''}</td>
            <td>${row.BENo || ''}</td>
            <td>${row.BEDate || ''}</td>
            <td>${row.MovementType || ''}</td>
            <td>${row.TransitType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.Consignee || ''}</td>
            <td>${row.CustomsBroker || ''}</td>
            <td>${row.ClearancePort || ''}</td>
            <td>${row.ClearanceCountry || ''}</td>
            <td>${row.Quantity || ''}</td>
            <td>${row.CargoWeight || ''}</td>
            <td>${row.ClearanceMode || ''}</td>
            <td>${row.Commodity || ''}</td>
            <td>${row.AnyInformation || ''}</td>
            <td>${row.TotalAmount || '0'}</td>
            <td>${row.SGSTAmt || '0'}</td>
            <td>${row.CGSTAmt || '0'}</td>
            <td>${row.IGSTAmt || '0'}</td>
            <td>${row.TotalGSTAmt || ''}</td>
            <td>${row.GrandTotalAmt || ''}</td>
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.InvoiceStatus || ''}</td>
        </tr>`;
    });

    tableHtml += `</tbody></table>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: "Bookings" });
    XLSX.writeFile(wb, 'ReportCustomsClearance.xlsx');
}

// PDF Export Function
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    if (!allData.length) return alert('No data to export.');

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const headers = [
        'Sr No', 'Job ID', 'Job Date', 'Customer Name', 'BL / AWB No', 'BL / AWB Date',
        'BE No', 'BE Date', 'Movement Type', 'Transit Type', 'Mode Type', 'Consignee',
        'Customs Broker', 'Clearance Port', 'Clearance Country', 'Quantity', 'Cargo Weight', 'Clearance Mode',
        'Commodity', 'Any Information', 'Total Amount', 'SGST', 'CGST', 'IGST', 'Total GST', 'Grand Total', 'Invoice Number',
        'Invoice Status'
    ];

    const formatNumber = (value) => typeof value === 'number' ? value.toFixed(2) : value || '';
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date) ? '' : date.toLocaleDateString();
    };

    const rows = allData.map((row, i) => [
        i + 1,
        row.JobID || '',
        formatDate(row.JobDate),
        row.PartyName || '',
        row.BLAWBNo || '',
        formatDate(row.BLAWBDate),
        row.BENo || '',
        formatDate(row.BEDate),
        row.MovementType || '',
        row.TransitType || '',
        row.ModeType || '',
        row.Consignee || '',
        row.CustomsBroker || '',
        row.ClearancePort || '',
        row.ClearanceCountry || '',
        row.Quantity || '',
        row.CargoWeight || '',
        row.ClearanceMode || '',
        row.Commodity || '',
        row.AnyInformation || '',
        formatNumber(row.TotalAmount),
        formatNumber(row.SGSTAmt),
        formatNumber(row.CGSTAmt),
        formatNumber(row.IGSTAmt),
        formatNumber(row.TotalGSTAmt),
        formatNumber(row.GrandTotalAmt),
        row.InvoiceNo || '',
        row.InvoiceStatus || ''
    ]);

    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        margin: { left: 10, right: 10 },
        styles: { fontSize: 6.5, overflow: 'linebreak', cellPadding: 1.2 },
        headStyles: { fillColor: [0, 123, 255] },
        didDrawPage: function (data) {
            doc.setFontSize(10);
            doc.text("Customs Clearance Report", data.settings.margin.left, 10);
        },
        pageBreak: 'auto'
    });

    doc.save('ReportCustomsClearance.pdf');
}

async function fetchAllFilteredData(filters = {}) {
    let allData = [], batchSize = 1000, from = 0, to = batchSize - 1, hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from('CustomsClearanceView')
            .select('*')
            .eq('company_id', CompanyID);


        if (filters.JobID) query = query.ilike('JobID', `%${filters.JobID}%`);
        if (filters.bLAWBNo) query = query.ilike('BLAWBNo', `%${filters.bLAWBNo}%`);
        if (filters.bENo) query = query.ilike('BENo', `%${filters.bENo}%`);
        if (filters.customerName) query = query.ilike('PartyName', `%${filters.customerName}%`);
        if (filters.movementType) query = query.ilike('MovementType', `%${filters.movementType}%`);
        if (filters.transitType) query = query.ilike('TransitType', `%${filters.transitType}%`);
        if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
        if (filters.customsBroker) query = query.ilike('CustomsBroker', `%${filters.customsBroker}%`);
        if (filters.clearanceCountry) query = query.ilike('ClearanceCountry', `%${filters.clearanceCountry}%`);
        if (filters.clearancePort) query = query.ilike('ClearancePort', `%${filters.clearancePort}%`);
        if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
        if (filters.startDate) query = query.gte('JobDate', filters.startDate);
        if (filters.endDate) query = query.lte('JobDate', filters.endDate);

        // If invoiceMonth is set (format: MM-YYYY or YYYY-MM)
        if (filters.bookedMonth) {
            let [monthStr, yearStr] = filters.bookedMonth.split('-');
            if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

            const month = parseInt(monthStr);
            const year = parseInt(yearStr);

            if (!isNaN(year) && !isNaN(month)) {
                const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const end = new Date(year, month, 0).toISOString().split('T')[0];
                query = query.gte('JobDate', start).lte('JobDate', end);
            }
        }

        // Else fallback to full year range if only invoiceYear is set
        if (!filters.bookedMonth && filters.bookedYear) {
            const year = parseInt(filters.bookedYear);
            if (!isNaN(year)) {
                const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
                const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
                query = query.gte('JobDate', start).lte('JobDate', end);
            }
        }

        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split('-').map(Number);
            query = query.gte('JobDate', `${startYear}-04-01`).lte('JobDate', `${endYear}-03-31`);
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