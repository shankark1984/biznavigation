document.addEventListener('DOMContentLoaded', async () => {
    // Ensure CompanyID is defined globally or fetched here
    // const CompanyID = localStorage.getItem('CompanyID'); 

    await Promise.all([
        loadCustomerOutstanding(),
        loadVendorOutstanding()
    ]);

    // Tab Event Listeners (Use only if triggering a resize/refresh is actually needed)
    document.getElementById('customer-tab').addEventListener('click', () => {
        // Optional logic
    });

    document.getElementById('vendor-tab').addEventListener('click', () => {
        // Optional logic
    });
});

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
            `<tr><td colspan="13" class="text-center text-danger">Failed to load customer data.</td></tr>`;
    }
}

async function loadVendorOutstanding() {
    try {
        const data = await fetchOutstandingData('VendorBillPaymentView', 'BillDate');
        renderTableData(data, 'vendorTableBody', 'Vendor');
    } catch (err) {
        console.error('Error loading vendor outstanding:', err);
        document.getElementById('vendorTableBody').innerHTML =
            `<tr><td colspan="13" class="text-center text-danger">Failed to load vendor data.</td></tr>`;
    }
}

// ==========================================
// Table Rendering & Logic
// ==========================================

function renderTableData(data, tbodyId, type) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted">No outstanding records found.</td></tr>`;
        return;
    }

    // Group data by PartyName
    const groupedData = data.reduce((acc, row) => {
        const partyName = row.PartyName || 'Unknown Party';
        if (!acc[partyName]) acc[partyName] = [];
        acc[partyName].push(row);
        return acc;
    }, {});

    // Totals trackers exactly matching your 9 HTML buckets
    const grandTotals = {
        '0_10': 0, '11_20': 0, '21_30': 0, '41_50': 0, '51_60': 0,
        '71_80': 0, '91_100': 0, '111_120': 0, 'gt_121': 0, 'overall': 0
    };

    // Strip time from current date for accurate day calculation
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Map fields outside the loop for performance
    const isCustomer = type === 'Customer';
    const dateField = isCustomer ? 'InvoiceDate' : 'BillDate';
    const noField = isCustomer ? 'InvoiceNo' : 'BillNo';

    const fragment = document.createDocumentFragment();
    let groupIndex = 0; // Used for identifying rows for the toggle functionality

    for (const [partyName, rows] of Object.entries(groupedData)) {
        groupIndex++;
        let firstRow = true;

        rows.forEach((row) => {
            const tr = document.createElement('tr');

            // Add identifying class to child rows so they can be toggled later
            if (!firstRow) {
                tr.classList.add(`group-child-${groupIndex}`);
            }

            const balanceAmount = parseFloat(row.BalanceAmount) || 0;
            const billDate = new Date(row[dateField]);
            billDate.setHours(0, 0, 0, 0);

            // Calculate aging days
            const diffTime = Math.abs(currentDate - billDate);
            const pendingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Determine bucket and update totals
            const bucketKey = getBucketKey(pendingDays);
            grandTotals[bucketKey] += balanceAmount;
            grandTotals['overall'] += balanceAmount;

            // Generate HTML for all 9 buckets
            const bucketsHTML = generateBucketsHTML(bucketKey, balanceAmount);

            // Build Row HTML
            let rowHTML = '';

            // Render Party Name only on the first row with Collapse/Expand Toggle
            if (firstRow) {
                rowHTML += `
                    <td rowspan="${rows.length}" class="fw-bold align-middle party-cell">
                        <span class="toggle-btn" data-group="${groupIndex}" data-collapsed="false" style="cursor:pointer;" title="Click to Collapse/Expand">
                            <i class="bi bi-dash-square text-secondary me-2"></i>
                        </span>
                        ${partyName}
                    </td>
                `;
                firstRow = false;
            }

            rowHTML += `
                <td>${row[noField] || '-'}</td>
                <td><i class="bi bi-calendar3 text-muted me-1"></i> ${formatDate(billDate)}</td>
                ${bucketsHTML}
                <td class="text-end fw-bold text-primary">${formatCurrency(balanceAmount)}</td>
            `;

            tr.innerHTML = rowHTML;
            fragment.appendChild(tr);
        });
    }

    // Append everything at once
    tbody.appendChild(fragment);

    // Attach ONE event listener via Event Delegation for all toggles
    setupEventDelegation(tbody);

    // Update Footer Totals
    updateFooterTotals(tbodyId, grandTotals);
}

// ==========================================
// Utility Helpers
// ==========================================

function getBucketKey(days) {
    // Maps perfectly to the 9 columns in your HTML
    if (days <= 10) return '0_10';
    if (days <= 20) return '11_20';
    if (days <= 30) return '21_30';
    if (days <= 50) return '41_50'; // Catches 31-50
    if (days <= 60) return '51_60';
    if (days <= 80) return '71_80'; // Catches 61-80
    if (days <= 100) return '91_100'; // Catches 81-100
    if (days <= 120) return '111_120'; // Catches 101-120
    return 'gt_121'; // > 121
}

function generateBucketsHTML(activeKey, amount) {
    const keys = ['0_10', '11_20', '21_30', '41_50', '51_60', '71_80', '91_100', '111_120', 'gt_121'];
    return keys.map(key =>
        `<td class="text-end ${key === activeKey ? 'fw-medium text-dark' : 'text-muted'}">${key === activeKey ? formatCurrency(amount) : '-'}</td>`
    ).join('');
}

function updateFooterTotals(tbodyId, totals) {
    const table = document.getElementById(tbodyId).closest('table');
    const tfoot = table.querySelector('tfoot');
    if (!tfoot) return;

    const footerCells = tfoot.querySelectorAll('td');

    // Check if HTML footer has the correct amount of cells (9 buckets + 1 grand total = 10 td cells)
    if (footerCells.length >= 10) {
        footerCells[0].textContent = formatCurrency(totals['0_10']);
        footerCells[1].textContent = formatCurrency(totals['11_20']);
        footerCells[2].textContent = formatCurrency(totals['21_30']);
        footerCells[3].textContent = formatCurrency(totals['41_50']);
        footerCells[4].textContent = formatCurrency(totals['51_60']);
        footerCells[5].textContent = formatCurrency(totals['71_80']);
        footerCells[6].textContent = formatCurrency(totals['91_100']);
        footerCells[7].textContent = formatCurrency(totals['111_120']);
        footerCells[8].textContent = formatCurrency(totals['gt_121']);
        footerCells[9].textContent = formatCurrency(totals['overall']);
    } else {
        console.warn(`Footer in ${tbodyId} is missing <td> tags. It has ${footerCells.length}, but needs 10.`);
    }
}

function setupEventDelegation(tbody) {
    // Remove existing listener to prevent duplicates if rendered multiple times
    tbody.removeEventListener('click', handleToggleClick);
    tbody.addEventListener('click', handleToggleClick);
}

function handleToggleClick(e) {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return; // Ignore clicks that aren't on the toggle button

    const groupIndex = btn.dataset.group;
    const isCollapsed = btn.dataset.collapsed === 'true';
    const newCollapsedState = !isCollapsed;
    const tbody = btn.closest('tbody');

    // Toggle Icon
    btn.dataset.collapsed = newCollapsedState;
    btn.innerHTML = newCollapsedState
        ? `<i class="bi bi-plus-square text-secondary me-2"></i>`
        : `<i class="bi bi-dash-square text-secondary me-2"></i>`;

    // Find all child rows for this specific group
    const childRows = tbody.querySelectorAll(`.group-child-${groupIndex}`);

    // Adjust RowSpan on the parent cell
    const tdParty = btn.closest('td');
    tdParty.rowSpan = newCollapsedState ? 1 : (childRows.length + 1);

    // Toggle visibility
    childRows.forEach(row => {
        row.style.display = newCollapsedState ? 'none' : '';
    });
}

function formatDate(dateObj) {
    if (isNaN(dateObj.getTime())) return '-';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function formatCurrency(amount) {
    if (!amount || amount === 0) return '-';
    return Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}