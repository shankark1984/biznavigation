document.addEventListener('DOMContentLoaded', async () => {
    // Ensure CompanyID is defined (e.g., fetched from localStorage or session)
    // const CompanyID = localStorage.getItem('CompanyID'); 

    await loadCustomerOutstanding();
    await loadVendorOutstanding();

    // Tab Event Listeners to refresh or resize if needed
    document.getElementById('customer-tab').addEventListener('click', () => {
        // Optional: refresh data or adjust layout
    });

    document.getElementById('vendor-tab').addEventListener('click', () => {
        // Optional: refresh data or adjust layout
    });
});

async function loadCustomerOutstanding() {
    try {
        const { data, error } = await supabaseClient
            .from('InvoicePaymentView')
            .select('*')
            .eq('company_id', CompanyID) // Make sure CompanyID is globally available
            .neq('PaymentStatus', 'Paid')
            .gt('BalanceAmount', 0)
            .order('PartyName', { ascending: true })
            .order('InvoiceDate', { ascending: true });

        if (error) throw error;

        renderTableData(data, 'customerTableBody', 'Customer');
    } catch (err) {
        console.error('Error loading customer outstanding:', err);
        document.getElementById('customerTableBody').innerHTML = `<tr><td colspan="11" class="text-center text-danger">Failed to load customer data.</td></tr>`;
    }
}

async function loadVendorOutstanding() {
    try {
        const { data, error } = await supabaseClient
            .from('VendorBillPaymentView')
            .select('*')
            .eq('company_id', CompanyID)
            .neq('PaymentStatus', 'Paid')
            .gt('BalanceAmount', 0)
            .order('PartyName', { ascending: true })
            .order('BillDate', { ascending: true });

        if (error) throw error;

        renderTableData(data, 'vendorTableBody', 'Vendor');
    } catch (err) {
        console.error('Error loading vendor outstanding:', err);
        document.getElementById('vendorTableBody').innerHTML = `<tr><td colspan="11" class="text-center text-danger">Failed to load vendor data.</td></tr>`;
    }
}

function renderTableData(data, tbodyId, type) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">No outstanding records found.</td></tr>`;
        return;
    }

    // Group data by PartyName
    const groupedData = data.reduce((acc, row) => {
        const partyName = row.PartyName || 'Unknown Party';
        if (!acc[partyName]) acc[partyName] = [];
        acc[partyName].push(row);
        return acc;
    }, {});

    // Totals trackers
    const grandTotals = {
        '0_10': 0, '11_20': 0, '21_30': 0, '31_40': 0, '41_50': 0, '51_60': 0, '71_80': 0, '91_100': 0, '111_120': 0, 'gt_151': 0, 'overall': 0
    };

    const currentDate = new Date();

    for (const [partyName, rows] of Object.entries(groupedData)) {
        let isCollapsed = false;
        let groupDOMRows = []; // Store references to all TRs in this group
        let tdParty; // Reference to the rowspan cell

        rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            groupDOMRows.push(tr);

            // 1. Render Party Name only on the first row with Collapse/Expand Toggle
            if (index === 0) {
                tdParty = document.createElement('td');
                tdParty.rowSpan = rows.length;
                tdParty.className = 'fw-bold align-middle';

                // Construct the toggle button mimicking the reference image
                tdParty.innerHTML = `
                    <span class="toggle-btn" style="cursor:pointer;" title="Click to Collapse/Expand">
                        <i class="bi bi-dash-square text-secondary me-2"></i>
                    </span>
                    ${partyName}
                `;

                // Add collapse/expand event listener
                tdParty.querySelector('.toggle-btn').addEventListener('click', function () {
                    isCollapsed = !isCollapsed;
                    // Toggle Icon
                    this.innerHTML = isCollapsed
                        ? `<i class="bi bi-plus-square text-secondary me-2"></i>`
                        : `<i class="bi bi-dash-square text-secondary me-2"></i>`;

                    // Adjust RowSpan so layout doesn't break when hiding rows
                    tdParty.rowSpan = isCollapsed ? 1 : rows.length;

                    // Toggle visibility of subsequent rows in this group
                    for (let i = 1; i < groupDOMRows.length; i++) {
                        groupDOMRows[i].style.display = isCollapsed ? 'none' : '';
                    }
                });

                tr.appendChild(tdParty);
            }

            // 2. Extract Data fields based on View type
            const expId = type === 'Customer' ? row.InvoiceNo : row.BillReferenceNo;
            const billDateStr = type === 'Customer' ? row.InvoiceDate : row.BillDate;
            const billNo = type === 'Customer' ? row.InvoiceNo : row.BillNo;
            const balanceAmount = parseFloat(row.BalanceAmount) || 0;

            const billDate = new Date(billDateStr);
            const formattedDate = formatDate(billDate);

            // 3. Calculate aging days
            const diffTime = Math.abs(currentDate - billDate);
            const pendingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 4. Assign to Specific Buckets
            let buckets = { b0_10: '-', b11_20: '-', b21_30: '-', b31_40: '-', b41_50: '-', b51_60: '-', b71_80: '-', b91_100: '-', b111_120: '-', bgt_151: '-' };

            if (pendingDays >= 0 && pendingDays <= 10) {
                buckets.b41_50 = formatCurrency(balanceAmount);
                grandTotals['41_50'] += balanceAmount;
            } else if (pendingDays >= 11 && pendingDays <= 20) {
                buckets.b41_50 = formatCurrency(balanceAmount);
                grandTotals['41_50'] += balanceAmount;
            } else if (pendingDays >= 21 && pendingDays <= 30) {
                buckets.b41_50 = formatCurrency(balanceAmount);
                grandTotals['41_50'] += balanceAmount;
            } else if (pendingDays >= 31 && pendingDays <= 40) {
                buckets.b41_50 = formatCurrency(balanceAmount);
                grandTotals['41_50'] += balanceAmount;
            } else if (pendingDays >= 41 && pendingDays <= 50) {
                buckets.b41_50 = formatCurrency(balanceAmount);
                grandTotals['41_50'] += balanceAmount;
            } else if (pendingDays >= 51 && pendingDays <= 60) {
                buckets.b51_60 = formatCurrency(balanceAmount);
                grandTotals['51_60'] += balanceAmount;
            } else if (pendingDays >= 71 && pendingDays <= 80) {
                buckets.b71_80 = formatCurrency(balanceAmount);
                grandTotals['71_80'] += balanceAmount;
            } else if (pendingDays >= 91 && pendingDays <= 100) {
                buckets.b91_100 = formatCurrency(balanceAmount);
                grandTotals['91_100'] += balanceAmount;
            } else if (pendingDays >= 111 && pendingDays <= 120) {
                buckets.b111_120 = formatCurrency(balanceAmount);
                grandTotals['111_120'] += balanceAmount;
            } else if (pendingDays >= 151) {
                buckets.bgt_151 = formatCurrency(balanceAmount);
                grandTotals['gt_151'] += balanceAmount;
            }

            // Always add to overall row total regardless of bucket
            grandTotals['overall'] += balanceAmount;

            // 5. Build Row HTML
            tr.innerHTML += `
                <td>${billNo || '-'}</td>
                <td><i class="bi bi-calendar3 text-muted me-1"></i> ${formattedDate}</td>
                <td class="text-end">${buckets.b41_50}</td>
                <td class="text-end">${buckets.b51_60}</td>
                <td class="text-end">${buckets.b71_80}</td>
                <td class="text-end">${buckets.b91_100}</td>
                <td class="text-end">${buckets.b111_120}</td>
                <td class="text-end">${buckets.bgt_151}</td>
                <td class="text-end fw-bold">${formatCurrency(balanceAmount)}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    // Update Footer Totals
    updateFooterTotals(tbodyId, grandTotals);
}

function updateFooterTotals(tbodyId, totals) {
    const table = document.getElementById(tbodyId).closest('table');
    const tfoot = table.querySelector('tfoot');
    if (!tfoot) return;

    const footerCells = tfoot.querySelectorAll('td');

    // Safety check to ensure we map to the correct footer cells
    if (footerCells.length >= 8) {
        footerCells[1].textContent = formatCurrency(totals['41_50']);
        footerCells[2].textContent = formatCurrency(totals['51_60']);
        footerCells[3].textContent = formatCurrency(totals['71_80']);
        footerCells[4].textContent = formatCurrency(totals['91_100']);
        footerCells[5].textContent = formatCurrency(totals['111_120']);
        footerCells[6].textContent = formatCurrency(totals['gt_151']);
        footerCells[7].textContent = formatCurrency(totals['overall']);
    }
}

// ==========================================
// Utility Functions
// ==========================================

function formatDate(dateObj) {
    if (isNaN(dateObj.getTime())) return '-';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function formatCurrency(amount) {
    if (!amount || amount === 0) return '-';
    // Formats into Indian Numbering System (e.g. 1,29,000.00) to match image
    return Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}