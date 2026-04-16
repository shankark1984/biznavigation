
async function generate_International_InvoicePDF(header, lines = []) {

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
       SHIPMENT TABLE & CHARGES
    ============================== */
    console.log("Invoice Printing Type ", reportType);
    if (reportType === "Print Annexure") {
        const tableResult = await fetchAndRenderShipmentTable_Annexure(doc, y, PAGE, FONT, header?.InvoiceNo);
        if (tableResult && tableResult.finalY) {
            y = tableResult.finalY;
        } else if (doc.lastAutoTable) {
            y = doc.lastAutoTable.finalY;
        }
    } else if (reportType === "Main") {
        const tableResult = await fetchAndRenderShipmentTable_Main(doc, y, PAGE, FONT, header?.InvoiceNo);
        if (tableResult && tableResult.finalY) {
            y = tableResult.finalY;
        } else if (doc.lastAutoTable) {
            y = doc.lastAutoTable.finalY;
        }
    } else if (reportType === "Latter Head") {
        const tableResult = await fetchAndRenderShipmentTable_LatterHead(doc, y, PAGE, FONT, header?.InvoiceNo);
        if (tableResult && tableResult.finalY) {
            y = tableResult.finalY;
        } else if (doc.lastAutoTable) {
            y = doc.lastAutoTable.finalY;
        }
    }




    /* ==============================
       TERMS AND BANK DETAILS
    ============================== */
    y = await drawTermsAndBankDetails_int(doc, y, company, header, PAGE, FONT, safeRect, getInvoiceBankDetails);

    /* ==============================
           PAGE FOOTER
        ============================== */
    applyPdfFooter(doc, PAGE);
    // Save PDF
    doc.save(`${party.name || "NA"}_${header?.InvoiceNo || "NA"}.pdf`);
}

async function fetchAndRenderShipmentTable_Annexure(doc, startY, PAGE, FONT, invoiceNo) {
    const shipmentColumnStyles = {
        0: { cellWidth: 8, halign: "center" }, // Sl No
        1: { cellWidth: 25 }, // Docket / Job ID
        2: { cellWidth: 20 }, // Date / Booked Date
        3: { cellWidth: 20 }, // Movement Type
        4: { cellWidth: 20 }, // Transit Type
        5: { cellWidth: 15 }, // Mode 
        6: { cellWidth: 25 }, // Origin
        7: { cellWidth: 25 }, // Destination
        8: { cellWidth: 16, halign: "right" }, // Qty
        9: { cellWidth: 16, halign: "right" }, // Wt/CBM
    };
    const chargesColumnStyles = { //
        0: { cellWidth: 8, halign: "center" }, //""
        1: { cellWidth: 25 }, // Charge Name (colSpan 2)
        2: { cellWidth: 20 }, // HSN Code
        3: { cellWidth: 20, halign: "right" }, // Taxable Value
        4: { cellWidth: 20, halign: "right" }, // GST %
        5: { cellWidth: 15, halign: "right" }, // SGST
        6: { cellWidth: 25, halign: "right" }, // CGST
        7: { cellWidth: 25, halign: "right" }, // IGST
        8: { cellWidth: 16, halign: "right" }, // Total GST
        9: { cellWidth: 16, halign: "right" }, // Grand Total
    };

    let totalFreight = 0;
    let totalGstAmt = 0;
    let totalGrandTotal = 0;
    let totalWeight = 0;
    let totalTaxable = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;

    /* ===============================
    Invoice Details
    =============================== */
    console.log("Fetching invoice details for invoice:", invoiceNo);
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
        .from("InternationalBookingView")
        .select("*")
        .eq("InvoiceNumber", invoiceNo)
        .order("BookedDate", { ascending: true });

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
        .from("InternationalBookingCharges")
        .select("*")
        .in("ID_IB", shipmentIds);

    /* GROUP CHARGES BY SHIPMENT */
    const chargesMap = {};
    allCharges?.forEach(c => {
        if (!chargesMap[c.ID_IB]) chargesMap[c.ID_IB] = [];
        chargesMap[c.ID_IB].push(c);
    });

    /* ===============================
    FETCH ALL Equipment (ONE QUERY)
 ================================ */

    console.log("Fetching equipment details for shipments:", shipmentIds);
    const { data: allEquipment, error: equipmenterror } = await supabaseClient
        .from("InternationalBookingEquipment")
        .select("*")
        .in("ID_IB", shipmentIds);

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
    Payment Details
    =============================== */
    const totalsPayment = await advancedPaymentDetails(invoiceNo, invoiceDetails?.InvoiceDate);

    const totalPaymentReceived = totalsPayment.totalPayment + totalsPayment.totalOtherDeduction + totalsPayment.totalTDS;

    /* ===============================
       GRAND TOTAL VARIABLES
    =============================== */

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
                "Sl", "Docket", "Date", "Movement", "Transit", "Mode", "Origin", "Dest", "Quantity",
                "Wt/CBM"
            ]] : undefined,
            body: [[
                i + 1,
                row.DocketNo,
                formatDate(row.BookedDate),
                row.MovementType || "",
                row.TransitType || "",
                row.ModeType || "",
                row.OriginName || "",
                row.DestinationName || "",
                row.Quantity ? row.Quantity.toFixed(2) : "0.00",
                row.ChargableWeight + " " + row.UOMType || "0.00",
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
            console.log(c);
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
                { content: c.ChargesType || "", colSpan: 2 },
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
                { content: "Charge Name", colSpan: 2 }, "HSN", "GST %",
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
                { content: "SHIPMENT TOTAL", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
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
                    content: "Amount in Words:",
                    rowSpan: 2,
                    styles: {
                        halign: "left", cellWidth: 23, textColor: [0, 0, 0],
                        fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 6.5, valign: "middle",   // ✅ vertical center
                    }
                },
                {
                    content: numberToWordsIndian(totalGrandTotal),
                    colSpan: 5, rowSpan: 2,
                    styles: { halign: "left", valign: "middle" }
                },
                {
                    content: "Advance Amount: ", // Replace with actual advance amount if available
                    colSpan: 2,
                    styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold" }
                },
                {
                    content: totalPaymentReceived.toFixed(2), // Replace with actual advance amount if available
                    styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold" }
                }


            ],
            [
                {
                    content: "Balance Amount: ", // Replace with actual advance amount if available
                    colSpan: 2,
                    styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold", fillColor: [255, 255, 0] }
                },
                {
                    content: safeNumber(totalGrandTotal - totalPaymentReceived).toFixed(2), // Replace with actual advance amount if available
                    styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold", fillColor: [255, 255, 0] }
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

    return {
        finalY: currentY,
        totals: {
            totalFreight,
            totalGstAmt,
            totalGrandTotal,
            totalWeight,
            totalTaxable,
            totalSGST,
            totalCGST,
            totalIGST
        }
    };
}

async function fetchAndRenderShipmentTable_Main(doc, startY, PAGE, FONT, invoiceNo) {
    const shipmentColumnStyles = {
        0: { cellWidth: 8, halign: "center" }, // Sl No
        1: { cellWidth: 23 }, // Docket No
        2: { cellWidth: 15 }, // Booking Date 
        3: { cellWidth: 25 }, // Movement Type
        4: { cellWidth: 20 }, // Origin
        5: { cellWidth: 20 }, // Dest
        6: { cellWidth: 15, halign: "right" }, // Wt/CBM
        7: { cellWidth: 16, halign: "right" }, // Freight
        8: { cellWidth: 16, halign: "right" }, // FSC
        9: { cellWidth: 16, halign: "right" }, // Other
        10: { cellWidth: 16, halign: "right" }, // Total Amt
    };
    const chargesColumnStyles = { //
        0: { cellWidth: 8, halign: "center" }, //""
        1: { cellWidth: 23 }, // Charge Name (colSpan 2)
        2: { cellWidth: 25 }, // Non-Taxable Amount
        3: { cellWidth: 20, halign: "right" }, // Taxable Value
        4: { cellWidth: 20, halign: "right" }, // SGST
        5: { cellWidth: 15, halign: "right" }, // CGST
        6: { cellWidth: 16, halign: "right" }, // IGST
        7: { cellWidth: 16, halign: "right" }, // Total GST
        8: { cellWidth: 16, halign: "right" }, // Grand Total
    };

    let totalFreight = 0;
    let totalGstAmt = 0;
    let totalGrandTotal = 0;
    let totalWeight = 0;
    let totalTaxable = 0;
    let totalNonTaxable = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
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
        .from("InternationalBookingView")
        .select("*")
        .eq("InvoiceNumber", invoiceNo)
        .order("BookedDate", { ascending: true });

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

    const { data: allCharges } = await supabaseClient
        .from("InternationalBookingCharges")
        .select("*")
        .in("ID_IB", shipmentIds);

    /* GROUP CHARGES BY SHIPMENT */
    const chargesMap = {};
    allCharges?.forEach(c => {
        if (!chargesMap[c.ID_IB]) chargesMap[c.ID_IB] = [];
        chargesMap[c.ID_IB].push(c);
    });

    /* ===============================
    FETCH ALL Equipment (ONE QUERY)
 ================================ */

    const { data: allEquipment, error: equipmenterror } = await supabaseClient
        .from("InternationalBookingEquipment")
        .select("*")
        .in("ID_IB", shipmentIds);

    if (equipmenterror) {
        console.error("Equipment fetch error:", equipmenterror);
    }

    console.log("Fetched equipment data:", allEquipment);

    /* ===============================
       BUILD REMARKS TEXT
    ================================ */
    let equipmentText = "Remarks:\n";
    equipmentText += (allEquipment?.length)
        ? allEquipment.map(e =>
            `• Eq No: ${e?.EquipmentNumber || "-"} | Type: ${e?.EquipmentType || "-"} |`
        ).join("\n")
        : "No Equipment Details";

    /* ===============================
    Payment Details
    =============================== */
    const totalsPayment = await advancedPaymentDetails(invoiceNo, invoiceDetails?.InvoiceDate);
    const totalPaymentReceived = totalsPayment.totalPayment + totalsPayment.totalOtherDeduction + totalsPayment.totalTDS;

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
                "Sl", "Docket", "Date", "Movement", "Origin", "Dest",
                "Wt/CBM", "Freight", "FSC", "Other", "Total Amt"
            ]] : undefined,
            body: [[
                i + 1,
                row.DocketNo,
                formatDate(row.BookedDate),
                (row.MovementType || "") +
                "\n" +
                (row.TransitType || "") +
                "\n" +
                (row.ModeType || ""),
                row.OriginName || "",
                row.DestinationName || "",
                row.ChargableWeight + " " + row.UOMType || "0.00",
                safeNumber(row.FreightAmount).toFixed(2),
                safeNumber(row.FuelSurcharge).toFixed(2),
                safeNumber(row.OtherCharges).toFixed(2),
                safeNumber(row.TotalAmount).toFixed(2)
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

        charges.forEach(c => {
            if (safeNumber(c.TotalGSTAmt) > 0) {
                totalTaxable += safeNumber(c.TotalAmount);
            } else {
                totalNonTaxable += safeNumber(c.TotalAmount);
            }
            totalSGST += safeNumber(c.SGSTAmt);
            totalCGST += safeNumber(c.CGSTAmt);
            totalIGST += safeNumber(c.IGSTAmt);
        });

        doc.autoTable({
            startY: currentY,
            margin: { left: PAGE.x, right: PAGE.x },
            columnStyles: chargesColumnStyles,
            head: [[
                { content: "FINAL TOTAL", colSpan: 3, rowSpan: 2, styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "Non-Taxable", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "Taxable", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "SGST", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "CGST", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "IGST", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "Total GST", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [220, 220, 220] } },
                { content: "Grand Total", styles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], valign: "middle", fillColor: [255, 255, 0] } }
            ]],
            body: [[
                "",
                "",
                "",
                {
                    content: totalNonTaxable.toFixed(2),
                    styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0] }
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
                        content: "Amount in Words:",
                        rowSpan: 2,
                        styles: {
                            halign: "left", cellWidth: 23, textColor: [0, 0, 0],
                            fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 6.5, valign: "middle",   // ✅ vertical center
                        }
                    },
                    {
                        content: numberToWordsIndian(totalGrandTotal),
                        colSpan: 6, rowSpan: 2,
                        styles: { halign: "left", valign: "middle" }
                    },
                    {
                        content: "Advance Amount: ", // Replace with actual advance amount if available
                        colSpan: 2,
                        styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold" }
                    },
                    {
                        content: totalPaymentReceived.toFixed(2), // Replace with actual advance amount if available
                        styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold" }
                    }
                ],
                [
                    {
                        content: "Balance Amount: ", // Replace with actual advance amount if available
                        colSpan: 2,
                        styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold", fillColor: [255, 255, 0] }
                    },
                    {
                        content: safeNumber(totalGrandTotal - totalPaymentReceived).toFixed(2), // Replace with actual advance amount if available
                        styles: { halign: "right", textColor: [0, 0, 0], fontStyle: "bold", fillColor: [255, 255, 0] }
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

        return {
            finalY: currentY,
            totals: {
                totalFreight,
                totalGstAmt,
                totalGrandTotal,
                totalWeight,
                totalTaxable,
                totalSGST,
                totalCGST,
                totalIGST
            }
        };
    }
}
