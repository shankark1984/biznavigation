// ==========================================
// GENERATE INTERNATIONAL INVOICE PDF
// ==========================================
async function generate_International_InvoicePDF_Annexure(header, lines = []) {

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
        getShipmentData_int_Annexure(header?.InvoiceNo),
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
    const shipmentResult = await drawShipmentTable_int_Annexure(
        doc,
        PAGE,
        FONT,
        shipmentData.shipments,   // ✅ ARRAY
        y,
        shipmentData.charges      // ✅ ARRAY
    );

    y = shipmentResult.y;

    // ==========================================
    // TERMS + TAX SECTION
    // ==========================================
    y = await drawTermsAndTaxSection_int_Annexure(doc, PAGE, FONT, company, header, shipmentResult, y, bank, totalPaymentReceived,
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
async function drawTermsAndTaxSection_int_Annexure(doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived, tandcData
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
    const termsHeight = calculateTermsHeight_int_Annexure(doc, tandcData, COL.terms, CONFIG);

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
    drawOuterTable_int_Annexure(doc, PAGE, X, y, tableH);
    // ==========================================
    // HEADER ROW
    // ==========================================
    drawHeaderRow_int_Annexure(doc, FONT, X, COL, y, CONFIG.headerH);

    // ==========================================
    // TERMS CONTENT
    // ==========================================
    drawTermsContent_int_Annexure(doc, FONT, tandcData, X, COL, y, CONFIG);

    // ==========================================
    // TAX DETAILS
    // ==========================================
    drawTaxSection_int_Annexure(doc, FONT, totals, totalPaymentReceived, X, COL, y, CONFIG);

    return y + tableH;
}

// ==========================================
// HEIGHT OF TERMS
// ==========================================
function calculateTermsHeight_int_Annexure(
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
function drawOuterTable_int_Annexure(doc, PAGE, X, y, tableH) {

    doc.setLineWidth(0.1);

    doc.rect(PAGE.x, y, PAGE.w, tableH);

    doc.line(X.desc, y, X.desc, y + tableH);

    doc.line(X.nonTax, y, X.nonTax, y + tableH);

    doc.line(X.tax, y, X.tax, y + tableH);
}

// ==========================================
// HEADER ROW
// ==========================================
function drawHeaderRow_int_Annexure(doc, FONT, X, COL, y, rowH) {

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
function drawTermsContent_int_Annexure(
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

    const advance =
        safeNumber(
            totalPaymentReceived
        );

    const rows = [
        ["Total Charges", totals.nonTaxableAmount, totals.taxableAmount],
        ["CGST 9%", 0, totals.totalCGST],
        ["SGST 9%", 0, totals.totalSGST],
        ["IGST 18%", 0, totals.totalIGST],
        ["Total GST", 0, totals.totalGST],
        ["Grand Total", 0, totals.grandTotal],
        ["Advance Amount", 0, advance],
        ["Balance Amount", 0, round2(totals.grandTotal - advance)]
    ];

    doc.setFontSize(
        FONT.small
    );

    rows.forEach(
        (row, i) => {

            const rowY =
                y +
                CONFIG.headerH +
                (
                    i *
                    CONFIG.headerH
                );

            doc.line(
                X.desc,
                rowY,
                X.end,
                rowY
            );

            doc.text(
                row[0],
                X.desc + 2,
                rowY + 3.2
            );

            doc.text(
                safeAmount(
                    row[1]
                ).toFixed(2),
                X.nonTax +
                COL.nonTax -
                2,
                rowY + 3.2,
                {
                    align: "right"
                }
            );

            doc.text(
                safeAmount(
                    row[2]
                ).toFixed(2),
                X.tax +
                COL.tax -
                2,
                rowY + 3.2,
                {
                    align: "right"
                }
            );
        }
    );
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
async function getShipmentData_int_Annexure(invoiceNo) {

    try {

        // =========================
        // INVOICE DETAILS
        // =========================
        const { data: invoiceDetails, error: invError } = await supabaseClient
            .from("InvoiceDetails")
            .select("*")
            .eq("InvoiceNo", invoiceNo)
            .maybeSingle();

        if (invError) {
            console.error("Invoice fetch error:", invError);
        }

        // =========================
        // SHIPMENTS
        // =========================
        const { data: shipments, error: shipError } = await supabaseClient
            .from("InternationalBookingView")
            .select("*")
            .eq("InvoiceNumber", invoiceNo)
            .order("BookedDate", { ascending: true });

        if (shipError) {
            console.error("Shipment fetch error:", shipError);
        }

        const safeShipments = Array.isArray(shipments) ? shipments : [];

        if (!safeShipments.length) {
            return {
                invoiceDetails: invoiceDetails || null,
                shipments: [],
                charges: [],
                equipment: [],
                paymentDetails: {
                    totalPayment: 0,
                    totalOtherDeduction: 0,
                    totalTDS: 0
                }
            };
        }

        // =========================
        // SAFE SHIPMENT IDS (FIXED)
        // =========================
        const shipmentIds = safeShipments
            .map(x => x.ID_IB || x.id || x.ShipmentID)
            .filter(Boolean);

        // =========================
        // CHARGES + EQUIPMENT PARALLEL FETCH
        // =========================
        const [chargesRes, equipmentRes] = await Promise.all([
            supabaseClient
                .from("InternationalBookingCharges")
                .select("*")
                .in("ID_IB", shipmentIds)
                .order("id", { ascending: false }),

            supabaseClient
                .from("InternationalBookingEquipment")
                .select("*")
                .in("ID_IB", shipmentIds)
        ]);

        const charges = Array.isArray(chargesRes.data) ? chargesRes.data : [];
        const equipment = Array.isArray(equipmentRes.data) ? equipmentRes.data : [];

        if (chargesRes.error) {
            console.error("Charges fetch error:", chargesRes.error);
        }

        if (equipmentRes.error) {
            console.error("Equipment fetch error:", equipmentRes.error);
        }

        // =========================
        // PAYMENT DETAILS
        // =========================
        let paymentDetails = {
            totalPayment: 0,
            totalOtherDeduction: 0,
            totalTDS: 0
        };

        try {
            paymentDetails = await advancedPaymentDetails(
                invoiceNo,
                invoiceDetails?.InvoiceDate
            ) || paymentDetails;
        } catch (err) {
            console.error("Payment fetch error:", err);
        }

        // =========================
        // FINAL RESPONSE
        // =========================
        return {
            invoiceDetails: invoiceDetails || null,
            shipments: safeShipments,
            charges,
            equipment,
            paymentDetails
        };

    } catch (err) {

        console.error("Unexpected error in getShipmentData_int_Annexure:", err);

        return {
            invoiceDetails: null,
            shipments: [],
            charges: [],
            equipment: [],
            paymentDetails: {
                totalPayment: 0,
                totalOtherDeduction: 0,
                totalTDS: 0
            }
        };
    }
}

// Utility function to fetch shipment details
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
    // GROUP CHARGES
    // =========================
    const chargesMap = {};

    allCharges.forEach(c => {
        const key = c.ID_IB;
        if (!chargesMap[key]) chargesMap[key] = [];
        chargesMap[key].push(c);
    });

    const safe = (val, fallback = "-") =>
        val !== null && val !== undefined && String(val).trim() !== ""
            ? val
            : fallback;

    const body = [];

    rows.forEach((row, i) => {

        // 🔥 FIX: SAFE SHIPMENT KEY (IMPORTANT)
        const shipmentKey = row.ID_IB || row.id || row.BookingID;

        console.log(`Shipment Key: ${shipmentKey}`);

        const TransitType = [
            row.MovementType,
            row.ModeType,
        ].filter(Boolean).join("\n");

        const sector = [
            `Origin: ${safe(row.Origin)}`,
            `Dest: ${safe(row.Destination)}`
        ].join("\n");

        // =========================
        // SHIPMENT TOTALS
        // =========================
        freightAmount += safeNumber(row.FreightAmount || 0);
        fuelSurcharge += safeNumber(row.FuelSurcharge || 0);
        otherAmount += safeNumber(row.OtherAmount || 0);

        taxableAmount += safeNumber(row.TaxableAmount || 0);
        nonTaxableAmount += safeNumber(row.NonTaxableAmount || 0);

        // =========================
        // SHIPMENT ROW
        // =========================
        body.push([
            i + 1,
            formatDate(row.BookedDate) || "",
            row.DocketNo || "",
            TransitType || "",
            safe(row.ClearanceMode),
            safe(row.Origin) || "",
            safe(row.Destination) || "",
            row.Consignee || "",
            row.NoofUnit ?? "0",
            `${safeNumber(row.ChargableWeight)} ${row.UOMType || ""}`,
        ]);

        // =========================
        // CHARGES UNDER SHIPMENT
        // =========================
        const chargeOrder = {
            "Freight Amount": 1,
            "Fuel Surcharge": 2,
            "Other Amount": 3
        };

        const charges = (chargesMap[shipmentKey] || []).sort((a, b) => {
            const orderA = chargeOrder[a.ChargesType] || 999;
            const orderB = chargeOrder[b.ChargesType] || 999;
            return orderA - orderB;
        });

        // Shipment-wise total
        let shipmentTotal = 0;

        charges.forEach(c => {

            const amt = safeNumber(c.TotalAmount || 0);

            shipmentTotal += amt;

            totalCGST += safeNumber(c.TotalCGSTAmt || 0);
            totalSGST += safeNumber(c.TotalSGSTAmt || 0);
            totalIGST += safeNumber(c.TotalIGSTAmt || 0);
            totalGST += safeNumber(c.TotalGSTAmt || 0);

            body.push([
                {
                    content: c.ChargesType || "",
                    colSpan: 8,
                    styles: {
                        halign: "right",
                        fontStyle: "normal",
                        textColor: [0, 0, 0],
                        valign: "middle"
                    }
                },
                {
                    content: amt.toFixed(2),
                    colSpan: 2, // Merge Qty + Weight columns
                    styles: {
                        halign: "right",
                        fontStyle: "bold",
                        valign: "middle",
                        textColor: [0, 0, 0]
                    }
                }
            ]);
        });

        // =========================
        // SHIPMENT TOTAL ROW
        // =========================
        if (charges.length > 0) {

            body.push([
                {
                    content: "Sub Total",
                    colSpan: 8,
                    styles: {
                        halign: "right",
                        fontStyle: "bold",
                        fillColor: [240, 240, 240],
                        textColor: [0, 0, 0],
                        valign: "middle",
                        halign: "right",
                        minCellHeight: 2,
                        cellPadding: { top: 0, bottom: 0, left: 2, right: 2 }
                    }
                },
                {
                    content: shipmentTotal.toFixed(2),
                    colSpan: 2, // Merge Qty + Weight columns
                    styles: {
                        halign: "right",
                        fontStyle: "bold",
                        fillColor: [240, 240, 240],
                        textColor: [0, 0, 0],
                        valign: "middle"
                    }
                },
                ""
            ]);
        }
    });

    // =========================
    // GRAND TOTAL
    // =========================
    const grandTotal = Math.round(
        freightAmount +
        fuelSurcharge +
        otherAmount +
        totalGST
    );

    // =========================
    // TABLE
    // =========================
    doc.autoTable({
        startY,
        margin: { left: PAGE.x, right: PAGE.x },
        tableWidth: PAGE.w,

        head: [[
            "Sl",
            "Date",
            "AWB No",
            "Transit",
            "Mode",
            "Origin",
            "Dest.",
            "Consignee",
            "Qty",
            "Weight",
        ]],

        body,

        styles: {
            fontSize: FONT.small,
            cellPadding: 1.5,
            textColor: 0,
            lineWidth: 0.2,
            lineColor: [0, 0, 0]
        },

        headStyles: {
            fillColor: [60, 60, 60],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            valign: "middle"
        },
        didParseCell: function (data) {
            if (data.section === "body") {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [0, 0, 0];
            }
        },

        columnStyles: {
            0: { cellWidth: 8, halign: "center" }, // Sl
            1: { cellWidth: 17 }, // Date
            2: { cellWidth: 25 }, // AWB No
            3: { cellWidth: 20 }, // Transit
            4: { cellWidth: 20 }, // Mode
            5: { cellWidth: 20 }, // Origin
            6: { cellWidth: 20 }, // Dest.
            7: { cellWidth: 40 }, // Consignee
            8: { cellWidth: 10, halign: "right" }, // Qty,
            9: { cellWidth: 10, halign: "right" } // Weight
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