async function generate_CustmsClearance_InvoicePDF(header, lines = []) {

    // Import jsPDF library
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4"); // Portrait, millimeters, A4 size

    const PAGE = { x: 10, w: 190, h: 297 }; // Page margins and width/height
    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6 }; // Font sizes
    let y = 10; // Current vertical position cursor

    // Helper function to draw rectangle safely
    const safeRect = (doc, x, y, w, h) => doc.rect(x, y, w, h);

    /* ==============================
       COMPANY DETAILS
    ============================== */
    const company = await companyDetails();
    /* ==============================
       HEADER SECTION
    ============================== */
    const headerH = 22; // Height of header
    const logoW = PAGE.w * 0.2; // Width reserved for logo
    const textW = PAGE.w * 0.75; // Width reserved for company text

    safeRect(doc, PAGE.x, y, PAGE.w, headerH); // Draw outer rectangle for header

    // Load company logo and scale proportionally
    const logoImg = await loadImage(company.logo);
    if (logoImg) {
        const maxW = logoW - 6;
        const maxH = headerH - 4;
        const ratio = logoImg.width / logoImg.height;
        let w = maxW, h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        doc.addImage(logoImg, "PNG",
            PAGE.x + (logoW - w) / 2,
            y + (headerH - h) / 2,
            w, h
        );
    }

    // Company text positioning
    const textX = PAGE.x + logoW + 4;
    const centerY = y + headerH / 2;

    doc.setFont("helvetica", "bold").setFontSize(FONT.header);
    doc.text(company.name, textX + textW / 2, centerY - 4, { align: "center" });

    doc.setFont("helvetica", "normal").setFontSize(FONT.body);
    doc.text(doc.splitTextToSize(company.address, textW - 8),
        textX + textW / 2, centerY + 1, { align: "center" });

    doc.setFontSize(FONT.small);
    doc.text(`Ph: ${company.phone} | ${company.email} | GST: ${company.gst}`,
        textX + textW / 2, centerY + 7, { align: "center" });

    y += headerH; // Move cursor down after header

    /* ==============================
       TITLE SECTION
    ============================== */
    safeRect(doc, PAGE.x, y, PAGE.w, 6);
    doc.setFont("helvetica", "bold").setFontSize(FONT.title);
    doc.text("TAX INVOICE", PAGE.x + PAGE.w / 2, y + 4, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(FONT.body);
    /* ==============================
       PARTY DETAILS
    ============================== */

    const party = await partyDetails(header.PartyCode); // Fetch customer info

    // Define column widths for party and invoice details
    const left70 = PAGE.w * 0.7;
    const left40 = PAGE.w * 0.4;

    // Split text for wrapping
    const partyNameLines = doc.splitTextToSize(`M/s ${party.name}`, left70 - 6);
    const partyAddrLines = doc.splitTextToSize(party.address, left70 - 6);
    const rightLines = doc.splitTextToSize([
        `Invoice No : ${header?.InvoiceNo || "-"}`,
        `Invoice Date : ${formatDate(header?.InvoiceDate) || "-"}`,
        `SAC Code : ${header?.SACCode || "-"}`
    ].join("\n"), PAGE.w - left70 - 6);

    // Calculate row heights dynamically
    const row1H = Math.max(
        partyNameLines.length + partyAddrLines.length,
        rightLines.length
    ) * 4 + 4;

    const row2H = 6;
    const infoH = row1H + row2H;

    // Draw rectangle for party details
    safeRect(doc, PAGE.x, y, PAGE.w, infoH);
    doc.line(PAGE.x + left70, y, PAGE.x + left70, y + row1H);
    doc.line(PAGE.x + left40, y + row1H, PAGE.x + left40, y + infoH);
    doc.line(PAGE.x, y + row1H, PAGE.x + PAGE.w, y + row1H);

    // Add party text
    doc.setFont("helvetica", "bold").text(partyNameLines, PAGE.x + 3, y + 4);
    doc.setFont("helvetica", "normal")
        .text(partyAddrLines, PAGE.x + 3, y + 4 + partyNameLines.length * 4);
    doc.text(rightLines, PAGE.x + left70 + 3, y + 4);
    doc.text(`GST No : ${party.gst}`, PAGE.x + 3, y + row1H + 4);
    doc.text(`P.O. No : ${header?.PONumber || "-"}`, PAGE.x + left40 + 3, y + row1H + 4);

    y += infoH; // Move cursor below party details

    /* ==============================
       SHIPMENT TABLE
    ============================== */

    console.log("Generating shipment table for invoice:", header?.InvoiceNo);
    const tableResult = await fetchAndRenderShipmentTable(
        doc,
        y,
        PAGE,
        FONT,
        header?.InvoiceNo
    );

    if (tableResult && tableResult.finalY) {
        y = tableResult.finalY;
    } else if (doc.lastAutoTable) {
        y = doc.lastAutoTable.finalY;
    }

    /* ==============================
       TERMS AND BANK DETAILS
    ============================== */
    y = await drawTermsAndBankDetails(doc, y, company, header, PAGE, FONT, safeRect, getInvoiceBankDetails);


    const addFooter = (doc, pageNumber, totalPages) => {

        const footerY = PAGE.h - 5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);

        // Color for AllEdge (example: Blue)
        doc.setTextColor(0, 0, 0);
        doc.text("Powered by", PAGE.x, footerY, { align: "left" });

        doc.setTextColor(3, 171, 255);
        doc.text("AllEdge", PAGE.x + 14, footerY);


        // Reset color to black for page number
        doc.setTextColor(0, 0, 0);
        doc.text(
            `Page ${pageNumber} of ${totalPages}`,
            PAGE.x + PAGE.w,
            footerY,
            { align: "right" }
        );
    };

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(doc, i, totalPages);
    }

    // Save PDF
    doc.save(`${party.name || "NA"}_${header?.InvoiceNo || "NA"}.pdf`);
}
