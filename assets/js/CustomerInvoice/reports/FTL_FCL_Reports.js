async function generate_DomesticReports_InvoicePDF(header, lines = []) {

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
    const companyData = await getCompanyProfile(header?.CompanyID || CompanyID);
    // Fetch company info from API
    const company = {
        name: companyData?.company_name || "",
        address: [
            companyData?.address,
            companyData?.city && `${companyData.city} - ${companyData.pin_code}`,
            companyData?.state,
            companyData?.country
        ].filter(Boolean).join(", "), // Concatenate address components
        phone: companyData?.phone_no || "-",
        email: companyData?.e_mail || "-",
        gst: companyData?.gst_number || "-",
        state: companyData?.state,
        logo: companyData?.logo_path
    };

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
    const partyData = await getPartyProfile(header.PartyCode); // Fetch customer info
    const party = {
        name: partyData?.PartyName || "-",
        address: [
            partyData?.Address,
            partyData?.City && `${partyData.City} - ${partyData.PinCode}`,
            partyData?.State,
            partyData?.Country
        ].filter(Boolean).join(", "),
        gst: partyData?.GSTNumber || "-",
        state: partyData?.State
    };

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
    doc.text(rightLines, PAGE.x + left70 + 6, y + 4);

    y += infoH; // Move cursor below party details

    /* ==============================
       SHIPMENT TABLE
    ============================== */
    let totalFreight = 0, totalFSC = 0, totalOther = 0;

    // Get table data from HTML table
    const table = document.getElementById("pendingShipmentTable");
    const tableData = Array.from(table.querySelectorAll("tbody tr")).map((tr, i) => {
        const c = tr.querySelectorAll("td");

        const freight = safeNumber(c[9]?.innerText);
        const fsc = safeNumber(c[10]?.innerText);
        const other = safeNumber(c[11]?.innerText);

        totalFreight += freight;
        totalFSC += fsc;
        totalOther += other;

        return [
            i + 1, // Sl No
            formatDate(c[1]?.innerText) || "", // Date
            c[0]?.innerText || "", // Docket
            c[2]?.innerText || "", // Transit
            c[3]?.innerText || "",// Mode
            c[4]?.innerText || "", // Origin
            c[5]?.innerText || "", // Destination
            c[7]?.innerText || "", // Wt/CBM
            freight.toFixed(2), // Freight
            fsc.toFixed(2), // FSC
            other.toFixed(2), // Other
            (freight + fsc + other).toFixed(2) // Total
        ];
    });

    const shipmentGrandTotal = totalFreight + totalFSC + totalOther;

    // Render table using jsPDF-AutoTable
    doc.autoTable({
        startY: y,
        margin: { left: PAGE.x, right: PAGE.x },
        head: [[
            "Sl", "Date", "Docket", "Transit", "Mode",
            "Origin", "Dest",
            "Wt/CBM", "Freight", "FSC", "Other", "Total"
        ]],
        body: tableData,
        styles: {
            fontSize: FONT.small, cellPadding: 1, lineWidth: 0.2, lineColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold", lineWidth: 0.2,
            lineColor: [0, 0, 0], halign: "center"
        },
        foot: [
            [
                { content: "", colSpan: 7 },
                { content: "TOTAL", styles: { halign: "right", fontStyle: "bold" } },
                { content: totalFreight.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: totalFSC.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: totalOther.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: shipmentGrandTotal.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
            ]
        ],
        columnStyles: {
            7: { halign: "right" },
            8: { halign: "right" },
            9: { halign: "right" },
            10: { halign: "right" },
            11: { halign: "right" }
        },
        didDrawCell: data => {
            // Force black border for every cell
            data.cell.styles.lineColor = [0, 0, 0];
            data.cell.styles.lineWidth = 0.5;
        },
        didDrawPage: d => { y = d.cursor.y; } // Update Y position after table
    });

    y = doc.lastAutoTable?.finalY || y;


    /* ==============================
       GST CALCULATION
    ============================== */
    const taxable = totalFreight + totalFSC + totalOther;
    const isInterState =
        (party.state || "").trim().toLowerCase() !==
        (company.state || "").trim().toLowerCase();

    const cgst = isInterState ? 0 : taxable * 0.09;
    const sgst = isInterState ? 0 : taxable * 0.09;
    const igst = isInterState ? taxable * 0.18 : 0;

    const grandTotal = taxable + cgst + sgst + igst;

    /* ==============================
       TERMS + BANK + TAX SUMMARY
    ============================== */
    const rowH = 4; // Row height
    const col1 = PAGE.w * 0.6; // Terms & Conditions
    const col2 = PAGE.w * 0.1; // Spacer / empty
    const col3 = PAGE.w * 0.15; // Non-tax
    const col4 = PAGE.w * 0.15; // Taxable

    const x1 = PAGE.x;
    const x2 = x1 + col1;
    const x3 = x2 + col2;
    const x4 = x3 + col3;

    const rows = 10; // Number of rows for table
    const tableH = rowH * rows;

    if (y + tableH > PAGE.h - 15) { // Page break check
        doc.addPage();
        y = PAGE.x;
    }

    // Draw main table rectangle
    safeRect(doc, PAGE.x, y, PAGE.w, tableH);
    [x2, x3, x4].forEach(x => doc.line(x, y, x, y + tableH)); // Draw vertical lines
    for (let i = 1; i < rows; i++) doc.line(PAGE.x, y + rowH * i, PAGE.x + PAGE.w, y + rowH * i); // Horizontal lines

    // Add headers
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Terms & Conditions", x1 + col1 / 2, y + 3, { align: "center" });
    doc.text("Non-Tax", x3 + col3 / 2, y + 3, { align: "center" });
    doc.text("Taxable", x4 + col4 / 2, y + 3, { align: "center" });

    // Terms
    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);
    const terms = [
        `1. Please draw cheque in favour of ${company.name}`,
        "2. Payments Should be made within 7 Days from the Date of Billing",
        "3. All Complaints in respect of this bill must be forwarded within 8 days from the date of receipt.",
        "4. Bangalore will be the Jurisdiction for any disputes arising out by this bill."
    ];
    terms.forEach((t, i) => {
        doc.text(t, x1 + 2, y + rowH * (i + 2) - 1);
    });
    const bankInfo = await getInvoiceBankDetails(header?.InvoiceNo);

    // Bank details
    const bankDetails = [
        `Account Name: ${company.name}`,
        `Account No: ${bankInfo?.AccountNo || '0000000000'}`,
        `Bank: ${bankInfo?.BankName || '-'} | Branch: ${bankInfo?.BranchName || '-'}`,
        `IFSC: ${bankInfo?.IFSCCode || '-'} | SWIFT: ${bankInfo?.MICRCode || 'N/A'}`
    ];

    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Bank Details", x1 + col1 / 2, y + rowH * (terms.length + 1.8), { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);
    bankDetails.forEach((b, i) => {
        doc.text(b, x1 + 2, y + rowH * (i + 7) - 1);
    });

    // Tax summary rows
    const rowsData = [
        ["Total Freight", totalFreight],
        ["Fuel Charges", totalFSC],
        ["Other Charges", totalOther],
        ["Sub Total", taxable],
        ["CGST @ 9%", cgst],
        ["SGST @ 9%", sgst],
        ["IGST @ 18%", igst],
        ["Total GST", cgst + sgst + igst],
        ["GRAND TOTAL", grandTotal]
    ];
    doc.setFontSize(FONT.small);

    rowsData.forEach((r, i) => {
        const ry = y + rowH * (i + 2) - 1;

        const highlightRows = ["GRAND TOTAL", "Sub Total", "Total GST"];
        const isHighlight = highlightRows.includes(r[0]);

        const cellY = ry - 3;

        if (isHighlight) {

            doc.setFillColor(220, 230, 241);

            // Fill each cell separately
            doc.rect(x2, cellY, col2, rowH, "F");
            doc.rect(x3, cellY, col3, rowH, "F");
            doc.rect(x4, cellY, col4, rowH, "F");

            // Bold border for each cell
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);

            doc.rect(x2, cellY, col2, rowH);
            doc.rect(x3, cellY, col3, rowH);
            doc.rect(x4, cellY, col4, rowH);

            doc.setFont("helvetica", "bold");

        } else {
            doc.setLineWidth(0.2);
            doc.setFont("helvetica", "normal");
        }

        doc.text(r[0], x2 + col2 / 2, ry, { align: "center" });
        doc.text("0.00", x3 + col3 - 2, ry, { align: "right" });
        doc.text(r[1].toFixed(2), x4 + col4 - 2, ry, { align: "right" });
    });

    /* ==============================
       AMOUNT IN WORDS + FOOTER
    ============================== */
    y += tableH;

    if (y + 16 > PAGE.h - 10) {
        doc.addPage();
        y = PAGE.x;
    }

    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    const amountText = "Amount in Words: " + numberToWordsIndian(grandTotal);
    const textLines = doc.splitTextToSize(amountText, PAGE.w - 6);

    // Draw amount in words box
    const boxH = textLines.length + 4; // Add small padding
    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.text(textLines, PAGE.x + 3, y + 3);
    y += boxH;

    // Footer function
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    const addFooter = (doc, pageNumber, totalPages) => {
        const footerY = PAGE.h - 5;
        doc.text("Powered by AllEdge", PAGE.x, footerY, { align: "left" });
        doc.text(
            "This is a computer generated invoice. No signature required.",
            PAGE.x + PAGE.w / 2,
            footerY,
            { align: "center" }
        );
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
    doc.save(`Invoice_${header?.InvoiceNo || "NA"}.pdf`);
}