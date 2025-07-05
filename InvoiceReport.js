document.addEventListener('DOMContentLoaded', async () => {
    await CompanyService.loadCompanyDetails('.company-details');
    loadCompanyLogo();
    InvoiceService.loadInvoice('ASL/25-26/0009');

});

class InvoiceService {
    // Fetch invoice details from Supabase
    static async fetchInvoiceDetails(invoiceNo) {
        if (!window.CompanyID) {
            console.error('Company ID is missing.');
            return null;
        }

        const { data, error } = await supabaseClient
            .from('InvoiceDetails')
            .select(`*`)
            .eq('company_id', window.CompanyID)
            .eq('InvoiceNo', invoiceNo)
            .single();

        if (error) {
            console.error('Error fetching invoice details:', error.message);
            return null;
        }

        return data;
    }

    // Render invoice details directly into the provided HTML structure
    static async renderInvoiceDetails(invoice) {
        if (!invoice) {
            console.error('No invoice data provided for rendering.');
            return;
        }

        try {
            document.getElementById('invoice-number').textContent = invoice.InvoiceNo || '';
            document.getElementById('invoiceDate').textContent = formatDate(invoice.InvoiceDate) || '';
            document.getElementById('poDetails').textContent = invoice.PONoDt || '';
            // Fetch party name asynchronously
            const partyData = await getPartyDetailsByCode(invoice.PartyCode);
            if (partyData) {
                document.getElementById('customerName').textContent = partyData.PartyName || '';
                document.getElementById('customerAddress').textContent = partyData.Address || '';
                document.getElementById('gSTNumber').textContent = partyData.GSTNumber || '';
            }

        } catch (error) {
            console.error('Error rendering invoice details:', error.message);
        }
    }

    // Load and render invoice details
    static async loadInvoice(invoiceNo) {
        if (!invoiceNo) {
            console.error('Invoice No. is required.');
            return;
        }

        const invoice = await this.fetchInvoiceDetails(invoiceNo);
        if (invoice) {
            this.renderInvoiceDetails(invoice);
        }
    }
}
