// ==========================================
// GENERATE INTERNATIONAL INVOICE PDF
// ==========================================
async function generate_International_InvoicePDF_Annexure(
    header,
    lines = []
) {
    try {

        const { jsPDF } = window.jspdf;

        const doc = new jsPDF("p", "mm", "a4");

        const PAGE = {
            x: 15,
            w: 190,
            h: 297
        };

        const FONT = {
            header: 14,
            title: 10,
            body: 8,
            small: 7,
            tiny: 6,
            stiny: 5
        };

        let y = 9;

        const invoiceNo = header?.InvoiceNo;
        const invoiceDate = header?.InvoiceDate;
        const companyId = header?.company_id;

        // ==========================================
        // FETCH MASTER DATA (PARALLEL)
        // ==========================================
        const [
            company,
            party,
            tandcData,
            shipmentData,
            bank,
            totalsPayment
        ] = await Promise.all([
            fetchCompanyDetails(header),
            fetchPartyDetails(header),
            getTermsAndConditions(companyId),
            getShipmentData_int_Annexure(invoiceNo),
            getInvoiceBankDetails(invoiceNo),
            advancedPaymentDetails(
                invoiceNo,
                invoiceDate
            )
        ]);

        // ==========================================
        // PAYMENT TOTALS
        // ==========================================
        const totalPaymentReceived = round2(
            safeNumber(totalsPayment?.totalPayment) +
            safeNumber(totalsPayment?.totalOtherDeduction) +
            safeNumber(totalsPayment?.totalTDS)
        );

        // ==========================================
        // HEADER
        // ==========================================
        y = await drawHeader(
            doc,
            PAGE,
            FONT,
            company,
            y
        );

        // ==========================================
        // TITLE
        // ==========================================
        y = drawTitle(
            doc,
            PAGE,
            FONT,
            y
        );

        // ==========================================
        // PARTY DETAILS
        // ==========================================
        y = drawPartySection(
            doc,
            PAGE,
            FONT,
            header,
            party,
            company,
            y
        );

        // ==========================================
        // SHIPMENT TABLE
        // ==========================================
        const shipmentResult =
            await drawShipmentTable_int_Annexure(
                doc,
                PAGE,
                FONT,
                shipmentData?.shipments || [],
                y,
                shipmentData?.charges || []
            );

        y = shipmentResult.y;

        // ==========================================
        // TERMS + TAX SECTION
        // ==========================================
        console.log("Drawing Terms & Tax Section with:", {
            tandcData,
            totals: shipmentResult,
            totalPaymentReceived
        });
        y = await drawTermsAndTaxSection_int_Annexure(
            doc,
            PAGE,
            FONT,
            company,
            header,
            shipmentResult,
            y,
            bank,
            totalPaymentReceived,
            tandcData
        );

        // ==========================================
        // AMOUNT IN WORDS
        // ==========================================
        y = drawAmountInWords(
            doc,
            PAGE,
            FONT,
            shipmentResult?.grandTotal || 0,
            y
        );

        // ==========================================
        // BANK DETAILS
        // ==========================================
        y = drawBankDetailsSection(
            doc,
            PAGE,
            FONT,
            company,
            bank,
            y
        );

        // ==========================================
        // FOOTER
        // ==========================================
        drawaddFooterToAllPages(
            doc,
            PAGE,
            y
        );

        // ==========================================
        // PAGE BORDER
        // ==========================================
        drawInvoiceBorderAllPages(
            doc,
            PAGE
        );

        // ==========================================
        // SAVE PDF
        // ==========================================
        const fileName =
            `${header?.InvoiceNo || "NA"}_${party?.name || "NA"}.pdf`;

        console.log(
            "PDF generated successfully",
            fileName
        );

        doc.save(fileName);

    } catch (error) {

        console.error(
            "Invoice PDF Generation Failed:",
            error
        );

        Swal.fire({
            icon: "error",
            title: "PDF Generation Failed",
            text:
                error?.message ||
                "Unable to generate invoice PDF."
        });
    }
}
// ==========================================
// TERMS & TAX SECTION
// ==========================================
async function drawTermsAndTaxSection_int_Annexure(
    doc,
    PAGE,
    FONT,
    company,
    header,
    totals,
    y,
    bank,
    totalPaymentReceived,
    tandcData
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

        bottomMargin: 35
    };

    // ==========================================
    // COLUMN WIDTHS
    // ==========================================
    const COL = {
        terms:
            PAGE.w -
            (
                CONFIG.colDescription +
                CONFIG.colNonTax +
                CONFIG.colTax
            ),

        desc: CONFIG.colDescription,
        nonTax: CONFIG.colNonTax,
        tax: CONFIG.colTax
    };

    // ==========================================
    // COLUMN POSITIONS
    // ==========================================
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
    const termsHeight =
        calculateTermsHeight_int_Annexure(
            doc,
            tandcData,
            COL.terms,
            CONFIG
        );

    const BANK_HEIGHT = 20;
    const TAX_ROWS = 8;

    const leftHeight =
        termsHeight +
        CONFIG.bankTopGap +
        BANK_HEIGHT +
        2;

    const rightHeight =
        (TAX_ROWS + 1) *
        CONFIG.headerH;

    const tableH = Math.max(
        leftHeight,
        rightHeight
    );

    // ==========================================
    // POSITION TABLE AT PAGE BOTTOM
    // ==========================================
    const pageHeight =
        doc.internal.pageSize.getHeight();

    const requiredY =
        pageHeight -
        CONFIG.bottomMargin -
        tableH;

    if (requiredY <= y) {
        doc.addPage();

        y =
            doc.internal.pageSize.getHeight() -
            CONFIG.bottomMargin -
            tableH;
    } else {
        y = requiredY;
    }

    // ==========================================
    // DRAW SECTION
    // ==========================================
    drawOuterTable_int_Annexure(
        doc,
        PAGE,
        X,
        y,
        tableH
    );

    drawHeaderRow_int_Annexure(
        doc,
        FONT,
        X,
        COL,
        y,
        CONFIG.headerH
    );

    drawTermsContent_int_Annexure(
        doc,
        FONT,
        tandcData,
        X,
        COL,
        y,
        CONFIG
    );

    drawTaxSection_int_Annexure(
        doc,
        FONT,
        totals,
        totalPaymentReceived,
        X,
        COL,
        y,
        CONFIG
    );

    return y + tableH;
}

// ==========================================
// HEIGHT OF TERMS
// ==========================================
function calculateTermsHeight_int_Annexure(
    doc,
    tandcData = [],
    termsWidth,
    CONFIG
) {

    const lineHeight = CONFIG.lineHeight;
    const paragraphGap = CONFIG.paragraphGap;
    const wrapWidth = termsWidth - 10;

    let height = CONFIG.headerH + 4;

    for (let i = 0; i < tandcData.length; i++) {

        const description =
            tandcData[i]?.Description || "";

        const lines =
            doc.splitTextToSize(
                `${i + 1}. ${description}`,
                wrapWidth
            );

        height += lines.length * lineHeight;

        if (i < tandcData.length - 1) {
            height += paragraphGap;
        }
    }

    return height;
}

// ==========================================
// TABLE BORDERS
// ==========================================
function drawOuterTable_int_Annexure(
    doc,
    PAGE,
    X,
    y,
    tableH
) {

    const bottomY = y + tableH;

    doc.setLineWidth(0.1);

    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        tableH
    );

    const columns = [
        X.desc,
        X.nonTax,
        X.tax
    ];

    for (let i = 0; i < columns.length; i++) {
        doc.line(
            columns[i],
            y,
            columns[i],
            bottomY
        );
    }
}

// ==========================================
// HEADER ROW
// ==========================================
function drawHeaderRow_int_Annexure(
    doc,
    FONT,
    X,
    COL,
    y,
    rowH
) {

    const bottomY = y + rowH;

    // Header Bottom Border
    doc.line(
        X.terms,
        bottomY,
        X.end,
        bottomY
    );

    PDF_FONT.bold(doc, FONT.body);

    const headers = [
        ["Terms & Conditions", X.terms, COL.terms],
        ["", X.desc, COL.desc],
        ["Non-Tax Amount", X.nonTax, COL.nonTax],
        ["Tax Amount", X.tax, COL.tax]
    ];

    for (let i = 0; i < headers.length; i++) {

        const [text, x, width] = headers[i];

        drawCenteredText(
            doc,
            text,
            x,
            width,
            y,
            rowH
        );
    }
}
// ==========================================
// TERMS CONTENT
// ==========================================
function drawTermsContent_int_Annexure(
    doc,
    FONT,
    tandcData = [],
    X,
    COL,
    y,
    CONFIG
) {

    PDF_FONT.normal(doc, FONT.body);

    const lineHeight = 3.8;
    const termGap = 1.5;

    const leftMargin = X.terms + 4;
    const indent = 2;
    const textWidth = COL.terms - 5;

    let currentY =
        y +
        CONFIG.headerH +
        4;

    for (let index = 0; index < tandcData.length; index++) {

        const description =
            tandcData[index]?.Description || "";

        const prefix =
            `${index + 1}. `;

        const lines =
            doc.splitTextToSize(
                description,
                textWidth - indent
            );

        // First line with numbering
        doc.text(
            prefix + (lines[0] || ""),
            leftMargin,
            currentY
        );

        currentY += lineHeight;

        // Remaining wrapped lines
        for (let i = 1; i < lines.length; i++) {

            doc.text(
                lines[i],
                leftMargin + indent,
                currentY
            );

            currentY += lineHeight;
        }

        currentY += termGap;
    }

    return currentY;
}

// ==========================================
// TAX SECTION
// ==========================================
function drawTaxSection_int_Annexure(
    doc,
    FONT,
    totals,
    totalPaymentReceived,
    X,
    COL,
    y,
    CONFIG
) {

    // ==========================================
    // VALUES
    // ==========================================
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

    // ==========================================
    // TOTALS
    // ==========================================
    const totalGST = cgst + sgst + igst;

    const grandTotal = Math.round(
        nonTaxable +
        taxable +
        totalGST
    );

    const balanceAmount = Math.round(
        grandTotal -
        advance
    );

    // ==========================================
    // ROW DATA
    // ==========================================
    const rows = [
        { label: "Total Charges", nonTax: nonTaxable, tax: taxable },
        { label: "CGST 9%", nonTax: 0, tax: cgst },
        {
            label: "SGST 9%",
            nonTax: 0,
            tax: sgst
        },
        {
            label: "IGST 18%",
            nonTax: 0,
            tax: igst
        },
        {
            label: "Total GST",
            nonTax: 0,
            tax: totalGST
        },
        {
            label: "Grand Total",
            nonTax: "",
            tax: grandTotal
        },
        {
            label: "Advance Amount",
            nonTax: "",
            tax: advance
        },
        {
            label: "Balance Amount",
            nonTax: "",
            tax: balanceAmount
        }
    ];

    const boldRows = new Set([
        "Total GST",
        "Grand Total",
        "Advance Amount",
        "Balance Amount"
    ]);

    const textYOffset = 3.2;

    PDF_FONT.normal(doc, FONT.body);

    // ==========================================
    // DRAW ROWS
    // ==========================================
    for (let i = 0; i < rows.length; i++) {

        const row = rows[i];

        const rowY =
            y +
            CONFIG.headerH +
            (i * CONFIG.headerH);

        const isHighlight =
            row.label === "Grand Total" ||
            row.label === "Advance Amount" ||
            row.label === "Balance Amount";

        // ==========================================
        // HIGHLIGHT SUMMARY ROWS
        // ==========================================
        if (isHighlight) {

            doc.setFillColor(
                230,
                230,
                230
            );

            doc.rect(
                X.desc,
                rowY,
                X.end - X.desc,
                CONFIG.headerH,
                "F"
            );

            // Border around highlighted row
            doc.rect(
                X.desc,
                rowY,
                X.end - X.desc,
                CONFIG.headerH
            );
        }

        // Top Border
        doc.line(
            X.desc,
            rowY,
            X.end,
            rowY
        );

        doc.setFont(
            "times",
            boldRows.has(row.label)
                ? "bold"
                : "normal"
        );

        doc.setFontSize(FONT.body);

        // ==========================================
        // LABEL
        // ==========================================
        doc.text(
            row.label,
            X.desc + 2,
            rowY + textYOffset
        );

        // ==========================================
        // NON TAXABLE COLUMN
        // ==========================================
        if (!isHighlight) {
            doc.text(
                formatAmount(row.nonTax),
                X.nonTax + COL.nonTax - 2,
                rowY + textYOffset,
                {
                    align: "right"
                }
            );
        }

        // ==========================================
        // TAX COLUMN
        // ==========================================
        doc.text(
            formatAmount(row.tax),
            X.tax +
            COL.tax -
            2,
            rowY + textYOffset,
            {
                align: "right"
            }
        );

        // Bottom Border
        doc.line(
            X.desc,
            rowY + CONFIG.headerH,
            X.end,
            rowY + CONFIG.headerH
        );
    }

    // ==========================================
    // END POSITION
    // ==========================================
    const endY =
        y +
        CONFIG.headerH +
        (rows.length * CONFIG.headerH);

    return {
        totalGST,
        grandTotal,
        balanceAmount,
        endY
    };
}
// ==========================================
// COMMON CENTER TEXT
// ==========================================
function drawCenteredText(
    doc,
    text = "",
    x,
    width,
    y,
    height
) {

    const centerX = x + (width / 2);
    const centerY = y + (height / 2);

    doc.text(
        String(text),
        centerX,
        centerY,
        {
            align: "center",
            baseline: "middle"
        }
    );
}
// ==========================================
// FETCH SHIPMENT DATA
// ==========================================
async function getShipmentData_int_Annexure(
    invoiceNo
) {

    const EMPTY_RESULT = {
        invoiceDetails: null,
        shipments: [],
        charges: [],
        equipment: []
    };

    try {

        // ==========================================
        // INVOICE + SHIPMENTS PARALLEL
        // ==========================================
        const [
            invoiceRes,
            shipmentRes
        ] = await Promise.all([

            supabaseClient
                .from("InvoiceDetails")
                .select("*")
                .eq("InvoiceNo", invoiceNo)
                .maybeSingle(),

            supabaseClient
                .from("InternationalBookingView")
                .select("*")
                .eq("InvoiceNumber", invoiceNo)
                .order("BookedDate", {
                    ascending: true
                })
        ]);

        if (invoiceRes.error) {
            console.error(
                "Invoice fetch error:",
                invoiceRes.error
            );
        }

        if (shipmentRes.error) {
            console.error(
                "Shipment fetch error:",
                shipmentRes.error
            );
        }

        const invoiceDetails =
            invoiceRes.data || null;

        const shipments =
            Array.isArray(shipmentRes.data)
                ? shipmentRes.data
                : [];
        console.log('Shipment Details ', shipments);
        // ==========================================
        // NO SHIPMENTS
        // ==========================================
        if (!shipments.length) {
            return {
                ...EMPTY_RESULT,
                invoiceDetails
            };
        }

        // ==========================================
        // SHIPMENT IDS
        // ==========================================
        const shipmentIds = shipments
            .map(
                row =>
                    row.ID_IB ||
                    row.id ||
                    row.ShipmentID
            )
            .filter(Boolean);

        if (!shipmentIds.length) {
            return {
                invoiceDetails,
                shipments,
                charges: [],
                equipment: []
            };
        }

        // ==========================================
        // CHARGES + EQUIPMENT PARALLEL
        // ==========================================
        const [
            chargesRes,
            equipmentRes
        ] = await Promise.all([

            supabaseClient
                .from("InternationalBookingCharges")
                .select("*")
                .in("ID_IB", shipmentIds)
                .order("id", {
                    ascending: false
                }),

            supabaseClient
                .from("InternationalBookingEquipment")
                .select("*")
                .in("ID_IB", shipmentIds)
        ]);

        if (chargesRes.error) {
            console.error(
                "Charges fetch error:",
                chargesRes.error
            );
        }

        if (equipmentRes.error) {
            console.error(
                "Equipment fetch error:",
                equipmentRes.error
            );
        }

        return {
            invoiceDetails,
            shipments,
            charges:
                Array.isArray(chargesRes.data)
                    ? chargesRes.data
                    : [],
            equipment:
                Array.isArray(equipmentRes.data)
                    ? equipmentRes.data
                    : []
        };

    } catch (error) {

        console.error(
            "getShipmentData_int_Annexure error:",
            error
        );

        return EMPTY_RESULT;
    }
}

// ==========================================
// SHIPMENT TABLE
// ==========================================
async function drawShipmentTable_int_Annexure(
    doc,
    PAGE,
    FONT,
    rows = [],
    startY,
    allCharges = []
) {

    rows = Array.isArray(rows) ? rows : [];
    allCharges = Array.isArray(allCharges) ? allCharges : [];

    // =========================
    // TOTALS
    // =========================
    let freightAmount = 0;
    let fuelSurcharge = 0;
    let otherAmount = 0;

    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;

    let taxableAmount = 0;
    let nonTaxableAmount = 0;

    // =========================
    // SAFE VALUE
    // =========================
    const safe = (val, fallback = "-") =>
        val !== null &&
            val !== undefined &&
            String(val).trim() !== ""
            ? val
            : fallback;

    // =========================
    // CHARGE ORDER
    // =========================
    const chargeOrder = {
        "Freight Amount": 1,
        "Other Amount": 2
    };
    console.log('Row Details ', rows);
    // =========================
    // REUSABLE STYLES
    // =========================
    const chargeLabelStyle = {
        halign: "right",
        font: "times",
        fontStyle: "normal",
        textColor: [0, 0, 0],
        valign: "middle",
        minCellHeight: 1,
        cellPadding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
        }
    };

    const chargeAmountStyle = {
        halign: "right",
        font: "times",
        fontStyle: "normal",
        textColor: [0, 0, 0],
        valign: "middle",
        minCellHeight: 1,
        cellPadding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
        }
    };

    const subtotalStyle = {
        halign: "right",
        fontStyle: "bold",
        fillColor: [128, 128, 128],
        textColor: [255, 255, 255],
        valign: "middle",
        minCellHeight: 2,
        cellPadding: {
            top: 1,
            bottom: 1,
            left: 2,
            right: 1
        }
    };

    // =========================
    // GROUP CHARGES
    // =========================
    const chargesMap = {};

    for (const charge of allCharges) {

        const key = charge.ID_IB;

        if (!key) continue;

        if (!chargesMap[key]) {
            chargesMap[key] = [];
        }

        chargesMap[key].push(charge);

        totalCGST += safeNumber(charge.CGSTAmt);
        totalSGST += safeNumber(charge.SGSTAmt);
        totalIGST += safeNumber(charge.IGSTAmt);
        totalGST += safeNumber(charge.TotalGSTAmt);
    }

    // Sort charges once
    for (const key in chargesMap) {

        chargesMap[key].sort((a, b) => {

            const orderA =
                chargeOrder[a.ChargesType] || 999;

            const orderB =
                chargeOrder[b.ChargesType] || 999;

            return orderA - orderB;
        });
    }

    // =========================
    // TABLE BODY
    // =========================
    const body = [];

    for (let i = 0; i < rows.length; i++) {

        const row = rows[i];

        const shipmentKey =
            row.ID_IB ||
            row.id ||
            row.BookingID;

        const transitType = [
            row.MovementType,
            row.ModeType,
        ]
            .filter(Boolean)
            .join("\n");

        console.log(transitType)
        // =========================
        // TOTALS
        // =========================
        freightAmount += safeNumber(row.FreightAmount);
        fuelSurcharge += safeNumber(row.FuelSurcharge);
        otherAmount += safeNumber(row.OtherAmount);
        taxableAmount += safeNumber(row.TaxableAmount);
        nonTaxableAmount += safeNumber(row.NonTaxableAmount);

        // =========================
        // SHIPMENT ROW
        // =========================
        body.push([
            i + 1,
            formatDate(row.BookedDate) || "",
            row.DocketNo || "",
            transitType,
            safe(row.ClearanceMode),
            safe(row.Origin),
            safe(row.Destination),
            row.Consignee || "",
            String(Number(row.NoofUnit || 0)).padStart(2, '0'),
            `${safeNumber(row.ChargableWeight)} ${row.UOMType || ""}`
        ]);

        // =========================
        // CHARGES
        // =========================
        const charges =
            chargesMap[shipmentKey] || [];

        let shipmentTotal = 0;

        for (let j = 0; j < charges.length; j++) {
            const charge = charges[j];
            const amount = safeNumber(charge.TotalAmount);
            shipmentTotal += amount;
            body.push([
                {
                    content: charge.ChargesType || "",
                    colSpan: 8,
                    styles: chargeLabelStyle
                },
                {
                    content: formatAmount(amount),
                    colSpan: 2,
                    styles: chargeAmountStyle
                }
            ]);
        }

        // =========================
        // SUB TOTAL
        // =========================
        if (shipmentTotal > 0) {

            body.push([
                {
                    content: "Sub Total",
                    colSpan: 8,
                    styles: subtotalStyle
                },
                {
                    content:
                        formatAmount(shipmentTotal),
                    colSpan: 2,
                    styles: subtotalStyle
                }
            ]);
        }
    }

    // =========================
    // GRAND TOTAL
    // =========================
    const grandTotal = Math.round(
        taxableAmount +
        nonTaxableAmount +
        totalGST
    );

    // =========================
    // TABLE
    // =========================
    doc.autoTable({

        startY,

        margin: {
            left: PAGE.x,
            right: PAGE.x
        },

        tableWidth: PAGE.w,

        head: [[
            "Sl",
            "Date",
            "AWB No",
            "Transit",
            "Mode",
            "Origin",
            "Dest.",
            "Consignee / Consignor",
            "Qty",
            "Weight"
        ]],

        body,
        theme: "grid",
        styles: {
            fontSize: FONT.body - 1,
            font: "times",
            fillColor: [255, 255, 255],
            cellPadding: 1.5,
            textColor: 0,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            valign: "middle"
        },

        headStyles: {
            font: "times",
            fillColor: [60, 60, 60],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            valign: "middle"
        },

        columnStyles: {
            0: { cellWidth: 8, halign: "center" }, // Sl No
            1: { cellWidth: 17 }, // Date
            2: { cellWidth: 20 }, // AWB No
            3: { cellWidth: 20 }, // Transit
            4: { cellWidth: 20 }, // Mode
            5: { cellWidth: 20 }, // Origin
            6: { cellWidth: 20 }, // Destination
            7: { cellWidth: 35 }, // Consignee
            8: { cellWidth: 15, halign: "right" }, // Qty
            9: { cellWidth: 15, halign: "right" } // Weight
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

        taxableAmount,
        nonTaxableAmount,

        grandTotal
    };
}