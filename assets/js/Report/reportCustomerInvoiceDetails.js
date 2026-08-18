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
    DEBOUNCE_DELAY: 300,
    MAX_VISIBLE_PAGES: 5,
    TABLE_COLUMNS: 18,
};

const STATE = {
    currentPage: 1,
    sortColumn: null,
    sortOrder: 'asc',
    partyNameCache: new Map(), // Use Map for better performance
    reportSuggestionData: [],
    filters: {},
    isLoading: false,
    totalRecords: 0,
};

// ============================================
// DOM REFS (Cache for performance)
// ============================================
const DOM = {
    // Cache DOM elements on initialization
    elements: {},

    init() {
        this.elements = {
            tableBody: document.querySelector('#bookingTable tbody'),
            pagination: document.getElementById('paginationControls'),
            spinner: document.getElementById('loadingSpinner'),
            dateRange: document.getElementById('dateRange'),
            searchBtn: document.getElementById('searchBtn'),
            exportExcelBtn: document.getElementById('exportExcelBtn'),
            exportPdfBtn: document.getElementById('exportPdfBtn'),
            filterSection: document.getElementById('filterSection'),
            paymentStatusBtn: document.getElementById('paymentStatusBtn'),

            // Input fields
            customerName: document.getElementById('customerName'),
            invoiceNo: document.getElementById('invoiceNo'),
            invoiceType: document.getElementById('invoiceType'),
            invoiceMonth: document.getElementById('invoiceMonth'),
            invoiceYear: document.getElementById('invoiceYear'),
            financialYear: document.getElementById('financialYear'),

            // Datalists
            invoiceNoList: document.getElementById('invoiceNoList'),
            customerNameList: document.getElementById('customerNameList'),
            invoiceTypeList: document.getElementById('invoiceTypeList'),
            paymentStatusList: document.getElementById('paymentStatusBtn'),
            financialYearList: document.getElementById('financialYearList'),

            // Totals
            totalBasicAmount: document.getElementById('totalBasicAmount'),
            totalOtherAmount: document.getElementById('totalOtherAmount'),
            totalCGSTAmount: document.getElementById('totalCGSTAmount'),
            totalSGSTAmount: document.getElementById('totalSGSTAmount'),
            totalIGSTAmount: document.getElementById('totalIGSTAmount'),
            totalGSTAmount: document.getElementById('totalGSTAmount'),
            totalGrandTotal: document.getElementById('totalGrandTotal'),
            totalCollected: document.getElementById('totalCollected'),
            totalOtherDeduction: document.getElementById('totalOtherDeduction'),
            totalTDSDeduction: document.getElementById('totalTDSDeduction'),
            totalPayment: document.getElementById('totalPayment'),
            totalBalance: document.getElementById('totalBalance'),
        };

        // Store table headers for sorting
        this.elements.sortHeaders = document.querySelectorAll('#bookingTable thead th[data-key]');
    },

    get(key) {
        return this.elements[key];
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
    toNumber: (value) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = parseFloat(String(value).replace(/,/g, ''));
        return isNaN(num) ? 0 : num;
    },

    formatAmount: (value) => {
        return Utils.toNumber(value).toLocaleString(CONFIG.CURRENCY_LOCALE, {
            minimumFractionDigits: CONFIG.CURRENCY_MIN_FRACTION,
            maximumFractionDigits: CONFIG.CURRENCY_MAX_FRACTION
        });
    },

    formatDate: (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
        } catch {
            return '';
        }
    },

    getCurrentFinancialYear: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    },

    getFinancialYearRange: (financialYear) => {
        const [startYear, endYear] = financialYear.split('-').map(Number);
        if (isNaN(startYear) || isNaN(endYear)) return null;
        return {
            startDate: `${startYear}-04-01`,
            endDate: `${endYear}-03-31`
        };
    },

    getMonthRange: (yearMonth) => {
        if (!yearMonth || !yearMonth.includes('-')) return null;
        const [year, month] = yearMonth.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);

        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    },

    getYearRange: (year) => {
        if (isNaN(year)) return null;
        return {
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`
        };
    },

    debounce: (func, delay = CONFIG.DEBOUNCE_DELAY) => {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    showError: (message, container) => {
        const target = container || DOM.get('tableBody');
        if (target) {
            target.innerHTML = `
                <tr>
                    <td colspan="${CONFIG.TABLE_COLUMNS}" class="text-center text-danger py-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        ${message}
                    </td>
                </tr>
            `;
        }
        console.error(message);
    },

    showLoading: (message = 'Processing data, please wait...') => {
        const target = DOM.get('tableBody');
        if (target) {
            target.innerHTML = `
                <tr>
                    <td colspan="${CONFIG.TABLE_COLUMNS}" class="text-center text-primary fw-bold py-4">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        ${message}
                    </td>
                </tr>
            `;
        }
    },

    showNoRecords: () => {
        const target = DOM.get('tableBody');
        if (target) {
            target.innerHTML = `
                <tr>
                    <td colspan="${CONFIG.TABLE_COLUMNS}" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>
                        No records found
                    </td>
                </tr>
            `;
        }
    },

    escapeHtml: (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    getPaginationRange: (currentPage, totalPages, maxVisible = CONFIG.MAX_VISIBLE_PAGES) => {
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        return { start, end };
    }
};

// ============================================
// DATABASE HELPERS
// ============================================
const Database = {
    getCompanyId: () => localStorage.getItem('CompanyID'),

    fetchSuggestions: async () => {
        const companyId = Database.getCompanyId();
        if (!companyId) {
            console.warn('Company ID not found');
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('InvoicePaymentView')
                .select('InvoiceNo, PartyCode, PartyName, InvoiceType, PaymentStatus, InvoiceDate')
                .eq('company_id', companyId)
                .order('InvoiceDate', { ascending: false }) // Most recent first
                .limit(5000);

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
        if (STATE.partyNameCache.has(partyCode)) {
            return { PartyName: STATE.partyNameCache.get(partyCode) };
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
                STATE.partyNameCache.set(partyCode, data.PartyName);
                return data;
            }

            // Cache empty result to avoid repeated queries
            STATE.partyNameCache.set(partyCode, partyCode);
            return { PartyName: partyCode };

        } catch (error) {
            console.error('Error fetching party details:', error);
            STATE.partyNameCache.set(partyCode, partyCode);
            return { PartyName: partyCode };
        }
    },

    getBatchPartyDetails: async (partyCodes) => {
        if (!partyCodes || partyCodes.length === 0) return {};

        // Filter out codes already in cache
        const uncachedCodes = partyCodes.filter(code =>
            code && !STATE.partyNameCache.has(code)
        );

        // Return cached values if all are cached
        if (uncachedCodes.length === 0) {
            const result = {};
            partyCodes.forEach(code => {
                if (code) result[code] = STATE.partyNameCache.get(code) || code;
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
                    STATE.partyNameCache.set(code, code);
                    result[code] = code;
                });
                return result;
            }

            // Update cache with results
            const result = {};
            if (data && data.length > 0) {
                data.forEach(item => {
                    if (item.PartyCode && item.PartyName) {
                        STATE.partyNameCache.set(item.PartyCode, item.PartyName);
                        result[item.PartyCode] = item.PartyName;
                    }
                });
            }

            // Set fallback for any codes not found
            uncachedCodes.forEach(code => {
                if (!result[code]) {
                    STATE.partyNameCache.set(code, code);
                    result[code] = code;
                }
            });

            return result;

        } catch (error) {
            console.error('Error in batch party details fetch:', error);
            const result = {};
            uncachedCodes.forEach(code => {
                STATE.partyNameCache.set(code, code);
                result[code] = code;
            });
            return result;
        }
    },

    buildQuery: (filters = {}, forCount = false) => {
        const companyId = Database.getCompanyId();
        const selectFields = forCount ? 'id' : '*';

        let query = supabaseClient
            .from('InvoicePaymentView')
            .select(selectFields, forCount ? { count: 'exact', head: true } : { count: 'exact' })
            .eq('company_id', companyId);

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
            const range = Utils.getFinancialYearRange(filters.financialYear);
            if (range) {
                return query.gte('InvoiceDate', range.startDate).lte('InvoiceDate', range.endDate);
            }
        }

        if (filters.invoiceYear) {
            const range = Utils.getYearRange(parseInt(filters.invoiceYear));
            if (range) {
                return query.gte('InvoiceDate', range.startDate).lte('InvoiceDate', range.endDate);
            }
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
        const tbody = DOM.get('tableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            Utils.showNoRecords();
            return;
        }

        // Batch fetch all party names at once
        const partyCodes = [...new Set(data.map(row => row.PartyCode).filter(Boolean))];
        const partyNameMap = partyCodes.length > 0
            ? await Database.getBatchPartyDetails(partyCodes)
            : {};

        tbody.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (let idx = 0; idx < data.length; idx++) {
            const row = data[idx];
            const tr = document.createElement('tr');

            const partyName = row.PartyCode ? (partyNameMap[row.PartyCode] || '') : '';
            const srNo = (STATE.currentPage - 1) * CONFIG.PAGE_SIZE + idx + 1;
            const invoiceLink = `../Accounting/CustomerInvoice.html?invoiceNo=${encodeURIComponent(row.InvoiceNo)}`;

            tr.innerHTML = `
                <td>${srNo}</td>
                <td>
                    <a href="${invoiceLink}" class="text-decoration-none fw-bold">
                        ${Utils.escapeHtml(row.InvoiceNo)}
                    </a>
                </td>
                <td>${Utils.formatDate(row.InvoiceDate)}</td>
                <td>${Utils.escapeHtml(row.InvoiceType || '')}</td>
                <td>${Utils.escapeHtml(partyName)}</td>
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
                <td>${Utils.escapeHtml(row.PaymentStatus || '')}</td>
            `;

            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
    },

    renderPagination: (totalCount, loadTableFn) => {
        const pagination = DOM.get('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(totalCount / CONFIG.PAGE_SIZE);
        pagination.innerHTML = '';

        if (totalPages <= 1) {
            // Show single page indicator
            const li = document.createElement('li');
            li.className = 'page-item disabled';
            li.innerHTML = `<span class="page-link">Page 1 of 1</span>`;
            pagination.appendChild(li);
            return;
        }

        // Previous button
        UI.createPaginationButton(pagination, '«', STATE.currentPage > 1, () => {
            if (STATE.currentPage > 1) {
                STATE.currentPage--;
                loadTableFn(UI.getFilters());
            }
        });

        // Page numbers
        const { start, end } = Utils.getPaginationRange(STATE.currentPage, totalPages);

        // First page with dots
        if (start > 1) {
            UI.createPageNumber(pagination, 1, loadTableFn);
            if (start > 2) {
                UI.createDots(pagination);
            }
        }

        // Visible pages
        for (let i = start; i <= end; i++) {
            UI.createPageNumber(pagination, i, loadTableFn, i === STATE.currentPage);
        }

        // Last page with dots
        if (end < totalPages) {
            if (end < totalPages - 1) {
                UI.createDots(pagination);
            }
            UI.createPageNumber(pagination, totalPages, loadTableFn);
        }

        // Next button
        UI.createPaginationButton(pagination, '»', STATE.currentPage < totalPages, () => {
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
        li.innerHTML = `<span class="page-link">…</span>`;
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
        const totalElements = {
            BasicAmount: 'totalBasicAmount',
            OtherAmount: 'totalOtherAmount',
            CGSTAmount: 'totalCGSTAmount',
            SGSTAmount: 'totalSGSTAmount',
            IGSTAmount: 'totalIGSTAmount',
            TotalGSTAmount: 'totalGSTAmount',
            GrandTotalAmount: 'totalGrandTotal',
            PaymentAmount: 'totalCollected',
            OtherDeductionAmount: 'totalOtherDeduction',
            TDSDeductionAmount: 'totalTDSDeduction',
            PaymentTotalAmount: 'totalPayment',
            BalanceAmount: 'totalBalance'
        };

        Object.keys(totals).forEach(key => {
            const element = DOM.get(totalElements[key]);
            if (element) {
                element.textContent = Utils.formatAmount(totals[key]);
            }
        });
    },

    updateHeaderSortIndicators: () => {
        const headers = DOM.get('sortHeaders');
        if (!headers) return;

        headers.forEach(th => {
            const key = th.getAttribute('data-key');
            const title = th.getAttribute('data-title') || th.textContent.replace(/\s+[▲▼]/, '');
            th.textContent = title;

            if (key === STATE.sortColumn) {
                th.textContent += STATE.sortOrder === 'asc' ? ' ▲' : ' ▼';
            }
        });
    },

    updatePaymentStatusDisplay: () => {
        const selected = [...document.querySelectorAll('.paymentStatus:checked')]
            .map(cb => cb.nextElementSibling?.textContent.trim() || cb.value);

        const btn = DOM.get('paymentStatusBtn');
        if (btn) {
            btn.textContent = selected.length ? selected.join(', ') : 'All Status';
        }
    },

    populateDatalists: (data, field, datalistId) => {
        const datalist = DOM.get(datalistId);
        if (!datalist) {
            console.warn(`Datalist with ID "${datalistId}" not found`);
            return false;
        }

        try {
            const uniqueValues = [...new Set(
                data
                    .map(item => item[field])
                    .filter(value => value && value.trim() !== '')
            )].sort((a, b) => a.localeCompare(b));

            datalist.innerHTML = uniqueValues
                .map(value => `<option value="${Utils.escapeHtml(value)}">`)
                .join('');

            return true;
        } catch (error) {
            console.error(`Error populating datalist "${datalistId}":`, error);
            return false;
        }
    },

    populateArrayDatalist: (array, datalistId) => {
        const datalist = DOM.get(datalistId);
        if (!datalist) {
            console.warn(`Datalist with ID "${datalistId}" not found`);
            return false;
        }

        try {
            datalist.innerHTML = array
                .filter(value => value && value.trim() !== '')
                .map(value => `<option value="${Utils.escapeHtml(value)}">`)
                .join('');
            return true;
        } catch (error) {
            console.error(`Error populating array datalist "${datalistId}":`, error);
            return false;
        }
    },

    getFilters: () => {
        const inputs = {
            customerName: DOM.get('customerName'),
            invoiceNo: DOM.get('invoiceNo'),
            invoiceType: DOM.get('invoiceType'),
            invoiceMonth: DOM.get('invoiceMonth'),
            invoiceYear: DOM.get('invoiceYear'),
            financialYear: DOM.get('financialYear'),
        };

        const filters = {
            customerName: inputs.customerName?.value.trim(),
            invoiceNo: inputs.invoiceNo?.value.trim(),
            invoiceType: inputs.invoiceType?.value.trim(),
            invoiceMonth: inputs.invoiceMonth?.value,
            invoiceYear: inputs.invoiceYear?.value.trim(),
            financialYear: inputs.financialYear?.value.trim(),
            paymentStatus: UI.getSelectedPaymentStatus()
        };

        const dateRange = DOM.get('dateRange')?.value.trim();
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
            .map(cb => cb.value)
            .filter(Boolean);
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

        // Batch fetch party names
        const partyCodes = [...new Set(allData.map(row => row.PartyCode).filter(Boolean))];
        const partyNameMap = partyCodes.length > 0
            ? await Database.getBatchPartyDetails(partyCodes)
            : {};

        let tableHtml = `<table><thead><tr>
            <th>Sr No</th><th>Invoice No</th><th>Invoice Date</th><th>Invoice Type</th><th>Customer Name</th>
            <th>Basic Amount</th><th>Other Amount</th><th>CGST Amount</th><th>SGST Amount</th><th>IGST Amount</th>
            <th>Total GST Amount</th><th>Grand Total Amount</th><th>Collected Amount</th><th>Other Deduction Amount</th>
            <th>TDS Deduction Amount</th><th>Total Payment Amount</th><th>Balance Amount</th><th>Payment Status</th>
        </tr></thead><tbody>`;

        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];
            const partyName = row.PartyCode ? (partyNameMap[row.PartyCode] || '') : '';

            tableHtml += `<tr>
                <td>${i + 1}</td>
                <td>${row.InvoiceNo || ''}</td>
                <td>${row.InvoiceDate || ''}</td>
                <td>${row.InvoiceType || ''}</td>
                <td>${partyName}</td>
                <td>${Utils.toNumber(row.BasicAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.OtherAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.CGSTAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.SGSTAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.IGSTAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.TotalGSTAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.GrandTotalAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.PaymentAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.OtherDeductionAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.TDSDeductionAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.PaymentTotalAmount).toFixed(2)}</td>
                <td>${Utils.toNumber(row.BalanceAmount).toFixed(2)}</td>
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

        // Batch fetch party names
        const partyCodes = [...new Set(allData.map(r => r.PartyCode).filter(Boolean))];
        const partyNameMap = partyCodes.length > 0
            ? await Database.getBatchPartyDetails(partyCodes)
            : {};

        // Prepare rows
        const rows = allData.map((row, i) => [
            i + 1,
            row.InvoiceNo || '',
            Utils.formatDate(row.InvoiceDate),
            row.InvoiceType || '',
            row.PartyCode ? (partyNameMap[row.PartyCode] || row.PartyCode) : '',
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
            // Initialize DOM cache
            DOM.init();

            // Initialize flatpickr
            const dateRange = DOM.get('dateRange');
            if (dateRange && typeof flatpickr !== 'undefined') {
                flatpickr('#dateRange', {
                    mode: 'range',
                    dateFormat: CONFIG.DATE_FORMAT,
                    allowInput: true
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
        const searchBtn = DOM.get('searchBtn');
        searchBtn?.addEventListener('click', async () => {
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
            const filterSection = DOM.get('filterSection');
            if (filterSection && typeof bootstrap !== 'undefined') {
                bootstrap.Collapse.getOrCreateInstance(filterSection).hide();
            }
        });

        // Export buttons
        DOM.get('exportExcelBtn')?.addEventListener('click', Exporter.toExcel);
        DOM.get('exportPdfBtn')?.addEventListener('click', Exporter.toPdf);

        // Payment status checkboxes
        document.querySelectorAll('.paymentStatus').forEach(cb => {
            cb.addEventListener('change', UI.updatePaymentStatusDisplay);
        });

        // Datalist filter with debounce
        const debouncedFilter = Utils.debounce(App.applyDatalistFilter);
        ['invoiceNo', 'customerName', 'invoiceType', 'paymentStatus'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', debouncedFilter);
            }
        });

        // Keyboard shortcut: Enter to search
        document.querySelectorAll('#filterSection input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchBtn?.click();
                }
            });
        });
    },

    enableSortableHeaders: () => {
        const headers = DOM.get('sortHeaders');
        if (!headers) return;

        headers.forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                if (STATE.isLoading) return;

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
        if (STATE.isLoading) return;
        STATE.isLoading = true;

        const tbody = DOM.get('tableBody');
        if (!tbody) {
            STATE.isLoading = false;
            return;
        }

        const spinner = DOM.get('spinner');
        if (spinner) spinner.style.display = 'block';
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

            STATE.totalRecords = count || 0;

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
            Utils.showError('Something went wrong while loading data. Please try again.');
        } finally {
            STATE.isLoading = false;
            if (spinner) spinner.style.display = 'none';
        }
    },

    loadReportSuggestions: async () => {
        try {
            const data = await Database.fetchSuggestions();
            STATE.reportSuggestionData = data;

            if (!data || data.length === 0) {
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

            let populatedCount = 0;
            Object.entries(fieldMapping).forEach(([listId, field]) => {
                const success = UI.populateDatalists(data, field, listId);
                if (success) populatedCount++;
            });

            console.log(`Populated ${populatedCount}/${Object.keys(fieldMapping).length} datalists`);

            // Financial years
            const financialYears = [...new Set(
                data
                    .map(item => item.InvoiceDate)
                    .filter(Boolean)
                    .map(date => {
                        try {
                            const d = new Date(date);
                            if (isNaN(d.getTime())) return null;
                            const year = d.getFullYear();
                            const month = d.getMonth() + 1;
                            return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean)
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

        if (!datalistId || !STATE.reportSuggestionData.length) return;

        const fieldMapping = {
            invoiceNo: 'InvoiceNo',
            customerName: 'PartyName',
            invoiceType: 'InvoiceType',
            paymentStatus: 'PaymentStatus'
        };

        const field = fieldMapping[inputId];
        if (!field) return;

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
                .map(value => `<option value="${Utils.escapeHtml(value)}">`)
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