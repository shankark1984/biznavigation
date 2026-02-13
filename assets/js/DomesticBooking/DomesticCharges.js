// Event listeners
document.getElementById('addFreightRow').addEventListener('click', addFreightRow);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeChange);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeOrPartyChange);

// Cache DOM elements that are reused
const freightElements = {
    docketNo: document.getElementById('docketNo'),
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
        docketNo,
        chargesTypeInput,
        hsnNumber,
        freightAmount,
        remarksDetails,
        partyDefaultTax
    } = freightElements;

    const docketNoValue = docketNo.value.trim();
    const chargesType = chargesTypeInput.value.trim();
    const freightAmountValue = parseFloat(freightAmount.value) || 0;
    const chargeableWeight = parseFloat(document.getElementById('chargeableWeight').value);
    const uOMType = document.getElementById('uOMType').value;

    // console.log("chargeableWeight", chargeableWeight + uOMType);
    // Validation
    if (!docketNoValue) return alert('Docket no cannot be empty!');
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
    if (!e.target.classList.contains('delete-row')) return;

    const row = e.target.closest('tr');

    if (!confirm("Remove this row?")) return;

    row.remove();
    recalcTotals();
});


async function saveFreightCharges() {

    const docketNo = freightElements.docketNo.value.trim();
    const tempFormID = freightElements.tempFormID.value.trim();

    if (!docketNo) return alert('Docket No cannot be empty!');

    const rows = Array.from(freightElements.freightTable.querySelectorAll('tr'));
    if (!rows.length) return alert('No charges to save!');

    try {

        /* STEP 1 : Delete old records */
        const { error: deleteError } = await supabaseClient
            .from('DomesticBookingCharges')
            .delete()
            .eq('ID_DB', tempFormID);

        if (deleteError) throw deleteError;

        /* STEP 2 : Build insert data from CURRENT TABLE VIEW */
        const insertData = [];

        for (const row of rows) {

            const cells = row.querySelectorAll('td');

            const taxTypeText = cells[12].textContent.trim();
            const taxDetails = await fetchTaxDetails(taxTypeText);

            const qty = parseFloat(cells[4].textContent) || 0;
            const rate = parseFloat(cells[5].textContent) || 0;

            insertData.push({
                DocketNo: docketNo,
                ChargesType: cells[0].textContent.trim(),
                ID_DB: tempFormID,
                Remarks: cells[2].textContent.trim(),
                HSNCode: cells[1].textContent.trim(),
                Quantity: qty,
                PerQtyAmt: rate,
                TotalAmount: qty * rate,
                TaxID: taxDetails?.taxId || null,
                TaxRate: taxDetails?.taxRate || null,
                SGSTAmt: parseFloat(cells[6].textContent) || 0,
                CGSTAmt: parseFloat(cells[7].textContent) || 0,
                IGSTAmt: parseFloat(cells[8].textContent) || 0,
                TotalGSTAmt: parseFloat(cells[9].textContent) || 0,
                GrandTotalAmt: parseFloat(cells[10].textContent) || 0,
                created_by: UserLoginID,
                created_at: localtimeStamp
            });
        }

        if (!insertData.length) return alert("Nothing to insert");

        /* STEP 3 : Insert */
        const { error: insertError } = await supabaseClient
            .from('DomesticBookingCharges')
            .insert(insertData);

        if (insertError) throw insertError;

        console.log("Charges replaced successfully");

    } catch (error) {
        console.error(error);
        alert(error.message || "Error saving charges");
    }
}


async function loadFreightCharges() {
    const docketNoValue = freightElements.docketNo.value.trim();
    const tempFormID = freightElements.tempFormID.value.trim(); // Assuming this is a hidden input field
    if (!tempFormID) return;
    if (!docketNoValue) return alert('Please select a valid Docket No!');

    freightElements.freightTable.innerHTML = ''; // Clear table

    try {
        const { data, error } = await supabaseClient
            .from('DomesticBookingCharges')
            .select('*')
            .eq('ID_DB', tempFormID);

        if (error) throw error;

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.ChargesType || ''}</td>
                <td>${item.HSNCode || ''}</td>
                <td>${item.Remarks || ''}</td>
                <td class="text-end">${parseFloat(item.TaxRate || 0).toFixed(2)}%</td>
                <td class="text-end">${item.Quantity || 0}</td>
                <td class="text-end">${(item.PerQtyAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.SGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.CGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.IGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.TotalGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.GrandTotalAmt || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-danger delete-row" disabled>Delete</button>
                </td>
                <td class="text-center d-none">${getTaxTypeText(item)}</td>
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
