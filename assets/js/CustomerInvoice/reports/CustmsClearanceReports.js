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

async function fetchAndRenderShipmentTable(doc, startY, PAGE, FONT, invoiceNo) {
    const shipmentColumnStyles = {
        0: { cellWidth: 8, halign: "center" }, // Sl No
        1: { cellWidth: 25 }, // Job ID
        2: { cellWidth: 25 }, // Date
        3: { cellWidth: 25 }, // BL / AWB No
        4: { cellWidth: 20 }, // BL Date
        5: { cellWidth: 25 }, // BE No
        6: { cellWidth: 20 }, // BE Date
        7: { cellWidth: 20, halign: "right" }, // Qty
        8: { cellWidth: 22, halign: "right" } // Weight
    };
    const chargesColumnStyles = {
        0: { cellWidth: 33 },   // Charge Name
        1: { cellWidth: 15 },  // HSN
        2: { cellWidth: 10 }, // GST Rate
        3: { cellWidth: 25, halign: "right" }, // Taxable Value
        4: { cellWidth: 20, halign: "right" }, // SGST
        5: { cellWidth: 25, halign: "right" }, // CGST
        6: { cellWidth: 20, halign: "right" }, // IGST
        7: { cellWidth: 20, halign: "right" }, // Total GST
        8: { cellWidth: 22, halign: "right" } // Grand Total
    };

    /* ===============================
    Invoice Details
    =============================== */
    const { data: invoiceDetails, error: invError } = await supabaseClient
        .from("InvoiceDetails")
        .select("*")
        .eq("InvoiceNo", invoiceNo)
        .maybeSingle();

    if (invError) {
        console.error("Invoice details load failed:", invError);
    } else {
        invoiceRemarks = "Information:\n" + "    " + (invoiceDetails?.Remarks || "");
    }

    /* ===============================
       FETCH SHIPMENTS
    =============================== */

    const { data: lines, error } = await supabaseClient
        .from("CustomsClearanceView")
        .select("*")
        .eq("InvoiceNo", invoiceNo)
        .order("JobDate", { ascending: true });

    if (error || !lines?.length) {
        return {
            finalY: startY,
            totals: { totalFreight: 0, totalGstAmt: 0, totalGrandTotal: 0, totalWeight: 0 },
        };
    }


    /* ===============================
       FETCH ALL CHARGES (ONE QUERY)
    =============================== */

    const shipmentIds = lines.map(x => x.id);

    console.log("Fetching charges for shipments:", shipmentIds);

    const { data: allCharges } = await supabaseClient
        .from("CustomsClearanceCharges")
        .select("*")
        .in("ID_CC", shipmentIds);

    /* GROUP CHARGES BY SHIPMENT */
    const chargesMap = {};
    allCharges?.forEach(c => {
        if (!chargesMap[c.ID_CC]) chargesMap[c.ID_CC] = [];
        chargesMap[c.ID_CC].push(c);
    });

    /* ===============================
    FETCH ALL Equipment (ONE QUERY)
 ================================ */
    const invoice_id = document.getElementById("tempFormID").value;
    console.log("Fetching equipment details for shipments:", shipmentIds);
    const { data: allEquipment, error: equipmenterror } = await supabaseClient
        .from("CustomsClearanceEquipment")
        .select("*")
        .in("ID_CC", shipmentIds);

    if (equipmenterror) {
        console.error("Equipment fetch error:", equipmenterror);
    }

    console.log("Fetched equipment data:", allEquipment);

    /* ===============================
       BUILD REMARKS TEXT
    ================================ */
    let equipmentText = "Remarks:\n";

    if (Array.isArray(allEquipment) && allEquipment.length > 0) {

        equipmentText += allEquipment
            .map(e =>
                `• Eq No: ${e?.EquipmentNumber || "-"} | ` +
                `Type: ${e?.EquipmentType || "-"} | `
            )
            .join("\n");

        console.log("Constructed equipment text:", equipmentText);

    } else {
        equipmentText += "No Equipment Details";
    }

    /* ===============================
       GRAND TOTAL VARIABLES
    =============================== */

    let totalFreight = 0;
    let totalGstAmt = 0;
    let totalGrandTotal = 0;
    let totalWeight = 0;
    let totalTaxable = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;

    let currentY = startY;

    /* ===============================
       LOOP SHIPMENTS
    =============================== */

    for (let i = 0; i < lines.length; i++) {

        const row = lines[i];

        totalWeight += safeNumber(row.CargoWeight);
        totalFreight += safeNumber(row.TotalAmount);
        totalGstAmt += safeNumber(row.TotalGSTAmt);
        totalGrandTotal += safeNumber(row.GrandTotalAmt);

        /* ---------- SHIPMENT ROW ---------- */

        doc.autoTable({
            startY: currentY,
            margin: { left: PAGE.x, right: PAGE.x },
            head: i === 0 ? [[
                "Sl", "Job ID", "Date", "BL / AWB No",
                "BL Date", "BE No", "BE Date", "Qty", "Weight"
            ]] : undefined,
            body: [[
                i + 1,
                row.JobID,
                formatDate(row.JobDate),
                row.BLAWBNo || "",
                formatDate(row.BLAWBDate),
                row.BENo || "",
                formatDate(row.BEDate),
                row.Quantity || "0.00",
                safeNumber(row.CargoWeight).toFixed(2)
            ]],
            columnStyles: shipmentColumnStyles,
            styles: {
                fontSize: FONT.small,
                cellPadding: 1,
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
                valign: "middle"
            },
            headStyles: {
                halign: "center",
                fontStyle: "bold",
                lineWidth: 0.2,
                lineColor: [0, 0, 0]
            },
            didParseCell: data => {
                if (data.section === "body") {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [255, 255, 255]; // White background
                    data.cell.styles.textColor = [0, 0, 0]; // Black text color
                }
            }
        });

        currentY = doc.lastAutoTable.finalY;

        /* ---------- CHARGES ---------- */

        const charges = chargesMap[row.id] || [];

        if (!charges.length) continue;

        let chTaxable = 0, chSGST = 0, chCGST = 0, chIGST = 0, chGST = 0, chGrand = 0;

        const chargeBody = charges.map(c => {

            const taxable = safeNumber(c.TotalAmount);
            const sgst = safeNumber(c.SGSTAmt);
            const cgst = safeNumber(c.CGSTAmt);
            const igst = safeNumber(c.IGSTAmt);
            const gst = safeNumber(c.TotalGSTAmt);
            const grand = safeNumber(c.GrandTotalAmt);

            chTaxable += taxable;
            chSGST += sgst;
            chCGST += cgst;
            chIGST += igst;
            chGST += gst;
            chGrand += grand;

            totalTaxable += taxable;
            totalSGST += sgst;
            totalCGST += cgst;
            totalIGST += igst;

            return [
                c.ChargesType || "",
                c.HSNCode || "",
                c.TaxRate || "00%",
                taxable.toFixed(2),
                sgst.toFixed(2),
                cgst.toFixed(2),
                igst.toFixed(2),
                gst.toFixed(2),
                grand.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: currentY,
            margin: { left: PAGE.x, right: PAGE.x },
            head: i === 0 ? [[
                "Charge Name", "HSN", "GST %",
                "Taxable", "SGST", "CGST", "IGST",
                "Total GST", "Grand Total"
            ]] : undefined,
            body: chargeBody,
            columnStyles: chargesColumnStyles,

            styles: {
                fontSize: FONT.small,
                cellPadding: 1,
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
                valign: "middle"
            },
            headStyles: {
                halign: "center",
                fontStyle: "bold",
                lineWidth: 0.2,
                lineColor: [0, 0, 0]
            },
            footStyles: {
                lineWidth: 0.2,
                lineColor: [0, 0, 0]
            },
            didParseCell: data => {
                if (data.section === "body") {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [255, 255, 255];
                    data.cell.styles.textColor = [0, 0, 0];
                }
            },
            foot: [[
                { content: "SHIPMENT TOTAL", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
                { content: chTaxable.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: chSGST.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: chCGST.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: chIGST.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: chGST.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
                { content: chGrand.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
            ]]
        });

        currentY = doc.lastAutoTable.finalY;
    }

    /* ===============================
       FINAL GRAND TOTAL
    =============================== */

    doc.autoTable({
        startY: currentY,
        margin: { left: PAGE.x, right: PAGE.x },
        columnStyles: chargesColumnStyles,
        body: [[
            {
                content: "FINAL TOTAL", colSpan: 3,
                styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0] }
            },
            {
                content: totalTaxable.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
            },
            {
                content: totalSGST.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
            },
            {
                content: totalCGST.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
            },
            {
                content: totalIGST.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
            },
            {
                content: totalGstAmt.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
            },
            {
                content: totalGrandTotal.toFixed(2),
                styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 0], textColor: [0, 0, 0] }
            }
        ]],

        styles: {
            fontSize: FONT.small,
            cellPadding: 1,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
        },
        footStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 255],
            fontStyle: "bold",
            lineWidth: 0.2,
            lineColor: [0, 0, 0]
        },
        foot: [
            [
                {
                    content: "Amount in Words: " + numberToWordsIndian(totalGrandTotal),
                    colSpan: 9,
                    styles: { halign: "left" }
                }
            ]
        ]

    });
    currentY = doc.lastAutoTable.finalY;
    doc.autoTable({
        startY: currentY,
        margin: { left: PAGE.x, right: PAGE.x },
        body: [
            [
                {
                    content: equipmentText,
                    colSpan: 4,   // Must match your total columns
                    styles: { halign: "left" }
                },
                {
                    content: invoiceRemarks,
                    colSpan: 5,
                    styles: { halign: "left" }
                }
            ]
        ],
        styles: {
            fontSize: FONT.small,
            cellPadding: 1,
            lineWidth: 0.2,
            lineColor: [0, 0, 0]
        }
    });



    currentY = doc.lastAutoTable.finalY;

    //    
}

async function drawTermsAndBankDetails(doc, y, company, header, PAGE, FONT, safeRect, getInvoiceBankDetails) {

    const rowH = 5;
    const col1 = PAGE.w * 0.5;
    const col2 = PAGE.w * 0.5;

    const x1 = PAGE.x;
    const x2 = x1 + col1;

    const rows = 5;
    const tableH = rowH * rows;

    // Page break
    if (y + tableH > PAGE.h - 20) {
        doc.addPage();
        y = 10;
    }

    /* Outer border */
    safeRect(doc, PAGE.x, y, PAGE.w, tableH);

    /* Vertical divider */
    doc.line(x2, y, x2, y + tableH);

    /* Horizontal lines */
    for (let i = 1; i < rows; i++) {
        doc.line(PAGE.x, y + rowH * i, PAGE.x + PAGE.w, y + rowH * i);
    }

    /* Headers */
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("TERMS", x1 + col1 / 2, y + 3.5, { align: "center" });
    doc.text("BANK DETAILS", x2 + col2 / 2, y + 3.5, { align: "center" });

    /* Terms content */
    doc.setFont("helvetica", "normal").setFontSize(FONT.small);

    const terms = [
        `1. Please draw cheque in favour of ${company.name}`,
        "2. Payments should be made within 7 days from the date of billing.",
        "3. Complaints must be forwarded within 8 days from receipt.",
        "4. Bangalore will be the jurisdiction for any disputes."
    ];

    terms.forEach((t, i) => {
        doc.text(t, x1 + 1, y + rowH * (i + 2) - 1);
    });

    /* Bank details */
    const bankInfo = await getInvoiceBankDetails(header?.InvoiceNo);

    const bankDetails = [
        `Account Name : ${company.name}`,
        `Account No   : ${bankInfo?.AccountNo || '0000000000'}`,
        `Bank Name    : ${bankInfo?.BankName || '-'} | Branch Name: ${bankInfo?.BranchName || '-'} `,
        `IFSC Code: ${bankInfo?.IFSCCode || '-'} | MICR Code: ${bankInfo?.MICRCode || '-'} `
    ];

    bankDetails.forEach((b, i) => {
        doc.text(b, x2 + 1, y + rowH * (i + 2) - 1);
    });

    /* Move Y */
    y = y + tableH + 3;

    // Footer note
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(FONT.small);
    doc.text(
        "This is a computer generated invoice. No signature required.",
        PAGE.x + PAGE.w / 2,
        y,
        { align: "center" }
    );

    return y + 5; // return updated Y
}