
async function getPendingInvoiceDetails() {
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

        const departmentElement = document.getElementById('department');
        const department = departmentElement?.value?.trim();

        // Department filter
        if (department && department.toLowerCase() !== 'all') {
            query = query.eq('Department', department);
            console.log('Fetching invoices for department:', department);
        } else {
            console.log('Fetching invoices for ALL departments');
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

        createPendingShipmentTableHeaderAndFooter_ib(); // Create header and footer if not already done

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

        updateTotals_ib({
            totalFreight,
            totalFSCAmt,
            totalOtherAmt,
            totalSGST,
            totalCGST,
            totalIGST,
            totalGST,
            totalGrand
        });
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error fetching or locking pending invoices:', err.message);
    } finally {
        hideSpinner();
    }
}

async function getBookingCharges(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingCharges')
            .select('ChargesType, TotalAmount, SGSTAmt, CGSTAmt, IGSTAmt, TotalGSTAmt, GrandTotalAmt')
            .eq('ID_IB', bookingID)
            .order('id', { ascending: true });

        if (error) throw error;

        if (data.length === 0) return null;

        const chargesMap = {};
        let BasicFrightAmt = 0, FSCAmt = 0, OtherAmt = 0;
        let totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, grandTotal = 0;

        data.forEach(charge => {
            const type = (charge.ChargesType || 'Other').trim();

            if (!chargesMap[type]) {
                chargesMap[type] = {
                    TotalAmount: 0,
                    SGSTAmt: 0,
                    CGSTAmt: 0,
                    IGSTAmt: 0,
                    TotalGSTAmt: 0,
                    GrandTotalAmt: 0
                };
            }

            chargesMap[type].TotalAmount += parseFloat(charge.TotalAmount) || 0;
            chargesMap[type].SGSTAmt += parseFloat(charge.SGSTAmt) || 0;
            chargesMap[type].CGSTAmt += parseFloat(charge.CGSTAmt) || 0;
            chargesMap[type].IGSTAmt += parseFloat(charge.IGSTAmt) || 0;
            chargesMap[type].TotalGSTAmt += parseFloat(charge.TotalGSTAmt) || 0;
            chargesMap[type].GrandTotalAmt += parseFloat(charge.GrandTotalAmt) || 0;

            // Summing category-wise
            const typeLower = type.trim().toLowerCase();
            if (typeLower === 'freight amount') {
                BasicFrightAmt += parseFloat(charge.TotalAmount) || 0;
            } else if (typeLower === 'fuel surcharge') {
                FSCAmt += parseFloat(charge.TotalAmount) || 0;
            } else {
                OtherAmt += parseFloat(charge.TotalAmount) || 0;
            }

            totalSGST += parseFloat(charge.SGSTAmt) || 0;
            totalCGST += parseFloat(charge.CGSTAmt) || 0;
            totalIGST += parseFloat(charge.IGSTAmt) || 0;
            totalGST += parseFloat(charge.TotalGSTAmt) || 0;
            grandTotal += parseFloat(charge.GrandTotalAmt) || 0;
        });

        return { BasicFrightAmt, FSCAmt, OtherAmt, totalSGST, totalCGST, totalIGST, totalGST, grandTotal, chargesMap };

    } catch (err) {
        console.error('Error fetching booking charges:', err.message);
        return null;
    }
}

function updateTotals_ib(totals) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toFixed(2);
    };

    setValue('totalQuantity', totals.totalQuantity || 0);
    setValue('totalChargeableWeight', totals.totalChargeableWeight || 0);
    setValue('totalFreight', totals.totalFreight);
    setValue('totalFSCAmt', totals.totalFSCAmt);
    setValue('totalOtherAmt', totals.totalOtherAmt);
    setValue('totalSGST', totals.totalSGST);
    setValue('totalCGST', totals.totalCGST);
    setValue('totalIGST', totals.totalIGST);
    setValue('totalGST', totals.totalGST);
    setValue('totalGrand', Math.round(totals.totalGrand));

    // ✅ Still update invoiceData (guard with parseFloat defaults)
    invoiceData.BasicAmount = formatAmount(totals.totalFreight) || 0;
    invoiceData.OtherAmount = (formatAmount(totals.totalFSCAmt) || 0) + (formatAmount(totals.totalOtherAmt) || 0);
    invoiceData.CGSTAmount = formatAmount(totals.totalCGST) || 0;
    invoiceData.SGSTAmount = formatAmount(totals.totalSGST) || 0;
    invoiceData.IGSTAmount = formatAmount(totals.totalIGST) || 0;
    invoiceData.TotalGSTAmount = formatAmount(totals.totalGST) || 0;
    invoiceData.GrandTotalAmount = formatAmount(Math.round(totals.totalGrand)) || 0;
}

async function updateInvoiceNumbers(invNo) {
    const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');

    const shipmentIds = [];

    // Step 1: Clear existing assignments
    const { error: clearError } = await supabaseClient
        .from('international_booking')
        .update({
            InvoiceStatus: false,
            InvoiceNumber: null
        })
        .eq('InvoiceNumber', invNo); // Corrected: Use eq for a single invoice number

    // Extract IDs from a hidden column or dataset
    rows.forEach(row => {
        const shipId = row.getAttribute('data-ship-id'); // Assuming you store the shipment ID here
        if (shipId) shipmentIds.push(parseInt(shipId));
    });
    // console.log('Shipment IDs to update:', shipmentIds);
    if (shipmentIds.length === 0) {
        console.warn('No shipment IDs found for invoice update.');
        return;
    }

    // console.log('Clearing previous invoice assignments for:', invNo);
    if (clearError) {
        console.error('Error clearing previous invoice assignments:', clearError.message);
        throw clearError;
    }
    // console.log('Previous invoice assignments cleared for:', invNo);

    // Step 2: Update new assignments
    const { error: updateError } = await supabaseClient
        .from('international_booking')
        .update({
            InvoiceStatus: true,
            InvoiceNumber: invNo,
            IsLocked: false,
            LockedBy: null,
            LockedAt: null
        })
        .in('id', shipmentIds);

    if (updateError) {
        console.error('Error updating invoice numbers:', updateError.message);
        throw updateError;
    }

    // console.log('Invoice numbers updated for shipments:', shipmentIds);
}

async function loadInvoiceBookings(invoiceNo) {
    if (!invoiceNo) {
        alert('Please enter a valid invoice number.');
        return;
    }

    showSpinner();

    let totals = {
        totalFreight: 0,
        totalFSCAmt: 0,
        totalOtherAmt: 0,
        totalSGST: 0,
        totalCGST: 0,
        totalIGST: 0,
        totalGST: 0,
        totalGrand: 0
    };

    let mergedChargesMap = {};

    try {
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('InvoiceNumber', invoiceNo)
            .order('BookedDate', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No shipments found for this invoice.');
            return;
        }

        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        tableBody.innerHTML = '';

        createPendingShipmentTableHeaderAndFooter_ib();// Create header and footer if not already done

        for (const invoice of data) {
            const charges = await getBookingCharges(invoice.id);
            if (!charges || charges.grandTotal <= 0) continue;

            // Update totals
            totals.totalFreight += charges.BasicFrightAmt;
            totals.totalFSCAmt += charges.FSCAmt;
            totals.totalOtherAmt += charges.OtherAmt;
            totals.totalSGST += charges.totalSGST;
            totals.totalCGST += charges.totalCGST;
            totals.totalIGST += charges.totalIGST;
            totals.totalGST += charges.totalGST;
            totals.totalGrand += charges.grandTotal;

            // Merge charge types
            for (const [type, amounts] of Object.entries(charges.chargesMap)) {
                const normalizedType = toProperCase(type.trim().toLowerCase());

                if (!mergedChargesMap[normalizedType]) {
                    mergedChargesMap[normalizedType] = {
                        TotalAmount: 0,
                        SGSTAmt: 0,
                        CGSTAmt: 0,
                        IGSTAmt: 0,
                        TotalGSTAmt: 0,
                        GrandTotalAmt: 0
                    };
                }

                mergedChargesMap[normalizedType].TotalAmount += amounts.TotalAmount;
                mergedChargesMap[normalizedType].SGSTAmt += amounts.SGSTAmt;
                mergedChargesMap[normalizedType].CGSTAmt += amounts.CGSTAmt;
                mergedChargesMap[normalizedType].IGSTAmt += amounts.IGSTAmt;
                mergedChargesMap[normalizedType].TotalGSTAmt += amounts.TotalGSTAmt;
                mergedChargesMap[normalizedType].GrandTotalAmt += amounts.GrandTotalAmt;
            }

            // Render row
            const row = document.createElement('tr');
            row.setAttribute('data-ship-id', invoice.id);
            row.innerHTML = `
                <td>${invoice.DocketNo || ''}</td>
                <td>${formatDate(invoice.BookedDate) || ''}</td>
                <td>${invoice.MovementType || ''}</td>
                <td>${invoice.TransitType || ''}</td>
                <td>${invoice.ModeType || ''}</td>
                <td>${invoice.Origin || ''}</td>
                <td>${invoice.Destination || ''}</td>
                <td>${invoice.NoofUnit || ''}</td>
                <td>${invoice.AcutalWeight || ''} ${invoice.UOMType || ''}</td>
                <td>${invoice.ChargableWeight || ''} ${invoice.UOMType || ''}</td>
                <td>${charges.BasicFrightAmt.toFixed(2)}</td>
                <td>${charges.FSCAmt.toFixed(2)}</td>
                <td>${charges.OtherAmt.toFixed(2)}</td>
                <td>${charges.totalSGST.toFixed(2)}</td>
                <td>${charges.totalCGST.toFixed(2)}</td>
                <td>${charges.totalIGST.toFixed(2)}</td>
                <td>${charges.totalGST.toFixed(2)}</td>
                <td>${charges.grandTotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)" disabled><i class="bi bi-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        }

        updateTotals(totals);
        renderChargesTable(mergedChargesMap);

    } catch (err) {
        console.error('Error loading linked bookings:', err.message);
        alert('Error loading bookings. Please try again.');
    } finally {
        hideSpinner();
    }
}

async function addSingleShipmentToInvoice(shipmentNo, invoiceNo) {
    showSpinner();

    try {
        // Fetch shipment details
        const { data, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('DocketNo', shipmentNo)
            .is('InvoiceNumber', null)
            .eq('IsLocked', false)
            .single();

        if (error || !data) {
            alert('Shipment not found or already locked.');
            return;
        }

        const charges = await getBookingCharges(data.id);
        if (!charges || charges.grandTotal <= 0) {
            alert('No valid charges for this shipment.');
            return;
        }

        // Lock the shipment and assign invoice number
        const { error: updateError } = await supabaseClient
            .from('international_booking')
            .update({
                IsLocked: true,
                LockedBy: UserLoginID,
                LockedAt: localtimeStamp
            })
            .eq('id', data.id);

        if (updateError) throw updateError;

        // Add to table
        const tableBody = document.getElementById('pendingShipmentTable').querySelector('tbody');
        const row = document.createElement('tr');
        row.setAttribute('data-ship-id', data.id);
        row.innerHTML = `
            <td>${data.DocketNo || ''}</td>
            <td>${formatDate(data.BookedDate) || ''}</td>
            <td>${data.MovementType || ''}</td>
            <td>${data.TransitType || ''}</td>
            <td>${data.ModeType || ''}</td>
            <td>${data.Origin || ''}</td>
            <td>${data.Destination || ''}</td>
            <td>${data.NoofUnit || ''} ${data.UOMType || ''}</td>
            <td>${data.AcutalWeight || ''}</td>
            <td>${data.ChargableWeight || ''}</td>
            <td>${formatAmount(charges.BasicFrightAmt)}</td>
            <td>${formatAmount(charges.FSCAmt)}</td>
            <td>${formatAmount(charges.OtherAmt)}</td>
            <td>${formatAmount(charges.totalSGST)}</td>
            <td>${formatAmount(charges.totalCGST)}</td>
            <td>${formatAmount(charges.totalIGST)}</td>
            <td>${formatAmount(charges.totalGST)}</td>
            <td>${formatAmount(charges.grandTotal)}</td>
            <td><button class="btn btn-danger btn-sm delete-btn" onclick="removeRow(this)"><i class="bi bi-trash"></i></button></td>
        `;
        tableBody.appendChild(row);

        // ✅ Update totals from footer before adding new values
        const totals = {
            totalFreight: parseFloat(document.getElementById('totalFreight').textContent) + charges.BasicFrightAmt,
            totalFSCAmt: parseFloat(document.getElementById('totalFSCAmt').textContent) + charges.FSCAmt,
            totalOtherAmt: parseFloat(document.getElementById('totalOtherAmt').textContent) + charges.OtherAmt,
            totalSGST: parseFloat(document.getElementById('totalSGST').textContent) + charges.totalSGST,
            totalCGST: parseFloat(document.getElementById('totalCGST').textContent) + charges.totalCGST,
            totalIGST: parseFloat(document.getElementById('totalIGST').textContent) + charges.totalIGST,
            totalGST: parseFloat(document.getElementById('totalGST').textContent) + charges.totalGST,
            totalGrand: parseFloat(document.getElementById('totalGrand').textContent) + charges.grandTotal
        };

        // ✅ Now pass totals to updateTotals_ib
        await updateTotals_ib(totals);

        // Optionally refresh merged charges table
        await renderChargesTable(charges.chargesMap);


        alert('Shipment added successfully!');

    } catch (err) {
        console.error('Error adding shipment:', err.message);
        alert('Error adding shipment: ' + err.message);
    } finally {
        hideSpinner();
    }
}

async function unlockBooking_ib(userID) {
    if (!userID) {
        console.warn("No user ID provided. Cannot unlock booking.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("international_booking")
            .update({ IsLocked: false, LockedBy: null, LockedAt: null }) // Also clear lock metadata
            .eq("LockedBy", userID);

        if (error) {
            console.error("Failed to unlock booking:", error.message);
        } else {
            // console.log(`Booking(s) unlocked successfully for user ID: ${userID}`);
        }
    } catch (err) {
        console.error("Unexpected error during unlock:", err);
    }
}

// Function to create table header & footer dynamically
async function createPendingShipmentTableHeaderAndFooter_ib() {
    const headerCols = [
        "Docket<br>No",
        "Booked<br>Date",
        "Movement<br>Type",
        "Transit<br>Type",
        "Mode<br>Type",
        "Origin",
        "Destination",
        "No.<br>of Units",
        "Actual<br>Weight",
        "Chargeable<br>Weight",
        "Basic<br>Freight",
        "FSC<br>Amount",
        "Other<br>Amount",
        "SGST<br>Amount",
        "CGST<br>Amount",
        "IGST<br>Amount",
        "Total GST<br>Amount",
        "Grand Total<br>Amount",
        "Action"
    ];

    const footerTotals = [
        { colspan: 10, label: "Totals:", align: "text-end" },
        { id: "totalFreight" },
        { id: "totalFSCAmt" },
        { id: "totalOtherAmt" },
        { id: "totalSGST" },
        { id: "totalCGST" },
        { id: "totalIGST" },
        { id: "totalGST" },
        { id: "totalGrand" },
        { empty: true }
    ];

    const table = document.getElementById("pendingShipmentTable");

    // Remove old head/foot if exists
    const oldHead = table.querySelector("thead");
    const oldFoot = table.querySelector("tfoot");
    if (oldHead) oldHead.remove();
    if (oldFoot) oldFoot.remove();

    // Create THEAD
    const thead = document.createElement("thead");
    thead.classList.add("table-light");

    const headRow = document.createElement("tr");
    headerCols.forEach(text => {
        const th = document.createElement("th");
        th.innerHTML = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.prepend(thead);

    // Create TFOOT
    const tfoot = document.createElement("tfoot");
    tfoot.classList.add("table-light");

    const footRow = document.createElement("tr");
    footRow.id = "totalsRow";

    footerTotals.forEach(item => {
        const th = document.createElement("th");
        if (item.colspan) th.colSpan = item.colspan;
        if (item.label) th.textContent = item.label;
        if (item.id) {
            th.id = item.id;
            th.classList.add("text-end");
            th.textContent = "0.00";
        }
        if (item.align) th.classList.add(item.align);
        if (item.empty) th.textContent = "";
        footRow.appendChild(th);
    });

    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
}

function removeRow(button) {
    const row = button.closest('tr');
    if (!row) return;

    // Get the shipment ID
    const shipId = row.getAttribute('data-ship-id');
    console.log('Removing row for Shipment ID:', shipId);
    if (shipId) {
        // Optional: Remove from lockedBookingIds if you maintain this array
        const index = lockedBookingIds.indexOf(parseInt(shipId));
        if (index !== -1) {
            lockedBookingIds.splice(index, 1);
        }

        // Optional: Unlock the record in the database
        unlockShipmentRecord(shipId);
    }

    // Get the amounts from the row
    const freightAmt = parseFloat(row.cells[10].textContent) || 0;
    const fscAmt = parseFloat(row.cells[11].textContent) || 0;
    const otherAmt = parseFloat(row.cells[12].textContent) || 0;
    const sgstAmt = parseFloat(row.cells[13].textContent) || 0;
    const cgstAmt = parseFloat(row.cells[14].textContent) || 0;
    const igstAmt = parseFloat(row.cells[15].textContent) || 0;
    const gstAmt = parseFloat(row.cells[16].textContent) || 0;
    const grandAmt = parseFloat(row.cells[17].textContent) || 0;

    // Subtract from totals
    document.getElementById('totalFreight').textContent = (parseFloat(document.getElementById('totalFreight').textContent) - freightAmt).toFixed(2);
    document.getElementById('totalFSCAmt').textContent = (parseFloat(document.getElementById('totalFSCAmt').textContent) - fscAmt).toFixed(2);
    document.getElementById('totalOtherAmt').textContent = (parseFloat(document.getElementById('totalOtherAmt').textContent) - otherAmt).toFixed(2);
    document.getElementById('totalSGST').textContent = (parseFloat(document.getElementById('totalSGST').textContent) - sgstAmt).toFixed(2);
    document.getElementById('totalCGST').textContent = (parseFloat(document.getElementById('totalCGST').textContent) - cgstAmt).toFixed(2);
    document.getElementById('totalIGST').textContent = (parseFloat(document.getElementById('totalIGST').textContent) - igstAmt).toFixed(2);
    document.getElementById('totalGST').textContent = (parseFloat(document.getElementById('totalGST').textContent) - gstAmt).toFixed(2);
    document.getElementById('totalGrand').textContent = (parseFloat(document.getElementById('totalGrand').textContent) - grandAmt).toFixed(2);

    // Remove row from table
    row.remove();
}