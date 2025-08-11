async function CustomsClearanceInvoiceDetails() {
    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDateElement = document.getElementById('invoiceDate');
    const movementTypeElement = document.getElementById('movementType');
    const movementType = movementTypeElement.value;

    if (!partyCode) {
        alert('Please select a customer first.');
        return;
    }

    if (!invoiceDateElement.value) {
        alert('Please select an invoice date first.');
        invoiceDateElement.focus();
        return;
    }

    if (!movementType) {
        alert('Please select a movement type first.');
        movementTypeElement.focus();
        return;
    }

    document.getElementById('fetchPendingInvoices').disabled = true;
    showSpinner();

    let totalFreight = 0, totalFSCAmt = 0, totalOtherAmt = 0;
    let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, totalGrand = 0;
    let mergedChargesMap = {};
    let validDataFound = false;

    try {
        // Build query
        let query = supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('CustomerCode', partyCode)
            .or('InvoiceNumber.is.null,InvoiceNumber.eq.""')
            .eq('IsLocked', false)
            .order('BookedDate', { ascending: true });

        console.log('Fetching pending invoices for:', CompanyID, partyCode, movementType);

        // Movement type condition
        if (movementType === 'Forwarding') {
            console.log('Fetching invoices for Forwarding movement type');
            query = query.in('MovementType', ['Import', 'Export']);
        } else {
            query = query.eq('MovementType', movementType);
            console.log('Fetching invoices for movement type:', movementType);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No pending invoices found or all are currently locked.');
            document.getElementById('fetchPendingInvoices').disabled = false;
            return;
        }

        const bookingIds = data.map(item => item.id);
        lockedBookingIds = bookingIds;
        startAutoUnlockTimer();

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        for (const invoice of data) {
            const charges = await getBookingCharges(invoice.id);
            if (!charges || charges.grandTotal <= 0) continue;

            const { error: lockError } = await supabaseClient
                .from('international_booking')
                .update({
                    IsLocked: true,
                    LockedBy: UserLoginID,
                    LockedAt: localtimeStamp
                })
                .eq('id', invoice.id);
            if (lockError) throw lockError;

            validDataFound = true;

            totalFreight += charges.BasicFrightAmt;
            totalFSCAmt += charges.FSCAmt;
            totalOtherAmt += charges.OtherAmt;
            totalSGST += charges.totalSGST;
            totalCGST += charges.totalCGST;
            totalIGST += charges.totalIGST;
            totalGST += charges.totalGST;
            totalGrand += charges.grandTotal;

            for (const [type, amounts] of Object.entries(charges.chargesMap)) {
                const normalizedType = toProperCase(type.trim().toLowerCase());
                if (!mergedChargesMap[normalizedType]) {
                    mergedChargesMap[normalizedType] = {
                        TotalAmount: 0, SGSTAmt: 0, CGSTAmt: 0,
                        IGSTAmt: 0, TotalGSTAmt: 0, GrandTotalAmt: 0
                    };
                }

                const entry = mergedChargesMap[normalizedType];
                entry.TotalAmount += amounts.TotalAmount;
                entry.SGSTAmt += amounts.SGSTAmt;
                entry.CGSTAmt += amounts.CGSTAmt;
                entry.IGSTAmt += amounts.IGSTAmt;
                entry.TotalGSTAmt += amounts.TotalGSTAmt;
                entry.GrandTotalAmt += amounts.GrandTotalAmt;
            }

            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);
            row.innerHTML = `
                <td>${invoice.DocketNo || ''}</td>
                <td>${invoice.BookedDate || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.Origin || ''}</td>
                <td>${invoice.Destination || ''}</td>
                <td>${invoice.NoofUnit || ''} ${invoice.UOMType || ''}</td>
                <td>${invoice.AcutalWeight || ''}</td>
                <td>${invoice.ChargableWeight || ''}</td>
                <td>${charges.BasicFrightAmt.toFixed(2)}</td>
                <td>${charges.FSCAmt.toFixed(2)}</td>
                <td>${charges.OtherAmt.toFixed(2)}</td>
                <td>${charges.totalSGST.toFixed(2)}</td>
                <td>${charges.totalCGST.toFixed(2)}</td>
                <td>${charges.totalIGST.toFixed(2)}</td>
                <td>${charges.totalGST.toFixed(2)}</td>
                <td>${charges.grandTotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)"><i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }

        if (!validDataFound) {
            alert('No pending invoices with grand total greater than 0 found.');
        }

        updateTotals({ totalFreight, totalFSCAmt, totalOtherAmt, totalSGST, totalCGST, totalIGST, totalGST, totalGrand });
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error fetching or locking pending invoices:', err.message);
    } finally {
        hideSpinner();
    }
}