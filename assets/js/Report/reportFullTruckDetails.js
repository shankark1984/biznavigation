let currentPage = 1;
const pageSize = 100;
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
    let dateRange = document.getElementById('dateRange').value;

    let [startDate, endDate] = dateRange
        ? dateRange.split(' to ')
        : [];

    return {
        docketNo: document.getElementById('docketNo').value.trim(),

        // ✅ Trim + null safety
        startDate: startDate ? startDate.trim() : null,
        endDate: endDate ? endDate.trim() : null,

        customerName: document.getElementById('customerName').value.trim(),
        movementType: document.getElementById('movementType').value.trim(),
        modeType: document.getElementById('modeType').value.trim(),
        originCity: document.getElementById('originLocation').value.trim(),
        destinationCity: document.getElementById('destinationLocation').value.trim(),
        routeDetails: document.getElementById('routeDetails').value.trim(),
        vendorName: document.getElementById('vendorName').value.trim(),
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

            currentPage = 1;   // ADD THIS
            loadTable(getFilters());
        });
    });
}

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from('FullLoadMovementDetailsView')
        .select('LRNumber, CustomerName, MovementType, OriginCity, DestinationCity, ModeType, InvoiceStatus, PickupDate,VendorName')
        .eq('company_id', CompanyID)
        .order('PickupDate', { ascending: false })
        .limit(1000);

    if (error) return console.error('Error fetching suggestions:', error);

    populateDatalists(data, 'LRNumber', 'docketNoList');
    populateDatalists(data, 'CustomerName', 'customerNameList');
    populateDatalists(data, 'MovementType', 'movementTypeList');
    populateDatalists(data, 'ModeType', 'modeTypeList');
    populateDatalists(data, 'OriginCity', 'originLocationList');
    populateDatalists(data, 'DestinationCity', 'destinationLocationList');
    populateDatalists(data, 'VendorName', 'vendorNameList');
    populateDatalists(data, 'InvoiceStatus', 'invoiceStatusList');

    const financialYears = [...new Set(data.map(item => {
        const year = new Date(item.PickupDate).getFullYear();
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

function updateHeaderSortIndicators() {
    document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {

        const key = th.dataset.key;
        const title = th.dataset.title || th.textContent.replace(/[▲▼]/g, '').trim();

        th.dataset.title = title;

        if (key === sortColumn) {
            th.textContent = title + (sortOrder === 'asc' ? ' ▲' : ' ▼');
        } else {
            th.textContent = title;
        }

    });
}

function renderTable(data) {
    const tbody = document.querySelector('#bookingTable tbody');

    if (!data || data.length === 0) {
        tbody.innerHTML = `
        <tr>
            <td colspan="33" class="text-center text-muted">
                No records found
            </td>
        </tr>`;
        return;
    }

    tbody.innerHTML = data.map((row, idx) => `
        <tr>
            <td>${(currentPage - 1) * pageSize + idx + 1}</td>
            <td>${row.LRNumber || ''}</td>
            <td>${formatDate(row.PickupDate || '')}</td>
            <td>${row.CustomerName || ''}</td>
            <td>${row.MovementType || ''}</td>
            <td>${row.ModeType || ''}</td>
            <td>${row.RouteDetails || ''}</td>
            <td>${row.OriginPincode || ''}</td>
            <td>${row.OriginCity || ''}</td>
            <td>${row.DestinationPincode || ''}</td>
            <td>${row.DestinationCity || ''}</td>
            <td>${formatDate(row.RequestedDate || '')}</td>
            <td>${row.ReferenceNo || ''}</td>
            <td>${row.VehicleType || ''}</td>
            <td>${row.VendorName || ''}</td>
            <td>${row.VehicleNumber || ''}</td>
            <td>${row.ContainerNumber || ''}</td>
            <td class="text-end">${row.Quantity || '0'}</td>
            <td class="text-end">${row.ChargeableWeight || '0'}</td>
            <td>${formatDate(row.CompletionDate || '')}</td>
            <td>${row.ShipmentStatus || ''}</td>
            <td>${row.DescriptionofGoods || ''}</td>
            <td>${row.WayBillNo || ''}</td>
            <td>${row.Information || ''}</td>
            <td class="text-end">${row.FreightAmountSale || '0'}</td>
            <td class="text-end">${row.OtherAmountSale || '0'}</td>
            <td class="text-end">${row.CGSTAmountSale || '0'}</td>
            <td class="text-end">${row.SGSTAmountSale || '0'}</td>
            <td class="text-end">${row.IGSTAmountSale || '0'}</td>
            <td class="text-end">${row.TotalGSTAmountSale || '0'}</td>
            <td class="text-end">${row.GrandTotalSale || '0'}</td>
            <td>${row.InvoiceNumber || ''}</td>
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

    if (allData.length > 20000) {
        alert("Too much data. Please apply filters.");
        return;
    }

    if (!allData || allData.length === 0) {
        alert(`Too much data (${allData.length} rows). Please apply filters.`);
        return;
    }

    const excelData = allData.map((row, idx) => ({
        "Sr No": idx + 1,
        "Docket No": row.LRNumber || "",
        "Booking Date": row.PickupDate || "",
        "Customer Name": row.CustomerName || "",
        "Movement Type": row.MovementType || "",
        "Transit Type": row.TransitType || "",
        "Mode Type": row.ModeType || "",
        "Route Details": row.RouteDetails || "",
        "Origin Pincode": row.OriginPincode || "",
        "Origin City": row.OriginCity || "",
        "Destination Pincode": row.DestinationPincode || "",
        "Destination City": row.DestinationCity || "",
        "Requested Date": row.RequestedDate || "",
        "Reference No": row.ReferenceNo || "",
        "Vehicle Type": row.VehicleType || "",
        "Vendor Name": row.VendorName || "",
        "Vehicle Number": row.VehicleNumber || "",
        "Container Number": row.ContainerNumber || "",
        "Quantity": row.Quantity || 0,
        "Cargo Weight": row.CargoWeight || 0,
        "Completion Date": row.CompletionDate || "",
        "Status": row.ShipmentStatus || "",
        "Description of Goods": row.DescriptionofGoods || "",
        "Way Bill No": row.WayBillNo || "",
        "Information": row.Information || "",
        "Freight Amount": row.FreightAmountSale || 0,
        "Other Charges": row.OtherAmountSale || 0,
        "SGST Amt": row.SGSTAmountSale || 0,
        "CGST Amt": row.CGSTAmountSale || 0,
        "IGST Amt": row.IGSTAmountSale || 0,
        "Total GST": row.TotalGSTAmountSale || 0,
        "Grand Total": row.GrandTotalSale || 0,
        "Invoice Number": row.InvoiceNumber || "",
        "Invoice Status": row.InvoiceStatus || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Full Truck Report");

    XLSX.writeFile(workbook, "ReportFullTruckDetails.xlsx");
}

// PDF Export Function
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    if (allData.length > 20000) {
        alert("Too much data. Please apply filters.");
        return;
    }

    if (!allData.length) return alert(`Too much data (${allData.length} rows). Please apply filters.`);

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const headers = [
        'Sr No', 'Docket No', 'Pickup Date', 'Customer Name', 'Movement Type', 'Transit Type', 'Mode Type', 'Route Details',
        'Origin Pincode', 'Origin City', 'Destination Pincode', 'Destination City', 'Requested Date', 'Reference No',
        'Vehicle Type', 'Vendor Name', 'Vehicle Number', 'Container Number', 'Completion Date', 'Status', 'Description of Goods',
        'Way Bill No', 'Information', 'Freight Amount', 'Other Charges', 'SGST', 'CGST', 'IGST', 'Total GST', 'Grand Total', 'Invoice Number',
        'Invoice Status'
    ];

    const formatNumber = (value) => typeof value === 'number' ? value.toFixed(2) : value || '';

    const rows = allData.map((row, i) => [
        i + 1,
        row.LRNumber || '',
        formatDate(row.PickupDate),
        row.CustomerName || '',
        row.MovementType || '',
        row.TransitType || '',
        row.ModeType || '',
        row.RouteDetails || '',
        row.OriginPincode || '',
        row.OriginCity || '',
        row.DestinationPincode || '',
        row.DestinationCity || '',
        formatDate(row.RequestedDate),
        row.ReferenceNo || '',
        row.VehicleType || '',
        row.VendorName || '',
        row.VehicleNumber || '',
        row.ContainerNumber || '',
        formatDate(row.CompletionDate),
        row.ShipmentStatus || '',
        row.DescriptionofGoods || '',
        row.WayBillNo || '',
        row.Information || '',
        formatNumber(row.FreightAmountSale),
        formatNumber(row.OtherAmountSale),
        formatNumber(row.SGSTAmountSale),
        formatNumber(row.CGSTAmountSale),
        formatNumber(row.IGSTAmountSale),
        formatNumber(row.TotalGSTAmountSale),
        formatNumber(row.GrandTotalSale),
        row.InvoiceNumber || '',
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
            doc.text("Full Truck Movement Report", data.settings.margin.left, 10);
        },
        pageBreak: 'auto'
    });

    doc.save('ReportFullTruckDetails.pdf');
}

function applyFilters(query, filters) {
    if (filters.docketNo) query = query.ilike('LRNumber', `%${filters.docketNo}%`);
    if (filters.customerName) query = query.ilike('CustomerName', `%${filters.customerName}%`);
    if (filters.movementType) query = query.ilike('MovementType', `%${filters.movementType}%`);
    if (filters.modeType) query = query.ilike('ModeType', `%${filters.modeType}%`);
    if (filters.vendorName) query = query.ilike('VendorName', `%${filters.vendorName}%`);
    if (filters.routeDetails) query = query.ilike('RouteDetails', `%${filters.routeDetails}%`);
    if (filters.originCity) query = query.ilike('OriginCity', `%${filters.originCity}%`);
    if (filters.destinationCity) query = query.ilike('DestinationCity', `%${filters.destinationCity}%`);
    if (filters.invoiceStatus) query = query.ilike('InvoiceStatus', `%${filters.invoiceStatus}%`);
    if (filters.startDate) query = query.gte('PickupDate', filters.startDate);
    if (filters.endDate) query = query.lte('PickupDate', filters.endDate);

    // Month filter
    if (filters.bookedMonth) {
        let [monthStr, yearStr] = filters.bookedMonth.split('-');
        if (parseInt(monthStr) > 12) [yearStr, monthStr] = [monthStr, yearStr];

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('PickupDate', start).lte('PickupDate', end);
        }
    }

    // Year filter
    if (!filters.bookedMonth && filters.bookedYear) {
        const year = parseInt(filters.bookedYear);
        if (!isNaN(year)) {
            query = query
                .gte('PickupDate', `${year}-01-01`)
                .lte('PickupDate', `${year}-12-31`);
        }
    }

    // Financial year
    if (filters.financialYear) {
        const [startYear, endYear] = filters.financialYear.split('-').map(Number);
        query = query
            .gte('PickupDate', `${startYear}-04-01`)
            .lte('PickupDate', `${endYear}-03-31`);
    }

    return query;
}

async function loadTable(filters = {}) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.classList.remove('d-none');

    let query = supabaseClient
        .from('FullLoadMovementDetailsView')
        .select('*', { count: 'exact' })
        .eq('company_id', CompanyID);

    // ✅ Apply common filters
    query = applyFilters(query, filters);

    // ✅ Sorting
    if (sortColumn) {
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
    }

    const { data, error, count } = await query.range(
        (currentPage - 1) * pageSize,
        currentPage * pageSize - 1
    );

    spinner.classList.add('d-none');

    if (error) {
        console.error('Error loading table:', error);
        return;
    }

    renderTable(data);
    renderPagination(count, loadTable);
    updateHeaderSortIndicators();
}

async function fetchAllFilteredData(filters = {}) {
    let allData = [];
    let batchSize = 1000;
    let from = 0;
    let to = batchSize - 1;
    let hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from('FullLoadMovementDetailsView')
            .select('*')
            .eq('company_id', CompanyID);

        // ✅ Apply same filters
        query = applyFilters(query, filters);

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
