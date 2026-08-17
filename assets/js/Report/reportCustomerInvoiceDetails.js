// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG = {
    PAGE_SIZE: 50,
    MAX_SUGGESTIONS: 50,
    BATCH_SIZE: 1000,
    DATE_FORMAT: "Y-m-d",
    CURRENCY_LOCALE: "en-IN",
    CURRENCY_MIN_FRACTION: 2,
    CURRENCY_MAX_FRACTION: 2,
};

const STATE = {
    currentPage: 1,
    sortColumn: null,
    sortOrder: 'asc',
    partyNameCache: {},
    reportSuggestionData: [],
    filters: {},
};

// ============================================
// DOM REFS (Cache for performance)
// ============================================
const DOM = {
    get tableBody() { return document.querySelector('#bookingTable tbody'); },
    get pagination() { return document.getElementById('paginationControls'); },
    get spinner() { return document.getElementById('loadingSpinner'); },
    get dateRange() { return document.getElementById('dateRange'); },
    get searchBtn() { return document.getElementById('searchBtn'); },
    get exportExcelBtn() { return document.getElementById('exportExcelBtn'); },
    get exportPdfBtn() { return document.getElementById('exportPdfBtn'); },
    get filterSection() { return document.getElementById('filterSection'); },
    get paymentStatusBtn() { return document.getElementById('paymentStatusBtn'); },

    // Input fields
    get inputs() {
        return {
            customerName: document.getElementById('customerName'),
            invoiceNo: document.getElementById('invoiceNo'),
            invoiceType: document.getElementById('invoiceType'),
            invoiceMonth: document.getElementById('invoiceMonth'),
            invoiceYear: document.getElementById('invoiceYear'),
            financialYear: document.getElementById('financialYear'),
        };
    },

    // Datalists
    get datalists() {
        return {
            invoiceNo: document.getElementById('invoiceNoList'),
            customerName: document.getElementById('customerNameList'),
            invoiceType: document.getElementById('invoiceTypeList'),
            paymentStatus: document.getElementById('paymentStatusBtn'),
            financialYear: document.getElementById('financialYearList'),
        };
    },

    // Total display elements
    get totals() {
        return {
            BasicAmount: document.getElementById('totalBasicAmount'),
            OtherAmount: document.getElementById('totalOtherAmount'),
            CGSTAmount: document.getElementById('totalCGSTAmount'),
            SGSTAmount: document.getElementById('totalSGSTAmount'),
            IGSTAmount: document.getElementById('totalIGSTAmount'),
            TotalGSTAmount: document.getElementById('totalGSTAmount'),
            GrandTotalAmount: document.getElementById('totalGrandTotal'),
            PaymentAmount: document.getElementById('totalCollected'),
            OtherDeductionAmount: document.getElementById('totalOtherDeduction'),
            TDSDeductionAmount: document.getElementById('totalTDSDeduction'),
            PaymentTotalAmount: document.getElementById('totalPayment'),
            BalanceAmount: document.getElementById('totalBalance'),
        };
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
    toNumber: (value) => {
        if (value === null || value === undefined || value === '') return 0;
        return parseFloat(String(value).replace(/,/g, '')) || 0;
    },

    formatAmount: (value) => {
        return Utils.toNumber(value).toLocaleString(CONFIG.CURRENCY_LOCALE, {
            minimumFractionDigits: CONFIG.CURRENCY_MIN_FRACTION,
            maximumFractionDigits: CONFIG.CURRENCY_MAX_FRACTION
        });
    },

    formatDate: (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return isNaN(date) ? '' : date.toLocaleDateString();
    },

    getCurrentFinancialYear: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    },

    getFinancialYearRange: (financialYear) => {
        const [startYear, endYear] = financialYear.split('-').map(Number);
        return {
            startDate: `${startYear}-04-01`,
            endDate: `${endYear}-03-31`
        };
    },

    getMonthRange: (yearMonth) => {
        const [year, month] = yearMonth.split('-').map(Number);
        if (isNaN(year) || isNaN(month)) return null;
        const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const end = new Date(year, month, 0).toISOString().split('T')[0];
        return { startDate: start, endDate: end };
    },

    getYearRange: (year) => {
        return {
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`
        };
    },

    debounce: (func, delay = 300) => {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    showError: (message, container = DOM.tableBody) => {
        if (container) {
            container.innerHTML = `
                <tr>
                    <td colspan="18" class="text-center text-danger py-4">
                        ${message}
                    </td>
                </tr>
            `;
        }
        console.error(message);
    },

    showLoading: (message = 'Processing data, please wait...') => {
        if (DOM.tableBody) {
            DOM.tableBody.innerHTML = `
                <tr>
                    <td colspan="18" class="text-center text-primary fw-bold py-4">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        ${message}
                    </td>
                </tr>
            `;
        }
    },

    showNoRecords: () => {
        if (DOM.tableBody) {
            DOM.tableBody.innerHTML = `
                <tr>
                    <td colspan="18" class="text-center text-muted">No records found</td>
                </tr>
            `;
        }
    }
};

// ============================================
// DATABASE HELPERS - COMPLETE
// ============================================
const Database = {
    getCompanyId: () => localStorage.getItem('CompanyID'),

    fetchSuggestions: async () => {
        const companyId = Database.getCompanyId();
        if (!companyId) {
            console.error('Company ID not found');
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('InvoicePaymentView')
                .select('InvoiceNo, PartyCode, PartyName, InvoiceType, PaymentStatus, InvoiceDate')
                .eq('company_id', companyId);

            if (error) {
                console.error('Error fetching suggestions:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in fetchSuggestions:', error);
            return [];
        }
    },

    getPartyDetails: async (partyCode) => {
        if (!partyCode) return null;

        // Check cache first
        if (STATE.partyNameCache[partyCode]) {
            return { PartyName: STATE.partyNameCache[partyCode] };
        }

        try {
            const { data, error } = await supabaseClient
                .from('PartyDetails')
                .select('PartyName')
                .eq('PartyCode', partyCode)
                .eq('company_id', Database.getCompanyId())
                .maybeSingle();

            if (error) {
                console.error('Error fetching party details:', error);
                return null;
            }

            if (data?.PartyName) {
                STATE.partyNameCache[partyCode] = data.PartyName;
                return data;
            }

            // If no data found, cache empty result to avoid repeated queries
            STATE.partyNameCache[partyCode] = partyCode;
            return { PartyName: partyCode };

        } catch (error) {
            console.error('Error fetching party details:', error);
            STATE.partyNameCache[partyCode] = partyCode;
            return { PartyName: partyCode };
        }
    },

    getBatchPartyDetails: async (partyCodes) => {
        if (!partyCodes || partyCodes.length === 0) return {};

        // Filter out codes already in cache
        const uncachedCodes = partyCodes.filter(code =>
            code && !STATE.partyNameCache[code]
        );

        if (uncachedCodes.length === 0) {
            // Return cached values
            const result = {};
            partyCodes.forEach(code => {
                if (code) result[code] = STATE.partyNameCache[code] || code;
            });
            return result;
        }

        try {
            const { data, error } = await supabaseClient
                .from('PartyDetails')
                .select('PartyCode, PartyName')
                .in('PartyCode', uncachedCodes)
                .eq('company_id', Database.getCompanyId());

            if (error) {
                console.error('Error fetching batch party details:', error);
                // Return fallback values
                const result = {};
                uncachedCodes.forEach(code => {
                    STATE.partyNameCache[code] = code;
                    result[code] = code;
                });
                return result;
            }

            // Update cache with results
            const result = {};
            if (data && data.length > 0) {
                data.forEach(item => {
                    if (item.PartyCode && item.PartyName) {
                        STATE.partyNameCache[item.PartyCode] = item.PartyName;
                        result[item.PartyCode] = item.PartyName;
                    }
                });
            }

            // Set fallback for any codes not found
            uncachedCodes.forEach(code => {
                if (!result[code]) {
                    STATE.partyNameCache[code] = code;
                    result[code] = code;
                }
            });

            return result;

        } catch (error) {
            console.error('Error in batch party details fetch:', error);
            // Cache fallback values
            const result = {};
            uncachedCodes.forEach(code => {
                STATE.partyNameCache[code] = code;
                result[code] = code;
            });
            return result;
        }
    },

    buildQuery: (filters = {}) => {
        const companyId = Database.getCompanyId();
        let query = supabaseClient
            .from('InvoicePaymentView')
            .select('*', { count: 'exact' })
            .eq('company_id', companyId)
            .order('InvoiceNo', { ascending: false });

        // Apply text filters
        if (filters.invoiceNo) {
            query = query.ilike('InvoiceNo', `%${filters.invoiceNo}%`);
        }
        if (filters.customerName) {
            query = query.ilike('PartyName', `%${filters.customerName}%`);
        }
        if (filters.invoiceType) {
            query = query.ilike('InvoiceType', `%${filters.invoiceType}%`);
        }
        if (filters.paymentStatus?.length > 0) {
            query = query.in('PaymentStatus', filters.paymentStatus);
        }

        // Apply date filters
        query = Database.applyDateFilters(query, filters);

        return query;
    },

    applyDateFilters: (query, filters) => {
        const hasExplicitDateFilter =
            filters.startDate || filters.endDate ||
            filters.invoiceMonth || filters.invoiceYear ||
            filters.financialYear;

        // Only customer name selected -> current financial year
        const onlyCustomerNameSelected =
            filters.customerName && !filters.invoiceNo && !filters.invoiceType &&
            !filters.paymentStatus?.length && !hasExplicitDateFilter;

        if (onlyCustomerNameSelected) {
            const [startYear, endYear] = Utils.getCurrentFinancialYear().split('-');
            return query
                .gte('InvoiceDate', `${startYear}-04-01`)
                .lte('InvoiceDate', `${endYear}-03-31`);
        }

        // Priority: financialYear > invoiceYear > invoiceMonth > dateRange
        if (filters.financialYear) {
            const { startDate, endDate } = Utils.getFinancialYearRange(filters.financialYear);
            return query.gte('InvoiceDate', startDate).lte('InvoiceDate', endDate);
        }

        if (filters.invoiceYear) {
            const { startDate, endDate } = Utils.getYearRange(parseInt(filters.invoiceYear));
            return query.gte('InvoiceDate', startDate).lte('InvoiceDate', endDate);
        }

        if (filters.invoiceMonth) {
            const range = Utils.getMonthRange(filters.invoiceMonth);
            if (range) {
                return query.gte('InvoiceDate', range.startDate).lte('InvoiceDate', range.endDate);
            }
        }

        if (filters.startDate) {
            query = query.gte('InvoiceDate', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('InvoiceDate', filters.endDate);
        }

        // Default: no date filters -> last 2 months
        if (!hasExplicitDateFilter) {
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
            const dateStr = twoMonthsAgo.toISOString().split('T')[0];
            query = query.gte('InvoiceDate', dateStr);
        }

        return query;
    },

    fetchPage: async (filters, page, sortColumn, sortOrder) => {
        const from = (page - 1) * CONFIG.PAGE_SIZE;
        const to = page * CONFIG.PAGE_SIZE - 1;

        let query = Database.buildQuery(filters);

        if (sortColumn) {
            query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
        }

        const result = await query.range(from, to);
        return result;
    },

    fetchAllData: async (filters) => {
        const allData = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const to = from + CONFIG.BATCH_SIZE - 1;
            let query = Database.buildQuery(filters);
            query = query.order('InvoiceNo', { ascending: true });

            const { data, error } = await query.range(from, to);

            if (error) {
                console.error('Error fetching data for export:', error);
                break;
            }

            if (data?.length > 0) {
                allData.push(...data);
                from += CONFIG.BATCH_SIZE;
            } else {
                hasMore = false;
            }
        }

        return allData;
    }
};
// ============================================
// UI RENDER FUNCTIONS
// ============================================
const UI = {
    renderTable: async (data) => {
        const tbody = DOM.tableBody;
        if (!tbody) return;

        if (!data || data.length === 0) {
            Utils.showNoRecords();
            return;
        }

        tbody.innerHTML = '';

        for (let idx = 0; idx < data.length; idx++) {
            const row = data[idx];
            const tr = document.createElement('tr');

            let partyName = '';
            if (row.PartyCode) {
                const details = await Database.getPartyDetails(row.PartyCode);
                partyName = details?.PartyName || '';
            }

            const srNo = (STATE.currentPage - 1) * CONFIG.PAGE_SIZE + idx + 1;
            const invoiceLink = `../Accounting/CustomerInvoice.html?invoiceNo=${encodeURIComponent(row.InvoiceNo)}`;

            tr.innerHTML = `
                <td>${srNo}</td>
                <td>
                    <a href="${invoiceLink}" class="text-decoration-none fw-bold">
                        ${row.InvoiceNo}
                    </a>
                </td>
                <td>${Utils.formatDate(row.InvoiceDate)}</td>
                <td>${row.InvoiceType || ''}</td>
                <td>${partyName}</td>
                <td class="text-end">${Utils.formatAmount(row.BasicAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.OtherAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.CGSTAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.SGSTAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.IGSTAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.TotalGSTAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.GrandTotalAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.PaymentAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.OtherDeductionAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.TDSDeductionAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.PaymentTotalAmount)}</td>
                <td class="text-end">${Utils.formatAmount(row.BalanceAmount)}</td>
                <td>${row.PaymentStatus || ''}</td>
            `;

            tbody.appendChild(tr);
        }
    },

    renderPagination: (totalCount, loadTableFn) => {
        const pagination = DOM.pagination;
        if (!pagination) return;

        const totalPages = Math.ceil(totalCount / CONFIG.PAGE_SIZE);
        pagination.innerHTML = '';

        if (totalPages <= 1) {
            // Only show single page indicator or nothing
            return;
        }

        // Previous button
        UI.createPaginationButton(pagination, 'Previous', STATE.currentPage > 1, () => {
            if (STATE.currentPage > 1) {
                STATE.currentPage--;
                loadTableFn(UI.getFilters());
            }
        });

        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, STATE.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        startPage = Math.max(1, endPage - maxVisible + 1);

        // First page with dots
        if (startPage > 1) {
            UI.createPageNumber(pagination, 1, loadTableFn);
            if (startPage > 2) {
                UI.createDots(pagination);
            }
        }

        // Visible pages
        for (let i = startPage; i <= endPage; i++) {
            UI.createPageNumber(pagination, i, loadTableFn, i === STATE.currentPage);
        }

        // Last page with dots
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                UI.createDots(pagination);
            }
            UI.createPageNumber(pagination, totalPages, loadTableFn);
        }

        // Next button
        UI.createPaginationButton(pagination, 'Next', STATE.currentPage < totalPages, () => {
            if (STATE.currentPage < totalPages) {
                STATE.currentPage++;
                loadTableFn(UI.getFilters());
            }
        });
    },

    createPaginationButton: (container, text, enabled, onClick) => {
        const li = document.createElement('li');
        li.className = `page-item ${!enabled ? 'disabled' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${text}</a>`;
        if (enabled) {
            li.addEventListener('click', (e) => {
                e.preventDefault();
                onClick();
            });
        }
        container.appendChild(li);
    },

    createPageNumber: (container, page, loadTableFn, isActive = false) => {
        const li = document.createElement('li');
        li.className = `page-item ${isActive ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${page}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            STATE.currentPage = page;
            loadTableFn(UI.getFilters());
        });
        container.appendChild(li);
    },

    createDots: (container) => {
        const li = document.createElement('li');
        li.className = 'page-item disabled';
        li.innerHTML = `<span class="page-link">...</span>`;
        container.appendChild(li);
    },

    updateCumulativeTotals: (allData) => {
        const totals = {
            BasicAmount: 0,
            OtherAmount: 0,
            CGSTAmount: 0,
            SGSTAmount: 0,
            IGSTAmount: 0,
            TotalGSTAmount: 0,
            GrandTotalAmount: 0,
            PaymentAmount: 0,
            OtherDeductionAmount: 0,
            TDSDeductionAmount: 0,
            PaymentTotalAmount: 0,
            BalanceAmount: 0
        };

        const endIndex = STATE.currentPage * CONFIG.PAGE_SIZE;
        const cumulativeRows = allData.slice(0, endIndex);

        cumulativeRows.forEach(row => {
            Object.keys(totals).forEach(key => {
                totals[key] += Utils.toNumber(row[key]);
            });
        });

        // Update DOM
        Object.keys(totals).forEach(key => {
            const element = DOM.totals[key];
            if (element) {
                element.textContent = Utils.formatAmount(totals[key]);
            }
        });
    },

    updateHeaderSortIndicators: () => {
        document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
            const key = th.getAttribute('data-key');
            const title = th.getAttribute('data-title') || th.textContent.replace(/\s+[\u25B2\u25BC]/, '');
            th.textContent = title;

            if (key === STATE.sortColumn) {
                th.textContent += STATE.sortOrder === 'asc' ? ' ▲' : ' ▼';
            }
        });
    },

    updatePaymentStatusDisplay: () => {
        const selected = [...document.querySelectorAll('.paymentStatus:checked')]
            .map(cb => cb.nextElementSibling.textContent.trim());

        if (DOM.paymentStatusBtn) {
            DOM.paymentStatusBtn.textContent = selected.length ? selected.join(', ') : 'All Status';
        }
    },

    populateDatalists: (data, field, datalistId) => {
        const datalist = DOM.datalists[Object.keys(DOM.datalists).find(key =>
            DOM.datalists[key]?.id === datalistId
        )] || document.getElementById(datalistId);

        if (!datalist) {
            console.warn(`Datalist with ID "${datalistId}" not found`);
            return;
        }

        const uniqueValues = [...new Set(
            data.map(item => item[field]).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        datalist.innerHTML = uniqueValues
            .map(value => `<option value="${value}">`)
            .join('');
    },

    populateArrayDatalist: (array, datalistId) => {
        const datalist = document.getElementById(datalistId);
        if (!datalist) {
            console.warn(`Datalist with ID "${datalistId}" not found`);
            return;
        }
        datalist.innerHTML = array.map(value => `<option value="${value}">`).join('');
    },

    getFilters: () => {
        const inputs = DOM.inputs;
        const filters = {
            customerName: inputs.customerName?.value.trim(),
            invoiceNo: inputs.invoiceNo?.value.trim(),
            invoiceType: inputs.invoiceType?.value.trim(),
            invoiceMonth: inputs.invoiceMonth?.value,
            invoiceYear: inputs.invoiceYear?.value.trim(),
            financialYear: inputs.financialYear?.value.trim(),
            paymentStatus: UI.getSelectedPaymentStatus()
        };

        const dateRange = DOM.dateRange?.value.trim();
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(' to ');
            filters.startDate = startDate || '';
            filters.endDate = endDate || startDate || '';
        }

        STATE.filters = filters;
        return filters;
    },

    getSelectedPaymentStatus: () => {
        return [...document.querySelectorAll('.paymentStatus:checked')]
            .map(cb => cb.value);
    }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================
const Exporter = {
    toExcel: async () => {
        const filters = UI.getFilters();
        const allData = await Database.fetchAllData(filters);

        if (allData.length === 0) {
            alert('No data to export.');
            return;
        }

        let tableHtml = `<table><thead><tr>
            <th>Sr No</th><th>Invoice No</th><th>Invoice Date</th><th>Invoice Type</th><th>Customer Name</th>
            <th>Basic Amount</th><th>Other Amount</th><th>CGST Amount</th><th>SGST Amount</th><th>IGST Amount</th>
            <th>Total GST Amount</th><th>Grand Total Amount</th><th>Collected Amount</th><th>Other Deduction Amount</th>
            <th>TDS Deduction Amount</th><th>Total Payment Amount</th><th>Balance Amount</th><th>Payment Status</th>
        </tr></thead><tbody>`;

        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];
            let partyName = '';

            if (row.PartyCode) {
                const details = await Database.getPartyDetails(row.PartyCode);
                partyName = details?.PartyName || '';
            }

            tableHtml += `<tr>
                <td>${i + 1}</td>
                <td>${row.InvoiceNo || ''}</td>
                <td>${row.InvoiceDate || ''}</td>
                <td>${row.InvoiceType || ''}</td>
                <td>${partyName}</td>
                <td>${row.BasicAmount || '0'}</td>
                <td>${row.OtherAmount || '0'}</td>
                <td>${row.CGSTAmount || '0'}</td>
                <td>${row.SGSTAmount || '0'}</td>
                <td>${row.IGSTAmount || '0'}</td>
                <td>${row.TotalGSTAmount || '0'}</td>
                <td>${row.GrandTotalAmount || '0'}</td>
                <td>${row.PaymentAmount || '0'}</td>
                <td>${row.OtherDeductionAmount || '0'}</td>
                <td>${row.TDSDeductionAmount || '0'}</td>
                <td>${row.PaymentTotalAmount || '0'}</td>
                <td>${row.BalanceAmount || '0'}</td>
                <td>${row.PaymentStatus || ''}</td>
            </tr>`;
        }

        tableHtml += '</tbody></table>';

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableHtml;
        const wb = XLSX.utils.table_to_book(tempDiv.querySelector('table'), { sheet: 'Bookings' });
        XLSX.writeFile(wb, 'InternationalBookings.xlsx');
    },

    toPdf: async () => {
        const filters = UI.getFilters();
        const allData = await Database.fetchAllData(filters);

        if (allData.length === 0) {
            alert('No data to export.');
            return;
        }

        const doc = new window.jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const headers = [
            'Sr No', 'Invoice No', 'Invoice Date', 'Invoice Type', 'Customer Name',
            'Basic Amount', 'Other Amount', 'CGST Amount', 'SGST Amount', 'IGST Amount',
            'Total GST Amount', 'Grand Total Amount', 'Collected Amount',
            'Other Deduction Amount', 'TDS Deduction Amount', 'Total Payment Amount',
            'Balance Amount', 'Payment Status'
        ];

        // Get party names
        const uniqueCodes = [...new Set(allData.map(r => r.PartyCode).filter(Boolean))];
        const partyNameMap = {};

        for (const code of uniqueCodes) {
            const details = await Database.getPartyDetails(code);
            partyNameMap[code] = details?.PartyName || code;
        }

        // Prepare rows
        const rows = allData.map((row, i) => [
            i + 1,
            row.InvoiceNo || '',
            Utils.formatDate(row.InvoiceDate),
            row.InvoiceType || '',
            partyNameMap[row.PartyCode] || row.PartyCode || '',
            Utils.toNumber(row.BasicAmount).toFixed(2),
            Utils.toNumber(row.OtherAmount).toFixed(2),
            Utils.toNumber(row.CGSTAmount).toFixed(2),
            Utils.toNumber(row.SGSTAmount).toFixed(2),
            Utils.toNumber(row.IGSTAmount).toFixed(2),
            Utils.toNumber(row.TotalGSTAmount).toFixed(2),
            Utils.toNumber(row.GrandTotalAmount).toFixed(2),
            Utils.toNumber(row.PaymentAmount).toFixed(2),
            Utils.toNumber(row.OtherDeductionAmount).toFixed(2),
            Utils.toNumber(row.TDSDeductionAmount).toFixed(2),
            Utils.toNumber(row.PaymentTotalAmount).toFixed(2),
            Utils.toNumber(row.BalanceAmount).toFixed(2),
            row.PaymentStatus || ''
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
                doc.text('Customer Invoice Report', data.settings.margin.left, 10);
            },
            pageBreak: 'auto'
        });

        doc.save('CustomerInvoiceReport.pdf');
    }
};

// ============================================
// MAIN FUNCTIONS
// ============================================
const App = {
    init: async () => {
        try {
            // Initialize flatpickr
            if (DOM.dateRange) {
                flatpickr('#dateRange', {
                    mode: 'range',
                    dateFormat: CONFIG.DATE_FORMAT
                });
            }

            // Set up event listeners
            App.setupEventListeners();

            // Load initial data
            await App.loadReportSuggestions();
            await App.loadTable(UI.getFilters());

            // Enable sorting
            App.enableSortableHeaders();

            // Update payment status display
            UI.updatePaymentStatusDisplay();

        } catch (error) {
            console.error('Initialization error:', error);
            Utils.showError('Failed to initialize application');
        }
    },

    setupEventListeners: () => {
        // Search button
        DOM.searchBtn?.addEventListener('click', async () => {
            const filters = UI.getFilters();
            const hasAnyFilter = Object.values(filters).some(value =>
                value && (Array.isArray(value) ? value.length > 0 : true)
            );

            if (!hasAnyFilter) {
                const ok = confirm(
                    'No filters selected.\n\nThis will load all company records.\n\nDo you want to continue?'
                );
                if (!ok) return;
            }

            STATE.currentPage = 1;
            await App.loadTable(filters);

            // Hide filter section
            const filterSection = DOM.filterSection;
            if (filterSection) {
                bootstrap.Collapse.getOrCreateInstance(filterSection).hide();
            }
        });

        // Export buttons
        DOM.exportExcelBtn?.addEventListener('click', Exporter.toExcel);
        DOM.exportPdfBtn?.addEventListener('click', Exporter.toPdf);

        // Payment status checkboxes
        document.querySelectorAll('.paymentStatus').forEach(cb => {
            cb.addEventListener('change', UI.updatePaymentStatusDisplay);
        });

        // Datalist filter with debounce
        const debouncedFilter = Utils.debounce(App.applyDatalistFilter, 300);
        ['invoiceNo', 'customerName', 'invoiceType', 'paymentStatus'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', debouncedFilter);
            }
        });
    },

    enableSortableHeaders: () => {
        document.querySelectorAll('#bookingTable thead th[data-key]').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-key');
                if (STATE.sortColumn === key) {
                    STATE.sortOrder = STATE.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    STATE.sortColumn = key;
                    STATE.sortOrder = 'asc';
                }
                App.loadTable(UI.getFilters());
            });
        });
    },

    loadTable: async (filters = {}) => {
        const tbody = DOM.tableBody;
        if (!tbody) return;

        if (DOM.spinner) DOM.spinner.style.display = 'block';
        Utils.showLoading();

        try {
            const { data: pageData, error: pageError, count } = await Database.fetchPage(
                filters,
                STATE.currentPage,
                STATE.sortColumn,
                STATE.sortOrder
            );

            if (pageError) {
                throw new Error('Failed to load data: ' + pageError.message);
            }

            // Get cumulative data for totals
            const totalQuery = Database.buildQuery(filters);
            if (STATE.sortColumn) {
                totalQuery.order(STATE.sortColumn, { ascending: STATE.sortOrder === 'asc' });
            }
            const cumulativeTo = STATE.currentPage * CONFIG.PAGE_SIZE - 1;
            const { data: cumulativeData, error: totalError } = await totalQuery.range(0, cumulativeTo);

            if (totalError) {
                console.error('Error loading cumulative totals:', totalError);
            }

            await UI.renderTable(pageData || []);
            UI.updateCumulativeTotals(cumulativeData || []);
            UI.renderPagination(count || 0, App.loadTable);
            UI.updateHeaderSortIndicators();

        } catch (error) {
            console.error('Load table error:', error);
            Utils.showError('Something went wrong while loading data');
        } finally {
            if (DOM.spinner) DOM.spinner.style.display = 'none';
        }
    },

    loadReportSuggestions: async () => {
        try {
            const data = await Database.fetchSuggestions();
            STATE.reportSuggestionData = data;

            if (data.length === 0) {
                console.warn('No suggestion data available');
                return;
            }

            // Populate datalists
            const fieldMapping = {
                invoiceNoList: 'InvoiceNo',
                customerNameList: 'PartyName',
                invoiceTypeList: 'InvoiceType',
                paymentStatusBtn: 'PaymentStatus'
            };

            Object.entries(fieldMapping).forEach(([listId, field]) => {
                UI.populateDatalists(data, field, listId);
            });

            // Financial years
            const financialYears = [...new Set(
                data
                    .map(item => item.InvoiceDate)
                    .filter(Boolean)
                    .map(date => {
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = d.getMonth() + 1;
                        return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
                    })
            )].sort();

            UI.populateArrayDatalist(financialYears, 'financialYearList');

        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    },

    applyDatalistFilter: (event) => {
        const input = event.target;
        const inputId = input.id;
        const datalistId = input.getAttribute('list');

        if (!datalistId) return;

        const fieldMapping = {
            invoiceNo: 'InvoiceNo',
            customerName: 'PartyName',
            invoiceType: 'InvoiceType',
            paymentStatus: 'PaymentStatus'
        };

        const field = fieldMapping[inputId];
        if (!field || !STATE.reportSuggestionData.length) return;

        let searchText = input.value.trim().toLowerCase().replace(/%/g, '');

        const matchedValues = [...new Set(
            STATE.reportSuggestionData
                .map(item => item[field])
                .filter(Boolean)
                .filter(value => value.toLowerCase().startsWith(searchText))
        )].sort((a, b) => a.localeCompare(b));

        const datalist = document.getElementById(datalistId);
        if (datalist) {
            datalist.innerHTML = matchedValues
                .slice(0, CONFIG.MAX_SUGGESTIONS)
                .map(value => `<option value="${value}">`)
                .join('');
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});