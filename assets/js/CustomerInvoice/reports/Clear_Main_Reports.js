// ==========================================
// GENERATE INTERNATIONAL INVOICE PDF
// ==========================================
async function generate_Clear_InvoicePDF_Main(header, lines = []) {

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
        getShipmentData_Clear_Main(header?.InvoiceNo),
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
    console.log("Report Type:", reportType);
    if (reportType === "Duty Invoice") {
        y = drawTitle_Duty_Invoice(doc, PAGE, FONT, y);
    } else {
        y = drawTitle(doc, PAGE, FONT, y);
    }

    // ==========================================
    // PARTY SECTION
    // ==========================================
    y = drawPartySection_Clearance(
        doc,
        PAGE,
        FONT,
        header,
        party,
        company,
        shipmentData.shipments,
        y
    );

    // ==========================================
    // SHIPMENT TABLE
    // ==========================================
    const shipmentResult = await drawShipmentTable_Clear_Main(
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
    y = await drawTermsAndTaxSection_Clear_Main(doc, PAGE, FONT, company, header, shipmentResult, y, bank, totalPaymentReceived,
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
async function drawTermsAndTaxSection_Clear_Main(doc, PAGE, FONT, company, header, totals, y, bank, totalPaymentReceived, tandcData
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

        bottomMargin: 20,
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
function calculateTermsHeight_Clear_Main(
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
function drawOuterTable_Clear_Main(doc, PAGE, X, y, tableH) {

    doc.setLineWidth(0.1);

    doc.rect(PAGE.x, y, PAGE.w, tableH);

    doc.line(X.desc, y, X.desc, y + tableH);

    doc.line(X.nonTax, y, X.nonTax, y + tableH);

    doc.line(X.tax, y, X.tax, y + tableH);
}

// ==========================================
// HEADER ROW
// ==========================================
function drawHeaderRow_Clear_Main(doc, FONT, X, COL, y, rowH) {

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
function drawTermsContent_Clear_Main(
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
function drawTaxSection_Clear_Main(
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
// FETCH SHIPMENT DATA
// ==========================================
async function getShipmentData_Clear_Main(invoiceNo) {

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
            .from("CustomsClearanceView")
            .select("*")
            .eq("InvoiceNo", invoiceNo)
            .order("JobDate", { ascending: true });

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
            .map(x => x.ID_CC || x.id || x.ShipmentID)
            .filter(Boolean);

        // =========================
        // CHARGES + EQUIPMENT PARALLEL FETCH
        // =========================
        const [chargesRes, equipmentRes] = await Promise.all([
            supabaseClient
                .from("CustomsClearanceCharges")
                .select("*")
                .in("ID_CC", shipmentIds)
                .order("id", { ascending: false }),

            supabaseClient
                .from("CustomsClearanceEquipment")
                .select("*")
                .in("ID_CC", shipmentIds)
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

// ==========================================
// CLEARANCE CHARGES TABLE
// ==========================================
async function drawShipmentTable_Clear_Main(
    doc,
    PAGE,
    FONT,
    rows = [],
    startY,
    allCharges = []
) {

    allCharges = Array.isArray(allCharges)
        ? allCharges
        : [];

    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;

    let taxableAmount = 0;
    let nonTaxableAmount = 0;

    const body = [];

    // ==========================================
    // SORT CHARGES
    // Duty / Import Duty first
    // ==========================================
    allCharges.sort((a, b) => {

        const getPriority = (chargeType = "") => {

            const txt = chargeType.toLowerCase();

            if (txt.includes("import duty")) return 1;
            if (txt.includes("duty")) return 2;

            return 999;
        };

        return (
            getPriority(a.ChargesType) -
            getPriority(b.ChargesType)
        );
    });
    // ==========================================
    // CHARGE ROWS
    // ==========================================
    allCharges.forEach((c, index) => {

        const amount = safeNumber(c.TotalAmount || 0);
        const gst = safeNumber(c.TotalGSTAmt || 0);

        let taxable = 0;
        let nonTaxable = 0;

        if (gst > 0) {
            taxable = amount;
        } else {
            nonTaxable = amount;
        }

        taxableAmount += taxable;
        nonTaxableAmount += nonTaxable;

        totalCGST += safeNumber(c.CGSTAmt || 0);
        totalSGST += safeNumber(c.SGSTAmt || 0);
        totalIGST += safeNumber(c.IGSTAmt || 0);
        totalGST += gst;

        body.push([
            index + 1,
            c.ChargesType || "",
            c.HSNCode || "",
            nonTaxable ? nonTaxable.toFixed(2) : "0.00",
            taxable ? taxable.toFixed(2) : "0.00"
        ]);
    });

    // ==========================================
    // TOTAL ROW
    // ==========================================
    body.push([
        {
            content: "",
            styles: {
                fillColor: [240, 240, 240]
            }
        },
        {
            content: "Total",
            styles: {
                fontStyle: "bold",
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0]
            }
        },
        {
            content: "",
            styles: {
                fillColor: [240, 240, 240]
            }
        },
        {
            content: nonTaxableAmount.toFixed(2),
            styles: {
                halign: "right",
                fontStyle: "bold",
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0]
            }
        },
        {
            content: taxableAmount.toFixed(2),
            styles: {
                halign: "right",
                fontStyle: "bold",
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0]
            }
        }
    ]);

    // ==========================================
    // GRAND TOTAL
    // ==========================================
    const grandTotal = Math.round(
        taxableAmount +
        nonTaxableAmount +
        totalGST
    );

    // ==========================================
    // TABLE
    // ==========================================
    doc.autoTable({

        startY,

        margin: {
            left: PAGE.x,
            right: PAGE.x
        },

        tableWidth: PAGE.w,

        head: [[
            "Sl No",
            "Particulars",
            "SAC Code",
            "Non Taxable Amount",
            "Taxable Amount"
        ]],

        body,

        styles: {
            fontSize: FONT.small,
            cellPadding: 1.5,
            textColor: [0, 0, 0],
            lineWidth: 0.2,
            lineColor: [0, 0, 0]
        },

        headStyles: {
            fillColor: [60, 60, 60],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
            valign: "middle"
        },

        columnStyles: {

            // Sl No
            0: {
                cellWidth: 12,
                halign: "center"
            },

            // Particulars
            1: {
                cellWidth: 90
            },

            // SAC Code
            2: {
                cellWidth: 28,
                halign: "center"
            },

            // Non Taxable
            3: {
                cellWidth: 30,
                halign: "right"
            },

            // Taxable
            4: {
                cellWidth: 30,
                halign: "right"
            }
        },

        didParseCell(data) {

            if (data.section === "body") {

                if (!data.cell.styles.fillColor) {
                    data.cell.styles.fillColor = [255, 255, 255];
                }

                data.cell.styles.textColor = [0, 0, 0];
            }
        }
    });

    return {

        y: doc.lastAutoTable.finalY,

        freightAmount: 0,
        fuelSurcharge: 0,
        otherAmount: 0,

        totalCGST,
        totalSGST,
        totalIGST,
        totalGST,

        taxableAmount,
        nonTaxableAmount,

        grandTotal
    };
}

// Draw party details section // Draw party details section Invoice no, invoice date, SAC code, GST no, PO no
function drawPartySection_Clearance(
    doc,
    PAGE,
    FONT,
    header,
    party,
    company,
    shipments = [],
    y
) {

    const left70 = PAGE.w * 0.7;
    const lineHeight = 3.5;
    const startX = PAGE.x + 3;

    // 🔹 Safe helper
    const safe = (v, d = "-") =>
        (v !== null && v !== undefined && String(v).trim() !== "")
            ? v
            : d;

    // ==========================================
    // SHIPMENT DETAILS
    // ==========================================
    const firstShipment = shipments?.[0] || {};

    const mawb =
        firstShipment.BLAWBNo + " / " + formatDate(firstShipment.BLAWBDate) ||
        "-";

    const beNo =
        firstShipment.BENo + " / " + formatDate(firstShipment.BEDate) ||
        "-";

    const weight =
        `${safeNumber(firstShipment.CargoWeight)} Kgs /   ${safe(firstShipment.Quantity)} Pcs` || "-";


    const poNo =
        firstShipment.PONo ||
        header?.PONo ||
        "-";

    // ==========================================
    // LEFT SIDE
    // ==========================================
    const partyNameLines = doc.splitTextToSize(
        `M / s ${safe(party?.name, "")}`,
        left70 - 6
    );

    const partyAddrLines = doc.splitTextToSize(
        safe(party?.address, ""),
        left70 - 6
    );

    // ==========================================
    // RIGHT SIDE
    // ==========================================
    const rightData = [
        {
            label: "Invoice No :",
            value: safe(header?.InvoiceNo)
        },
        {
            label: "Invoice Date :",
            value: formatDate(header?.InvoiceDate) || "-"
        },
        {
            label: "MAWB / Dt. :",
            value: mawb
        },
        {
            label: "BE No./ Dt. :",
            value: beNo
        },
        {
            label: "Wt. / Qty. :",
            value: weight
        },
        {
            label: "P. O No. :",
            value: poNo
        }
    ];

    // ==========================================
    // LABEL WIDTH
    // ==========================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT.title);

    const labelWidth = Math.max(
        ...rightData.map(r => doc.getTextWidth(r.label))
    );

    // ==========================================
    // HEIGHT CALCULATION
    // ==========================================
    const leftLines =
        partyNameLines.length +
        partyAddrLines.length +
        1;

    const rightLines =
        rightData.length;

    const row1Lines =
        Math.max(leftLines, rightLines);

    const row1H =
        (row1Lines * lineHeight) + 4;

    const infoH = row1H;

    // ==========================================
    // OUTER BOX
    // ==========================================
    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        infoH
    );

    doc.line(
        PAGE.x + left70,
        y,
        PAGE.x + left70,
        y + row1H
    );

    // ==========================================
    // LEFT CONTENT
    // ==========================================
    let currentY = y + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT.body);

    doc.text(
        partyNameLines,
        startX,
        currentY
    );

    currentY +=
        partyNameLines.length *
        lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT.small);

    doc.text(
        partyAddrLines,
        startX,
        currentY
    );

    currentY +=
        partyAddrLines.length *
        lineHeight;

    drawLabelValue(
        doc,
        "GST No :",
        safe(party?.gst),
        startX,
        currentY
    );

    // ==========================================
    // RIGHT CONTENT
    // ==========================================
    let rightY = y + 4;

    const rightX =
        PAGE.x + left70 + 3;

    rightData.forEach(item => {

        drawLabelValueAligned(
            doc,
            item.label,
            item.value,
            rightX,
            rightY,
            labelWidth
        );

        rightY += lineHeight;
    });

    return y + infoH;
}