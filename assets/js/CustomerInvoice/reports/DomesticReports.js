async function generate_DomesticReports_InvoicePDF(header, lines = []) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const PAGE = { x: 10, w: 190, h: 297 };
    const FONT = { header: 14, title: 10, body: 8, small: 7, tiny: 6 };

    let y = 10;

    const company = await fetchCompanyDetails(header);
    y = await drawHeader(doc, PAGE, FONT, company, y);

    y = drawTitle(doc, PAGE, FONT, y);

    const party = await fetchPartyDetails(header);
    y = drawPartySection(doc, PAGE, FONT, header, party, company, y);

    const shipmentResult = await drawShipmentTable(doc, PAGE, FONT, header, y);
    y = shipmentResult.y;

    const totals = calculateGST(shipmentResult, party, company);

    y = await drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y);

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

// Title section
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
    doc.text(rightLines, PAGE.x + left70 + 3, y + 4);

    // Bottom row
    doc.text(`GST No : ${party.gst}`, PAGE.x + 3, y + row1H + 4);
    doc.text(`P.O. No : ${header?.PONumber || "-"}`, PAGE.x + left40 + 3, y + row1H + 4);

    return y + infoH;
}


async function drawShipmentTable(doc, PAGE, FONT, header, y) {
    let totalFreight = 0, totalFSC = 0, totalOther = 0;

    const rows = await getDomesticShipmentData(header?.InvoiceNo);

    const body = rows.map((row, i) => {
        const freight = safeNumber(row.FreightAmount);
        const fsc = safeNumber(row.FuelSurcharge);
        const other = safeNumber(row.OtherCharges);

        totalFreight += freight;
        totalFSC += fsc;
        totalOther += other;

        return [
            i + 1,
            formatDate(row.BookingDate),
            row.DocketNo,
            row.TransitType || "",
            row.ModeType || "",
            row.OriginCity || "",
            row.DestinationCity || "",
            row.ChargeableWeight || "",
            freight.toFixed(2),
            fsc.toFixed(2),
            other.toFixed(2),
            (freight + fsc + other).toFixed(2)
        ];
    });

    doc.autoTable({
        startY: y,
        head: [["Sl", "Date", "Docket", "Transit", "Mode", "Origin", "Dest",
            "Wt/CBM", "Freight", "FSC", "Other", "Total"]],
        body
    });

    return {
        y: doc.lastAutoTable.finalY,
        totalFreight,
        totalFSC,
        totalOther
    };
}

function calculateGST(totals, party, company) {
    const taxable = totals.totalFreight + totals.totalFSC + totals.totalOther;

    const isInterState =
        (party.state || "").toLowerCase() !==
        (company.state || "").toLowerCase();

    const cgst = isInterState ? 0 : taxable * 0.09;
    const sgst = isInterState ? 0 : taxable * 0.09;
    const igst = isInterState ? taxable * 0.18 : 0;

    return {
        totalFreight: totals.totalFreight,
        totalFSC: totals.totalFSC,
        totalOther: totals.totalOther,
        taxable,
        cgst,
        sgst,
        igst,
        grandTotal: taxable + cgst + sgst + igst
    };
}

async function drawTermsAndTaxSection(doc, PAGE, FONT, company, header, totals, y) {

    const bank = await getInvoiceBankDetails(header?.InvoiceNo);

    const rowH = 5;
    const rows = 11;
    const tableH = rowH * rows;

    const col1 = PAGE.w * 0.6;  // Terms
    const col2 = PAGE.w * 0.15; // Label
    const col3 = PAGE.w * 0.125; // Non-Tax
    const col4 = PAGE.w * 0.125; // Taxable

    const x1 = PAGE.x;
    const x2 = x1 + col1;
    const x3 = x2 + col2;
    const x4 = x3 + col3;

    // Page break
    if (y + tableH > PAGE.h - 15) {
        doc.addPage();
        y = PAGE.x;
    }

    // Outer box
    doc.rect(PAGE.x, y, PAGE.w, tableH);

    // Vertical lines
    [x2, x3, x4].forEach(x => doc.line(x, y, x, y + tableH));

    // Horizontal lines
    for (let i = 1; i < rows; i++) {
        doc.line(PAGE.x, y + i * rowH, PAGE.x + PAGE.w, y + i * rowH);
    }

    // Headers
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Terms & Conditions", x1 + col1 / 2, y + 4, { align: "center" });
    doc.text("Non-Tax", x3 + col3 / 2, y + 4, { align: "center" });
    doc.text("Taxable", x4 + col4 / 2, y + 4, { align: "center" });

    // Terms
    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const terms = [
        `1. Please draw cheque in favour of ${company.name}`,
        "2. Payments Should be made within 7 Days from the Date of Billing",
        "3. All Complaints must be forwarded within 8 days",
        "4. Bangalore will be Jurisdiction"
    ];

    terms.forEach((t, i) => {
        doc.text(t, x1 + 2, y + rowH * (i + 2) - 1);
    });

    // Bank details
    doc.setFont("helvetica", "bold").setFontSize(FONT.body);
    doc.text("Bank Details", x1 + col1 / 2, y + rowH * 6, { align: "center" });

    doc.setFont("helvetica", "normal").setFontSize(FONT.tiny);

    const bankDetails = [
        `Account Name: ${company.name}`,
        `Account No: ${bank?.AccountNo || "-"}`,
        `Bank: ${bank?.BankName || "-"} | Branch: ${bank?.BranchName || "-"}`,
        `IFSC: ${bank?.IFSCCode || "-"}`
    ];

    bankDetails.forEach((b, i) => {
        doc.text(b, x1 + 2, y + rowH * (7 + i) - 1);
    });

    // Tax rows
    const data = [
        ["Total Freight", totals.totalFreight],
        ["Fuel Charges", totals.totalFSC],
        ["Other Charges", totals.totalOther],
        ["Sub Total", totals.taxable],
        ["CGST @ 9%", totals.cgst],
        ["SGST @ 9%", totals.sgst],
        ["IGST @ 18%", totals.igst],
        ["Total GST", totals.cgst + totals.sgst + totals.igst],
        ["GRAND TOTAL", totals.grandTotal]
    ];

    doc.setFontSize(FONT.small);

    data.forEach((row, i) => {
        const ry = y + rowH * (i + 2) - 1;

        const isHighlight =
            row[0] === "Sub Total" ||
            row[0] === "Total GST" ||
            row[0] === "GRAND TOTAL";

        if (isHighlight) {
            doc.setFillColor(220, 230, 241);
            doc.rect(x2, ry - 3, col2, rowH, "F");
            doc.rect(x3, ry - 3, col3, rowH, "F");
            doc.rect(x4, ry - 3, col4, rowH, "F");

            doc.setFont("helvetica", "bold");
        } else {
            doc.setFont("helvetica", "normal");
        }

        doc.text(row[0], x2 + col2 / 2, ry, { align: "center" });
        doc.text("0.00", x3 + col3 - 2, ry, { align: "right" });
        doc.text(row[1].toFixed(2), x4 + col4 - 2, ry, { align: "right" });
    });

    return y + tableH;
}

function drawAmountInWords(doc, PAGE, FONT, grandTotal, y) {
    const text = "Amount in Words: " + numberToWordsIndian(grandTotal);

    doc.rect(PAGE.x, y, PAGE.w, 10);
    doc.text(text, PAGE.x + 2, y + 5);

    return y + 10;
}

function addFooterToAllPages(doc, PAGE) {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.text("Powered by AllEdge", PAGE.x, PAGE.h - 5);
        doc.text(`Page ${i} of ${totalPages}`, PAGE.x + PAGE.w - 20, PAGE.h - 5);
    }
}


async function getDomesticShipmentData(invoiceNo) {
    try {
        const { data, error } = await supabaseClient
            .from("DomesticBookingDetails")   // 👈 your table name
            .select("*")
            .eq("InvoiceNumber", invoiceNo);

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