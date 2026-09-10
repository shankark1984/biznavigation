async function generatePDF() {
    if (!els.tempFormID.value || !/^\d+$/.test(els.tempFormID.value.trim())) {
        alert("Please save or load a valid note before generating the report.");
        return;
    }

    const noteDbId = parseInt(els.tempFormID.value.trim(), 10);
    const partyCode = els.partyCode.value.trim();

    // 1. Change button state to show loading
    const originalText = els.reportButton.innerHTML;
    els.reportButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
    els.reportButton.disabled = true;

    try {
        // 2. Fetch Header, Line Items, Company Profile, and Party Details in parallel for performance
        const [
            { data: headerData, error: headerError },
            { data: itemData, error: itemError },
            { data: companyData, error: companyError },
            { data: partyData, error: partyError }
        ] = await Promise.all([
            supabaseClient.from("credit_debit_notes").select("*").eq("id", noteDbId).maybeSingle(),
            supabaseClient.from("credit_debit_note_items").select("*").eq("note_id", noteDbId).order("line_no"),
            supabaseClient.from("company_profile").select("*").eq("company_id", CompanyID).maybeSingle(),
            partyCode ? supabaseClient.from("PartyDetails").select("*").eq("PartyCode", partyCode).maybeSingle() : Promise.resolve({ data: null, error: null })
        ]);

        if (headerError) throw headerError;
        if (itemError) throw itemError;
        if (companyError) throw companyError;
        if (partyError) throw partyError;

        const header = headerData || {};
        const comp = companyData || {};
        const party = partyData || {};

        // 3. Format Header & Document Variables
        const noteType = header.note_type || "CREDIT / DEBIT NOTE";
        const noteNo = header.note_no || "DRAFT";
        const rawDate = header.note_date;
        const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : "";
        const reason = header.reason || "-";
        const remarks = header.remarks || "-";

        // 4. Format Party (Billed To) Details
        const partyName = party.PartyName || header.party_name || "";
        const partyFields = [
            party.Address, party.City, party.State,
            party.Pincode ? `- ${party.Pincode}` : "",
            party.Country
        ].filter(Boolean).join(", ");

        const partyMeta = [
            party.GSTNumber ? `GSTIN: ${party.GSTNumber}` : "",
            party.PanNumber ? `PAN: ${party.PanNumber}` : "",
            party.ContactNumber ? `Ph: ${party.ContactNumber}` : "",
            party.EmailID ? `Email: ${party.EmailID}` : ""
        ].filter(Boolean).join(" | ");

        const fullPartyAddress = [partyFields, partyMeta].filter(Boolean).join("<br>");

        // 5. Format Company Profile Details
        const companyName = comp.company_name || "Your Company Name";
        const companyAddress = [
            comp.address, comp.city, comp.state,
            comp.pincode ? `- ${comp.pincode}` : "",
            comp.country
        ].filter(Boolean).join(", ");

        const companyMeta = [
            comp.phone_no ? `Ph: ${comp.phone_no}` : "",
            comp.email ? `Email: ${comp.email}` : ""
        ].filter(Boolean).join(" | ");

        const fullCompanyAddress = [companyAddress, companyMeta].filter(Boolean).join(" | ");
        const companyGSTIN = comp.gst_number || "29ABCDE1234F1Z5";
        const companyPAN = comp.pan_number || "ABCDE1234F";

        // 6. Format Totals Variables
        const fmt = (val) => parseFloat(val || 0).toFixed(2);
        const totalTaxable = fmt(header.taxable_amount);
        const totalCGST = fmt(header.cgst_amount);
        const totalSGST = fmt(header.sgst_amount);
        const totalIGST = fmt(header.igst_amount);
        const totalCESS = fmt(header.cess_amount);
        const grandTotal = fmt(header.total_amount);

        // 7. Build Items Table Rows Dynamically
        let itemsHtml = "";
        (itemData || []).forEach((item, index) => {
            const totalGST = (parseFloat(item.cgst_amount) || 0) +
                (parseFloat(item.sgst_amount) || 0) +
                (parseFloat(item.igst_amount) || 0) +
                (parseFloat(item.cess_amount) || 0);

            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

            itemsHtml += `
                <tr style="background-color: ${rowBg};">
                    <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${index + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px;">
                        <strong style="color: #0f172a;">${item.item_name || '-'}</strong><br>
                        <span style="color: #64748b; font-size: 9.5px;">${item.description || ''}</span>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${item.reference_invoice || '-'}</td>
                    <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${item.hsn_sac || '-'}</td>
                    <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(item.qty)}</td>
                    <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(item.gst_percent)}%</td>
                    <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(item.taxable_amount)}</td>
                    <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(item.sgst_amount)}</td>
                    <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(item.cgst_amount)}</td>
                    <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #334155;">${fmt(totalGST)}</td>
                    <td style="text-align: right; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; color: #0f172a;">${fmt(item.line_total)}</td>
                </tr>
            `;
        });

        // 8. Construct A4 HTML Container Template
        const printContent = document.createElement("div");
        printContent.innerHTML = `
            <div style="box-sizing: border-box; width: 190mm; min-height: 277mm; padding: 10mm; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0 auto;">
                
                <!-- Company Header -->
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
                    <div style="max-width: 60%;">
                        <h2 style="margin: 0; font-weight: 700; font-size: 18px; color: #0f172a; letter-spacing: -0.3px;">${companyName}</h2>
                        <p style="margin: 3px 0 0; color: #475569; font-size: 10px; line-height: 1.4;">${fullCompanyAddress}</p>
                        <div style="margin-top: 5px; font-size: 10px; color: #334155;">
                            <span style="margin-right: 12px;"><strong>GSTIN:</strong> ${companyGSTIN}</span>
                            <span><strong>PAN:</strong> ${companyPAN}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${noteType}
                        </div>
                        <p style="margin: 5px 0 2px; font-size: 14px; font-weight: 700; color: #0f172a;"># ${noteNo}</p>
                        <p style="margin: 0; font-size: 10.5px; color: #475569;"><strong>Date:</strong> ${formattedDate}</p>
                    </div>
                </div>

                <!-- Party & Metadata Cards -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px; gap: 12px;">
                    <div style="width: 55%; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px;">
                        <h4 style="margin: 0 0 3px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; text-transform: uppercase; font-size: 9.5px; color: #64748b; letter-spacing: 0.5px;">Billed To / Party Details</h4>
                        <h3 style="margin: 3px 0 0; font-size: 13px; color: #0f172a; font-weight: 600;">${partyName}</h3>
                        ${fullPartyAddress ? `<p style="margin: 2px 0 0; font-size: 10px; color: #475569; line-height: 1.4;">${fullPartyAddress}</p>` : ""}
                    </div>
                    <div style="width: 42%; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px;">
                        <p style="margin: 0 0 3px; font-size: 10px; color: #334155;"><strong>Reason:</strong> ${reason}</p>
                        <p style="margin: 0; font-size: 10px; color: #334155;"><strong>Remarks:</strong> ${remarks}</p>
                    </div>
                </div>

                <!-- Itemized Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                    <thead>
                        <tr style="background-color: #0f172a; color: #ffffff; text-align: center;">
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Sr</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600; text-align: left;">Item / Description</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Ref Inv</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">HSN</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Qty</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">GST%</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Taxable</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">SGST</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">CGST</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Total GST</th>
                            <th style="border: 1px solid #0f172a; padding: 6px 8px; font-size: 10px; font-weight: 600;">Total Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <!-- Summary Totals Section -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
                    <table style="width: 40%; border-collapse: collapse; font-size: 10.5px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <tr>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>Taxable Amount:</strong></td>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a;">₹ ${totalTaxable}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>CGST:</strong></td>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a;">₹ ${totalCGST}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>SGST:</strong></td>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a;">₹ ${totalSGST}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;"><strong>IGST:</strong></td>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a;">₹ ${totalIGST}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #cbd5e1; color: #334155;"><strong>CESS:</strong></td>
                            <td style="padding: 5px 8px; border-bottom: 1px solid #cbd5e1; text-align: right; color: #0f172a;">₹ ${totalCESS}</td>
                        </tr>
                        <tr style="background-color: #e2e8f0;">
                            <td style="padding: 7px 8px; font-size: 12px; color: #0f172a;"><strong>Grand Total:</strong></td>
                            <td style="padding: 7px 8px; text-align: right; font-size: 12px; font-weight: 700; color: #0f172a;">₹ ${grandTotal}</td>
                        </tr>
                    </table>
                </div>

                <!-- Signatures & Footer Note -->
                <div style="display: flex; justify-content: space-between; margin-top: 40px;">
                    <div style="width: 170px; text-align: center; border-top: 1px solid #94a3b8; padding-top: 5px; font-size: 10.5px; color: #475569;">
                        Customer Signature
                    </div>
                    <div style="width: 170px; text-align: center; border-top: 1px solid #94a3b8; padding-top: 5px; font-size: 10.5px; color: #475569;">
                        Authorized Signatory
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 9px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                    This is a computer-generated document and does not require a physical signature.
                </div>
            </div>
        `;

        // 9. Strict A4 PDF Configuration Specs
        const filenameFormat = `${noteType.replace(/\s+/g, '_')}_${noteNo}.pdf`;
        const opt = {
            margin: 0,
            filename: filenameFormat,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 10. Execute PDF Export
        await html2pdf().set(opt).from(printContent).save();

    } catch (err) {
        console.error("PDF Database Fetch or Generation Error:", err);
        alert("Failed to generate PDF report. Please check your data connection and try again.");
    } finally {
        // Restore Report Button State
        els.reportButton.innerHTML = originalText;
        els.reportButton.disabled = false;
    }
}