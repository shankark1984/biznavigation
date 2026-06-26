document.addEventListener('DOMContentLoaded', async () => {
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    loadTaxData();
});

const referenceType = document.getElementById("referenceType");
const referenceInvoice = document.getElementById("referenceInvoice");
const datalist = document.getElementById("referenceInvoiceSuggestions");

referenceType.addEventListener("change", async function () {

    referenceInvoice.value = "";
    datalist.innerHTML = "";

    if (this.value === "Customer Invoice") {
        referenceInvoice.setAttribute("list", "referenceInvoiceSuggestions");
        await loadCustomerInvoices();
    }
    else if (this.value === "Vendor Bill") {
        referenceInvoice.setAttribute("list", "referenceInvoiceSuggestions");
        await loadVendorBills();
    }
    else if (this.value === "Other") {
        // Allow manual entry only
        referenceInvoice.removeAttribute("list");
    }
});

async function loadCustomerInvoices() {

    const { data, error } = await supabaseClient
        .from("InvoicePaymentView")
        .select("InvoiceNo")
        .eq("company_id", CompanyID)
        .neq("PaymentStatus", 'Paid') // not paid    
        .order("InvoiceNo");

    if (error) {
        console.error(error);
        return;
    }

    datalist.innerHTML = "";

    data.forEach(row => {
        datalist.innerHTML += `
            <option value="${row.InvoiceNo}">
        `;
        console.log(row.InvoiceNo);
    });
}

async function loadVendorBills() {

    const { data, error } = await supabaseClient
        .from("VendorBillPaymentView")
        .select("BillReferenceNo")
        .eq("company_id", CompanyID)
        .neq("PaymentStatus", 'Paid') // not paid   
        .order("BillReferenceNo");

    if (error) {
        console.error(error);
        return;
    }

    datalist.innerHTML = "";

    data.forEach(row => {
        datalist.innerHTML += `
            <option value="${row.BillReferenceNo}">
        `;
        console.log(row.BillReferenceNo);
    });
}