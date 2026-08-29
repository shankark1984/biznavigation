const footerY = 272;
const PDF_CONFIG = {
    PAGE: {
        x: 5,
        y: 5,
        w: 200, // 210 - 10 margin
        h: 287  // 297 - 10 margin
    },

    FONT: {
        header: 14,
        title: 10,
        body: 8,
        small: 7,
        tiny: 6,
        stiny: 5
    }
};
// Utility function to fetch company details
async function fetchCompanyDetails(header) {

    const companyId = header?.CompanyID || CompanyID;

    const data = await getCompanyProfile(companyId);

    const {
        data: { publicUrl }
    } = supabaseClient.storage
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

// ==========================================
// BANK DETAILS SECTION
// ==========================================
function drawBankDetailsSection(
    doc,
    PAGE,
    FONT,
    company,
    bank,
    y
) {

    const padding = 2;
    const lineHeight = 4;

    // ==========================================
    // DATA
    // ==========================================
    const line1 =
        `A/c Name : ${company?.name || "-"} | ` +
        `A/c No : ${bank?.AccountNo || "-"}`;

    const line2 =
        `Bank : ${bank?.BankName || "-"}`;

    const line3 =
        `Branch : ${bank?.BranchName || "-"} | ` +
        `IFSC : ${bank?.IFSCCode || "-"}`;

    // ==========================================
    // WRAP LONG TEXT
    // ==========================================
    const textWidth =
        PAGE.w - (padding * 2) - 2;

    const line1Wrapped =
        doc.splitTextToSize(
            line1,
            textWidth
        );

    const line2Wrapped =
        doc.splitTextToSize(
            line2,
            textWidth
        );

    const line3Wrapped =
        doc.splitTextToSize(
            line3,
            textWidth
        );

    const totalLines =
        line1Wrapped.length +
        line2Wrapped.length +
        line3Wrapped.length;

    const boxHeight =
        (totalLines * lineHeight) + 4;

    // ==========================================
    // OUTER BORDER
    // ==========================================
    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        boxHeight
    );

    // ==========================================
    // TITLE
    // ==========================================
    let currentY = y + 3;

    PDF_FONT.bold(
        doc,
        FONT.body
    );

    doc.text(
        "Bank Details :-",
        PAGE.x + padding,
        currentY
    );

    currentY += lineHeight;

    // ==========================================
    // CONTENT
    // ==========================================
    PDF_FONT.normal(
        doc,
        FONT.body
    );

    doc.text(
        line1Wrapped,
        PAGE.x + padding,
        currentY
    );

    currentY +=
        line1Wrapped.length *
        lineHeight;

    doc.text(
        line2Wrapped,
        PAGE.x + padding,
        currentY
    );

    currentY +=
        line2Wrapped.length *
        lineHeight;

    doc.text(
        line3Wrapped,
        PAGE.x + padding,
        currentY
    );

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
        doc.setFontSize(8);
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

// ==========================================
// PDF FONT HELPER
// ==========================================
const PDF_FONT = {

    family: "times", // change once here for entire PDF

    set(
        doc,
        {
            family = PDF_FONT.family,
            style = "normal",
            size = null
        } = {}
    ) {
        doc.setFont(family, style);

        if (size !== null) {
            doc.setFontSize(size);
        }
    },

    normal(doc, size = null) {
        this.set(doc, {
            style: "normal",
            size
        });
    },

    bold(doc, size = null) {
        this.set(doc, {
            style: "bold",
            size
        });
    },

    italic(doc, size = null) {
        this.set(doc, {
            style: "italic",
            size
        });
    },

    boldItalic(doc, size = null) {
        this.set(doc, {
            style: "bolditalic",
            size
        });
    }
};

// ==========================================
// DRAW LABEL + VALUE
// ==========================================
function drawLabelValue(
    doc,
    label,
    value,
    x,
    y,
    FONT
) {

    PDF_FONT.bold(doc, FONT.title);

    doc.text(label, x, y);

    PDF_FONT.normal(doc, FONT.title);

    doc.text(
        String(value || "-"),
        x + doc.getTextWidth(label) + 2,
        y
    );
}

// ==========================================
// DRAW LABEL + VALUE ALIGNED
// ==========================================
function drawLabelValueAligned(
    doc,
    label,
    value,
    x,
    y,
    labelWidth,
    FONT
) {

    PDF_FONT.bold(doc, FONT.title);

    doc.text(label, x, y);

    PDF_FONT.normal(doc, FONT.title);

    doc.text(
        String(value || "-"),
        x + labelWidth,
        y
    );
}

// ==========================================
// CENTERED TEXT
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
        x + (width / 2),
        y + (height / 2),
        {
            align: "center",
            baseline: "middle"
        }
    );
}

// ==========================================
// TITLE
// ==========================================
function drawTitle(
    doc,
    PAGE,
    FONT,
    y
) {

    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        6
    );

    PDF_FONT.bold(doc, FONT.title);

    doc.text(
        "TAX INVOICE",
        PAGE.x + (PAGE.w / 2),
        y + 4,
        {
            align: "center"
        }
    );

    return y + 6;
}

// ==========================================
// DUTY TITLE
// ==========================================
function drawTitle_Duty_Invoice(
    doc,
    PAGE,
    FONT,
    y
) {

    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        6
    );

    PDF_FONT.bold(doc, FONT.title);

    doc.text(
        "DUTY INVOICE",
        PAGE.x + (PAGE.w / 2),
        y + 4,
        {
            align: "center"
        }
    );

    return y + 6;
}

// ==========================================
// HEADER contains company logo, name, address and contact details
// ==========================================
async function drawHeader(
    doc,
    PAGE,
    FONT,
    company,
    y
) {

    const headerH = 24;
    const logoW = PAGE.w * 0.20;
    const textW = PAGE.w * 0.75;

    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        headerH
    );

    // ==========================
    // LOGO
    // ==========================
    const logoImg = await loadImage(company.logo);

    if (logoImg) {

        const maxW = logoW - 6;
        const maxH = headerH - 4;

        const ratio = logoImg.width / logoImg.height;

        let w = maxW;
        let h = w / ratio;

        if (h > maxH) {
            h = maxH;
            w = h * ratio;
        }

        doc.addImage(
            logoImg,
            "PNG",
            PAGE.x + ((logoW - w) / 2),
            y + ((headerH - h) / 2),
            w,
            h
        );
    }

    // ==========================
    // TEXT AREA
    // ==========================
    const textX = PAGE.x + logoW + 2;
    const centerX = textX + (textW / 2);

    // Company Name
    PDF_FONT.bold(doc, FONT.header + 2);

    doc.text(
        company.name || "",
        centerX,
        y + 5,
        { align: "center" }
    );

    // ==========================
    // ADDRESS (MAX 2 LINES)
    // ==========================
    PDF_FONT.normal(doc, FONT.title - 1);

    const addressLines = doc
        .splitTextToSize(
            company.address || "",
            textW - 10
        )
        .slice(0, 2);

    doc.text(
        addressLines,
        centerX,
        y + 10,
        {
            align: "center"
        }
    );

    // ==========================
    // CONTACT DETAILS
    // ==========================
    let contactLine =
        `Ph: ${company.phone || "-"} | ` +
        `${company.email || "-"} | ` +
        `GST: ${company.gst || "-"}`;

    if (
        company?.panNo &&
        company.panNo.trim() &&
        company.panNo !== "-"
    ) {
        contactLine += ` | PAN: ${company.panNo}`;
    }

    if (
        company?.uANo &&
        company.uANo.trim() &&
        company.uANo !== "-"
    ) {
        contactLine += ` | UA No: ${company.uANo}`;
    }

    // Position contact line below address
    const contactY =
        y +
        10 +
        (addressLines.length * 3.8) +
        2;

    PDF_FONT.normal(doc, FONT.title - 1);

    doc.text(
        contactLine,
        centerX,
        contactY,
        {
            align: "center",
            maxWidth: textW - 8
        }
    );

    return y + headerH;
}

// ==========================================
// PARTY SECTION contains party details and invoice info
// ==========================================
function drawPartySection(
    doc,
    PAGE,
    FONT,
    header,
    party,
    company,
    opNo, // <--- Added opNo parameter here
    y
) {

    const LEFT_WIDTH = PAGE.w * 0.70;
    const PADDING = 3;
    const LINE_H = 3.5;

    const safe = (v, fallback = "-") =>
        v?.toString().trim() || fallback;

    // ==========================
    // PARTY DATA
    // ==========================
    const partyNameLines = doc.splitTextToSize(
        `M/s ${safe(party?.name, "")}`,
        LEFT_WIDTH - (PADDING * 2)
    );

    const partyAddrLines = doc.splitTextToSize(
        safe(party?.address, ""),
        LEFT_WIDTH - (PADDING * 2)
    );
    const gstNoLines = doc.splitTextToSize(
        `GST No: ${safe(party?.gst, "")}`,
        LEFT_WIDTH - (PADDING * 2)
    );

    // ==========================
    // RIGHT SIDE DATA
    // ==========================
    const rightData = [
        ["Invoice No. :", safe(header?.InvoiceNo)],
        ["Invoice Date :", formatDate(header?.InvoiceDate) || "-"],
        ["SAC Code :", safe(header?.SACCode)],
        ["PO No :", safe(opNo)] // <--- Mapped opNo here
    ];

    // 👉 bold only these rows
    const boldLabels = new Set([
        "Invoice No. :",
        "Invoice Date :"
    ]);

    const labelWidth = Math.max(
        ...rightData.map(([label]) =>
            doc.getTextWidth(label)
        )
    );

    // ==========================
    // ROW HEIGHT
    // ==========================
    const leftLineCount =
        partyNameLines.length +
        partyAddrLines.length +
        gstNoLines.length;

    const rightLineCount =
        rightData.length;

    const rowHeight =
        (Math.max(leftLineCount, rightLineCount) * LINE_H) +
        (PADDING * 2);

    // ==========================
    // OUTER BOX
    // ==========================
    doc.rect(
        PAGE.x,
        y,
        PAGE.w,
        rowHeight
    );

    doc.line(
        PAGE.x + LEFT_WIDTH,
        y,
        PAGE.x + LEFT_WIDTH,
        y + rowHeight
    );

    // ==========================
    // LEFT SECTION
    // ==========================
    let leftY = y + PADDING + 1;
    const leftX = PAGE.x + PADDING;

    PDF_FONT.bold(doc, FONT.header - 2);

    doc.text(
        partyNameLines,
        leftX,
        leftY
    );

    leftY += partyNameLines.length * LINE_H;

    PDF_FONT.normal(doc, FONT.title - 1);

    doc.text(
        partyAddrLines,
        leftX,
        leftY
    );

    leftY += partyAddrLines.length * LINE_H + 1;

    PDF_FONT.bold(doc, FONT.title - 1);
    doc.text(
        gstNoLines,
        leftX,
        leftY
    );

    leftY += gstNoLines.length * LINE_H;

    // ==========================
    // RIGHT SECTION
    // ==========================
    let rightY = y + PADDING + 1;
    const rightX = PAGE.x + LEFT_WIDTH + PADDING;

    rightData.forEach(([label, value]) => {

        const isBold =
            label.trim() === "Invoice No. :" ||
            label.trim() === "Invoice Date :";

        // 👉 set font once per row (IMPORTANT)

        doc.setFont("times", isBold ? "bold" : "normal");
        doc.setFontSize(FONT.title);

        const text = `${label} ${value}`;

        doc.text(text, rightX, rightY);

        rightY += LINE_H;
    });

    return y + rowHeight;
}

// =========================
// INVOICE BORDER
// =========================
function drawInvoiceBorder(
    doc,
    PAGE,
    movementType,
    footerY = 272,
    {
        top = 9,
        bottom,
        left = 0,
        right = 0,
        lineWidth = 0.1
    } = {}
) {
    // Set default bottom based on movement type
    if (bottom === undefined) {
        bottom = movementType === "Customs Clearance" ? 2 : 12;
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(lineWidth);

    const x = PAGE.x + left;
    const y = top;
    const width = PAGE.w - left - right;
    const height = PAGE.h - top - bottom;

    doc.rect(x, y, width, height);
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