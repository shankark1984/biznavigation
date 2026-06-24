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

    document.getElementById("invoiceMonth").value = currentMonth;

    document.getElementById("searchBtn").addEventListener("click", loadTaxReport);
    document.getElementById("exportExcelBtn").addEventListener("click", exportToExcel);
    document.getElementById("exportPdfBtn").addEventListener("click", exportToPdf);

    await loadTaxReport();
});

// ==========================
// HELPERS
// ==========================
function toNumber(value) {
    return Number(value) || 0;
}

function formatAmount(value) {
    return toNumber(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB");
}

function showLoading(show) {
    document
        .getElementById("loadingSpinner")
        .classList.toggle("d-none", !show);
}

function getFilters() {
    return {
        invoiceMonth: document.getElementById("invoiceMonth").value,
        invoiceYear: document.getElementById("invoiceYear").value,
        financialYear: document.getElementById("financialYear").value
    };
}

function initializeFinancialYears() {
    const list = document.getElementById("financialYearList");
    list.innerHTML = "";

    const currentYear = new Date().getFullYear();

    for (let year = currentYear - 10; year <= currentYear + 1; year++) {
        const option = document.createElement("option");
        option.value = `${year}-${year + 1}`;
        list.appendChild(option);
    }
}

// ==========================
// PAGE TOTALS
// ==========================
function updatePageTotals(pageRows = []) {
    const totals = pageRows.reduce(
        (acc, row) => {
            acc.nonTaxable += toNumber(row.NonTaxableAmount);
            acc.taxable += toNumber(row.TaxableAmount);
            acc.sgst += toNumber(row.SGST);
            acc.cgst += toNumber(row.CGST);
            acc.igst += toNumber(row.IGST);
            acc.gst += toNumber(row.TotalGST);
            acc.invoice += toNumber(row.TotalInvoiceAmount);
            return acc;
        },
        {
            nonTaxable: 0,
            taxable: 0,
            sgst: 0,
            cgst: 0,
            igst: 0,
            gst: 0,
            invoice: 0
        }
    );

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatAmount(value);
    };

    setText("totalNonTaxable", totals.nonTaxable);
    setText("totalTaxable", totals.taxable);
    setText("totalSGST", totals.sgst);
    setText("totalCGST", totals.cgst);
    setText("totalIGST", totals.igst);
    setText("totalGST", totals.gst);
    setText("totalInvoice", totals.invoice);
}

// ==========================
// LOAD REPORT
// ==========================
async function loadTaxReport() {
    try {
        currentPage = 1;
        showLoading(true);

        let query = supabaseClient
            .from("TaxReportView")
            .select("*")
            .eq("company_id", CompanyID);

        const { invoiceMonth, invoiceYear, financialYear } = getFilters();

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

        // Financial year filter
        if (financialYear) {
            const [startYear, endYear] = financialYear.split("-");
            query = query
                .gte("InvoiceDate", `${startYear}-04-01`)
                .lte("InvoiceDate", `${endYear}-03-31`);
        }

        query = query.order("InvoiceDate", { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        allTaxData = data || [];
        filteredData = [...allTaxData];

        renderTable(filteredData);

        const hasData = filteredData.length > 0;
        document.getElementById("exportExcelBtn").disabled = !hasData;
        document.getElementById("exportPdfBtn").disabled = !hasData;

    } catch (err) {
        console.error(err);
        alert("Failed to load tax report");
        allTaxData = [];
        filteredData = [];
        renderTable([]);
    } finally {
        showLoading(false);
    }
}

// ==========================
// RENDER TABLE
// ==========================
function renderTable(data = []) {
    const tbody = document.getElementById("tableBody");

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // current visible page rows
    const pageData = data.slice(startIndex, endIndex);

    // cumulative rows from 1 to current page end
    const cumulativeData = data.slice(0, endIndex);

    if (!pageData.length) {
        tbody.innerHTML = `
            <tr id="emptyRow">
                <td colspan="13" class="text-center text-muted">
                    No records found
                </td>
            </tr>
        `;
        updatePageTotals([]);
        renderPagination(data.length, () => renderTable(filteredData));
        return;
    }

    tbody.innerHTML = pageData.map((row, index) => `
        <tr>
            <td class="text-center">${startIndex + index + 1}</td>
            <td class="text-center">${formatDate(row.InvoiceDate)}</td>
            <td class="text-center">${row.InvoiceNo || ""}</td>
            <td class="text-start">${row.CustomerName || ""}</td>
            <td class="text-start">${row.State || ""}</td>
            <td class="text-start">${row.GSTNo || ""}</td>
            <td class="text-end">${formatAmount(row.NonTaxableAmount)}</td>
            <td class="text-end">${formatAmount(row.TaxableAmount)}</td>
            <td class="text-end">${formatAmount(row.SGST)}</td>
            <td class="text-end">${formatAmount(row.CGST)}</td>
            <td class="text-end">${formatAmount(row.IGST)}</td>
            <td class="text-end">${formatAmount(row.TotalGST)}</td>
            <td class="text-end">${formatAmount(row.TotalInvoiceAmount)}</td>
        </tr>
    `).join("");

    // 🔥 cumulative total from row 1 to current page
    updatePageTotals(cumulativeData);

    renderPagination(data.length, () => renderTable(filteredData));
}

// ==========================
// PAGINATION
// ==========================
function renderPagination(totalCount, loadTableFn) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = document.getElementById("paginationControls");

    pagination.innerHTML = "";

    if (totalPages <= 1) return;

    const maxVisiblePages = 5;

    // Previous
    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
    prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prevLi.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            loadTableFn();
        }
    });
    pagination.appendChild(prevLi);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    startPage = Math.max(1, endPage - maxVisiblePages + 1);

    if (startPage > 1) {
        addPageButton(1);
        if (startPage > 2) addDots();
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) addDots();
        addPageButton(totalPages);
    }

    // Next
    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextLi.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            loadTableFn();
        }
    });
    pagination.appendChild(nextLi);

    function addPageButton(page) {
        const li = document.createElement("li");
        li.className = `page-item ${page === currentPage ? "active" : ""}`;
        li.innerHTML = `<a class="page-link" href="#">${page}</a>`;
        li.addEventListener("click", (e) => {
            e.preventDefault();
            currentPage = page;
            loadTableFn();
        });
        pagination.appendChild(li);
    }

    function addDots() {
        const li = document.createElement("li");
        li.className = "page-item disabled";
        li.innerHTML = `<span class="page-link">...</span>`;
        pagination.appendChild(li);
    }
}

// ==========================
// EXPORT LIBS
// ==========================
async function loadPdfLibs() {
    if (!window.jspdf) {
        await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
}

async function loadExportLibraries() {
    if (!window.XLSX) {
        await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
    }
}

// ==========================
// FETCH ALL FILTERED DATA FOR EXPORT
// ==========================
async function fetchAllFilteredData(filters = {}) {
    let allData = [];
    const batchSize = 1000;
    let from = 0;
    let to = batchSize - 1;
    let hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from("TaxReportView")
            .select("*")
            .eq("company_id", CompanyID)
            .order("InvoiceDate", { ascending: true });

        // Month filter
        if (filters.invoiceMonth) {
            const [year, month] = filters.invoiceMonth.split("-").map(Number);
            if (!isNaN(year) && !isNaN(month)) {
                const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

                query = query
                    .gte("InvoiceDate", startDate)
                    .lte("InvoiceDate", endDate);
            }
        }

        // Year filter
        if (filters.invoiceYear) {
            const year = parseInt(filters.invoiceYear, 10);
            if (!isNaN(year)) {
                query = query
                    .gte("InvoiceDate", `${year}-01-01`)
                    .lte("InvoiceDate", `${year}-12-31`);
            }
        }

        // Financial year filter
        if (filters.financialYear) {
            const [startYear, endYear] = filters.financialYear.split("-").map(Number);
            if (!isNaN(startYear) && !isNaN(endYear)) {
                query = query
                    .gte("InvoiceDate", `${startYear}-04-01`)
                    .lte("InvoiceDate", `${endYear}-03-31`);
            }
        }

        const { data, error } = await query.range(from, to);

        if (error) {
            console.error("Error fetching data for export:", error);
            break;
        }

        if (data && data.length > 0) {
            allData.push(...data);
            from += batchSize;
            to += batchSize;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

// ==========================
// EXPORT EXCEL
// ==========================
async function exportToExcel() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);

    await loadExportLibraries();

    if (!allData.length) {
        alert("No data to export.");
        return;
    }

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Sr No</th>
                    <th>Invoice Date</th>
                    <th>Invoice No</th>
                    <th>Customer Name</th>
                    <th>State</th>
                    <th>GST No</th>
                    <th>Non-Taxable Amount</th>
                    <th>Taxable Amount</th>
                    <th>SGST Amount</th>
                    <th>CGST Amount</th>
                    <th>IGST Amount</th>
                    <th>Total GST Amount</th>
                    <th>Total Invoice Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        tableHtml += `
            <tr>
                <td>${i + 1}</td>
                <td>${formatDate(row.InvoiceDate)}</td>
                <td>${row.InvoiceNo || ""}</td>
                <td>${row.CustomerName || ""}</td>
                <td>${row.State || ""}</td>
                <td>${row.GSTNo || ""}</td>
                <td>${toNumber(row.NonTaxableAmount)}</td>
                <td>${toNumber(row.TaxableAmount)}</td>
                <td>${toNumber(row.SGST)}</td>
                <td>${toNumber(row.CGST)}</td>
                <td>${toNumber(row.IGST)}</td>
                <td>${toNumber(row.TotalGST)}</td>
                <td>${toNumber(row.TotalInvoiceAmount)}</td>
            </tr>
        `;
    }

    tableHtml += `</tbody></table>`;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = tableHtml;

    const wb = XLSX.utils.table_to_book(tempDiv.querySelector("table"), {
        sheet: "GST Report"
    });

    XLSX.writeFile(wb, "GSTReport.xlsx");
}

// ==========================
// EXPORT PDF
// ==========================
async function exportToPdf() {
    const filters = getFilters();
    const allData = await fetchAllFilteredData(filters);

    await loadPdfLibs();

    if (!allData.length) {
        alert("No data to export.");
        return;
    }

    const doc = new window.jspdf.jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const headers = [[
        "Sr No",
        "Invoice Date",
        "Invoice No",
        "Customer Name",
        "State",
        "GST No",
        "Non-Taxable Amount",
        "Taxable Amount",
        "SGST Amount",
        "CGST Amount",
        "IGST Amount",
        "Total GST Amount",
        "Total Invoice Amount"
    ]];

    const totals = {
        nonTaxable: 0,
        taxable: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        gst: 0,
        invoice: 0
    };

    const rows = allData.map((row, i) => {
        totals.nonTaxable += toNumber(row.NonTaxableAmount);
        totals.taxable += toNumber(row.TaxableAmount);
        totals.sgst += toNumber(row.SGST);
        totals.cgst += toNumber(row.CGST);
        totals.igst += toNumber(row.IGST);
        totals.gst += toNumber(row.TotalGST);
        totals.invoice += toNumber(row.TotalInvoiceAmount);

        return [
            i + 1,
            formatDate(row.InvoiceDate),
            row.InvoiceNo || "",
            row.CustomerName || "",
            row.State || "",
            row.GSTNo || "",
            formatAmount(row.NonTaxableAmount),
            formatAmount(row.TaxableAmount),
            formatAmount(row.SGST),
            formatAmount(row.CGST),
            formatAmount(row.IGST),
            formatAmount(row.TotalGST),
            formatAmount(row.TotalInvoiceAmount)
        ];
    });

    // Grand total row
    rows.push([
        "",
        "",
        "",
        "GRAND TOTAL",
        "",
        "",
        formatAmount(totals.nonTaxable),
        formatAmount(totals.taxable),
        formatAmount(totals.sgst),
        formatAmount(totals.cgst),
        formatAmount(totals.igst),
        formatAmount(totals.gst),
        formatAmount(totals.invoice)
    ]);

    doc.autoTable({
        head: headers,
        body: rows,
        startY: 18,
        margin: { left: 5, right: 5 },
        theme: "grid",
        styles: {
            fontSize: 6.5,
            cellPadding: 1.2,
            overflow: "linebreak",
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            textColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [0, 123, 255],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center"
        },
        columnStyles: {
            0: { halign: "center" },
            6: { halign: "right" },
            7: { halign: "right" },
            8: { halign: "right" },
            9: { halign: "right" },
            10: { halign: "right" },
            11: { halign: "right" },
            12: { halign: "right" }
        },
        didParseCell(data) {
            if (data.section === "body" && data.row.index === rows.length - 1) {
                data.cell.styles.fillColor = [230, 230, 230];
                data.cell.styles.fontStyle = "bold";
            }
        },
        didDrawPage(data) {
            doc.setFontSize(12);
            doc.setFont(undefined, "bold");
            doc.text("GST Invoice Report", data.settings.margin.left, 10);

            doc.setFontSize(8);
            doc.setFont(undefined, "normal");
            doc.text(
                `Generated On : ${new Date().toLocaleString()}`,
                data.settings.margin.left,
                15
            );
        }
    });

    doc.save("GST Invoice Report.pdf");
}