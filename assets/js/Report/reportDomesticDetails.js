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
        docketNo: document.getElementById('docketNo').value.trim(),
        startDate: dateRange[0]?.trim() || null,
        endDate: dateRange[1]?.trim() || null,
        customerName: document.getElementById('customerName').value.trim(),
        modeType: document.getElementById('modeType').value.trim(),
        transitType: document.getElementById('transitType').value.trim(),
        bookedMonth: document.getElementById('bookedMonth').value.trim(),
        bookedYear: document.getElementById('bookedYear').value.trim(),
        financialYear: document.getElementById('financialYear').value.trim(),
        invoiceStatus: document.getElementById('invoiceStatus').value.trim(),
    };
}

function enableSortableHeaders() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
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
        .from('DomesticBookingView')
        .select('DocketNo, CustomerName, TransitType, ModeType, InvoiceStatus, BookingDate');

    if (error) return console.error(error);

    populateDatalists(data, 'DocketNo', 'docketNoList');
    populateDatalists(data, 'CustomerName', 'customerNameList');
    populateDatalists(data, 'TransitType', 'transitTypeList');
    populateDatalists(data, 'ModeType', 'modeTypeList');
    populateDatalists(data, 'InvoiceStatus', 'invoiceStatusList');

    const financialYears = [...new Set(data.map(item => {
        const year = new Date(item.BookingDate).getFullYear();
        return `${year}-${year + 1}`;
    }))];

    populateArrayDatalist(financialYears, 'financialYearList');
}

function populateDatalists(data, field, datalistId) {
    const uniqueValues = [...new Set(data.map(item => item[field]).filter(Boolean))];
    document.getElementById(datalistId).innerHTML =
        uniqueValues.map(v => `<option value="${v}">`).join('');
}

function populateArrayDatalist(array, datalistId) {
    document.getElementById(datalistId).innerHTML =
        array.map(v => `<option value="${v}">`).join('');
}

async function loadTable(filters = {}) {

    document.getElementById('loadingSpinner').style.display = 'block';

    let query = supabaseClient
        .from('DomesticBookingView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (filters.docketNo) query = query.ilike('DocketNo', `%${filters.docketNo}%`);
    if (filters.customerName) query = query.ilike('CustomerName', `%${filters.customerName}%`);
    if (filters.transitType) query = query.ilike('TransitType', `%${filters.transitType}%`);
    if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
    if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
    if (filters.startDate) query = query.gte('BookingDate', filters.startDate);
    if (filters.endDate) query = query.lte('BookingDate', filters.endDate);

    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('BookingDate', `${startYear}-04-01`)
            .lte('BookingDate', `${endYear}-03-31`);
    }

    if (sortColumn)
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    const { data, error, count } =
        await query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    document.getElementById('loadingSpinner').style.display = 'none';
    if (error) return console.error(error);

    renderTable(data);
    renderPagination(count);
    updateHeaderSortIndicators();
}

function updateHeaderSortIndicators() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
        const key = th.getAttribute('data-key');
        const base = th.textContent.replace(/\s+[▲▼]/, '');
        th.textContent = base;
        if (key === sortColumn)
            th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
    });
}

function renderTable(data) {
    const tbody = document.querySelector('#bookingTable tbody');
    tbody.innerHTML = data.map((row, idx) => `
        <tr>
            <td>${(currentPage - 1) * pageSize + idx + 1}</td>
            <td>${row.DocketNo || ''}</td>
            <td>${formatDate(row.BookingDate)}</td>
            <td>${row.CustomerName || ''}</td>
            <td>${row.ShippingType || ''}</td>
            <td>${row.ConsignorName || ''}</td>
            <td>${row.OriginPincode || ''}</td>
            <td>${row.OriginCity || ''}</td>
            <td>${row.OriginAddress || ''}</td>
            <td>${row.ConsigneeName || ''}</td>
            <td>${row.DestinationPincode || ''}</td>
            <td>${row.DestinationCity || ''}</td>
            <td>${row.DestinationAddress || ''}</td>
            <td>${row.TransitType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.ServiceProvider || ''}</td>
            <td>${row.CustomerReferenceNo || ''}</td>
            <td>${row.InvoiceValue || '0'}</td>
            <td>${row.Quantity || '0'}</td>
            <td>${row.UOMType || ''}</td>
            <td>${row.ActualWeight || '0'}</td>
            <td>${row.VolumetricWeight || '0'}</td>
            <td>${row.ChargeableWeight || '0'}</td>
            <td>${row.CargoDescription || ''}</td>
            <td>${row.PaymentType || ''}</td>
            <td>${row.FreightAmount || '0'}</td>
            <td>${row.FuelSurcharge || '0'}</td>
            <td>${row.OtherCharges || '0'}</td>
            <td>${row.TotalAmount || '0'}</td>
            <td>${row.SGSTAmt || '0'}</td>
            <td>${row.CGSTAmt || '0'}</td>
            <td>${row.IGSTAmt || '0'}</td>
            <td>${row.TotalGSTAmt || '0'}</td>
            <td>${row.GrandTotalAmt || '0'}</td>
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.InvoiceStatus || ''}</td>
        </tr>
    `).join('');
}

function renderPagination(totalCount) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = document.getElementById('paginationControls');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', () => {
            currentPage = i;
            loadTable(getFilters());
        });
        pagination.appendChild(li);
    }
}

/* ---------- EXPORT ---------- */

async function exportToExcel() {
    const data = await fetchAllFilteredData(getFilters());
    if (!data.length) return alert('No data');

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Domestic Report");
    XLSX.writeFile(wb, 'DomesticReport.xlsx');
}

async function exportToPdf() {
    const data = await fetchAllFilteredData(getFilters());
    if (!data.length) return alert('No data');

    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    const rows = data.map((r, i) => [
        i + 1, r.DocketNo, r.BookingDate, r.CustomerName, r.InvoiceNo, r.GrandTotalAmt
    ]);

    doc.autoTable({
        head: [['Sr', 'Docket', 'Date', 'Customer', 'Invoice', 'Grand Total']],
        body: rows
    });

    doc.save('DomesticReport.pdf');
}

async function fetchAllFilteredData(filters = {}) {

    let allData = [], batchSize = 1000, from = 0, to = batchSize - 1, hasMore = true;

    while (hasMore) {

        let query = supabaseClient
            .from('DomesticBookingView')
            .select('*')
            .eq('company_id', CompanyID);

        if (filters.docketNo) query = query.ilike('DocketNo', `%${filters.docketNo}%`);
        if (filters.customerName) query = query.ilike('CustomerName', `%${filters.customerName}%`);
        if (filters.transitType) query = query.ilike('TransitType', `%${filters.transitType}%`);
        if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
        if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);

        const { data } = await query.range(from, to);

        if (data.length) {
            allData = allData.concat(data);
            from += batchSize;
            to += batchSize;
        } else hasMore = false;
    }

    return allData;
}
