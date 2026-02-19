let cachedCompany = null;
let cachedParty = null;
let cachedEquipment = null;
let invoiceRemarks = null;

async function companyDetails() {

    // Return cached value if already loaded
    if (cachedCompany) return cachedCompany;

    try {
        const companyData = await getCompanyProfile(CompanyID);

        const company = {
            name: companyData?.company_name || "",
            address: [
                companyData?.address,
                companyData?.city && `${companyData.city} - ${companyData.pin_code}`,
                companyData?.state,
                companyData?.country
            ].filter(Boolean).join(", "),
            phone: companyData?.phone_no || "-",
            email: companyData?.e_mail || "-",
            gst: companyData?.gst_number || "-",
            state: companyData?.state || "",
            logo: companyData?.logo_path || ""
        };

        // Cache result
        cachedCompany = company;

        return company;

    } catch (err) {
        console.error("Company profile load failed:", err);

        return {
            name: "",
            address: "",
            phone: "-",
            email: "-",
            gst: "-",
            state: "",
            logo: ""
        };
    }
}

async function partyDetails(partyID) {

    // Return cached value if already loaded and matches requested partyID
    if (cachedParty && cachedParty.id === partyID) {
        return cachedParty;
    }


    try {
        const partyData = await getPartyProfile(partyID);

        const party = {
            id: partyID,
            name: partyData?.PartyName || "-",
            address: [
                partyData?.Address,
                partyData?.City && `${partyData.City} - ${partyData.PinCode}`,
                partyData?.State,
                partyData?.Country
            ].filter(Boolean).join(", "),
            gst: partyData?.GSTNumber || "-",
            state: partyData?.State || ""
        };

        // Cache result
        cachedParty = party;

        return party;

    } catch (err) {
        console.error("Party profile load failed:", err);

        return {
            id: partyID,
            name: "-",
            address: "-",
            gst: "-",
            state: ""
        };
    }
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
                    colSpan: 5,
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
                    colSpan: 9,   // Must match your total columns
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
            cellPadding: 3,
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
