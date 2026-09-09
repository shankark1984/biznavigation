// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const PDF_CONFIG = {
    PAGE: { x: 15, w: 190, h: 150 },
    FONT: { header: 14, title: 10, body: 8, small: 7, tiny: 6, stiny: 5 }
};

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
// TEXT BALANCING HELPER
// ==========================================
function getBalancedText(doc, text, maxWidth) {
    if (!text) return [];
    const fullW = doc.getTextWidth(text);
    if (fullW <= maxWidth) return doc.splitTextToSize(text, maxWidth);

    const targetW = (fullW / 2) + 5;
    const lines = doc.splitTextToSize(text, Math.max(targetW, maxWidth * 0.55));
    return lines.length > 2 ? doc.splitTextToSize(text, maxWidth) : lines;
}

// ==========================================
// DATA FETCHING HELPERS
// ==========================================
async function getLRDetails(lrNumber) {
    const { data, error } = await supabaseClient
        .from("FullLoadMovementDetailsView")
        .select("*")
        .eq("LRNumber", lrNumber)
        .maybeSingle();

    if (error) {
        console.error("Error fetching LR details:", error);
        return null;
    }
    return data || null;
}

async function fetchCompanyDetails(header) {
    const companyId = header?.CompanyID || window.CompanyID;
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
        website: data?.web_site || "-",
        gst: data?.gst_number || "-",
        logo: publicUrl,
        uANo: data?.Udyog_aadhaar_no || "-",
        panNo: data?.pan_number || "-"
    };
}

// ==========================================
// GENERATE CONSIGNMENT NOTE PDF
// ==========================================
async function generateConsignmentNote(lrNumber) {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true
    });

    const PAGE = PDF_CONFIG.PAGE;
    const FONT = PDF_CONFIG.FONT;
    let y = 9;

    const header = await getLRDetails(lrNumber);
    if (!header) {
        console.error("Consignment note details not found for LR:", lrNumber);
        return;
    }

    const company = await fetchCompanyDetails(header?.company_id);

    // Build Document Layout Sections Sequentially
    y = drawTitle(doc, PAGE, FONT, y);
    y = await drawHeader(doc, PAGE, FONT, company, y, lrNumber, header?.PickupDate);
    y = drawPickupDeliveryDetails(doc, PAGE, FONT, header, y);
    y = drawOriginDestinationDetails(doc, PAGE, FONT, header, y);
    y = drawDescriptionGoods(doc, PAGE, FONT, header, y);
    y = drawReferenceNoInvoiceValue(doc, PAGE, FONT, header, y);
    y = drawTermsConditions(doc, PAGE, FONT, header, y);

    drawInlineFooter(doc, PAGE, y);

    const fileName = `${header?.LRNumber || "NA"}_${header?.DestinationCity || "NA"}.pdf`;
    doc.save(fileName);
}

// ==========================================
// TITLE SECTION
// ==========================================
function drawTitle(doc, PAGE, FONT, y, title = "GOODS CONSIGNMENT NOTE") {
    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, 6);
    PDF_FONT.bold(doc, FONT.title);
    doc.text(title, PAGE.x + (PAGE.w / 2), y + 4, { align: "center" });
    return y + 6;
}

// ==========================================
// HEADER SECTION
// ==========================================
async function drawHeader(doc, PAGE, FONT, company, y, lrNumber, lrDate) {
    const headerH = 28;
    const colLeftW = PAGE.w * 0.20;
    const colRightW = PAGE.w * 0.20;
    const colCenterW = PAGE.w - colLeftW - colRightW;

    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, headerH);
    doc.line(PAGE.x + colLeftW, y, PAGE.x + colLeftW, y + headerH);
    doc.line(PAGE.x + colLeftW + colCenterW, y, PAGE.x + colLeftW + colCenterW, y + headerH);

    // 1. Left Column: Logo
    if (company?.logo) {
        const logoImg = await loadImage(company.logo);
        if (logoImg) {
            const maxW = colLeftW - 4, maxH = headerH - 4;
            const ratio = logoImg.width / logoImg.height;
            let imgW = maxW, imgH = imgW / ratio;

            if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
            doc.addImage(logoImg, "PNG", PAGE.x + ((colLeftW - imgW) / 2), y + ((headerH - imgH) / 2), imgW, imgH);
        }
    }

    // 2. Center Column: Company Details
    const centerX = PAGE.x + colLeftW + (colCenterW / 2);
    const addressLines = getBalancedText(doc, toProperCase(company.address || ""), colCenterW - 4);

    const isValid = (val) => val && val.trim() !== "" && val !== "-";

    // Line 1: Regulatory details (GST & PAN)
    const line1Items = [
        isValid(company?.gst) ? `GST: ${company.gst}` : null,
        isValid(company?.panNo) ? `PAN: ${company.panNo}` : null
    ].filter(Boolean);

    // Line 2: Communication details (Phone, Email, Website) - Phone will be on this next line
    const line2Items = [
        isValid(company?.phone) ? `Contact No: ${company.phone}` : null,
        isValid(company?.email) ? company.email : null,
        isValid(company?.website) ? company.website : null
    ].filter(Boolean);

    const contactLine1 = line1Items.join(" | ");
    const contactLine2 = line2Items.join(" | ");

    const nameSpace = 5;
    const addressSpace = addressLines.length * 3.8;
    const contactSpace1 = 4.5;
    const contactSpace2 = contactLine2 ? 3.8 : 0;
    const totalCenterHeight = nameSpace + addressSpace + contactSpace1 + contactSpace2;

    let currentCenterY = y + ((headerH - totalCenterHeight) / 2) + 3.5;

    PDF_FONT.bold(doc, FONT.header + 2);
    doc.text(company.name || "", centerX, currentCenterY, { align: "center" });

    currentCenterY += nameSpace;
    PDF_FONT.normal(doc, FONT.title);
    doc.text(addressLines, centerX, currentCenterY, { align: "center", maxWidth: colCenterW - 4 });

    currentCenterY += addressSpace;
    doc.text(contactLine1, centerX, currentCenterY, { align: "center", maxWidth: colCenterW - 4 });

    if (contactLine2) {
        currentCenterY += contactSpace2;
        doc.text(contactLine2, centerX, currentCenterY, { align: "center", maxWidth: colCenterW - 4 });
    }

    // 3. Right Column: QR Code & Meta
    if (lrNumber) {
        const gap = 2, lrTextSpace = 4, dateTextSpace = lrDate ? 4 : 0;
        const totalTextSpace = lrTextSpace + dateTextSpace;
        const qrSize = Math.min(colRightW - 4, headerH - totalTextSpace - gap - 2);
        const rightCenterX = PAGE.x + colLeftW + colCenterW + (colRightW / 2);
        const totalRightHeight = qrSize + gap + totalTextSpace;
        const startRightY = y + ((headerH - totalRightHeight) / 2);

        try {
            const qrImgBase64 = await generateQRCodeBase64(lrNumber);
            if (qrImgBase64) {
                doc.addImage(qrImgBase64, "PNG", rightCenterX - (qrSize / 2), startRightY, qrSize, qrSize);
            }
        } catch (error) {
            console.warn("Could not generate QR code:", error);
        }

        let textY = startRightY + qrSize + gap + 2.5;
        PDF_FONT.bold(doc, FONT.title || 8);
        doc.text(String(lrNumber), rightCenterX, textY, { align: "center" });

        if (lrDate) {
            textY += dateTextSpace;
            PDF_FONT.normal(doc, FONT.body || 8);
            doc.text(`Booking Date: ${formatDate(lrDate)}`, rightCenterX, textY, { align: "center" });
        }
    }

    return y + headerH;
}

// ==========================================
// PICKUP & DELIVERY DETAILS
// ==========================================
function drawPickupDeliveryDetails(doc, PAGE, FONT, lrDetails, y) {
    const boxH = 20;
    const colW = PAGE.w / 2;

    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.line(PAGE.x + colW, y, PAGE.x + colW, y + boxH);

    const data = lrDetails || {};

    // Left Column: Pickup Details
    let leftY = y + 3, leftX = PAGE.x + 2;
    PDF_FONT.bold(doc, FONT.title);
    doc.text("Pickup Details (Consignor):", leftX, leftY);

    leftY += 4;
    leftX += 2;
    PDF_FONT.normal(doc, FONT.body);
    const rawPickup = [data.OriginAddress, data.OriginCity, data.OriginPincode].filter(Boolean).join(", ");
    doc.text(getBalancedText(doc, toProperCase(rawPickup), colW - 4), leftX, leftY);

    // Right Column: Delivery Details
    let rightY = y + 3, rightX = PAGE.x + colW + 2;
    PDF_FONT.bold(doc, FONT.title);
    doc.text("Delivery Details (Consignee):", rightX, rightY);

    rightY += 4;
    rightX += 2;
    PDF_FONT.normal(doc, FONT.body);
    const rawDelivery = [data.DestinationAddress, data.DestinationCity, data.DestinationPincode].filter(Boolean).join(", ");
    doc.text(getBalancedText(doc, toProperCase(rawDelivery), colW - 4), rightX, rightY);

    return y + boxH;
}

// ==========================================
// ORIGIN & DESTINATION DETAILS
// ==========================================
function drawOriginDestinationDetails(doc, PAGE, FONT, lrDetails, y) {
    const boxH = 10;
    const colW = PAGE.w / 4;

    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.line(PAGE.x, y + (boxH / 2), PAGE.x + PAGE.w, y + (boxH / 2));
    doc.line(PAGE.x + colW, y, PAGE.x + colW, y + boxH);
    doc.line(PAGE.x + (colW * 2), y, PAGE.x + (colW * 2), y + boxH);
    doc.line(PAGE.x + (colW * 3), y, PAGE.x + (colW * 3), y + boxH);

    const data = lrDetails || {};
    const originCity = data.OriginCity || "-";
    const destCity = data.DestinationCity || "-";
    const vehicleNo = [data.VehicleNumber, data.VehicleType].filter(Boolean).join(" - ") || "-";
    const movement = [data.MovementType, data.ModeType].filter(Boolean).join(" / ") || "-";

    PDF_FONT.bold(doc, FONT.body);
    let headerY = y + 3.5;
    doc.text("Origin", PAGE.x + 2, headerY);
    doc.text("Destination", PAGE.x + colW + 2, headerY);
    doc.text("Vehicle Number / Type", PAGE.x + (colW * 2) + 2, headerY);
    doc.text("Movement / Mode", PAGE.x + (colW * 3) + 2, headerY);

    PDF_FONT.normal(doc, FONT.body);
    let valueY = y + 8.5;
    const truncate = (text) => {
        const lines = doc.splitTextToSize(String(text).toUpperCase(), colW - 4);
        return lines.length > 1 ? lines[0].trim() + "..." : lines[0];
    };

    doc.text(truncate(originCity), PAGE.x + 2, valueY);
    doc.text(truncate(destCity), PAGE.x + colW + 2, valueY);
    doc.text(truncate(vehicleNo), PAGE.x + (colW * 2) + 2, valueY);
    doc.text(truncate(movement), PAGE.x + (colW * 3) + 2, valueY);

    return y + boxH;
}

// ==========================================
// DESCRIPTION OF GOODS
// ==========================================
function drawDescriptionGoods(doc, PAGE, FONT, lrDetails, y) {
    const colW1 = 12, colW2 = 25, colW3 = 103, colW4 = 25, colW5 = 25;
    const data = lrDetails || {};

    const slNo = "1";
    const pkgs = data.quantity || data.Quantity || "0";
    const description = data.DescriptionOfGoods || data.DescriptionOfGoods || "-";
    const aWeight = data.actualWt || data.ActualWeight || "0.00";
    const cWeight = data.chargeWt || data.ChargeableWeight || "0.00";
    const containerNo = data.ContainerNumber || data.ContainerNumber ? `\nContainer No: ${data.ContainerNumber || data.ContainerNumber}` : "";
    const routeDetails = data.RouteDetails || data.RouteDetails ? `\nRoute: ${data.RouteDetails || data.RouteDetails}` : "";
    const information = data.Information || data.Information ? `\nInformation: ${data.Information || data.Information}` : "";

    const fullDescription = description + containerNo + routeDetails + information;

    PDF_FONT.normal(doc, FONT.body);
    const descLines = doc.splitTextToSize(fullDescription, colW3 - 4);

    const headerH = 6;

    // INCREASED HEIGHT HERE: Changed line spacing multiplier from 4 to 5.5, and padding from +4 to +8
    const lineHeight = 10;
    const valueAreaH = Math.max(14, (descLines.length * lineHeight) + 8);

    const boxH = headerH + valueAreaH;

    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, boxH);

    const x1 = PAGE.x + colW1, x2 = x1 + colW2, x3 = x2 + colW3, x4 = x3 + colW4;
    doc.line(x1, y, x1, y + boxH);
    doc.line(x2, y, x2, y + boxH);
    doc.line(x3, y, x3, y + boxH);
    doc.line(x4, y, x4, y + boxH);

    const dividerY = y + 5.5;
    doc.line(PAGE.x, dividerY, PAGE.x + PAGE.w, dividerY);

    PDF_FONT.bold(doc, FONT.title || 6);
    let headerY = y + 3.8;
    doc.text("Sl No", PAGE.x + (colW1 / 2), headerY, { align: "center" });
    doc.text("No of Pkgs", x1 + (colW2 / 2), headerY, { align: "center" });
    doc.text("Description of Goods (Said to Contain)", x2 + 2, headerY);
    doc.text("Actual Wt", x3 + (colW4 / 2), headerY, { align: "center" });
    doc.text("Charge Wt", x4 + (colW5 / 2), headerY, { align: "center" });

    PDF_FONT.normal(doc, FONT.body);
    let valueY = dividerY + 4.5; // Adjusted starting vertical alignment slightly down

    doc.text(String(slNo), PAGE.x + (colW1 / 2), valueY, { align: "center" });
    doc.text(String(pkgs), x1 + (colW2 / 2), valueY, { align: "center" });

    // Pass the line spacing configuration explicitly to multi-line text block
    doc.text(descLines, x2 + 2, valueY, { lineHeight: lineHeight });

    doc.text(String(aWeight), x3 + colW4 - 2, valueY, { align: "right" });
    doc.text(String(cWeight), x4 + colW5 - 2, valueY, { align: "right" });

    return y + boxH;
}

// ==========================================
// REFERENCE NO, INVOICE VALUE & E-WAY BILL
// ==========================================
function drawReferenceNoInvoiceValue(doc, PAGE, FONT, lrDetails, y) {
    const boxH = 6;
    const colW = PAGE.w / 3;

    // 1. Draw Outer Box and Vertical Dividers
    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.line(PAGE.x + colW, y, PAGE.x + colW, y + boxH);
    doc.line(PAGE.x + (colW * 2), y, PAGE.x + (colW * 2), y + boxH);

    // 2. Extract Data Safely
    const data = lrDetails || {};
    const refNo = data.referenceNumber || data.ReferenceNo || "-";
    const invoiceVal = data.invoiceValue || data.InvoiceValue || "0.00";
    const eWayBillNo = data.wayBillNo || data.WayBillNo || data.eWayBillNo || "-";

    const textY = y + 4.2;
    const maxColWidth = colW - 4; // Padding constraint

    // 3. Define Column Data Structure
    const columns = [
        { label: "Cust Reference No : ", value: refNo },
        { label: "Invoice Value : ", value: invoiceVal },
        { label: "e-Way Bill No : ", value: eWayBillNo }
    ];

    // 4. Render Columns Loop
    columns.forEach((col, index) => {
        const startX = PAGE.x + (colW * index) + 2;

        PDF_FONT.bold(doc, FONT.body);
        doc.text(col.label, startX, textY);
        const labelWidth = doc.getTextWidth(col.label);

        PDF_FONT.normal(doc, FONT.body);
        const valStr = String(col.value);
        const availableWidth = maxColWidth - labelWidth;

        // Truncate if value exceeds column space
        let displayVal = valStr;
        if (doc.getTextWidth(valStr) > availableWidth && availableWidth > 0) {
            const lines = doc.splitTextToSize(valStr, availableWidth);
            displayVal = lines[0] ? lines[0].trim() + "..." : valStr;
        }

        doc.text(displayVal, startX + labelWidth, textY);
    });

    return y + boxH;
}

// ==========================================
// TERMS & CONDITIONS
// ==========================================
function drawTermsConditions(doc, PAGE, FONT, lrDetails, y) {
    const colLeftW = PAGE.w * 0.58;
    const colRightW = PAGE.w * 0.42;
    const splitX = PAGE.x + colLeftW;

    const data = lrDetails || {};
    const tcPoints = [
        "1. Goods are carried at owner's risk.",
        "2. Unloading to be done by consignee.",
        "3. Company is not responsible for leakage & breakage in transit & while unloading.",
        "4. Consignment will not be detained, diverted or re-booked without written request.",
        "5. All disputes are subject to local jurisdiction.",
        "",
        "Sender Name & Signature : _____________________________"
    ];
    const tcString = data.TermsAndConditions || tcPoints.join("\n");

    const deliveryArray = [
        "Delivery at: ______________________________",
        "",
        "Arrived Date & Time : ___/___/20___ @ ___:___",
        "",
        "Delivered Date & Time : ___/___/20___ @ ___:___",
        "",
        "Receiver Name & Signature : __________________________"
    ];
    const deliveryString = deliveryArray.join("\n");

    PDF_FONT.normal(doc, FONT.body || 6);
    const tcLines = doc.splitTextToSize(tcString, colLeftW - 6);
    const deliveryLines = doc.splitTextToSize(deliveryString, colRightW - 6);

    const lineSpacing = 3.6;
    const headerOffset = 4.5;
    const textStartOffset = 4.5;
    const maxLines = Math.max(tcLines.length, deliveryLines.length);
    const boxH = headerOffset + textStartOffset + (maxLines * lineSpacing) + 2;

    doc.setLineWidth(0.15);
    doc.rect(PAGE.x, y, PAGE.w, boxH);
    doc.line(splitX, y, splitX, y + boxH);

    // Left Column: Terms
    let leftY = y + headerOffset;
    PDF_FONT.bold(doc, FONT.title);
    doc.text("Terms & Conditions:", PAGE.x + 3, leftY);
    leftY += textStartOffset;
    PDF_FONT.normal(doc, FONT.body || 6);
    tcLines.forEach((line, index) => {
        doc.text(line, PAGE.x + 3, leftY + (index * lineSpacing));
    });

    // Right Column: Delivery Details
    let rightY = y + headerOffset;
    PDF_FONT.bold(doc, FONT.title);
    doc.text("Delivery Details:", splitX + 3, rightY);
    rightY += textStartOffset;
    PDF_FONT.normal(doc, FONT.body || 6);
    deliveryLines.forEach((line, index) => {
        doc.text(line, splitX + 3, rightY + (index * lineSpacing));
    });

    return y + boxH;
}

// ==========================================
// FOOTER (Drawn directly below content)
// ==========================================
function drawInlineFooter(doc, PAGE, y) {
    const footerYPos = y + 6; // Adds a small 6mm gap below the Terms & Conditions box

    PDF_FONT.bold(doc, 7);
    doc.setTextColor(0, 102, 204);
    doc.text("AllEdge Technology for BizNavigation", PAGE.x, footerYPos);

    PDF_FONT.italic(doc, 7);
    doc.setTextColor(180, 0, 0);
    doc.text("This is a computer-generated document. No signature required.", PAGE.x + (PAGE.w / 2), footerYPos, { align: "center" });

    // PDF_FONT.normal(doc, 7);
    // doc.setTextColor(180, 0, 0);
    // doc.text(`Page 1 of 1`, PAGE.x + PAGE.w, footerYPos, { align: "right" });

    // Reset text color back to default black
    PDF_FONT.normal(doc, 8);
    doc.setTextColor(0, 0, 0);
}