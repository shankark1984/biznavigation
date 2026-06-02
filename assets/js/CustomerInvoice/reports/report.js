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


// 🔥 Reusable: normal label + value
function drawLabelValue(doc, label, value, x, y) {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);

    doc.setFont("helvetica", "normal");
    doc.text(value, x + doc.getTextWidth(label) + 2, y);
}

// ================= AMOUNT IN WORDS =================
function drawAmountInWords(doc, PAGE, FONT, grandTotal) {

    const paddingX = 1;
    const paddingY = 1;

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

function drawBankDetailsSection(
    doc,
    PAGE,
    FONT,
    company,
    bank,
    y
) {

    const boxHeight = 4;

    doc.rect(PAGE.x, y, PAGE.w, boxHeight);

    PDF_FONT.set(doc, "normal");
    doc.setFontSize(FONT.tiny);

    // ==========================
    // LINE 1
    // ==========================
    let rowY = y + 3;
    let x = PAGE.x + 2;

    // Bold Label
    PDF_FONT.set(doc, "bold");

    const label = "Bank Details :-";

    doc.text(label, x, rowY);

    x += doc.getTextWidth(label) + 5;

    // Normal Text
    PDF_FONT.set(doc, "normal");

    const fields = [
        `A/c Name : ${company?.name || "-"}`, "|",
        `A/c No : ${bank?.AccountNo || "-"}`, "|",
        `Bank : ${bank?.BankName || "-"}`, "|",
        `Branch : ${bank?.BranchName || "-"}`, "|",
        `IFSC : ${bank?.IFSCCode || "-"}`
    ];

    fields.forEach(text => {
        doc.text(text, x, rowY);
        x += doc.getTextWidth(text) + 2;
    });

    return y + boxHeight;
}

// ==========================================
// ADD FOOTER TO ALL PAGES
// ==========================================
function drawaddFooterToAllPages(doc, PAGE, y) {

    const totalPages = doc.getNumberOfPages();

    for (let pageNo = 1; pageNo <= totalPages; pageNo++) {

        doc.setPage(pageNo);

        const pageHeight = doc.internal.pageSize.getHeight();
        const footerY = pageHeight - 4; // always bottom


        // LEFT
        PDF_FONT.set(doc, "bold");
        doc.setFontSize(7);
        doc.setTextColor(0, 102, 204);

        doc.text(
            "AllEdge Technology for BizNavigation",
            PAGE.x,
            footerY
        );

        // CENTER
        PDF_FONT.set(doc, "italic");
        doc.setTextColor(180, 0, 0);

        doc.text(
            "This is a computer-generated invoice. No signature required.",
            PAGE.x + (PAGE.w / 2),
            footerY,
            { align: "center" }
        );

        // RIGHT
        PDF_FONT.set(doc, "normal");
        doc.setTextColor(180, 0, 0);

        doc.text(
            `Page ${pageNo} of ${totalPages}`,
            PAGE.x + PAGE.w,
            footerY,
            { align: "right" }
        );
    }

    PDF_FONT.set(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
}

const PDF_FONT = {

    family: "times",

    set(doc, style = "normal") {
        doc.setFont(this.family, style);
    },

    normal(doc) {
        this.set(doc);
    },

    bold(doc) {
        this.set(doc, "bold");
    },

    italic(doc) {
        this.set(doc, "italic");
    },

    boldItalic(doc) {
        this.set(doc, "bolditalic");
    }

};

// =========================
// INVOICE BORDER
function drawInvoiceBorder(doc, PAGE) {

    const left = PAGE.x;        // 15
    const top = 9;
    const width = PAGE.w;       // 190
    const height = PAGE.h - 22; // 5 mm top + 5 mm bottom

    doc.setDrawColor(0);
    doc.setLineWidth(0.1);

    doc.rect(left, top, width, height);
}
function drawInvoiceBorderAllPages(doc, PAGE) {

    const totalPages = doc.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {

        doc.setPage(page);

        drawInvoiceBorder(doc, PAGE);
    }
}

// Utility function to draw title
function drawTitle(doc, PAGE, FONT, y) {
    doc.rect(PAGE.x, y, PAGE.w, 6);

    doc.setFont("helvetica", "bold").setFontSize(FONT.title);
    doc.text("TAX INVOICE", PAGE.x + PAGE.w / 2, y + 4, { align: "center" });

    return y + 6;
}
function drawTitle_Duty_Invoice(doc, PAGE, FONT, y) {
    doc.rect(PAGE.x, y, PAGE.w, 6);

    doc.setFont("helvetica", "bold").setFontSize(FONT.title);
    doc.text("DUTY INVOICE", PAGE.x + PAGE.w / 2, y + 4, { align: "center" });

    return y + 6;
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


