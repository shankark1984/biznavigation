const CompanyID = localStorage.getItem("CompanyID");

let allTaxData = [];
let filteredData = [];
let currentPage = 1;
const pageSize = 50;

document.addEventListener("DOMContentLoaded", async () => {
    initializeFinancialYears();

    // Set current month as default
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    document.getElementById("invoiceMonth").value = currentMonth;

    document.getElementById("searchBtn")
        .addEventListener("click", loadTaxReport);

    await loadTaxReport();
});

async function loadTaxReport() {
    try {
        currentPage = 1;
        showLoading(true);

        let query = supabaseClient
            .from("TaxReportView")
            .select("*")
            .eq("company_id", CompanyID);

        const invoiceMonth =
            document.getElementById("invoiceMonth").value;

        const invoiceYear =
            document.getElementById("invoiceYear").value;

        const financialYear =
            document.getElementById("financialYear").value;

        // Month filter
        if (invoiceMonth) {
            const startDate = `${invoiceMonth}-01`;

            const endDate = new Date(
                new Date(startDate).getFullYear(),
                new Date(startDate).getMonth() + 1,
                0
            )
                .toISOString()
                .split("T")[0];

            query = query
                .gte("InvoiceDate", startDate)
                .lte("InvoiceDate", endDate);
        }

        // Year filter
        if (invoiceYear) {
            query = query
                .gte("InvoiceDate", `${invoiceYear}-01-01`)
                .lte("InvoiceDate", `${invoiceYear}-12-31`);
        }

        // Financial Year filter
        if (financialYear) {
            const [startYear, endYear] =
                financialYear.split("-");

            query = query
                .gte("InvoiceDate", `${startYear}-04-01`)
                .lte("InvoiceDate", `${endYear}-03-31`);
        }

        query = query.order("InvoiceDate", {
            ascending: true
        });

        const { data, error } = await query;

        if (error) throw error;

        allTaxData = data || [];
        filteredData = [...allTaxData];

        renderTable(filteredData);

        document.getElementById("exportExcelBtn").disabled =
            filteredData.length === 0;

        document.getElementById("exportPdfBtn").disabled =
            filteredData.length === 0;

    } catch (err) {
        console.error(err);
        alert("Failed to load tax report");
    } finally {
        showLoading(false);
    }
}

function renderTable(data) {
    const tbody = document.getElementById("tableBody");

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const pageData = data.slice(startIndex, endIndex);

    if (!pageData.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center text-muted">
                    No records found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map((row, index) => `
        <tr>
            <td>${startIndex + index + 1}</td>
            <td>${formatDate(row.InvoiceDate)}</td>
            <td>${row.InvoiceNo || ""}</td>
            <td>${row.CustomerName || ""}</td>
            <td>${row.State || ""}</td>
            <td>${row.GSTNo || ""}</td>
            <td>${formatAmount(row.TotalInvoiceAmount)}</td>
            <td>${formatAmount(row.NonTaxableAmount)}</td>
            <td>${formatAmount(row.TaxableAmount)}</td>
            <td>${formatAmount(row.SGST)}</td>
            <td>${formatAmount(row.CGST)}</td>
            <td>${formatAmount(row.IGST)}</td>
            <td>${formatAmount(row.TotalGST)}</td>
        </tr>
    `).join("");

    renderPagination(data.length, () => {
        renderTable(filteredData);
    });
}

function showLoading(show) {
    document
        .getElementById("loadingSpinner")
        .classList.toggle("d-none", !show);
}

function initializeFinancialYears() {
    const list = document.getElementById("financialYearList");

    const currentYear = new Date().getFullYear();

    for (let year = currentYear - 10; year <= currentYear + 1; year++) {
        const option = document.createElement("option");
        option.value = `${year}-${year + 1}`;
        list.appendChild(option);
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
            loadTableFn();
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
            loadTableFn();
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
            loadTableFn();
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
function getFilters() {
    return {
        invoiceMonth: document.getElementById("invoiceMonth").value,
        invoiceYear: document.getElementById("invoiceYear").value,
        financialYear: document.getElementById("financialYear").value
    };
}

async function loadPdfLibs() {
    if (!window.jspdf) {
        await import(
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        );
    }
}
async function loadExportLibraries() {
    if (!window.XLSX) {
        await import(
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
        );
    }
}

async function fetchAllFilteredData(filters = {}) {
    let allData = [];
    let batchSize = 1000;
    let from = 0;
    let to = batchSize - 1;
    let hasMore = true;

    while (hasMore) {

        let query = supabaseClient
            .from('TaxReportView')
            .select('*')
            .eq('company_id', CompanyID)
            .order('InvoiceDate', { ascending: true });

        // ==========================
        // MONTH FILTER
        // ==========================
        if (filters.invoiceMonth) {

            let [part1, part2] = filters.invoiceMonth.split('-');

            let month, year;

            // Handle both MM-YYYY and YYYY-MM
            if (parseInt(part1) > 12) {
                year = parseInt(part1);
                month = parseInt(part2);
            } else {
                month = parseInt(part1);
                year = parseInt(part2);
            }

            if (!isNaN(month) && !isNaN(year)) {

                const startDate =
                    `${year}-${String(month).padStart(2, '0')}-01`;

                const lastDay =
                    new Date(year, month, 0).getDate();

                const endDate =
                    `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                query = query
                    .gte('InvoiceDate', startDate)
                    .lte('InvoiceDate', endDate);

                console.log('Month Filter:', filters.invoiceMonth);
                console.log('Start Date:', startDate);
                console.log('End Date:', endDate);
            }
        }

        // ==========================
        // YEAR FILTER
        // ==========================
        else if (filters.invoiceYear) {

            const year = parseInt(filters.invoiceYear);

            if (!isNaN(year)) {

                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                query = query
                    .gte('InvoiceDate', startDate)
                    .lte('InvoiceDate', endDate);

                console.log('Year Filter:', year);
                console.log('Start Date:', startDate);
                console.log('End Date:', endDate);
            }
        }

        // ==========================
        // FINANCIAL YEAR FILTER
        // ==========================
        if (filters.financialYear) {

            const [startYear, endYear] =
                filters.financialYear.split('-').map(Number);

            query = query
                .gte('InvoiceDate', `${startYear}-04-01`)
                .lte('InvoiceDate', `${endYear}-03-31`);

            console.log(
                'Financial Year:',
                `${startYear}-04-01`,
                `${endYear}-03-31`
            );
        }

        const { data, error } = await query.range(from, to);

        if (error) {
            console.error('Error fetching data for export:', error);
            break;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += batchSize;
            to += batchSize;
        } else {
            hasMore = false;
        }
    }

    return allData;
}
async function exportToExcel() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);
    await loadExportLibraries();
    if (allData.length === 0) return alert('No data to export.');

    let tableHtml = `<table><thead><tr>
        <th>Sr No</th><th>Invoice Date</th><th>Invoice No</th><th>Customer Name</th>
        <th>State</th><th>GST No</th><th>Total InvoiceAmount</th><th>Non-Taxable Amount</th><th>Taxable Amount</th>
        <th>CGST Amount</th><th>SGST Amount</th><th>IGST Amount</th>
        <th>Total GST Amount</th></thead><tbody>`;

    for (let i = 0; i < allData.length; i++) {
        const row = allData[i];

        tableHtml += `<tr>
            <td>${i + 1}</td>
            <td>${row.InvoiceDate || ''}</td>
            <td>${row.InvoiceNo || ''}</td>
            <td>${row.CustomerName || ''}</td>
            <td>${row.State}</td>
            <td>${row.GSTNo || '0'}</td>
            <td>${row.TotalInvoiceAmount || '0'}</td>
            <td>${row.NonTaxableAmount || '0'}</td>
            <td>${row.TaxableAmount || '0'}</td>
            <td>${row.SGST || '0'}</td>
            <td>${row.CGST || '0'}</td>
            <td>${row.IGST || '0'}</td>
            <td>${row.TotalGST || '0'}</td>
        </tr>`;
    }

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

    await loadPdfLibs();

    if (!allData.length) {
        alert('No data to export.');
        return;
    }

    const doc = new window.jspdf.jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const headers = [
        'Sr No',
        'Invoice Date',
        'Invoice No',
        'Customer Name',
        'State',
        'GST No',
        'Total Invoice Amount',
        'Non-Taxable Amount',
        'Taxable Amount',
        'CGST Amount',
        'SGST Amount',
        'IGST Amount',
        'Total GST Amount'
    ];

    const formatNumber = (value) => {
        return (parseFloat(value) || 0).toFixed(2);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString('en-GB');
    };

    // ==========================
    // GRAND TOTALS
    // ==========================
    const totals = {
        TotalInvoiceAmount: 0,
        NonTaxableAmount: 0,
        TaxableAmount: 0,
        CGST: 0,
        SGST: 0,
        IGST: 0,
        TotalGST: 0
    };

    allData.forEach(row => {
        totals.TotalInvoiceAmount += Number(row.TotalInvoiceAmount || 0);
        totals.NonTaxableAmount += Number(row.NonTaxableAmount || 0);
        totals.TaxableAmount += Number(row.TaxableAmount || 0);
        totals.CGST += Number(row.CGST || 0);
        totals.SGST += Number(row.SGST || 0);
        totals.IGST += Number(row.IGST || 0);
        totals.TotalGST += Number(row.TotalGST || 0);
    });

    // ==========================
    // DATA ROWS
    // ==========================
    const rows = allData.map((row, i) => [
        i + 1,
        formatDate(row.InvoiceDate),
        row.InvoiceNo || '',
        row.CustomerName || '',
        row.State || '',
        row.GSTNo || '',
        formatNumber(row.TotalInvoiceAmount),
        formatNumber(row.NonTaxableAmount),
        formatNumber(row.TaxableAmount),
        formatNumber(row.CGST),
        formatNumber(row.SGST),
        formatNumber(row.IGST),
        formatNumber(row.TotalGST)
    ]);

    // ==========================
    // GRAND TOTAL ROW
    // ==========================
    rows.push([
        '',
        '',
        '',
        'GRAND TOTAL',
        '',
        '',
        formatNumber(totals.TotalInvoiceAmount),
        formatNumber(totals.NonTaxableAmount),
        formatNumber(totals.TaxableAmount),
        formatNumber(totals.CGST),
        formatNumber(totals.SGST),
        formatNumber(totals.IGST),
        formatNumber(totals.TotalGST)
    ]);

    // ==========================
    // PDF TABLE
    // ==========================
    doc.autoTable({
        head: [headers],
        body: rows,

        startY: 18,
        margin: {
            left: 5,
            right: 5
        },

        theme: 'grid',

        styles: {
            fontSize: 6.5,
            cellPadding: 1.2,
            overflow: 'linebreak',
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            textColor: [0, 0, 0]
        },

        headStyles: {
            fillColor: [0, 123, 255],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },

        columnStyles: {
            0: { halign: 'center' }, // Sr No
            6: { halign: 'right' },  // Total Invoice Amount
            7: { halign: 'right' },  // Non-Taxable Amount
            8: { halign: 'right' },  // Taxable Amount
            9: { halign: 'right' },  // CGST Amount
            10: { halign: 'right' }, // SGST Amount
            11: { halign: 'right' }, // IGST Amount
            12: { halign: 'right' }  // Total GST Amount
        },

        didParseCell: function (data) {
            if (
                data.section === 'body' &&
                data.row.index === rows.length - 1
            ) {
                data.cell.styles.fillColor = [230, 230, 230];
                data.cell.styles.fontStyle = 'bold';
            }
        },

        didDrawPage: function (data) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(
                'Customer Invoice Report',
                data.settings.margin.left,
                10
            );

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(
                `Generated On : ${new Date().toLocaleString()}`,
                data.settings.margin.left,
                15
            );
        }
    });

    // ==========================
    // SAVE PDF
    // ==========================
    doc.save('CustomerInvoiceReport.pdf');
}