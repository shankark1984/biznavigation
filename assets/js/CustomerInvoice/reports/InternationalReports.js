async function generate_International_InvoicePDF_R1(header, lines = []) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const PAGE = { x: 15, w: 190, h: 297 };
    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6 };

    let y = 10;

    const [company, party, shipmentData, bank, totalsPayment] = await Promise.all([
        fetchCompanyDetails(header),
        fetchPartyDetails(header),
        getDomesticShipmentData(header?.InvoiceNo),
        getInvoiceBankDetails(header?.InvoiceNo),
        advancedPaymentDetails(header?.InvoiceNo, header?.InvoiceDate)
    ]);

    totalPaymentReceived = round2(
        safeNumber(totalsPayment?.totalPayment) +
        safeNumber(totalsPayment?.totalOtherDeduction) +
        safeNumber(totalsPayment?.totalTDS)
    );

    y = await drawHeader(doc, PAGE, FONT, company, y);

    y = drawTitle(doc, PAGE, FONT, y);


    y = drawPartySection(doc, PAGE, FONT, header, party, company, y);
    //Shipment section
    const shipmentResult = await drawShipmentTable(doc, PAGE, FONT, shipmentData, y);

    y = shipmentResult.y;
    //TermsAndTaxSection
    const totals = shipmentResult;

    y = await drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived);

    y = drawAmountInWords(doc, PAGE, FONT, totals.grandTotal, y);

    addFooterToAllPages(doc, PAGE);

    doc.save(`Invoice_${header?.InvoiceNo || "NA"}.pdf`);
}


