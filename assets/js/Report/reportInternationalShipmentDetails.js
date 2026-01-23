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
        movementType: document.getElementById('movementType').value.trim(),
        modeType: document.getElementById('modeType').value.trim(),
        serviceProviderName: document.getElementById('serviceProviderName').value.trim(),
        bookedMonth: document.getElementById('bookedMonth').value.trim(),
        bookedYear: document.getElementById('bookedYear').value.trim(),
        financialYear: document.getElementById('financialYear').value.trim(),
        invoiceStatus: document.getElementById('invoiceStatus').value.trim(),
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
        .from('InternationalBookingView')
        .select('DocketNo, CustomerName, MovementType, ModeType, ServiceProviderName, InvoiceStatus, BookedDate');

    if (error) return console.error('Error fetching suggestions:', error);

    populateDatalists(data, 'DocketNo', 'docketNoList');
    populateDatalists(data, 'CustomerName', 'customerNameList');
    populateDatalists(data, 'MovementType', 'movementTypeList');
    populateDatalists(data, 'ModeType', 'modeTypeList');
    populateDatalists(data, 'ServiceProviderName', 'serviceProviderNameList');
    populateDatalists(data, 'InvoiceStatus', 'invoiceStatusList');

    const financialYears = [...new Set(data.map(item => {
        const year = new Date(item.BookedDate).getFullYear();
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
        .from('InternationalBookingView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    if (filters.docketNo) query = query.ilike('DocketNo', `%${filters.docketNo}%`);
    if (filters.customerName) query = query.ilike('CustomerName', `%${filters.customerName}%`);
    if (filters.movementType) query = query.ilike('MovementType', `%${filters.movementType}%`);
    if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
    if (filters.serviceProviderName) query = query.ilike('ServiceProviderName', `%${filters.serviceProviderName}%`);
    if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
    if (filters.startDate) query = query.gte('BookedDate', filters.startDate);
    if (filters.endDate) query = query.lte('BookedDate', filters.endDate);

    // If invoiceMonth is set (format: MM-YYYY or YYYY-MM)
    if (filters.bookedMonth) {
        let [monthStr, yearStr] = filters.bookedMonth.split('-');
        if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('BookedDate', start).lte('BookedDate', end);
        }
    }

    // Else fallback to full year range if only invoiceYear is set
    if (!filters.bookedMonth && filters.bookedYear) {
        const year = parseInt(filters.bookedYear);
        if (!isNaN(year)) {
            const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
            const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
            query = query.gte('BookedDate', start).lte('BookedDate', end);
        }
    }

    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query.gte('BookedDate', `${startYear}-04-01`).lte('BookedDate', `${endYear}-03-31`);
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
            <td>${row.DocketNo || ''}</td>
            <td>${row.BookedDate || ''}</td>
            <td>${row.CustomerName || ''}</td>
            <td>${row.MovementType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.ServiceProviderName || ''}</td>
            <td>${row.CourierName || ''}</td>
            <td>${row.Consignee || ''}</td>
            <td>${row.OriginName || ''}</td>
            <td>${row.PortofLoading || ''}</td>
            <td>${row.DestinationName || ''}</td>
            <td>${row.PortofDischarge || ''}</td>
            <td>${row.UOMType || ''}</td>
            <td>${row.NoofUnit || ''}</td>
            <td>${row.AcutalWeight || ''}</td>
            <td>${row.VolumeWeight || ''}</td>
            <td>${row.ChargableWeight || ''}</td>
            <td>${row.TotalAmount || ''}</td>
            <td>${row.TotalSGSTAmt || ''}</td>
            <td>${row.TotalCGSTAmt || ''}</td>
            <td>${row.TotalIGSTAmt || ''}</td>
            <td>${row.TotalGSTAmt || ''}</td>
            <td>${row.GrandTotalAmt || ''}</td>
            <td>${row.InvoiceNumber || ''}</td>
            <td>${row.InvoiceStatus || ''}</td>
            <td>${row.ShipperRef || ''}</td>
            <td>${row.Commodity || ''}</td>
            <td>${row.ShippingType || ''}</td>
            <td>${row.ConsignmentValue || ''}</td>
            <td>${row.PONo || ''}</td>
        </tr>
    `).join('');
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
        <th>Sr No</th><th>Docket No</th><th>Booked Date</th><th>Customer Name</th><th>Movement Type</th>
        <th>Mode Type</th><th>Service Provider</th><th>Courier Name</th><th>Consignee</th><th>Origin</th>
        <th>Port of Loading</th><th>Destination</th><th>Port of Discharge</th><th>UOM</th><th>No. of Units</th>
        <th>Actual Weight</th><th>Volume Weight</th><th>Chargeable Weight</th><th>Total Amount</th>
        <th>SGST</th><th>CGST</th><th>IGST</th><th>Total GST</th><th>Grand Total</th><th>Invoice Number</th>
        <th>Invoice Status</th><th>Shipper Ref</th><th>Commodity</th><th>Shipping Type</th>
        <th>Consignment Value</th><th>PO No</th></tr></thead><tbody>`;

    allData.forEach((row, idx) => {
        tableHtml += `<tr>
            <td>${idx + 1}</td>
            <td>${row.DocketNo || ''}</td>
            <td>${row.BookedDate || ''}</td>
            <td>${row.CustomerName || ''}</td>
            <td>${row.MovementType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.ServiceProviderName || ''}</td>
            <td>${row.CourierName || ''}</td>
            <td>${row.Consignee || ''}</td>
            <td>${row.OriginName || ''}</td>
            <td>${row.PortofLoading || ''}</td>
            <td>${row.DestinationName || ''}</td>
            <td>${row.PortofDischarge || ''}</td>
            <td>${row.UOMType || ''}</td>
            <td>${row.NoofUnit || ''}</td>
            <td>${row.AcutalWeight || ''}</td>
            <td>${row.VolumeWeight || ''}</td>
            <td>${row.ChargableWeight || ''}</td>
            <td>${row.TotalAmount || ''}</td>
            <td>${row.TotalSGSTAmt || ''}</td>
            <td>${row.TotalCGSTAmt || ''}</td>
            <td>${row.TotalIGSTAmt || ''}</td>
            <td>${row.TotalGSTAmt || ''}</td>
            <td>${row.GrandTotalAmt || ''}</td>
            <td>${row.InvoiceNumber || ''}</td>
            <td>${row.InvoiceStatus || ''}</td>
            <td>${row.ShipperRef || ''}</td>
            <td>${row.Commodity || ''}</td>
            <td>${row.ShippingType || ''}</td>
            <td>${row.ConsignmentValue || ''}</td>
            <td>${row.PONo || ''}</td>
        </tr>`;
    });

    tableHtml += `</tbody></table>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: "Bookings" });
    XLSX.writeFile(wb, 'InternationalBookings.xlsx');
}

// PDF Export Function
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    if (!allData.length) return alert('No data to export.');

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const headers = [
        'Sr No', 'Docket No', 'Booked Date', 'Customer Name', 'Movement Type', 'Mode Type',
        'Service Provider', 'Courier Name', 'Consignee', 'Origin', 'Port of Loading', 'Destination',
        'Port of Discharge', 'UOM', 'No. of Units', 'Actual Weight', 'Volume Weight', 'Chargeable Weight',
        'Total Amount', 'SGST', 'CGST', 'IGST', 'Total GST', 'Grand Total', 'Invoice Number',
        'Invoice Status', 'Shipper Ref', 'Commodity', 'Shipping Type', 'Consignment Value', 'PO No'
    ];

    const formatNumber = (value) => typeof value === 'number' ? value.toFixed(2) : value || '';
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date) ? '' : date.toLocaleDateString();
    };

    const rows = allData.map((row, i) => [
        i + 1,
        row.DocketNo || '',
        formatDate(row.BookedDate),
        row.CustomerName || '',
        row.MovementType || '',
        row.ModeType || '',
        row.ServiceProviderName || '',
        row.CourierName || '',
        row.Consignee || '',
        row.OriginName || '',
        row.PortofLoading || '',
        row.DestinationName || '',
        row.PortofDischarge || '',
        row.UOMType || '',
        row.NoofUnit || '',
        formatNumber(row.AcutalWeight),
        formatNumber(row.VolumeWeight),
        formatNumber(row.ChargableWeight),
        formatNumber(row.TotalAmount),
        formatNumber(row.TotalSGSTAmt),
        formatNumber(row.TotalCGSTAmt),
        formatNumber(row.TotalIGSTAmt),
        formatNumber(row.TotalGSTAmt),
        formatNumber(row.GrandTotalAmt),
        row.InvoiceNumber || '',
        row.InvoiceStatus || '',
        row.ShipperRef || '',
        row.Commodity || '',
        row.ShippingType || '',
        formatNumber(row.ConsignmentValue),
        row.PONo || ''
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
            doc.text("International Bookings Report", data.settings.margin.left, 10);
        },
        pageBreak: 'auto'
    });

    doc.save('InternationalBookings.pdf');
}

async function fetchAllFilteredData(filters = {}) {
    let allData = [], batchSize = 1000, from = 0, to = batchSize - 1, hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from('InternationalBookingView')
            .select('*')
            .eq('company_id', CompanyID);

        if (filters.docketNo) query = query.ilike('DocketNo', `%${filters.docketNo}%`);
        if (filters.customerName) query = query.ilike('CustomerName', `%${filters.customerName}%`);
        if (filters.movementType) query = query.ilike('MovementType', `%${filters.movementType}%`);
        if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
        if (filters.serviceProviderName) query = query.ilike('ServiceProviderName', `%${filters.serviceProviderName}%`);
        if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
        if (filters.startDate) query = query.gte('BookedDate', filters.startDate);
        if (filters.endDate) query = query.lte('BookedDate', filters.endDate);

        // If invoiceMonth is set (format: MM-YYYY or YYYY-MM)
        if (filters.bookedMonth) {
            let [monthStr, yearStr] = filters.bookedMonth.split('-');
            if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

            const month = parseInt(monthStr);
            const year = parseInt(yearStr);

            if (!isNaN(year) && !isNaN(month)) {
                const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const end = new Date(year, month, 0).toISOString().split('T')[0];
                query = query.gte('BookedDate', start).lte('BookedDate', end);
            }
        }

        // Else fallback to full year range if only invoiceYear is set
        if (!filters.bookedMonth && filters.bookedYear) {
            const year = parseInt(filters.bookedYear);
            if (!isNaN(year)) {
                const start = new Date(year, 0, 1).toISOString().split('T')[0];   // Jan 1
                const end = new Date(year, 11, 31).toISOString().split('T')[0];  // Dec 31
                query = query.gte('BookedDate', start).lte('BookedDate', end);
            }
        }

        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split('-').map(Number);
            query = query.gte('BookedDate', `${startYear}-04-01`).lte('BookedDate', `${endYear}-03-31`);
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