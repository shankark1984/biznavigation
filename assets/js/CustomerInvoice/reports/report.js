const footerY = 272;
const PDF_CONFIG = {
    PAGE: { x: 5, y: 5, w: 200, h: 287 },
    FONT: { header: 14, title: 10, body: 8, small: 7, tiny: 6, stiny: 5 }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
async function fetchCompanyDetails(header) {
    const companyId = header?.CompanyID || CompanyID;
    const data = await getCompanyProfile(companyId);

    const { data: { publicUrl } } = supabaseClient.storage
        .from("company-logos")
        .getPublicUrl(`${companyId}.png`);

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
        logo: publicUrl,
        uANo: data?.Udyog_aadhaar_no || "-",
        panNo: data?.pan_number || "-"
    };
}

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

// ================= AMOUNT IN WORDS =================
function drawAmountInWords(doc, PAGE, FONT, grandTotal, y) { // 👈 Added missing 'y' parameter
    const padding = 1;
    const text = `Amount in Words: ${numberToWordsIndian(grandTotal)}`;

    const lines = doc.splitTextToSize(text, PAGE.w - (padding * 2));
    const boxH = (lines.length * 3) + (padding * 2);

    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.text(lines, PAGE.x + padding, y + padding + 2);

    return y + boxH;
}

// ==========================================
// BANK DETAILS SECTION
// ==========================================
function drawBankDetailsSection(doc, PAGE, FONT, company, bank, y) {
    const padding = 2;
    const lineHeight = 4;
    const textWidth = PAGE.w - (padding * 2) - 2;

    // Use an array to map and dynamically measure text lines
    const wrappedLines = [
        `A/c Name : ${company?.name || "-"} | A/c No : ${bank?.AccountNo || "-"}`,
        `Bank : ${bank?.BankName || "-"}`,
        `Branch : ${bank?.BranchName || "-"} | IFSC : ${bank?.IFSCCode || "-"}`
    ].map(line => doc.splitTextToSize(line, textWidth));

    const totalLines = wrappedLines.reduce((acc, curr) => acc + curr.length, 0);
    const boxHeight = (totalLines * lineHeight) + 4;

    doc.rect(PAGE.x, y, PAGE.w, boxHeight);

    let currentY = y + 3;
    PDF_FONT.bold(doc, FONT.body);
    doc.text("Bank Details :-", PAGE.x + padding, currentY);

    currentY += lineHeight;
    PDF_FONT.normal(doc, FONT.body);

    wrappedLines.forEach(lines => {
        doc.text(lines, PAGE.x + padding, currentY);
        currentY += lines.length * lineHeight;
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
        const footerYPos = doc.internal.pageSize.getHeight() - 4;

        PDF_FONT.bold(doc, 8);
        doc.setTextColor(0, 102, 204);
        doc.text("AllEdge Technology for BizNavigation", PAGE.x, footerYPos);

        PDF_FONT.italic(doc, 8);
        doc.setTextColor(180, 0, 0);
        doc.text("This is a computer-generated invoice. No signature required.", PAGE.x + (PAGE.w / 2), footerYPos, { align: "center" });

        PDF_FONT.normal(doc, 8);
        doc.setTextColor(180, 0, 0);
        doc.text(`Page ${pageNo} of ${totalPages}`, PAGE.x + PAGE.w, footerYPos, { align: "right" });
    }

    // Reset defaults
    PDF_FONT.normal(doc, 8);
    doc.setTextColor(0, 0, 0);
}

// ==========================================
// PDF FONT HELPER
// ==========================================
const PDF_FONT = {
    family: "times",
    set(doc, { family = PDF_FONT.family, style = "normal", size = null } = {}) {
        doc.setFont(family, style);
        if (size !== null) doc.setFontSize(size);
    },
    normal(doc, size = null) { this.set(doc, { style: "normal", size }); },
    bold(doc, size = null) { this.set(doc, { style: "bold", size }); },
    italic(doc, size = null) { this.set(doc, { style: "italic", size }); },
    boldItalic(doc, size = null) { this.set(doc, { style: "bolditalic", size }); }
};

// ==========================================
// TEXT HELPERS
// ==========================================
function drawLabelValue(doc, label, value, x, y, FONT) {
    PDF_FONT.bold(doc, FONT.title);
    doc.text(label, x, y);
    PDF_FONT.normal(doc, FONT.title);
    doc.text(String(value || "-"), x + doc.getTextWidth(label) + 2, y);
}

function drawLabelValueAligned(doc, label, value, x, y, labelWidth, FONT) {
    PDF_FONT.bold(doc, FONT.title);
    doc.text(label, x, y);
    PDF_FONT.normal(doc, FONT.title);
    doc.text(String(value || "-"), x + labelWidth, y);
}

function drawCenteredText(doc, text, x, width, y, height) {
    doc.text(text, x + (width / 2), y + (height / 2), { align: "center", baseline: "middle" });
}

// ==========================================
// TITLE (Merged both Title functions into one)
// ==========================================
function drawTitle(doc, PAGE, FONT, y, title = "TAX INVOICE") {
    doc.rect(PAGE.x, y, PAGE.w, 6);
    PDF_FONT.bold(doc, FONT.title);
    doc.text(title, PAGE.x + (PAGE.w / 2), y + 4, { align: "center" });
    return y + 6;
}

// ==========================================
// HEADER
// ==========================================
async function drawHeader(doc, PAGE, FONT, company, y) {
    const headerH = 24, logoW = PAGE.w * 0.20, textW = PAGE.w * 0.75;
    doc.rect(PAGE.x, y, PAGE.w, headerH);

    // LOGO
    const logoImg = await loadImage(company.logo);
    if (logoImg) {
        const maxW = logoW - 6, maxH = headerH - 4;
        const ratio = logoImg.width / logoImg.height;
        let w = maxW, h = w / ratio;

        if (h > maxH) { h = maxH; w = h * ratio; }
        doc.addImage(logoImg, "PNG", PAGE.x + ((logoW - w) / 2), y + ((headerH - h) / 2), w, h);
    }

    const centerX = PAGE.x + logoW + 2 + (textW / 2);

    PDF_FONT.bold(doc, FONT.header + 2);
    doc.text(company.name || "", centerX, y + 5, { align: "center" });

    PDF_FONT.normal(doc, FONT.title - 1);
    const addressLines = doc.splitTextToSize(company.address || "", textW - 10).slice(0, 2);
    doc.text(addressLines, centerX, y + 10, { align: "center" });

    // Contact Details Array mapping
    const contactInfo = [
        `Ph: ${company.phone || "-"}`,
        company.email || "-",
        `GST: ${company.gst || "-"}`
    ];
    if (company?.panNo && company.panNo !== "-") contactInfo.push(`PAN: ${company.panNo}`);
    if (company?.uANo && company.uANo !== "-") contactInfo.push(`UA No: ${company.uANo}`);

    const contactY = y + 12 + (addressLines.length * 3.8);
    doc.text(contactInfo.join(" | "), centerX, contactY, { align: "center", maxWidth: textW - 8 });

    return y + headerH;
}

// ==========================================
// PARTY SECTION
// ==========================================
function drawPartySection(doc, PAGE, FONT, header, party, company, opNo, y) {
    const LEFT_WIDTH = PAGE.w * 0.70, PADDING = 3, LINE_H = 3.5;
    const safe = (v, fallback = "-") => v?.toString().trim() || fallback;

    const leftLines = [
        `M/s ${safe(party?.name, "")}`,
        safe(party?.address, ""),
        `GST No: ${safe(party?.gst, "")}`
    ].map(text => doc.splitTextToSize(text, LEFT_WIDTH - (PADDING * 2)));

    const rightData = [
        ["Invoice No. :", safe(header?.InvoiceNo)],
        ["Invoice Date :", formatDate(header?.InvoiceDate) || "-"],
        ["SAC Code :", safe(header?.SACCode)],
        ["PO No :", safe(opNo)]
    ];

    const boldLabels = new Set(["Invoice No. :", "Invoice Date :"]);
    const rowHeight = (Math.max(leftLines.flat().length, rightData.length) * LINE_H) + (PADDING * 2);

    doc.rect(PAGE.x, y, PAGE.w, rowHeight);
    doc.line(PAGE.x + LEFT_WIDTH, y, PAGE.x + LEFT_WIDTH, y + rowHeight);

    // LEFT SECTION
    let leftY = y + PADDING + 1;
    const leftX = PAGE.x + PADDING;

    const [partyNameLines, partyAddrLines, gstNoLines] = leftLines;

    PDF_FONT.bold(doc, FONT.header - 2);
    doc.text(partyNameLines, leftX, leftY);
    leftY += partyNameLines.length * LINE_H;

    PDF_FONT.normal(doc, FONT.title - 1);
    doc.text(partyAddrLines, leftX, leftY);
    leftY += partyAddrLines.length * LINE_H + 1;

    PDF_FONT.bold(doc, FONT.title - 1);
    doc.text(gstNoLines, leftX, leftY);

    // RIGHT SECTION
    let rightY = y + PADDING + 1;
    const rightX = PAGE.x + LEFT_WIDTH + PADDING;

    rightData.forEach(([label, value]) => {
        // 👉 Using the Set you created properly to assign font weights
        doc.setFont("times", boldLabels.has(label.trim()) ? "bold" : "normal");
        doc.setFontSize(FONT.title);
        doc.text(`${label} ${value}`, rightX, rightY);
        rightY += LINE_H;
    });

    return y + rowHeight;
}

// =========================
// INVOICE BORDER
// =========================
function drawInvoiceBorder(doc, PAGE, movementType, footerY = 272, { top = 9, bottom, left = 0, right = 0, lineWidth = 0.1 } = {}) {
    bottom ??= movementType === "Customs Clearance" ? 2 : 12;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(lineWidth);
    doc.rect(PAGE.x + left, top, PAGE.w - left - right, PAGE.h - top - bottom);
}

// =========================
// INVOICE BORDER ALL PAGES
// =========================
function drawInvoiceBorderAllPages(doc, PAGE, movementType, footerY = 272) {
    const currentPage = doc.getCurrentPageInfo().pageNumber;

    for (let page = 1; page <= doc.getNumberOfPages(); page++) {
        doc.setPage(page);
        drawInvoiceBorder(doc, PAGE, movementType, footerY);
    }

    doc.setPage(currentPage);
}