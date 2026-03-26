async function generate_FullTruckReports_InvoicePDF(header, lines = []) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const PAGE = { x: 10, w: 190, h: 297 };
    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6 };

    let y = 10;

    const [company, party, shipmentData, bank] = await Promise.all([
        fetchCompanyDetails(header),
        fetchPartyDetails(header),
        getDomesticShipmentData(header?.InvoiceNo),
        getInvoiceBankDetails(header?.InvoiceNo)
    ]);


    y = await drawHeader(doc, PAGE, FONT, company, y);

    y = drawTitle(doc, PAGE, FONT, y);


    y = drawPartySection(doc, PAGE, FONT, header, party, company, y);
    //Shipment section
    const shipmentResult = await drawShipmentTable(doc, PAGE, FONT, shipmentData, y);

    y = shipmentResult.y;
    //TermsAndTaxSection
    const totals = shipmentResult;

    y = await drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y, bank);

    y = drawAmountInWords(doc, PAGE, FONT, totals.grandTotal, y);

    addFooterToAllPages(doc, PAGE);

    doc.save(`Invoice_${header?.InvoiceNo || "NA"}.pdf`);
}
// Utility function to fetch company details
async function fetchCompanyDetails(header) {
    const data = await getCompanyProfile(header?.CompanyID || CompanyID);

    return {
        name: data?.company_name || "",
        address: [
            data?.address,
            data?.city && `${data.city} - ${data.pin_code}`,
            data?.state,
            data?.country
        ].filter(Boolean).join(", "),
        phone: data?.phone_no || "-",
        email: data?.e_mail || "-",
        gst: data?.gst_number || "-",
        state: data?.state,
        logo: data?.logo_path
    };
}
// Utility function to load image as base64
async function drawHeader(doc, PAGE, FONT, company, y) {
    const headerH = 22;
    const logoW = PAGE.w * 0.2;
    const textW = PAGE.w * 0.75;

    doc.rect(PAGE.x, y, PAGE.w, headerH);

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

    return y + headerH;
}
// Utility function to draw title
function drawTitle(doc, PAGE, FONT, y) {
    doc.rect(PAGE.x, y, PAGE.w, 6);

    doc.setFont("helvetica", "bold").setFontSize(FONT.title);
    doc.text("TAX INVOICE", PAGE.x + PAGE.w / 2, y + 4, { align: "center" });

    return y + 6;
}
// Utility function to fetch party details
async function fetchPartyDetails(header) {
    const data = await getPartyProfile(header.PartyCode);

    return {
        name: data?.PartyName || "-",
        address: [
            data?.Address,
            data?.City && `${data.City} - ${data.PinCode}`,
            data?.State,
            data?.Country
        ].filter(Boolean).join(", "),
        gst: data?.GSTNumber || "-",
        state: data?.State
    };
}
// Draw party details section Invoice no, invoice date, SAC code, GST no, PO no
function drawPartySection(doc, PAGE, FONT, header, party, company, y) {
    const left70 = PAGE.w * 0.7;
    const left40 = PAGE.w * 0.4;

    // Split text
    const partyNameLines = doc.splitTextToSize(`M/s ${party.name}`, left70 - 6);
    const partyAddrLines = doc.splitTextToSize(party.address, left70 - 6);

    const rightLines = doc.splitTextToSize([
        `Invoice No : ${header?.InvoiceNo || "-"}`,
        `Invoice Date : ${formatDate(header?.InvoiceDate) || "-"}`,
        `SAC Code : ${header?.SACCode || "-"}`
    ].join("\n"), PAGE.w - left70 - 6);

    // Dynamic height
    const row1H = Math.max(
        partyNameLines.length + partyAddrLines.length,
        rightLines.length
    ) * 4 + 4;

    const row2H = 6;
    const infoH = row1H + row2H;

    // Draw box
    doc.rect(PAGE.x, y, PAGE.w, infoH);

    // Vertical + horizontal lines
    doc.line(PAGE.x + left70, y, PAGE.x + left70, y + row1H);
    doc.line(PAGE.x + left40, y + row1H, PAGE.x + left40, y + infoH);
    doc.line(PAGE.x, y + row1H, PAGE.x + PAGE.w, y + row1H);

    // Left side
    doc.setFont("helvetica", "bold");
    doc.text(partyNameLines, PAGE.x + 3, y + 4);

    doc.setFont("helvetica", "normal");
    doc.text(partyAddrLines, PAGE.x + 3, y + 4 + partyNameLines.length * 4);

    // Right side
    doc.text(rightLines, PAGE.x + left70 + 3, y + 4, {
        maxWidth: PAGE.w - left70 - 6
    });

    // Bottom row
    doc.text(`GST No : ${party.gst}`, PAGE.x + 3, y + row1H + 4);
    doc.text(`P.O. No : ${header?.PONumber || "-"}`, PAGE.x + left40 + 3, y + row1H + 4);

    return y + infoH;
}
// Utility function to fetch shipment details
async function drawShipmentTable(doc, PAGE, FONT, rows = [], y) {

    let totalFreight = 0, totalOther = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0, totalGST = 0;

    if (!rows.length) {
        console.warn("No shipment data found");
    }

    const body = rows.map((row, i) => {

        let freightAmount = 0, otherAmount = 0;


        (row.FullLoadBookingCharges || []).forEach(c => {

            const amount = safeNumber(c.amount);

            totalCGST += safeNumber(c.cgst_amount);
            totalSGST += safeNumber(c.sgst_amount);
            totalIGST += safeNumber(c.igst_amount);


            if (c.charges_type === "Freight Amount" || c.charges_type === "Transportation Charges") {
                freightAmount += amount;
            } else {
                otherAmount += amount;
            }
        });

        // totals
        totalFreight += freightAmount;
        totalOther += otherAmount;

        // 🔥 ADD THIS HERE
        const description = [
            `Move: ${row.movement_type || "-"}`,
            `Ref: ${row.reference_number || "-"}`,
            `Vehicle: ${row.vehicle_type || ""} / ${row.vehicle_number || ""}`,
            `Container: ${row.container_number || "-"}`,
            `Route: ${row.origin_city || ""} → ${row.destination_city || ""}`,
            `Mode: ${row.mode_type || "-"}`,
            `Delivery: ${formatDate(row.completion_date) || "-"}`
        ].join("\n");


        return [
            i + 1,
            row.lr_number || "",
            formatDate(row.pickup_date) || "",
            description,
            row.charge_weight || "",
            freightAmount.toFixed(2),
            otherAmount.toFixed(2),
            (freightAmount + otherAmount).toFixed(2)
        ];
    });

    totalGST = round2(totalCGST + totalSGST + totalIGST);
    const grandTotal = round2(totalFreight + totalOther + totalGST);

    doc.autoTable({
        startY: y,
        margin: { left: PAGE.x, right: PAGE.x },
        tableWidth: PAGE.w,

        head: [[
            "Sl", "Docket no", "Date", "Descriptions", "Qty",
            "Rate Per Unit", "Other Charges", "Amount (INR)"
        ]],

        body,

        styles: {
            fontSize: FONT.tiny,
            cellPadding: 1.5,
            overflow: "linebreak",
            textColor: 0,
            minCellHeight: 5,
            lineWidth: 0.2,              // 🔥 border thickness
            lineColor: [0, 0, 0],
        },

        headStyles: {
            fillColor: [60, 60, 60],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            cellPadding: 1.5,
            lineWidth: 0.2,              // 🔥 header border
            lineColor: [0, 0, 0]
        },

        columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 17 },
            2: { cellWidth: 22 },
            3: { cellWidth: 60 },  // 🔥 BIG for description
            4: { cellWidth: 12 },
            5: { cellWidth: 22, halign: "right" },
            6: { cellWidth: 22, halign: "right" },
            7: { cellWidth: 14, halign: "right" },

        },
        didDrawCell: (data) => {
            if (data.section === "body") {
                data.cell.styles.lineColor = [0, 0, 0]; // 🔥 enforce borders
                data.cell.styles.lineWidth = 0.2;
            }
        }
    });

    return {
        y: doc.lastAutoTable.finalY,
        totalFreight,
        totalOther,
        totalCGST,
        totalSGST,
        totalIGST,
        totalGST,
        grandTotal
    };
}
// ================= TERMS AND TAX SECTION =================
async function drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y, bank) {

    const rowH = 4;        // 🔥 fixed row height (increase for spacing)
    const rows = 10;       // total rows
    const tableH = rowH * rows;

    const col3 = 30;  // Non-Tax (match Freight column)
    const col2 = 24;  // Label (slightly wider for text)
    const col1 = PAGE.w - (col2 + col3); // remaining space

    const x1 = PAGE.x;
    const x2 = x1 + col1;
    const x3 = x2 + col2;
    const x4 = x3 + col3;

    // Page break
    y = checkPageBreak(doc, y, tableH, PAGE);

    // Outer border (bold)
    doc.setDrawColor(0, 0, 0);     // black
    doc.setLineWidth(0.2);         // 🔥 thicker outer border
    doc.rect(PAGE.x, y, PAGE.w, tableH);

    // Inner lines (light + thin)
    doc.setDrawColor(120, 120, 120); // 🔥 soft gray (better than black)
    doc.setLineWidth(0.2);

    // Vertical lines
    [x2, x3, x4].forEach(x => {
        doc.line(x, y, x, y + tableH);
    });

    // Horizontal lines
    for (let i = 1; i < rows; i++) {
        doc.line(PAGE.x, y + i * rowH, PAGE.x + PAGE.w, y + i * rowH);
    }

    // ================= HEADER =================
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);

    const headerY = y + rowH / 2;

    doc.text("Terms & Conditions", x1 + col1 / 2, headerY, {
        align: "center",
        baseline: "middle"
    });

    doc.text("Non-Tax", x3 + col3 / 2, headerY, {
        align: "center",
        baseline: "middle"
    });

    // ================= TERMS =================
    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const terms = [
        `1. Please draw cheque in favour of ${company.name}`,
        "2. Payments Should be made within 7 Days from the Date of Billing",
        "3. All Complaints must be forwarded within 8 days of receipt",
        "4. Only the courts of Bangalore will have exclusive jurisdiction over this contract.",
    ];

    terms.forEach((t, i) => {

        const rowTopY = y + rowH * (i + 1);
        const textY = rowTopY + rowH / 2;

        const text = doc.splitTextToSize(t, col1 - 4);

        doc.text(text, x1 + 2, textY, {
            align: "left",
            baseline: "middle"
        });
    });

    // ================= BANK =================
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Bank Details", x1 + col1 / 2, y + rowH * 6 - 2, {
        align: "center", baseline: "middle"
    });

    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const bankDetails = [
        `Account Name: ${company.name}`,
        `Account No: ${bank?.AccountNo || "-"}`,
        `Bank: ${bank?.BankName || "-"} | Branch: ${bank?.BranchName || "-"}`,
        `IFSC: ${bank?.IFSCCode || "-"}`
    ];

    bankDetails.forEach((b, i) => {

        const rowTopY = y + rowH * (6 + i);
        const textY = rowTopY + rowH / 2;

        const text = doc.splitTextToSize(b, col1 - 4);

        doc.text(text, x1 + 2, textY, {
            align: "left",
            baseline: "middle"
        });
    });
    console.log("Calculated totals for tax table:", totals);
    // ================= TAX TABLE =================
    const data = [
        ["Freight Charges", totals.totalFreight],
        ["Other Charges", totals.totalOther],
        ["Sub Total", totals.totalFreight + totals.totalOther],
        ["CGST", totals.totalCGST],
        ["SGST", totals.totalSGST],
        ["IGST", totals.totalIGST],
        ["Total GST", totals.totalGST],
        ["GRAND TOTAL", totals.grandTotal]
    ];

    doc.setFontSize(FONT.small);

    data.forEach((row, i) => {

        const rowTopY = y + rowH * (i + 1);
        const textY = rowTopY + rowH / 2;

        const label = row[0];
        const freight = row[1];


        const isHighlight =
            label === "Sub Total" ||
            label === "Total GST" ||
            label === "GRAND TOTAL";


        // ================= HIGHLIGHT ROWS =================
        if (isHighlight) {

            doc.setFillColor(220, 230, 241);

            // Fill
            doc.rect(x2, rowTopY, col2, rowH, "F");
            doc.rect(x3, rowTopY, col3, rowH, "F");

            // Border
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);

            doc.rect(x2, rowTopY, col2, rowH);
            doc.rect(x3, rowTopY, col3, rowH);

            doc.setFont("helvetica", "bold");

        } else {

            doc.setFont("helvetica", "normal");
        }

        // ================= TEXT =================

        // Label
        doc.text(label, x2 + 2, textY, {
            baseline: "middle"
        });



        // Non-Tax
        doc.text(
            safeAmount(freight).toFixed(2),
            x3 + col3 - 2,
            textY,
            { align: "right", baseline: "middle" }
        );

    });

    return y + tableH;
}
// ================= AMOUNT IN WORDS =================
function drawAmountInWords(doc, PAGE, FONT, grandTotal, y) {

    const paddingX = 3;
    const paddingY = 2;

    const text = "Amount in Words: " + numberToWordsIndian(grandTotal);

    // 🔥 Split text based on width
    const maxWidth = PAGE.w - (paddingX * 2);
    const lines = doc.splitTextToSize(text, maxWidth);

    // 🔥 Calculate dynamic height
    const lineHeight = 3;
    const boxH = (lines.length * lineHeight) + (paddingY * 2);

    // Draw box
    doc.rect(PAGE.x, y, PAGE.w, boxH);

    // Draw text (top padding)
    doc.text(lines, PAGE.x + paddingX, y + paddingY + 2);

    return y + boxH;
}
// ================= ADD FOOTER TO ALL PAGES =================
function addFooterToAllPages(doc, PAGE) {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.text("Powered by AllEdge to BizNavigation", PAGE.x, PAGE.h - 8);
        doc.text(`Page ${i} of ${totalPages}`, PAGE.x + PAGE.w - 20, PAGE.h - 8);
    }
}
// ================= GET DOMESTIC SHIPMENT DATA =================
async function getDomesticShipmentData(invoiceNo) {
    try {
        const { data, error } = await supabaseClient
            .from("FullLoadBookingDetails")
            .select(`
                id,
                lr_number,
                pickup_date,
                routedetails,
                origin_city,
                destination_city,
                vehicle_type,
                vehicle_number,
                container_number,
                FullLoadBookingCharges (
                    charges_type,
                    amount,
                    gst_type,
                    sgst_amount,
                    cgst_amount,
                    igst_amount,
                    total_gst_amount,
                    grand_total_billing,
                    account_type
                )
            `)
            .eq("invoice_number", invoiceNo);

        if (error) {
            console.error("Error fetching shipment data:", error);
            return [];
        }

        return data || [];

    } catch (err) {
        console.error("Unexpected error:", err);
        return [];
    }
}