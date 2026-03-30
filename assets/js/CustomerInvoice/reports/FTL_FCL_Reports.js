let totalPaymentReceived = 0;
async function generate_FullTruckReports_InvoicePDF(header, lines = []) {
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
        logo: data?.logo_path,
        uANo: data?.Udyog_aadhaar_no || "-",
        panNo: data?.pan_number || "-"

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
        const maxH = headerH - 1;
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
    doc.text(`Ph: ${company.phone} | ${company.email} | GST: ${company.gst} | PAN: ${company?.panNo} | UA No: ${company?.uANo} `,
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
    const lineHeight = 3.5;
    const startX = PAGE.x + 3;

    // 🔹 Safe helper
    const safe = (v, d = "-") => (v ? v : d);

    // ================= LEFT SIDE =================
    const partyNameLines = doc.splitTextToSize(`M / s ${safe(party.name, "")
        } `, left70 - 6);
    const partyAddrLines = doc.splitTextToSize(safe(party.address, ""), left70 - 6);

    // ================= RIGHT SIDE =================
    const rightData = [
        { label: "Invoice No :", value: safe(header?.InvoiceNo) },
        { label: "Invoice Date :", value: formatDate(header?.InvoiceDate) || "-" },
        { label: "SAC Code :", value: safe(header?.SACCode) }
    ];

    // 🔹 Calculate label width once
    doc.setFont("helvetica", "bold").setFontSize(FONT.title);
    const labelWidth = Math.max(...rightData.map(r => doc.getTextWidth(r.label)));

    // ================= HEIGHT =================
    const leftLines = partyNameLines.length + partyAddrLines.length + 1; // +1 for GST
    const rightLines = rightData.length;

    const row1Lines = Math.max(leftLines, rightLines);
    const row1H = row1Lines * lineHeight + 4;

    const infoH = row1H; // 🔥 removed unused bottom row

    // ================= BOX =================
    doc.rect(PAGE.x, y, PAGE.w, infoH);
    doc.line(PAGE.x + left70, y, PAGE.x + left70, y + row1H);

    // ================= DRAW LEFT =================
    let currentY = y + 4;

    // Party Name
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text(partyNameLines, startX, currentY);
    currentY += partyNameLines.length * lineHeight;

    // Address
    doc.setFont("helvetica", "normal").setFontSize(FONT.small);
    doc.text(partyAddrLines, startX, currentY);
    currentY += partyAddrLines.length * lineHeight;

    // GST
    drawLabelValue(doc, "GST No :", safe(party.gst), startX, currentY);

    // ================= DRAW RIGHT =================
    let rightY = y + 4;
    const rightX = PAGE.x + left70 + 3;

    rightData.forEach(item => {
        drawLabelValueAligned(doc, item.label, item.value, rightX, rightY, labelWidth);
        rightY += lineHeight;
    });

    return y + infoH;
}

// 🔥 Reusable: normal label + value
function drawLabelValue(doc, label, value, x, y) {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);

    doc.setFont("helvetica", "normal");
    doc.text(value, x + doc.getTextWidth(label) + 2, y);
}

// 🔥 Reusable: aligned labels (right column)
function drawLabelValueAligned(doc, label, value, x, y, labelWidth) {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);

    doc.setFont("helvetica", "normal");
    doc.text(value, x + labelWidth + 2, y);

}
// Utility function to fetch shipment details
async function drawShipmentTable(doc, PAGE, FONT, rows = [], y) {

    let totalFreight = 0, totalOther = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0, totalGST = 0;

    const rowHeight = 5;
    const headerHeight = 6;

    // 🔥 Reserve space for footer sections

    const LAYOUT = {
        footerReserve: 83, // Terms & Tax (60) + Amount in Words (23)
        rowHeight: 5
    };

    const emptyRow = ["", "", "", "", "", "", "", ""];

    if (!rows.length) {
        console.warn("No shipment data found");
    }

    // ================= BUILD BODY =================
    let body = rows.map((row, i) => {

        let freightAmount = 0, otherAmount = 0, perQtyAmt = 0, Qty = 0;

        (row.FullLoadBookingCharges || []).forEach(c => {
            const amount = safeNumber(c.TotalAmount);
            const perQtyAmount = safeNumber(c.PerQtyAmt);

            totalCGST += safeNumber(c.CGSTAmt);
            totalSGST += safeNumber(c.SGSTAmt);
            totalIGST += safeNumber(c.IGSTAmt);

            Qty = c.Quantity ?? Qty;

            if (["Freight Amount", "Transportation Charges"].includes(c.ChargesType)) {
                freightAmount += amount;
                perQtyAmt += perQtyAmount;
            } else {
                otherAmount += amount;
            }
        });

        totalFreight += freightAmount;
        totalOther += otherAmount;

        const safe = (val, fallback = "-") =>
            val && val.toString().trim() ? val : fallback;

        const routeDetails =
            safe(row.routedetails, null) ||
            `${safe(row.origin_city, "")} → ${safe(row.destination_city, "")} `;

        const deliveryDate = row.completion_date
            ? formatDate(row.completion_date)
            : null;

        const descriptionArr = [
            `Movement Type: ${safe(row.movement_type)} / ${safe(row.mode_type)}`,
            `Ref           : ${safe(row.reference_number)}`,
            `Vehicle       : ${safe(row.vehicle_type, "")} / ${safe(row.vehicle_number, "")}`,
            `Container     : ${safe(row.container_number)}`,
            `Route         : ${routeDetails}`,
            ...(deliveryDate ? [`Delivery      : ${deliveryDate}`] : [])
        ];

        const description = descriptionArr.join("\n");

        return [
            i + 1,
            row.lr_number || "",
            formatDate(row.pickup_date) || "",
            description,
            Qty ?? "0",
            safeNumber(perQtyAmt).toFixed(2),
            safeNumber(otherAmount).toFixed(2),
            (freightAmount + otherAmount).toFixed(2)
        ];
    });

    // ================= TOTALS =================
    totalGST = round2(totalCGST + totalSGST + totalIGST);
    const grandTotal = round2(totalFreight + totalOther + totalGST);

    // ================= PAGE CALCULATION =================
    const usablePageHeight = PAGE.h - y - LAYOUT.footerReserve;
    const maxRowsPerPage = Math.floor((usablePageHeight - headerHeight) / rowHeight);

    // 🔥 ONLY add empty rows if SINGLE PAGE
    const isSinglePage = body.length <= maxRowsPerPage;

    if (isSinglePage) {
        const rowsToAdd = maxRowsPerPage - body.length;

        for (let i = 0; i < rowsToAdd; i++) {
            body.push(emptyRow);
        }
    }

    // ================= TABLE =================
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
            fontSize: FONT.small,
            cellPadding: 1.5,
            overflow: "linebreak",
            textColor: 0,
            minCellHeight: rowHeight,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
        },

        headStyles: {
            fillColor: [60, 60, 60],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            cellPadding: 1.5,
            lineWidth: 0.2,
            lineColor: [0, 0, 0]
        },

        columnStyles: {
            0: { cellWidth: 8, halign: "center", valign: "middle" },
            1: { cellWidth: 20, valign: "middle" },
            2: { cellWidth: 20, valign: "middle" },
            3: { cellWidth: 67, valign: "middle" },
            4: { cellWidth: 15, halign: "right", valign: "middle" },
            5: { cellWidth: 20, halign: "right", valign: "middle" },
            6: { cellWidth: 20, halign: "right", valign: "middle" },
            7: { cellWidth: 20, halign: "right", valign: "middle" },
        },

        didDrawCell: (data) => {
            if (data.section === "body") {
                data.cell.styles.lineColor = [0, 0, 0];
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
        grandTotal,
    };
}
// ================= TERMS AND TAX SECTION =================
async function drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived) {

    const rowH = 4;
    const rows = 8;
    const tableH = rowH * rows;

    const col3 = 20;
    const col2 = 40;
    const col1 = PAGE.w - (col2 + col3);

    const x1 = PAGE.x;
    const x2 = x1 + col1;
    const x3 = x2 + col2;

    y = checkPageBreak(doc, y, tableH, PAGE);

    // ================= BORDER =================
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(PAGE.x, y, PAGE.w, tableH);

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);

    [x2, x3].forEach(x => doc.line(x, y, x, y + tableH));

    for (let i = 1; i < rows; i++) {
        doc.line(PAGE.x, y + i * rowH, PAGE.x + PAGE.w, y + i * rowH);
    }

    // ================= HEADER =================
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Terms & Conditions", x1 + col1 / 2, y + rowH / 2, {
        align: "center",
        baseline: "middle"
    });

    // ================= TERMS =================
    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const terms = [
        `1. Please draw cheque in favour of ${company.name} `,
        "2. Payments Should be made within 7 Days from the Date of Billing",
        "3. All Complaints must be forwarded within 8 days of receipt",
        "4. Only the courts of Bangalore will have exclusive jurisdiction over this contract.",
    ];

    terms.forEach((t, i) => {
        const rowTopY = y + rowH * (i + 1);
        const textY = rowTopY + rowH / 2;

        const text = doc.splitTextToSize(t, col1 - 4);

        doc.text(text, x1 + 2, textY, {
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
        [
            { label: "Account Name:", value: company.name },
            { label: " | Account No:", value: bank?.AccountNo || "-" }
        ],
        [
            { label: "Bank:", value: bank?.BankName || "-" },
            { label: " | Branch:", value: bank?.BranchName || "-" },
            { label: " | IFSC:", value: bank?.IFSCCode || "-" },
            { label: " | MICR:", value: bank?.MICRCode || "-" }
        ]
    ];

    bankDetails.forEach((row, i) => {
        const rowTopY = y + rowH * (6 + i);
        const textY = rowTopY + rowH / 2;

        let xOffset = x1 + 2;

        row.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, xOffset, textY, { baseline: "middle" });

            xOffset += doc.getTextWidth(item.label) + 2;

            doc.setFont("helvetica", "normal");
            doc.text(item.value, xOffset, textY, { baseline: "middle" });

            xOffset += doc.getTextWidth(item.value) + 2;
        });
    });

    const advance = safeNumber(totalPaymentReceived);
    // ================= TAX TABLE =================
    const data = [
        ["Total Amount :", totals.totalFreight],
        ["CGST", totals.totalCGST],
        ["SGST", totals.totalSGST],
        ["IGST", totals.totalIGST],
        ["Total GST", totals.totalGST],
        ["GRAND TOTAL", totals.grandTotal],
        ["Advance Amount :", advance.toFixed(2) || 0],
        ["Balance Amount :", round2(totals.grandTotal - advance).toFixed(2) || 0]
    ];

    doc.setFontSize(FONT.small);

    data.forEach((row, i) => {

        const rowTopY = y + rowH * i;
        const textY = rowTopY + rowH / 2;

        const label = row[0];
        const value = row[1];

        // 🔥 Color logic
        let fillColor = null;

        if (label === "Total GST" || label === "GRAND TOTAL") {
            fillColor = [220, 230, 241]; // light blue
        } else if (label === "Advance Amount :" || label === "Balance Amount :") {
            fillColor = [198, 224, 180]; // light green (professional)
        }

        // ================= HIGHLIGHT =================
        if (fillColor) {

            doc.setFillColor(...fillColor);
            doc.rect(x2, rowTopY, col2, rowH, "FD");
            doc.rect(x3, rowTopY, col3, rowH, "FD");

            doc.setDrawColor(0, 0, 0);
            doc.rect(x2, rowTopY, col2, rowH);
            doc.rect(x3, rowTopY, col3, rowH);

            doc.setFont("helvetica", "bold");

        } else {
            doc.setFont("helvetica", "normal");
        }

        // Label
        doc.text(label, x2 + 2, textY, {
            baseline: "middle"
        });

        // Value (right aligned)
        doc.text(
            safeAmount(value).toFixed(2),
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

        // 🔥 Set bold + color
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7); // optional
        doc.setTextColor(0, 102, 204); // 🔵 Blue color (RGB)

        // Left text
        doc.text("AllEdge Technology for BizNavigation", PAGE.x, PAGE.h - 8);

        // Right text (page number)
        doc.text(`Page ${i} of ${totalPages}`, PAGE.x + PAGE.w - 10, PAGE.h - 8, {
            align: "right"
        });

        // 🔁 Reset to default (important for rest of PDF)
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
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
    movement_type,
    reference_number,
    mode_type,
    completion_date,
    FullLoadBookingCharges!FullLoadBookingCharges_ID_FT_fkey(
        ChargesType,
        Quantity,
        PerQtyAmt,
        TotalAmount,
        TaxRate,
        SGSTAmt,
        CGSTAmt,
        IGSTAmt,
        TotalGSTAmt,
        GrandTotalAmt,
        AccountType
    )
        `)
            .eq("invoice_number", invoiceNo)
            .eq("FullLoadBookingCharges.AccountType", "Sale"); // 🔥 FIX

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