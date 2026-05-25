let currentPage = 1;
const pageSize = 50;
const CompanyID = localStorage.getItem('CompanyID');

let sortColumn = null;
let sortOrder = 'asc';

const TABLE_NAME = 'CustomsClearanceView';

// ------------------------------
// INITIALIZE
// ------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    flatpickr("#dateRange", {
        mode: "range",
        dateFormat: "Y-m-d"
    });

    document.getElementById('searchBtn')
        .addEventListener('click', handleSearch);

    document.getElementById('exportExcelBtn')
        .addEventListener('click', exportToExcel);

    document.getElementById('exportPdfBtn')
        .addEventListener('click', exportToPdf);

    enableSortableHeaders();

    await Promise.all([
        loadReportSuggestions(),
        loadTable()
    ]);
});

function handleSearch() {
    currentPage = 1;
    loadTable(getFilters());
}

// ------------------------------
// FILTERS
// ------------------------------

function getFilters() {
    const dateRange = document.getElementById('dateRange').value.split(' to ');

    return {
        JobID: getValue('jobNo'),
        BLAWBNo: getValue('bLAWBNo'),
        BENo: getValue('bENo'),
        customerName: getValue('customerName'),
        movementType: getValue('movementType'),
        transitType: getValue('transitType'),
        modeType: getValue('modeType'),
        origin: getValue('origin'),
        destination: getValue('destination'),
        clearancePort: getValue('clearancePort'),
        bookedMonth: getValue('bookedMonth'),
        bookedYear: getValue('bookedYear'),
        financialYear: getValue('financialYear'),
        invoiceStatus: getValue('invoiceStatus'),
        customsBroker: getValue('customsBroker'),
        startDate: dateRange[0]?.trim() || null,
        endDate: dateRange[1]?.trim() || null
    };
}

function getValue(id) {
    return document.getElementById(id)?.value.trim() || '';
}

// ------------------------------
// SORTING
// ------------------------------

function enableSortableHeaders() {
    document.querySelectorAll('#bookingTable thead th[data-key]')
        .forEach(th => {
            th.style.cursor = 'pointer';

            th.addEventListener('click', () => {
                const key = th.dataset.key;

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

function updateHeaderSortIndicators() {
    document.querySelectorAll('#bookingTable thead th[data-key]')
        .forEach(th => {
            const key = th.dataset.key;
            const title = th.dataset.title || th.textContent.replace(/[▲▼]/g, '').trim();

            th.textContent = title;

            if (key === sortColumn) {
                th.textContent += sortOrder === 'asc' ? ' ▲' : ' ▼';
            }
        });
}

// ------------------------------
// COMMON QUERY BUILDER
// ------------------------------

function buildQuery(filters = {}, withCount = false) {
    let query = supabaseClient
        .from(TABLE_NAME)
        .select('*', withCount ? { count: 'exact' } : undefined)
        .eq('company_id', CompanyID)
        .order('JobDate', { ascending: false });

    const filterMap = {
        JobID: 'JobID',
        BLAWBNo: 'BLAWBNo',
        BENo: 'BENo',
        customerName: 'PartyName',
        movementType: 'MovementType',
        transitType: 'TransitType',
        modeType: 'ModeType',
        customsBroker: 'CustomsBroker',
        clearancePort: 'ClearancePort',
        invoiceStatus: 'InvoiceStatus',
        origin: 'Origin',
        destination: 'Destination'
    };

    Object.entries(filterMap).forEach(([filterKey, dbField]) => {
        const value = filters[filterKey];

        if (value) {
            query = query.ilike(dbField, `%${value}%`);
        }
    });

    // Date range
    if (filters.startDate) {
        query = query.gte('JobDate', filters.startDate);
    }

    if (filters.endDate) {
        query = query.lte('JobDate', filters.endDate);
    }

    // Month filter
    if (filters.bookedMonth) {
        let [monthStr, yearStr] = filters.bookedMonth.split('-');

        if (+monthStr > 12) {
            [yearStr, monthStr] = [monthStr, yearStr];
        }

        const month = +monthStr;
        const year = +yearStr;

        if (!isNaN(month) && !isNaN(year)) {
            const start = new Date(year, month - 1, 1)
                .toISOString()
                .split('T')[0];

            const end = new Date(year, month, 0)
                .toISOString()
                .split('T')[0];

            query = query.gte('JobDate', start).lte('JobDate', end);
        }
    }

    // Year filter
    if (!filters.bookedMonth && filters.bookedYear) {
        const year = +filters.bookedYear;

        if (!isNaN(year)) {
            query = query
                .gte('JobDate', `${year}-01-01`)
                .lte('JobDate', `${year}-12-31`);
        }
    }

    // Financial year
    if (filters.financialYear) {
        const [startYear, endYear] =
            filters.financialYear.split('-').map(Number);

        query = query
            .gte('JobDate', `${startYear}-04-01`)
            .lte('JobDate', `${endYear}-03-31`);
    }

    // Sorting
    if (sortColumn) {
        query = query.order(sortColumn, {
            ascending: sortOrder === 'asc'
        });
    }

    return query;
}

// ------------------------------
// LOAD TABLE
// ------------------------------

async function loadTable(filters = {}) {
    toggleSpinner(true);

    try {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const query = buildQuery(filters, true)
            .range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        renderTable(data || []);
        renderPagination(count || 0);
        updateHeaderSortIndicators();

    } catch (err) {
        console.error('Error loading table:', err);
    } finally {
        toggleSpinner(false);
    }
}

function toggleSpinner(show) {
    document.getElementById('loadingSpinner').style.display =
        show ? 'block' : 'none';
}

// ------------------------------
// SUGGESTIONS
// ------------------------------

async function loadReportSuggestions() {
    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select(`
            JobID,
            PartyName,
            BLAWBNo,
            BENo,
            MovementType,
            TransitType,
            ModeType,
            Origin,
            Destination,
            ClearancePort,
            CustomsBroker,
            InvoiceStatus,
            JobDate
        `);

    if (error) {
        console.error(error);
        return;
    }

    const datalistMap = {
        JobID: 'jobNoList',
        BLAWBNo: 'bLAWBNoList',
        BENo: 'bENoList',
        PartyName: 'customerNameList',
        MovementType: 'movementTypeList',
        TransitType: 'transitTypeList',
        ModeType: 'modeTypeList',
        Origin: 'originList',
        Destination: 'destinationList',
        ClearancePort: 'clearancePortList',
        InvoiceStatus: 'invoiceStatusList',
        CustomsBroker: 'customsBrokerList'
    };

    Object.entries(datalistMap).forEach(([field, id]) => {
        populateDatalist(data, field, id);
    });

    // Financial years
    const financialYears = [
        ...new Set(
            data.map(item => {
                const year = new Date(item.JobDate).getFullYear();
                return `${year}-${year + 1}`;
            })
        )
    ].sort((a, b) => a.localeCompare(b));

    populateArrayDatalist(financialYears, 'financialYearList');
}

function populateDatalist(data, field, datalistId) {

    const uniqueValues = [...new Set(
        data
            .map(item => item[field])
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)); // A-Z sorting

    document.getElementById(datalistId).innerHTML =
        uniqueValues
            .map(v => `<option value="${v}">`)
            .join('');
}

function populateArrayDatalist(array, datalistId) {
    document.getElementById(datalistId).innerHTML =
        array.map(v => `<option value="${v}">`).join('');
}

// ------------------------------
// TABLE RENDER
// ------------------------------

function renderTable(data = []) {
    const tbody = document.querySelector('#bookingTable tbody');

    tbody.innerHTML = data.map((row, idx) => `
        <tr>
            <td>${(currentPage - 1) * pageSize + idx + 1}</td>
            <td>${safe(row.JobID)}</td>
            <td>${formatDate(safe(row.JobDate))}</td>
            <td>${safe(row.PartyName)}</td>
            <td>${safe(row.BLAWBNo)}</td>
            <td>${safe(row.BLAWBDate)}</td>
            <td>${safe(row.BENo)}</td>
            <td>${safe(row.BEDate)}</td>
            <td>${safe(row.MovementType)}</td>
            <td>${safe(row.TransitType)}</td>
            <td>${safe(row.ModeType)}</td>
            <td>${safe(row.Consignor)}</td>
            <td>${safe(row.Origin)}</td>
            <td>${safe(row.Destination)}</td>
            <td>${safe(row.ClearancePort)}</td>
            <td>${safe(row.CustomsBroker)}</td>
            <td>${safe(row.Quantity)}</td>
            <td>${safe(row.CargoWeight)}</td>
            <td>${safe(row.ClearanceMode)}</td>
            <td>${safe(row.Commodity)}</td>
            <td>${safe(row.AnyInformation)}</td>
            <td class="text-end">${formatAmount(row.TotalAmount)}</td>
            <td class="text-end">${formatAmount(row.SGSTAmt)}</td>
            <td class="text-end">${formatAmount(row.CGSTAmt)}</td>
            <td class="text-end">${formatAmount(row.IGSTAmt)}</td>
            <td class="text-end">${formatAmount(row.TotalGSTAmt)}</td>
            <td class="text-end">${formatAmount(row.GrandTotalAmt)}</td>
            <td>${safe(row.InvoiceNo)}</td>
            <td>${safe(row.InvoiceStatus)}</td>
        </tr>
    `).join('');
}

function safe(value, fallback = '') {
    return value ?? fallback;
}

// ------------------------------
// PAGINATION
// ------------------------------

function renderPagination(totalCount) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = document.getElementById('paginationControls');

    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    addPageItem('Previous', currentPage === 1, () => {
        currentPage--;
        loadTable(getFilters());
    });

    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    startPage = Math.max(1, endPage - maxVisiblePages + 1);

    if (startPage > 1) {
        addPageNumber(1);

        if (startPage > 2) addDots();
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageNumber(i);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) addDots();

        addPageNumber(totalPages);
    }

    addPageItem('Next', currentPage === totalPages, () => {
        currentPage++;
        loadTable(getFilters());
    });

    function addPageNumber(page) {
        addPageItem(page, false, () => {
            currentPage = page;
            loadTable(getFilters());
        }, page === currentPage);
    }

    function addDots() {
        const li = document.createElement('li');
        li.className = 'page-item disabled';
        li.innerHTML = `<span class="page-link">...</span>`;
        pagination.appendChild(li);
    }

    function addPageItem(label, disabled, onClick, active = false) {
        const li = document.createElement('li');

        li.className =
            `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;

        li.innerHTML = `<a class="page-link" href="#">${label}</a>`;

        if (!disabled) {
            li.addEventListener('click', e => {
                e.preventDefault();
                onClick();
            });
        }

        pagination.appendChild(li);
    }
}

// ------------------------------
// FETCH ALL DATA
// ------------------------------

async function fetchAllFilteredData(filters = {}) {
    const allData = [];
    const batchSize = 1000;

    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const to = from + batchSize - 1;

        const { data, error } = await buildQuery(filters)
            .range(from, to);

        if (error) {
            console.error(error);
            break;
        }

        if (!data.length) {
            hasMore = false;
            break;
        }

        allData.push(...data);

        from += batchSize;
    }

    return allData;
}

// ------------------------------
// EXPORT EXCEL
// ------------------------------

async function exportToExcel() {
    const data = await fetchAllFilteredData(getFilters());

    if (!data.length) {
        return alert('No data to export.');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Customs Clearance'
    );

    XLSX.writeFile(workbook, 'ReportCustomsClearance.xlsx');
}

// ------------------------------
// EXPORT PDF
// ------------------------------

async function exportToPdf() {
    const allData = await fetchAllFilteredData(getFilters());

    if (!allData.length) {
        return alert('No data to export.');
    }

    const doc = new window.jspdf.jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const headers = [[
        'Sr No',
        'Job ID',
        'Job Date',
        'Customer',
        'BL/AWB',
        'BE No',
        'Movement',
        'Transit',
        'Mode',
        'Origin',
        'Destination',
        'Invoice No',
        'Status',
        'Grand Total'
    ]];

    const rows = allData.map((row, i) => ([
        i + 1,
        row.JobID || '',
        row.JobDate || '',
        row.PartyName || '',
        row.BLAWBNo || '',
        row.BENo || '',
        row.MovementType || '',
        row.TransitType || '',
        row.ModeType || '',
        row.Origin || '',
        row.Destination || '',
        row.InvoiceNo || '',
        row.InvoiceStatus || '',
        row.GrandTotalAmt || 0
    ]));

    doc.autoTable({
        head: headers,
        body: rows,
        startY: 15,
        styles: {
            fontSize: 7
        },
        didDrawPage: () => {
            doc.setFontSize(11);
            doc.text('Customs Clearance Report', 14, 10);
        }
    });

    doc.save('ReportCustomsClearance.pdf');
}