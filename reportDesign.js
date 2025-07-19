// === Utilities ===
const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
});

const formatCurrencys = (amount = 0) => currencyFormatter.format(parseFloat(amount) || 0);
// const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '';
const setText = (id, val = '') => document.getElementById(id).textContent = val;
const setCurrency = (id, val = 0) => setText(id, formatCurrencys(val));

// === On Load ===
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await CompanyService.loadCompanyDetails('.company-details', '.company-name');
        await InvoiceService.loadInvoice('ASL/25-26/0009');
        loadCompanyLogo();
        fitMultilineText('#customerAddress');
    } catch (err) {
        console.error('Error during invoice load:', err.message || err);
    }
});

// === Invoice Service ===
class InvoiceService {
    static async loadInvoice(invoiceNo) {
        if (!invoiceNo) return console.warn('Invoice No. is required.');
        if (!window.CompanyID) return console.error('Company ID is missing.');

        const invoice = await this.fetchInvoiceDetails(invoiceNo);
        if (!invoice) return;

        this.renderInvoiceFields(invoice);
        await Promise.all([
            this.renderPartyDetails(invoice.PartyCode),
            this.fetchInvoiceBankDetails(invoice.BankID)
        ]);

        const lineItems = await this.fetchLineItems(invoiceNo);
        this.renderLineItems(lineItems);
    }

    static async fetchInvoiceDetails(invoiceNo) {
        const { data, error } = await supabaseClient
            .from('InvoiceDetails')
            .select('*')
            .eq('company_id', window.CompanyID)
            .eq('InvoiceNo', invoiceNo)
            .single();

        if (error) {
            console.error('Error fetching invoice details:', error.message);
            return null;
        }
        return data;
    }

    static async fetchInvoiceBankDetails(bankID) {
        try {
            const { data, error } = await supabaseClient
                .from('CompanyBankDetails')
                .select('*')
                .eq('id', bankID)
                .single();
            if (error) throw error;

            const companyName = document.querySelector('.company-name')?.textContent || 'NA';

            setText('accountHolderName', companyName);
            setText('accountNumber', data?.AccountNo ?? 'NA');
            setText('bankName', data?.BankName ?? 'NA');
            setText('branchName', data?.BranchName ?? 'NA');
            setText('ifscCode', data?.IFSCCode ?? 'NA');
        } catch (err) {
            console.error('Error fetching bank details:', err.message);
        }
    }

    static async fetchLineItems(invoiceNo) {
        const { data, error } = await supabaseClient
            .from('InternationalBookingView')
            .select(`
                DocketNo, BookedDate, MovementType, TransitType, ModeType, OriginName,
                DestinationName, UOMType, NoofUnit, ChargableWeight, FreightAmount,
                FuelSurcharge, OtherCharges, TotalAmount, TotalSGSTAmt, TotalCGSTAmt,
                TotalIGSTAmt, TotalGSTAmt, GrandTotalAmt, PONo, NonTaxableAmount, TaxableAmount
            `)
            .eq('InvoiceNumber', invoiceNo);

        if (error) {
            console.error('Error fetching line items:', error.message);
            return [];
        }
        return data;
    }

    static async renderPartyDetails(partyCode) {
        try {
            const party = await getPartyDetailsByCode(partyCode);
            if (!party) return;

            const companyName = document.querySelector('.company-name')?.textContent || '';

            setText('customerName', party.PartyName ?? '');
            setText('drawName', companyName);
            setText('gSTNumber', party.GSTNumber ?? '');
        } catch (err) {
            console.error('Error rendering party details:', err.message);
        }
    }

    static renderInvoiceFields(invoice) {
        setText('invoice-number', invoice.InvoiceNo ?? '');
        setText('invoiceDate', formatDate(invoice.InvoiceDate));
        setText('poDetails', invoice.PONo ?? 'NA');
        setText('customerAddress', invoice.InvoiceAddress ?? '');
    }

    static renderLineItems(items) {
        const tbody = document.getElementById('itemRows');
        tbody.innerHTML = '';

        const totals = {
            totalWeight: 0, totalFreight: 0, totalFSC: 0, totalOther: 0, totalAmount: 0,
            totalSGST: 0, totalCGST: 0, totalIGST: 0, freightNonTaxable: 0, freightTaxable: 0,
            grandTotal: 0
        };

        items.forEach((item, index) => {
            const {
                DocketNo, BookedDate, ModeType, OriginName, DestinationName,
                ChargableWeight = 0, FreightAmount = 0, FuelSurcharge = 0,
                OtherCharges = 0, TotalAmount = 0, TotalSGSTAmt = 0, TotalCGSTAmt = 0,
                TotalIGSTAmt = 0, GrandTotalAmt = 0, NonTaxableAmount = 0, TaxableAmount = 0
            } = item;

            Object.assign(totals, {
                totalWeight: totals.totalWeight + ChargableWeight,
                totalFreight: totals.totalFreight + FreightAmount,
                totalFSC: totals.totalFSC + FuelSurcharge,
                totalOther: totals.totalOther + OtherCharges,
                totalAmount: totals.totalAmount + TotalAmount,
                totalSGST: totals.totalSGST + TotalSGSTAmt,
                totalCGST: totals.totalCGST + TotalCGSTAmt,
                totalIGST: totals.totalIGST + TotalIGSTAmt,
                freightNonTaxable: totals.freightNonTaxable + NonTaxableAmount,
                freightTaxable: totals.freightTaxable + TaxableAmount,
                grandTotal: totals.grandTotal + GrandTotalAmt
            });

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="text-center border">${index + 1}</td>
                <td class="border">${formatDate(BookedDate)}</td>
                <td class="border">${DocketNo}</td>
                <td class="border">${ModeType}</td>
                <td class="border">${OriginName}</td>
                <td class="border">${DestinationName}</td>
                <td class="border text-end">${ChargableWeight.toFixed(2)}</td>
                <td class="border text-end">${formatCurrencys(FreightAmount)}</td>
                <td class="border text-end">${formatCurrencys(FuelSurcharge)}</td>
                <td class="border text-end">${formatCurrencys(OtherCharges)}</td>
                <td class="border text-end">${formatCurrencys(TotalAmount)}</td>
            `;
            tbody.appendChild(row);
        });

        const totalGST = totals.totalSGST + totals.totalCGST + totals.totalIGST;
        const emptyRowCount = Math.max(0, 20 - items.length);

        for (let i = 0; i < emptyRowCount; i++) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td class="text-center border">${items.length + i + 1}</td>
                <td class="border">&nbsp;</td>
                <td class="border">&nbsp;</td>
                <td class="border">&nbsp;</td>
                <td class="border">&nbsp;</td>
                <td class="border">&nbsp;</td>
                <td class="border text-end">&nbsp;</td>
                <td class="border text-end">&nbsp;</td>
                <td class="border text-end">&nbsp;</td>
                <td class="border text-end">&nbsp;</td>
                <td class="border text-end">&nbsp;</td>
            `;
            tbody.appendChild(emptyRow);
        }

        setText('totalWeight', totals.totalWeight.toFixed(2));
        setCurrency('totalFreight', totals.totalFreight);
        setCurrency('totalFSC', totals.totalFSC);
        setCurrency('totalOther', totals.totalOther);
        setCurrency('totalAmount', totals.totalAmount);
        setCurrency('totalSGST', totals.totalSGST);
        setCurrency('totalCGST', totals.totalCGST);
        setCurrency('totalIGST', totals.totalIGST);
        setCurrency('totalGST', totalGST);
        setCurrency('grandTotal', totals.grandTotal);
        setCurrency('freightNonTaxable', totals.freightNonTaxable);
        setCurrency('freightTaxable', totals.freightTaxable);
        setCurrency('subNonTaxable', totals.freightNonTaxable);
        setCurrency('subTaxable', totals.freightTaxable + totalGST);

        setText('amountInWords', numberToWordsIndian(totals.grandTotal));
    }
}

// === PDF Generation ===
function generatePDF() {
    const element = document.querySelector('.a4-page');
    const debugElements = document.querySelectorAll('.debug-border div');

    debugElements.forEach(el => el.style.border = 'none');

    html2pdf().set({
        margin: 10,
        filename: 'invoice.pdf',
        image: { type: 'jpeg', quality: 0.9 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    }).from(element).save().then(() => {
        debugElements.forEach(el => el.style.border = '1px dashed red');
    });
}