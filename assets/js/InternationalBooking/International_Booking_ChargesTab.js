// Cache DOM elements that are reused
const freightElements = {
    awbNo: document.getElementById('awbNo'),
    chargesTypeInput: document.getElementById('chargesTypeInput'),
    hsnNumber: document.getElementById('hsnNumber'),
    freightAmount: document.getElementById('freightAmount'),
    remarksDetails: document.getElementById('remarksDetails'),
    partyDefaultTax: document.getElementById('partyDefaultTax'),
    freightTable: document.querySelector('#freightTable tbody'),
    tempFormID: document.getElementById('tempFormID'),
    totalElements: {
        freight: document.getElementById('totalFreight'),
        sgst: document.getElementById('totalSGST'),
        cgst: document.getElementById('totalCGST'),
        igst: document.getElementById('totalIGST'),
        gst: document.getElementById('totalGST'),
        grand: document.getElementById('totalGrand')
    }
};

// Helper function to parse tax percentages
function parseTaxPercentages(taxString) {
    const taxes = { cgst: 0, sgst: 0, igst: 0 };
    const patterns = {
        cgst: /CGST\s*(\d+(\.\d+)?)%/,
        sgst: /SGST\s*(\d+(\.\d+)?)%/,
        igst: /IGST\s*(\d+(\.\d+)?)%/
    };

    for (const [tax, pattern] of Object.entries(patterns)) {
        const match = taxString.match(pattern);
        if (match) taxes[tax] = parseFloat(match[1]);
    }

    return taxes;
}

// Helper function to calculate tax amounts
function calculateTaxes(amount, { cgst, sgst, igst }) {
    const sgstAmt = (amount * sgst) / 100;
    const cgstAmt = (amount * cgst) / 100;
    const igstAmt = (amount * igst) / 100;
    const totalGstAmt = sgstAmt + cgstAmt + igstAmt;
    const grandTotal = amount + totalGstAmt;

    return {
        sgstAmt,
        cgstAmt,
        igstAmt,
        totalGstAmt,
        grandTotal,
        totalRate: (cgst + sgst + igst).toFixed(2)
    };
}

// Clear form inputs
function clearFreightInputs() {
    freightElements.chargesTypeInput.value = '';
    freightElements.hsnNumber.value = '';
    freightElements.freightAmount.value = '';
    freightElements.remarksDetails.value = '';
    freightElements.partyDefaultTax.value = '';
}

async function addFreightRow() {
    const {
        awbNo,
        chargesTypeInput,
        hsnNumber,
        freightAmount,
        remarksDetails,
        partyDefaultTax
    } = freightElements;

    const awbNoValue = awbNo.value.trim();
    const chargesType = chargesTypeInput.value.trim();
    const freightAmountValue = parseFloat(freightAmount.value) || 0;
    const chargeableWeight = parseFloat(document.getElementById('chargeableWeight').value);
    const uOMType = document.getElementById('uOMType').value;

    // console.log("chargeableWeight", chargeableWeight + uOMType);
    // Validation
    if (!awbNoValue) return alert('AWB No cannot be empty!');
    if (!chargesType) return alert('Charges Type cannot be empty!');
    if (!freightAmountValue) return alert('Freight Amount cannot be empty!');

    const taxes = parseTaxPercentages(partyDefaultTax.value);
    const taxCalculations = calculateTaxes(freightAmountValue, taxes);

    // determine quantity display
    let quantityDisplay;
    if (chargesType.includes('Freight')) {
        // assume these globals exist:
        //   - chargeableWeight  (e.g. 123.45)
        //   - uOMType           (e.g. "KG")
        quantityDisplay = `${chargeableWeight} ${uOMType}`;
    } else {
        quantityDisplay = '1 Nos';
    }

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${chargesType}</td>
        <td>${hsnNumber.value}</td>
        <td>${remarksDetails.value}</td>
        <td class="text-end">${taxCalculations.totalRate}%</td>
        <td class="text-end">${quantityDisplay}</td>
        <td class="text-end">${freightAmountValue.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.sgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.cgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.igstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.totalGstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.grandTotal.toFixed(2)}</td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
        </td>
        <td>${partyDefaultTax.value}</td>
    `;

    freightElements.freightTable.appendChild(newRow);
    recalcTotals();
    clearFreightInputs();
}

// Event delegation for delete button
freightElements.freightTable.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-row')) {
        e.target.closest('tr').remove();
        recalcTotals();
    }
});

async function saveFreightCharges() {
    const awbNoValue = freightElements.awbNo.value.trim();

    if (!awbNoValue) return alert('AWB No (Docket No) cannot be empty!');

    const rows = Array.from(freightElements.freightTable.querySelectorAll('tr'));
    if (!rows.length) return alert('No charges to save!');

    try {
        // Fetch existing charges in a single query
        const { data: existingData, error: fetchError } = await supabaseClient
            .from('InternationalBookingCharges')
            .select('ChargesType')
            .eq('ID_IB', freightElements.tempFormID.value.trim());


        if (fetchError) throw fetchError;

        const existingChargesTypes = new Set(existingData.map(x => x.ChargesType));
        const insertData = [];

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const chargesType = cells[0].textContent.trim();

            if (existingChargesTypes.has(chargesType)) {
                // console.log(`Skipping duplicate ChargesType: ${chargesType}`);
                continue;
            }

            const taxTypeText = cells[12].textContent.trim();
            const taxDetails = await fetchTaxDetails(taxTypeText);
            const tempFormID = document.getElementById('tempFormID')?.value; // Assuming this is a hidden input field

            insertData.push({
                DocketNo: awbNoValue,
                ChargesType: chargesType,
                ID_IB: tempFormID,
                Remarks: cells[2].textContent.trim(),
                HSNCode: cells[1].textContent.trim(),
                Quantity: cells[4].textContent.trim() || "0 Nos",
                PerQtyAmt: parseFloat(cells[5].textContent) || 0,
                TotalAmount: parseFloat(cells[5].textContent) || 0, // Quantity is always 1
                TaxID: taxDetails?.taxId || null,
                TaxRate: taxDetails?.taxRate || null,
                SGSTAmt: parseFloat(cells[6].textContent) || 0,
                CGSTAmt: parseFloat(cells[7].textContent) || 0,
                IGSTAmt: parseFloat(cells[8].textContent) || 0,
                TotalGSTAmt: parseFloat(cells[9].textContent) || 0,
                GrandTotalAmt: parseFloat(cells[10].textContent) || 0,
                created_by: userLoginID
            });
        }

        // if (!insertData.length) return console.log('No new charges to save (all are duplicates).');

        const { error } = await supabaseClient
            .from('InternationalBookingCharges')
            .insert(insertData);

        if (error) throw error;
        // console.log('Charges saved successfully!');
    } catch (error) {
        console.error('Error:', error.message);
        alert(error.message || 'An error occurred while saving charges.');
    }
}

async function loadFreightCharges() {
    const awbNoValue = freightElements.awbNo.value.trim();
    const tempFormID = freightElements.tempFormID.value.trim(); // Assuming this is a hidden input field
    if (!tempFormID) return alert('Please select a valid Temp Form ID!');
    if (!awbNoValue) return alert('Please select a valid AWB No!');

    freightElements.freightTable.innerHTML = ''; // Clear table

    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingCharges')
            .select('*')
            .eq('ID_IB', tempFormID);

        if (error) throw error;

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.ChargesType || ''}</td>
                <td>${item.HSNCode || ''}</td>
                <td>${item.Remarks || ''}</td>
                <td class="text-end">${(item.TaxRate || 0).toFixed(2)}%</td>
                <td class="text-end">${item.Quantity || 0}</td>
                <td class="text-end">${(item.PerQtyAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.SGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.CGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.IGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.TotalGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.GrandTotalAmt || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
                </td>
                <td>${getTaxTypeText(item)}</td>
            `;
            freightElements.freightTable.appendChild(row);
        });
        toggleEditMode(true);
        recalcTotals();
    } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to load charges: ' + error.message);
    }
}

// Helper to reconstruct tax type text from stored values
function getTaxTypeText(item) {
    const parts = [];
    if (item.SGSTAmt) parts.push(`SGST ${((item.SGSTAmt / item.PerQtyAmt) * 100).toFixed(0)}%`);
    if (item.CGSTAmt) parts.push(`CGST ${((item.CGSTAmt / item.PerQtyAmt) * 100).toFixed(0)}%`);
    if (item.IGSTAmt) parts.push(`IGST ${((item.IGSTAmt / item.PerQtyAmt) * 100).toFixed(0)}%`);
    return parts.join(' ') || 'No taxes';
}

function recalcTotals() {
    const rows = freightElements.freightTable.querySelectorAll('tr');
    const totals = { freight: 0, sgst: 0, cgst: 0, igst: 0, gst: 0, grand: 0 };

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        // If we don’t have at least 11 data cells, skip this row
        if (cells.length < 11) return;

        totals.freight += parseFloat(cells[5].textContent) || 0;
        totals.sgst += parseFloat(cells[6].textContent) || 0;
        totals.cgst += parseFloat(cells[7].textContent) || 0;
        totals.igst += parseFloat(cells[8].textContent) || 0;
        totals.gst += parseFloat(cells[9].textContent) || 0;
        totals.grand += parseFloat(cells[10].textContent) || 0;
    });

    Object.entries(freightElements.totalElements).forEach(([key, el]) => {
        el.textContent = totals[key].toFixed(2);
    });
}

// Event listeners
document.getElementById('addFreightRow').addEventListener('click', addFreightRow);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeChange);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeOrPartyChange);

// Make sure freightElements.freightTable references the <tbody>:
const tbody = freightElements.freightTable;

tbody.addEventListener('click', async function (e) {
    if (!e.target.classList.contains('delete-row')) return;

    // 1. Identify the row and extract key values
    const row = e.target.closest('tr');
    const cells = row.querySelectorAll('td');

    // Assuming AWB No is in an input elsewhere:
    const docketNo = freightElements.awbNo.value.trim();
    const chargesType = cells[0].textContent.trim();

    if (!docketNo || !chargesType) {
        return alert('Missing DocketNo or ChargesType!');
    }

    // Confirm deletion
    if (!confirm(`Delete charge "${chargesType}" for AWB ${docketNo}?`)) {
        return;
    }

    try {
        // 2. Call Supabase delete
        const tempFormID = freightElements.tempFormID.value.trim(); // Assuming this is a hidden input field

        const { error } = await supabaseClient
            .from('InternationalBookingCharges')
            .delete()
            .match({ ID_IB: tempFormID, DocketNo: docketNo, ChargesType: chargesType });

        if (error) {
            console.error('Delete error:', error.message);
            return alert('Failed to delete charge. See console.');
        }

        // 3. On success, remove the row & recalc
        row.remove();
        recalcTotals();
        console.log(`Deleted ${chargesType} for AWB ${docketNo}`);
    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An unexpected error occurred during deletion.');
    }
});



