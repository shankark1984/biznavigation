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

    y = tableResult.finalY;

    y = doc.lastAutoTable?.finalY || y;




    /* ==============================
   TERMS + BANK DETAILS (2 COLUMN)
============================== */

    const rowH = 5;
    const col1 = PAGE.w * 0.5;   // Terms
    const col2 = PAGE.w * 0.5;   // Bank Details

    const x1 = PAGE.x;
    const x2 = x1 + col1;

    const rows = 5;
    const tableH = rowH * rows;

    if (y + tableH > PAGE.h - 20) {
        doc.addPage();
        y = 10;
    }

    /* Draw Outer Border */
    safeRect(doc, PAGE.x, y, PAGE.w, tableH);

    /* Draw Vertical Divider */
    doc.line(x2, y, x2, y + tableH);

    /* Draw Horizontal Lines */
    for (let i = 1; i < rows; i++) {
        doc.line(PAGE.x, y + rowH * i, PAGE.x + PAGE.w, y + rowH * i);
    }

    /* ==============================
       HEADERS
    ============================== */

    doc.setFont("helvetica", "bold").setFontSize(FONT.body);

    doc.text("TERMS", x1 + col1 / 2, y + 3.5, { align: "center" });
    doc.text("BANK DETAILS", x2 + col2 / 2, y + 3.5, { align: "center" });

    /* ==============================
       TERMS CONTENT
    ============================== */

    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const terms = [
        `1. Please draw cheque in favour of ${company.name}`,
        "2. Payments should be made within 7 days from the date of billing.",
        "3. Complaints must be forwarded within 8 days from receipt.",
        "4. Bangalore will be the jurisdiction for any disputes."
    ];

    terms.forEach((t, i) => {
        doc.text(t, x1 + 1, y + rowH * (i + 2) - 1);
    });

    /* ==============================
       BANK DETAILS CONTENT
    ============================== */

    const bankInfo = await getInvoiceBankDetails(header?.InvoiceNo);
    const bankDetails = [
        `Account Name : ${company.name}`,
        `Account No   : ${bankInfo?.AccountNo || '0000000000'}`,
        `Bank Name    : ${bankInfo?.BankName || '-'} | Branch Name : ${bankInfo?.BranchName || '-'}`,
        `IFSC Code    : ${bankInfo?.IFSCCode || '-'} | SWIFT Code : ${bankInfo?.SWIFTCode || '-'}`
    ];


    bankDetails.forEach((b, i) => {
        doc.text(b, x2 + 1, y + rowH * (i + 2) - 1);
    });

    // Move Y position to bottom of table
    y = y + tableH + 3;

    // Page break check
    if (y > PAGE.h - 10) {
        doc.addPage();
        y = 15;
    }

    // Footer Note
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(FONT.tiny);

    doc.text(
        "This is a computer generated invoice. No signature required.",
        PAGE.x + PAGE.w / 2,
        y,
        { align: "center" }
    );

    const addFooter = (doc, pageNumber, totalPages) => {

        const footerY = PAGE.h - 5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);

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
