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
function drawAmountInWords(doc, PAGE, FONT, grandTotal, y) {

    const paddingX = 3;
    const paddingY = 2;

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

// ================= ADD FOOTER TO ALL PAGES =================
function addFooterToAllPages(doc, PAGE) {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // 🔥 Set bold + color
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7); // optional
        doc.setTextColor(0, 102, 204); // 🔵 Blue color (RGB)

        // Left text
        doc.text("AllEdge Technology for BizNavigation", PAGE.x, PAGE.h - 8);

        // Right text (page number)
        doc.text(`Page ${i} of ${totalPages}`, PAGE.x + PAGE.w - 10, PAGE.h - 8, {
            align: "right"
        });

        // 🔁 Reset to default (important for rest of PDF)
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
    }
}

