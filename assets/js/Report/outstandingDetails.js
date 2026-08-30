document.addEventListener('DOMContentLoaded', async () => {
    // const CompanyID = localStorage.getItem('CompanyID'); 

    await Promise.all([
        loadCustomerOutstanding(),
        loadVendorOutstanding()
    ]);

    const excelBtn = document.getElementById('exportExcelBtn');
    const pdfBtn = document.getElementById('exportPdfBtn');

    if (excelBtn) excelBtn.addEventListener('click', exportToExcel);
    if (pdfBtn) pdfBtn.addEventListener('click', exportToPDF);

    // Tab Event Listeners: Update dropdown filter when switching tabs
    document.getElementById('customer-tab').addEventListener('click', () => {
        populatePartyFilter('Customer');
        resetAndApplyFilter('customerTableBody');
    });

    document.getElementById('vendor-tab').addEventListener('click', () => {
        populatePartyFilter('Vendor');
        resetAndApplyFilter('vendorTableBody');
    });

    // Dropdown Filter Event Listener
    document.getElementById('partyFilter').addEventListener('change', (e) => {
        const activeTabPane = document.querySelector('.tab-pane.active');
        if (activeTabPane) {
            resetAndApplyFilter(activeTabPane.querySelector('tbody').id, e.target.value);
        }
    });
});

// ==========================================
// Global State & Constants
// ==========================================
const partyLists = { Customer: [], Vendor: [] };
const BUCKET_KEYS = ['0_10', '11_20', '21_30', '41_50', '51_60', '71_80', '91_100', '111_120', 'gt_121'];

function populatePartyFilter(type) {
    const filter = document.getElementById('partyFilter');
    if (!filter) return;

    filter.innerHTML = '<option value="" selected>All Parties</option>';
    const fragment = document.createDocumentFragment();

    partyLists[type].forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        option.textContent = party;
        fragment.appendChild(option);
    });

    filter.appendChild(fragment);
}

function resetAndApplyFilter(tbodyId, selectedParty = '') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const allSummaryRows = tbody.querySelectorAll('[class*="summary-row-"]');
    tbody.querySelectorAll('[class*="group-child-"]').forEach(row => row.style.display = 'none');

    // Track filtered grand totals
    const filteredGrandTotals = Object.fromEntries([...BUCKET_KEYS, 'overall'].map(k => [k, 0]));

    allSummaryRows.forEach(row => {
        const partyName = row.getAttribute('data-party');
        const match = row.className.match(/summary-row-(\d+)/);
        const groupIndex = match ? match[1] : null;

        if (!selectedParty) {
            row.style.display = '';
            const btn = row.querySelector('.toggle-btn');
            if (btn) {
                btn.dataset.collapsed = 'true';
                btn.innerHTML = '<i class="bi bi-plus-square text-secondary"></i>';
            }
            // When "All Parties" is selected, add summary row totals to grand total
            addSummaryRowTotalsToGrandTotal(row, filteredGrandTotals);

        } else if (partyName === selectedParty) {
            row.style.display = 'none';
            if (groupIndex) {
                const childRows = tbody.querySelectorAll(`.group-child-${groupIndex}`);
                childRows.forEach(child => {
                    child.style.display = '';
                    // If it's the subtotal row of this group, extract its numbers for the grand total
                    if (child.classList.value.includes('table-info')) {
                        addSubtotalRowTotalsToGrandTotal(child, filteredGrandTotals);
                    }
                });
            }
        } else {
            row.style.display = 'none';
        }
    });

    // Update the table footer with the newly calculated totals
    updateFooterTotals(tbodyId, filteredGrandTotals);
}

// Helper to extract totals from a collapsed summary row
function addSummaryRowTotalsToGrandTotal(row, totalsObj) {
    const cells = row.querySelectorAll('td');
    // Bucket columns start from index 3 up to 11 (9 buckets), and index 12 is overall total
    BUCKET_KEYS.forEach((key, index) => {
        const cellValue = parseCurrencyValue(cells[3 + index].textContent);
        totalsObj[key] += cellValue;
    });
    totalsObj['overall'] += parseCurrencyValue(cells[12].textContent);
}

// Helper to extract totals from an expanded subtotal row
function addSubtotalRowTotalsToGrandTotal(row, totalsObj) {
    const cells = row.querySelectorAll('td');
    // In subtotal rows, because colspan="3" shifts cells: buckets start at index 1 to 9, overall at index 10
    BUCKET_KEYS.forEach((key, index) => {
        const cellValue = parseCurrencyValue(cells[1 + index].textContent);
        totalsObj[key] += cellValue;
    });
    totalsObj['overall'] += parseCurrencyValue(cells[10].textContent);
}

function parseCurrencyValue(text) {
    if (!text || text === '-') return 0;
    // Remove commas and convert to float
    return parseFloat(text.replace(/,/g, '')) || 0;
}

// ==========================================
// Data Fetching
// ==========================================

async function fetchOutstandingData(viewName, dateColumn) {
    const { data, error } = await supabaseClient
        .from(viewName)
        .select('*')
        .eq('company_id', CompanyID)
        .neq('PaymentStatus', 'Paid')
        .gt('BalanceAmount', 0)
        .order('PartyName', { ascending: true })
        .order(dateColumn, { ascending: true });

    if (error) throw error;
    return data;
}

async function loadCustomerOutstanding() {
    try {
        const data = await fetchOutstandingData('InvoicePaymentView', 'InvoiceDate');
        renderTableData(data, 'customerTableBody', 'Customer');
    } catch (err) {
        console.error('Error loading customer outstanding:', err);
        document.getElementById('customerTableBody').innerHTML =
            `<tr><td colspan="14" class="text-center text-danger">Failed to load customer data.</td></tr>`;
    }
}

async function loadVendorOutstanding() {
    try {
        const data = await fetchOutstandingData('VendorBillPaymentView', 'BillDate');
        renderTableData(data, 'vendorTableBody', 'Vendor');
    } catch (err) {
        console.error('Error loading vendor outstanding:', err);
        document.getElementById('vendorTableBody').innerHTML =
            `<tr><td colspan="14" class="text-center text-danger">Failed to load vendor data.</td></tr>`;
    }
}

// ==========================================
// Table Rendering & Logic
// ==========================================

function renderTableData(data, tbodyId, type) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center text-muted py-4">No outstanding records found.</td></tr>`;
        return;
    }

    const groupedData = data.reduce((acc, row) => {
        const partyName = row.PartyName || 'Unknown Party';
        if (!acc[partyName]) acc[partyName] = [];
        acc[partyName].push(row);
        return acc;
    }, {});

    partyLists[type] = Object.keys(groupedData).sort((a, b) => a.localeCompare(b));

    const activeTabId = document.querySelector('.nav-link.active')?.id;
    if ((type === 'Customer' && activeTabId === 'customer-tab') ||
        (type === 'Vendor' && activeTabId === 'vendor-tab')) {
        populatePartyFilter(type);
    }

    const grandTotals = Object.fromEntries([...BUCKET_KEYS, 'overall'].map(k => [k, 0]));
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const isCustomer = type === 'Customer';
    const dateField = isCustomer ? 'InvoiceDate' : 'BillDate';
    const noField = isCustomer ? 'InvoiceNo' : 'BillNo';

    const fragment = document.createDocumentFragment();
    let groupIndex = 0;

    for (const [partyName, rows] of Object.entries(groupedData)) {
        groupIndex++;
        const safePartyName = partyName.replace(/"/g, '&quot;');
        const partyTotals = Object.fromEntries([...BUCKET_KEYS, 'overall'].map(k => [k, 0]));

        let childRowsHTML = '';
        const invoiceRowsCount = rows.length;

        rows.forEach((row, index) => {
            const balanceAmount = parseFloat(row.BalanceAmount) || 0;
            const billDate = new Date(row[dateField]);
            billDate.setHours(0, 0, 0, 0);

            const pendingDays = Math.ceil(Math.abs(currentDate - billDate) / (1000 * 60 * 60 * 24));
            const bucketKey = getBucketKey(pendingDays);

            partyTotals[bucketKey] += balanceAmount;
            partyTotals['overall'] += balanceAmount;
            grandTotals[bucketKey] += balanceAmount;
            grandTotals['overall'] += balanceAmount;

            const rowspanCell = index === 0 ? `
                <td class="align-top fw-bold border-end" rowspan="${invoiceRowsCount}" style="width: 250px;">
                    <div class="d-flex align-items-start text-wrap">
                        <span class="toggle-btn me-2 mt-1" data-group="${groupIndex}" data-collapsed="false" style="cursor:pointer;" title="Collapse">
                            <i class="bi bi-dash-square text-secondary"></i>
                        </span>
                        <span>${partyName}</span>
                    </div>
                </td>` : '';

            childRowsHTML += `
                <tr class="group-child-${groupIndex} bg-white" data-party="${safePartyName}" style="display: none;">
                    ${rowspanCell}
                    <td>${row[noField] || '(blank)'}</td>
                    <td>${formatDate(billDate)}</td>
                    ${generateBucketsHTML(bucketKey, balanceAmount)}
                    <td class="text-end">${formatCurrency(balanceAmount)}</td>
                    <td class="text-center fw-medium">${pendingDays}</td>
                </tr>
            `;
        });

        // Subtotal Row 
        childRowsHTML += `
            <tr class="group-child-${groupIndex} fw-bold table-info" data-party="${safePartyName}" style="display: none;">
                <td colspan="3" class="text-center border-end text-dark">${partyName} Total</td>
                ${generateSummaryBucketsHTML(partyTotals)}
                <td class="text-end text-primary">${formatCurrency(partyTotals['overall'])}</td>
                <td></td>
            </tr>
        `;

        // Collapsed Summary Row 
        const summaryRow = document.createElement('tr');
        summaryRow.className = `summary-row-${groupIndex} fw-bold table-light border-bottom`;
        summaryRow.setAttribute('data-party', partyName);
        summaryRow.innerHTML = `
            <td class="align-middle border-end" style="width: 250px;">
                <div class="d-flex align-items-center text-wrap">
                    <span class="toggle-btn me-2" data-group="${groupIndex}" data-collapsed="true" style="cursor:pointer;" title="Expand">
                        <i class="bi bi-plus-square text-secondary"></i>
                    </span>
                    <span class="text-dark">${partyName}</span>
                </div>
            </td>
            <td></td>
            <td></td>
            ${generateSummaryBucketsHTML(partyTotals)}
            <td class="text-end text-primary">${formatCurrency(partyTotals['overall'])}</td>
            <td></td>
        `;

        fragment.appendChild(summaryRow);

        const tempDiv = document.createElement('tbody');
        tempDiv.innerHTML = childRowsHTML;
        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }
    }

    tbody.appendChild(fragment);
    setupEventDelegation(tbody);
    updateFooterTotals(tbodyId, grandTotals);
}

// ==========================================
// Toggle Click Handler
// ==========================================

function handleToggleClick(e) {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;

    const tbody = btn.closest('tbody');
    const groupIndex = btn.dataset.group;
    const isOpening = btn.dataset.collapsed === 'true';

    const filterDropdown = document.getElementById('partyFilter');
    const selectedParty = filterDropdown ? filterDropdown.value : '';

    if (isOpening) {
        tbody.querySelectorAll('.toggle-btn[data-collapsed="false"]').forEach(openBtn => {
            if (openBtn.closest('tr').style.display !== 'none') {
                const openGroupIndex = openBtn.dataset.group;
                if (openGroupIndex !== groupIndex) {
                    const summary = tbody.querySelector(`.summary-row-${openGroupIndex}`);
                    tbody.querySelectorAll(`.group-child-${openGroupIndex}`).forEach(row => row.style.display = 'none');

                    if (summary) {
                        const partyName = summary.getAttribute('data-party');
                        summary.style.display = (!selectedParty || partyName === selectedParty) ? '' : 'none';
                    }
                }
            }
        });
    }

    const summaryRow = tbody.querySelector(`.summary-row-${groupIndex}`);
    const childRows = tbody.querySelectorAll(`.group-child-${groupIndex}`);

    if (isOpening) {
        if (summaryRow) summaryRow.style.display = 'none';
        childRows.forEach(row => row.style.display = '');
    } else {
        if (summaryRow) {
            const partyName = summaryRow.getAttribute('data-party');
            summaryRow.style.display = (!selectedParty || partyName === selectedParty) ? '' : 'none';
        }
        childRows.forEach(row => row.style.display = 'none');
    }
}

// ==========================================
// Utility Helpers
// ==========================================

function generateSummaryBucketsHTML(totalsObj) {
    return BUCKET_KEYS.map(key => {
        const val = totalsObj[key];
        return `<td class="text-end ${val > 0 ? 'text-dark' : 'text-muted'}">${val > 0 ? formatCurrency(val) : '-'}</td>`;
    }).join('');
}

function getBucketKey(days) {
    if (days <= 10) return '0_10';
    if (days <= 20) return '11_20';
    if (days <= 30) return '21_30';
    if (days <= 50) return '41_50';
    if (days <= 60) return '51_60';
    if (days <= 80) return '71_80';
    if (days <= 100) return '91_100';
    if (days <= 120) return '111_120';
    return 'gt_121';
}

function generateBucketsHTML(activeKey, amount) {
    return BUCKET_KEYS.map(key =>
        `<td class="text-end ${key === activeKey ? 'fw-medium text-dark' : 'text-muted'}">${key === activeKey ? formatCurrency(amount) : '-'}</td>`
    ).join('');
}

function updateFooterTotals(tbodyId, totals) {
    const tfoot = document.getElementById(tbodyId).closest('table').querySelector('tfoot');
    if (!tfoot) return;

    const footerCells = tfoot.querySelectorAll('td');
    if (footerCells.length >= 10) {
        BUCKET_KEYS.forEach((key, index) => {
            footerCells[index].textContent = formatCurrency(totals[key]);
        });
        footerCells[9].textContent = formatCurrency(totals['overall']);
    }
}

function setupEventDelegation(tbody) {
    tbody.removeEventListener('click', handleToggleClick);
    tbody.addEventListener('click', handleToggleClick);
}

function formatDate(dateObj) {
    if (isNaN(dateObj.getTime())) return '-';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${dateObj.getFullYear()}`;
}

function formatCurrency(amount) {
    if (!amount || amount === 0) return '-';
    return Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getActiveTableAndType() {
    const activeTabPane = document.querySelector('.tab-pane.active');
    if (!activeTabPane) return null;
    const table = activeTabPane.querySelector('table');
    const type = activeTabPane.id.includes('customer') ? 'Customer' : 'Vendor';
    return { table, type };
}

// ==========================================
// Export Functionality (Filtered, Expanded & Cleaned)
// ==========================================

function getFilteredExportTable() {
    const { table, type } = getActiveTableAndType() || {};
    if (!table) return null;

    const filterDropdown = document.getElementById('partyFilter');
    const selectedParty = filterDropdown ? filterDropdown.value : '';

    const tableClone = table.cloneNode(true);

    // Remove top summary rows and filter out unselected parties simultaneously
    tableClone.querySelectorAll('tr').forEach(row => {
        if (row.classList.value.includes('summary-row-')) {
            row.remove();
            return;
        }
        const partyAttr = row.getAttribute('data-party');
        if (selectedParty && partyAttr && partyAttr !== selectedParty) {
            row.remove();
        }
    });

    // Force expand all remaining rows
    tableClone.querySelectorAll('tr[style*="display: none"]').forEach(row => row.style.display = '');

    return { table: tableClone, type };
}

function exportToExcel() {
    const exportData = getFilteredExportTable();
    if (!exportData) return;
    const { table, type } = exportData;

    const wb = XLSX.utils.table_to_book(table, { raw: true });
    const filename = `${type}_Outstanding_Report_${formatDate(new Date())}.xlsx`;
    XLSX.writeFile(wb, filename);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const exportData = getFilteredExportTable();
    if (!exportData) return;
    const { table, type } = exportData;

    const doc = new jsPDF('l', 'pt', 'a4');

    doc.setFontSize(16);
    doc.text(`${type} Outstanding Report`, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated on: ${formatDate(new Date())}`, 40, 60);

    doc.autoTable({
        html: table,
        startY: 75,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [52, 58, 64] },
        footStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold' },
        didParseCell: function (data) {
            const firstCellText = data.cell.text && data.cell.text[0] ? data.cell.text[0] : '';
            if (data.row.section === 'body' && firstCellText.includes('Total')) {
                data.cell.styles.fillColor = [207, 244, 252];
                data.cell.styles.textColor = [13, 202, 240];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save(`${type}_Outstanding_Report_${formatDate(new Date())}.pdf`);
}