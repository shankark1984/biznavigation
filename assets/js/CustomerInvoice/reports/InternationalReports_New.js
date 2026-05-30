// ==========================================
// GENERATE INTERNATIONAL INVOICE PDF
// ==========================================
async function generate_International_InvoicePDF_R1(header, lines = []) {

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF("p", "mm", "a4");

    const PAGE = { x: 15, w: 190, h: 297 };

    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6, stiny: 5 };

    let y = 10;

    console.log(header);

    // ==========================================
    // FETCH DATA
    // ==========================================
    const [company, party, tandcData, shipmentData, bank, totalsPayment
    ] = await Promise.all([
        fetchCompanyDetails(header),
        fetchPartyDetails(header),
        getTermsAndConditions(header?.company_id),
        getInternationalShipmentData(header?.InvoiceNo),
        getInvoiceBankDetails(header?.InvoiceNo),
        advancedPaymentDetails(
            header?.InvoiceNo,
            header?.InvoiceDate
        )
    ]);

    // ==========================================
    // TOTAL PAYMENT RECEIVED
    // ==========================================
    const totalPaymentReceived = round2(
        safeNumber(totalsPayment?.totalPayment) +
        safeNumber(totalsPayment?.totalOtherDeduction) +
        safeNumber(totalsPayment?.totalTDS)

    );

    // ==========================================
    // HEADER
    // ==========================================
    y = await drawHeader(doc, PAGE, FONT, company, y);

    // ==========================================
    // TITLE
    // ==========================================
    y = drawTitle(doc, PAGE, FONT, y);

    // ==========================================
    // PARTY SECTION
    // ==========================================
    y = drawPartySection(doc, PAGE, FONT, header, party, company, y);

    // ==========================================
    // SHIPMENT TABLE
    // ==========================================
    const shipmentResult = await drawShipmentTable_international(doc, PAGE, FONT, shipmentData, y);

    y = shipmentResult.y;

    // ==========================================
    // TERMS + TAX SECTION
    // ==========================================
    y = await drawTermsAndTaxSection_int(doc, PAGE, FONT, company, header, shipmentResult, y, bank, totalPaymentReceived,
        tandcData
    );

    // ==========================================
    // AMOUNT IN WORDS
    // ==========================================
    y = drawAmountInWords(doc, PAGE, FONT, shipmentResult.grandTotal, y);

    // ==========================================
    // FOOTER
    // ==========================================
    addFooterToAllPages(doc, PAGE);

    // ==========================================
    // SAVE PDF
    // ==========================================
    doc.save(
        `Invoice_${header?.InvoiceNo || "NA"}.pdf`
    );
}


// ==========================================
// TERMS & TAX SECTION
// ==========================================
async function drawTermsAndTaxSection_int(
    doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived, tandcData
) {

    // ==========================================
    // CONFIG
    // ==========================================
    const rowH = 5;

    const lineHeight = 1.75;

    const paragraphGap = 1.5;

    // ==========================================
    // COLUMN WIDTHS Total GST (20) + Grand Total (20) = 40
    // ==========================================
    const col4 = 20; // Padding on the right
    const col3 = 20; // Match Total column

    const col2 = 25; // Match Description column

    const col1 = PAGE.w - (col2 + col3 + col4); // Remaining space

    // ==========================================
    // X POSITIONS
    // ==========================================
    const x1 = PAGE.x;

    const x2 = x1 + col1;

    const x3 = x2 + col2;

    const x4 = x3 + col3;

    // ==========================================
    // TERMS HEIGHT CALCULATION
    // ==========================================
    let termsHeight = rowH + 4;

    tandcData.forEach((item, i) => {

        const text =
            `${i + 1}. ${item.Description || ""}`;

        const splitText = doc.splitTextToSize(text, col1 - 10);

        const blockHeight = splitText.length * lineHeight;

        termsHeight += blockHeight;

        if (i !== tandcData.length - 1) {
            termsHeight += paragraphGap;
        }

    });

    // ==========================================
    // BANK HEIGHT
    // ==========================================
    const bankContentHeight = 6; // Static height for 2 rows of bank details (adjust as needed)

    const bankHeight = rowH + bankContentHeight;

    // ==========================================
    // LEFT HEIGHT
    // ==========================================
    const leftHeight = termsHeight + bankHeight + 3;

    // ==========================================
    // TAX TABLE HEIGHT
    // ==========================================
    const taxRows = 8; // Total Amount, CGST, SGST, IGST, Total GST, Grand Total, Advance Amount, Balance Amount

    const rightHeight = taxRows * rowH;

    // ==========================================
    // FINAL HEIGHT
    // ==========================================
    const tableH = Math.max(leftHeight, rightHeight);

    // ==========================================
    // PAGE BREAK
    // ==========================================
    y = checkPageBreak(doc, y, tableH, PAGE);

    // ==========================================
    // BORDER SETTINGS
    // ==========================================
    doc.setDrawColor(0, 0, 0);

    // OUTER BORDER
    doc.setLineWidth(0.1);

    doc.rect(PAGE.x, y, PAGE.w, tableH);

    // INNER LINES
    doc.setLineWidth(0.1);

    // ==========================================
    // VERTICAL LINES
    // ==========================================
    doc.line(x2, y, x2, y + tableH);

    doc.line(x3, y, x3, y + tableH);

    // ==========================================
    // RIGHT ROW LINES
    // ==========================================
    for (let i = 1; i < taxRows; i++) {

        doc.line(x2, y + (i * rowH), PAGE.x + PAGE.w, y + (i * rowH));

    }

    // ==========================================
    // TERMS HEADER
    // ==========================================
    doc.setFont("helvetica", "bold");

    doc.setFontSize(FONT.body);

    doc.line(PAGE.x, y + rowH, x2, y + rowH);

    doc.text(
        "Terms & Conditions",
        x1 + (col1 / 2),
        y + (rowH / 2) + 0.3,
        {
            align: "center",
            baseline: "middle"
        }
    );

    // ==========================================
    // TERMS CONTENT
    // ==========================================
    doc.setFont("helvetica", "normal");

    doc.setFontSize(FONT.tiny);

    let currentY = y + rowH + 2;

    tandcData.forEach((item, i) => {

        const text =
            `${i + 1}. ${item.Description || ""}`;

        const splitText = doc.splitTextToSize(text, col1 - 10);

        doc.text(splitText, x1 + 5, currentY);

        const blockHeight = splitText.length * lineHeight;

        currentY += blockHeight;

        if (i !== tandcData.length - 1) {
            currentY += paragraphGap;
        }

    });

    // ==========================================
    // BANK SECTION
    // ==========================================
    const bankStartY = currentY + 3;

    // TOP LINE
    doc.line(PAGE.x, bankStartY, x2, bankStartY);

    // HEADER BORDER
    doc.rect(PAGE.x, bankStartY, col1, rowH);

    // HEADER TEXT
    doc.setFont("helvetica", "bold");

    doc.setFontSize(FONT.body);

    doc.text(
        "Bank Details",
        x1 + (col1 / 2),
        bankStartY + (rowH / 2) + 0.3,
        {
            align: "center",
            baseline: "middle"
        }
    );

    // ==========================================
    // BANK DETAILS
    // ==========================================
    doc.setFontSize(FONT.small);

    const bankDetails = [

        [
            ["Account Name", company?.name || "-"],
            ["Account No", bank?.AccountNo || "-"]
        ],

        [
            ["Bank", bank?.BankName || "-"],
            ["Branch", bank?.BranchName || "-"],
            ["IFSC", bank?.IFSCCode || "-"]
        ]

    ];

    bankDetails.forEach((row, i) => {

        const rowY = bankStartY + 9 + (i * 4.5);

        let xOffset = x1 + 2;

        row.forEach((item, idx) => {

            // LABEL
            doc.setFont("helvetica", "bold");

            const label = `${item[0]} :`;

            doc.text(label, xOffset, rowY);

            xOffset += doc.getTextWidth(label) + 2;

            // VALUE
            doc.setFont("helvetica", "normal");

            const value =
                String(item[1]);

            doc.text(value, xOffset, rowY);

            xOffset +=
                doc.getTextWidth(value) + 4;
        });

    });

    // ==========================================
    // TAX DATA
    // ==========================================
    const advance = safeNumber(totalPaymentReceived);

    const data = [

        ["Total Amount :", 0, totals.totalFreight],

        ["CGST", 0, totals.totalCGST],

        ["SGST", 0, totals.totalSGST],

        ["IGST", 0, totals.totalIGST],

        ["Total GST", 0, totals.totalGST],

        ["GRAND TOTAL", 0, totals.grandTotal],

        ["Advance Amount :", 0, advance],

        [
            "Balance Amount :",
            round2(
                totals.grandTotal - advance
            )
        ]

    ];

    // ==========================================
    // TAX TABLE
    // ==========================================
    doc.setFontSize(FONT.small);

    data.forEach((row, i) => {

        const rowTopY =
            y + (i * rowH);

        const textY =
            rowTopY + (rowH / 2);

        const label = row[0];

        const value =
            safeAmount(row[1]);

        let fillColor = null;

        // ======================================
        // COLORS
        // ======================================
        if (
            label === "Total GST" ||
            label === "GRAND TOTAL"
        ) {

            fillColor = [220, 230, 241];

        }
        else if (
            label === "Advance Amount :" ||
            label === "Balance Amount :"
        ) {

            fillColor = [198, 224, 180];

        }

        // ======================================
        // ROW BG
        // ======================================
        if (fillColor) {

            doc.setFillColor(...fillColor);

            doc.rect(
                x2,
                rowTopY,
                col2,
                rowH,
                "FD"
            );

            doc.rect(
                x3,
                rowTopY,
                col3,
                rowH,
                "FD"
            );

            doc.setFont(
                "helvetica",
                "bold"
            );

        } else {

            doc.setFont(
                "helvetica",
                "normal"
            );

        }

        // LABEL
        doc.text(
            label,
            x2 + 2,
            textY,
            {
                baseline: "middle"
            }
        );

        // VALUE
        doc.text(
            value.toFixed(2),
            x3 + col3 - 2,
            textY,
            {
                align: "right",
                baseline: "middle"
            }
        );

    });

    // ==========================================
    // RETURN
    // ==========================================
    return y + tableH;

}
// ==========================================
// FETCH SHIPMENT DATA
// ==========================================
async function getInternationalShipmentData(invoiceNo) {

    try {

        const {
            data: lines,
            error
        } = await supabaseClient
            .from("InternationalBookingView")
            .select("*")
            .eq("InvoiceNumber", invoiceNo)
            .order(
                "BookedDate",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "Error fetching shipment data:",
                error
            );

            return [];

        }

        return lines || [];

    }
    catch (err) {

        console.error(
            "Unexpected error:",
            err
        );

        return [];

    }

}

// Utility function to fetch shipment details
async function drawShipmentTable_international(doc, PAGE, FONT, rows = [], y) {

    let totalFreight = 0, totalOther = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0, totalGST = 0;

    const rowHeight = 5;
    const headerHeight = 6;

    // 🔥 Reserve space for footer sections

    const LAYOUT = {
        footerReserve: 100, // Terms & Tax (60) + Amount in Words (23)
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