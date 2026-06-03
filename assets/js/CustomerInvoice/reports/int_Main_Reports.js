// ==========================================
// GENERATE INTERNATIONAL INVOICE PDF
// ==========================================
async function generate_International_InvoicePDF_Main(header, lines = []) {

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF("p", "mm", "a4");

    const PAGE = { x: 15, w: 190, h: 297 };

    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6, stiny: 5 };

    let y = 9;

    // ==========================================
    // FETCH DATA
    // ==========================================
    const [company, party, tandcData, shipmentData, bank, totalsPayment
    ] = await Promise.all([
        fetchCompanyDetails(header),
        fetchPartyDetails(header),
        getTermsAndConditions(header?.company_id),
        getShipmentData_int_Main(header?.InvoiceNo),
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
    const shipmentResult = await drawShipmentTable_int_Main(doc, PAGE, FONT, shipmentData, y);

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
    // BANK DETAILS SECTION
    // ==========================================
    y = drawBankDetailsSection(doc, PAGE, FONT, company, bank, y);
    // ==========================================
    // FOOTER
    // ==========================================
    drawaddFooterToAllPages(doc, PAGE, y);

    // ==========================================
    // SAVE PDF
    // ==========================================
    drawInvoiceBorderAllPages(doc, PAGE);
    doc.save(
        `Invoice_${header?.InvoiceNo || "NA"}.pdf`
    );
}

// ==========================================
// TERMS & TAX SECTION
// ==========================================
async function drawTermsAndTaxSection_int(doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived, tandcData
) {

    // ==========================================
    // CONFIG
    // ==========================================
    const CONFIG = {
        headerH: 5,
        lineHeight: 1,
        paragraphGap: 0.3,

        colDescription: 23,
        colNonTax: 23,
        colTax: 23,

        bankTopGap: 1,
        bankRowHeight: 4,

        bottomMargin: 35,
    };

    const colTerms =
        PAGE.w -
        (
            CONFIG.colDescription +
            CONFIG.colNonTax +
            CONFIG.colTax
        );

    const COL = {
        terms: colTerms,
        desc: CONFIG.colDescription,
        nonTax: CONFIG.colNonTax,
        tax: CONFIG.colTax
    };

    const X = {
        terms: PAGE.x,
        desc: PAGE.x + COL.terms,
        nonTax: PAGE.x + COL.terms + COL.desc,
        tax: PAGE.x + COL.terms + COL.desc + COL.nonTax,
        end: PAGE.x + PAGE.w
    };

    // ==========================================
    // HEIGHT CALCULATIONS
    // ==========================================
    const termsHeight = calculateTermsHeight(doc, tandcData, COL.terms, CONFIG);

    const bankHeight = 20;

    const leftHeight = termsHeight + CONFIG.bankTopGap + bankHeight + 2;

    const taxRows = 8;

    const rightHeight = (taxRows + 1) * CONFIG.headerH;

    const tableH = Math.max(leftHeight, rightHeight);

    // ==========================================
    // POSITION AT BOTTOM OF LAST PAGE
    // ==========================================
    const pageHeight =
        doc.internal.pageSize.getHeight();

    const bottomY = pageHeight - CONFIG.bottomMargin - tableH;

    // If enough space remains on current page,
    // move section to bottom.
    if (bottomY > y) {

        y = bottomY;

    } else {

        // Move to new page
        doc.addPage();

        const newPageHeight = doc.internal.pageSize.getHeight();

        y = newPageHeight - CONFIG.bottomMargin - tableH;
    }

    // ==========================================
    // OUTER BORDER
    // ==========================================
    drawOuterTable(doc, PAGE, X, y, tableH);
    // ==========================================
    // HEADER ROW
    // ==========================================
    drawHeaderRow(doc, FONT, X, COL, y, CONFIG.headerH);

    // ==========================================
    // TERMS CONTENT
    // ==========================================
    drawTermsContent(doc, FONT, tandcData, X, COL, y, CONFIG);

    // ==========================================
    // TAX DETAILS
    // ==========================================
    drawTaxSection(doc, FONT, totals, totalPaymentReceived, X, COL, y, CONFIG);

    return y + tableH;
}

// ==========================================
// HEIGHT OF TERMS
// ==========================================
function calculateTermsHeight(
    doc,
    tandcData,
    termsWidth,
    CONFIG
) {

    let height =
        CONFIG.headerH + 4;

    tandcData.forEach((item, i) => {

        const txt =
            `${i + 1}. ${item.Description || ""}`;

        const split =
            doc.splitTextToSize(
                txt,
                termsWidth - 10
            );

        height +=
            split.length *
            CONFIG.lineHeight;

        if (
            i <
            tandcData.length - 1
        ) {
            height +=
                CONFIG.paragraphGap;
        }

    });

    return height;
}

// ==========================================
// TABLE BORDERS
// ==========================================
function drawOuterTable(doc, PAGE, X, y, tableH) {

    doc.setLineWidth(0.1);

    doc.rect(PAGE.x, y, PAGE.w, tableH);

    doc.line(X.desc, y, X.desc, y + tableH);

    doc.line(X.nonTax, y, X.nonTax, y + tableH);

    doc.line(X.tax, y, X.tax, y + tableH);
}

// ==========================================
// HEADER ROW
// ==========================================
function drawHeaderRow(doc, FONT, X, COL, y, rowH) {

    doc.line(X.terms, y + rowH, X.end, y + rowH);

    PDF_FONT.set(doc, "bold");

    doc.setFontSize(FONT.body);

    drawCenteredText(doc, "Terms & Conditions", X.terms, COL.terms, y, rowH);

    drawCenteredText(doc, "", X.desc, COL.desc, y, rowH); // Empty header for Description column

    drawCenteredText(doc, "Non-Tax Amount", X.nonTax, COL.nonTax, y, rowH);

    drawCenteredText(doc, "Tax Amount", X.tax, COL.tax, y, rowH);
}

// ==========================================
// TERMS CONTENT
// ==========================================
function drawTermsContent(
    doc,
    FONT,
    tandcData,
    X,
    COL,
    y,
    CONFIG
) {
    PDF_FONT.set(doc, "normal");

    doc.setFontSize(6);

    let currentY = y + CONFIG.headerH + 4;

    const leftMargin = X.terms + 4;
    const textWidth = COL.terms - 5;
    const indent = 2; // hanging indent

    tandcData.forEach((item, index) => {

        const prefix = `${index + 1}. `;

        const lines = doc.splitTextToSize(
            item.Description || "",
            textWidth - indent
        );

        // First line with numbering
        doc.text(
            prefix + (lines[0] || ""),
            leftMargin,
            currentY
        );

        currentY += 3.8;

        // Remaining lines aligned
        for (let i = 1; i < lines.length; i++) {
            doc.text(
                lines[i],
                leftMargin + indent,
                currentY
            );
            currentY += 3.8;
        }

        // Gap between terms
        currentY += 1.5;
    });

    return currentY;
}

// ==========================================
// TAX SECTION
// ==========================================
function drawTaxSection(
    doc,
    FONT,
    totals,
    totalPaymentReceived,
    X,
    COL,
    y,
    CONFIG
) {

    // =========================
    // VALUES
    // =========================
    const nonTaxable =
        safeNumber(totals?.nonTaxableAmount);

    const taxable =
        safeNumber(totals?.taxableAmount);

    const cgst =
        safeNumber(totals?.totalCGST);

    const sgst =
        safeNumber(totals?.totalSGST);

    const igst =
        safeNumber(totals?.totalIGST);

    const advance =
        safeNumber(totalPaymentReceived);

    // =========================
    // TOTALS
    // =========================
    const totalGST =
        cgst +
        sgst +
        igst;

    const grandTotal = Math.ceil(
        nonTaxable +
        taxable +
        totalGST
    );

    const balanceAmount = Math.ceil(
        grandTotal - advance
    );

    // =========================
    // TABLE ROWS
    // =========================
    const rows = [
        [
            "Total Charges",
            nonTaxable,
            taxable
        ],
        [
            "CGST 9%",
            0,
            cgst
        ],
        [
            "SGST 9%",
            0,
            sgst
        ],
        [
            "IGST 18%",
            0,
            igst
        ],
        [
            "Total GST",
            0,
            totalGST
        ],
        [
            "Grand Total",
            0,
            grandTotal
        ],
        [
            "Advance Amount",
            0,
            advance
        ],
        [
            "Balance Amount",
            0,
            balanceAmount
        ]
    ];

    // =========================
    // DRAW ROWS
    // =========================
    doc.setFontSize(FONT.small);

    rows.forEach((row, i) => {

        const rowY =
            y +
            CONFIG.headerH +
            (i * CONFIG.headerH);

        // Row separator
        doc.line(
            X.desc,
            rowY,
            X.end,
            rowY
        );

        // Bold important rows
        const isBold =
            row[0] === "Total GST" ||
            row[0] === "Grand Total" ||
            row[0] === "Balance Amount";

        doc.setFont(
            "times",
            isBold ? "bold" : "normal"
        );

        // Description
        doc.text(
            row[0],
            X.desc + 2,
            rowY + 3.2
        );

        // Non Tax
        doc.text(
            safeAmount(row[1]).toFixed(2),
            X.nonTax +
            COL.nonTax -
            2,
            rowY + 3.2,
            {
                align: "right"
            }
        );

        // Tax Amount
        doc.text(
            safeAmount(row[2]).toFixed(2),
            X.tax +
            COL.tax -
            2,
            rowY + 3.2,
            {
                align: "right"
            }
        );
    });

    // Bottom Border
    const endY =
        y +
        CONFIG.headerH +
        rows.length *
        CONFIG.headerH;

    doc.line(
        X.desc,
        endY,
        X.end,
        endY
    );

    return {
        grandTotal,
        totalGST,
        balanceAmount,
        endY
    };
}

// ==========================================
// COMMON CENTER TEXT
// ==========================================
function drawCenteredText(
    doc,
    text,
    x,
    width,
    y,
    height
) {

    doc.text(
        text,
        x + width / 2,
        y + height / 2,
        {
            align: "center",
            baseline: "middle"
        }
    );
}
// ==========================================
// FETCH SHIPMENT DATA
// ==========================================
async function getShipmentData_int_Main(invoiceNo) {

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

            console.error("Error fetching shipment data:", error);

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
async function drawShipmentTable_int_Main(doc, PAGE, FONT, rows = [], y) {

    let freightAmount = 0, fuelSurcharge = 0, otherAmount = 0;
    let totalFreight = 0, totalOther = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0, totalGST = 0;
    let nonTaxableAmount = 0, taxableAmount = 0;

    const rowHeight = 10;
    const headerHeight = 6;

    // 🔥 Reserve space for footer sections

    const LAYOUT = {
        footerReserve: 67, // Terms & Tax (60) + Amount in Words (23)
        rowHeight: 10
    };

    const emptyRow = Array(12).fill("");

    if (!rows.length) {
        console.warn("No shipment data found");
    }

    // ================= BUILD BODY =================
    let body = rows.map((row, i) => {

        freightAmount += safeNumber(row.FreightAmount) || 0;
        fuelSurcharge += safeNumber(row.FuelSurcharge) || 0;
        otherAmount += safeNumber(row.OtherAmount) || 0;
        totalCGST += safeNumber(row.TotalCGSTAmt);
        totalSGST += safeNumber(row.TotalSGSTAmt);
        totalIGST += safeNumber(row.TotalIGSTAmt);
        totalGST += safeNumber(row.TotalGSTAmt);
        nonTaxableAmount += safeNumber(row.NonTaxableAmount) || 0;
        taxableAmount += safeNumber(row.TaxableAmount) || 0;

        const safe = (val, fallback = "-") =>
            val !== null &&
                val !== undefined &&
                String(val).trim() !== ""
                ? val
                : fallback;

        const mode = [
            row.MovementType,
            row.ModeType,

        ]
            .filter(Boolean)
            .join("\n");

        const sector = [
            `Origin: ${safe(row.Origin)}`,
            `Dest.: ${safe(row.Destination)}`
        ]
            .filter(Boolean)
            .join(" \n ");

        return [
            i + 1,
            formatDate(row.BookedDate) || "",
            row.DocketNo || "",
            mode || "",
            safe(row.ClearanceMode),
            safe(row.Origin) || "",
            safe(row.Destination) || "",
            row.NoofUnit ?? "0",
            row.ChargableWeight + " " + row.UOMType,
            row.FreightAmount ? safeNumber(row.FreightAmount).toFixed(2) : "0.00",
            row.FuelSurcharge ? safeNumber(row.FuelSurcharge).toFixed(2) : "0.00",
            row.OtherCharges ? safeNumber(row.OtherCharges).toFixed(2) : "0.00",
            row.TotalAmount ? safeNumber(row.TotalAmount).toFixed(2) : "0.00"
        ];
    });

    // ================= TOTALS =================
    const grandTotal = Math.round(
        freightAmount + fuelSurcharge + otherAmount + totalGST
    );

    // ================= TABLE =================
    doc.autoTable({
        startY: y,
        margin: { left: PAGE.x, right: PAGE.x },
        tableWidth: PAGE.w,
        head: [[
            "Sl No.", "Date", "AWB No", "Transit", "Mode", "Origin", "Dest.", "Qty",
            "Weight", "Frt. Amt.", "FSC. Chrgs", "Other Charges", "TotalAmt."
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
            lineColor: [0, 0, 0],
            valign: "middle"
        },
        didParseCell: function (data) {
            if (data.section === "body") {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [0, 0, 0];
            }
        },
        columnStyles: {
            0: { cellWidth: 7, halign: "center", valign: "middle" }, // Sl
            1: { cellWidth: 16, valign: "middle" }, // Date
            2: { cellWidth: 19, valign: "middle" }, // AWB No
            3: { cellWidth: 19, valign: "middle" }, // Transit
            4: { cellWidth: 15, valign: "middle" }, // Mode
            5: { cellWidth: 15, valign: "middle" }, // Origin
            6: { cellWidth: 15, valign: "middle" }, // Dest.
            7: { cellWidth: 10, halign: "right", valign: "middle" }, // Qty
            8: { cellWidth: 12, halign: "right", valign: "middle" }, // Weight/CBM
            9: { cellWidth: 17, halign: "right", valign: "middle" }, // Frt. Amt.
            10: { cellWidth: 14, halign: "right", valign: "middle" }, // FSC. Chrgs
            11: { cellWidth: 14, halign: "right", valign: "middle" },  // Other Charges
            12: { cellWidth: 17, halign: "right", valign: "middle" }, // TotalAmt.
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
        freightAmount,
        fuelSurcharge,
        otherAmount,
        totalCGST,
        totalSGST,
        totalIGST,
        totalGST,
        nonTaxableAmount,
        taxableAmount,
        grandTotal,
    };
}