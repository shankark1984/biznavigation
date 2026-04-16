// Event listeners
document.getElementById('addFreightRow').addEventListener('click', addFreightRow);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeChange);
document.getElementById('chargesTypeInput').addEventListener('change', onChargeTypeOrPartyChange);

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
    const taxID = partyDefaultTax.value.trim();
    const taxes = await getTaxRatesById(taxID);;
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
        <td>${taxID}</td>
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
    const awbNoValue = freightElements.awbNo.value.trim();

    if (!awbNoValue) return alert('AWB No (Docket No) cannot be empty!');
    const tempFormID = document.getElementById('tempFormID')?.value; // Assuming this is a hidden input field
    console.log("tempFormID", tempFormID);

    try {
        if (!tempFormID) {
            alert("Temp Form ID missing!");
            return;
        }

        const { error: deleteError } = await supabaseClient
            .from('InternationalBookingCharges')
            .delete()
            .eq('ID_IB', tempFormID);

        if (deleteError) throw deleteError;

        const rows = Array.from(freightElements.freightTable.querySelectorAll('tr'));

        if (rows.length === 0) return alert('No rows to save!');
        const insertData = [];

        for (const row of rows) {
            const cells = row.querySelectorAll('td');

            insertData.push({
                DocketNo: awbNoValue,
                ID_IB: tempFormID,
                ChargesType: cells[0].textContent.trim(),
                HSNCode: cells[1].textContent.trim(),
                Remarks: cells[2].textContent.trim(),
                TaxRate: parseFloat(cells[3].textContent.trim().replace('%', '')) || 0, // Calculate tax rate, default to 0 if parsing fails.cells[3].textContent.trim().replace('%', '') || "0",
                Quantity: cells[4].textContent.trim() || "0 Nos",
                PerQtyAmt: Number(
                    (parseFloat(cells[5].textContent || 0) /
                        (parseFloat(cells[4].textContent.trim().split(' ')[0]) || 1)
                    ).toFixed(2)), // Calculate per quantity amount, default to 0 if parsing fails
                TotalAmount: parseFloat(cells[5].textContent) || 0, // Quantity is always 1
                SGSTAmt: parseFloat(cells[6].textContent) || 0,
                CGSTAmt: parseFloat(cells[7].textContent) || 0,
                IGSTAmt: parseFloat(cells[8].textContent) || 0,
                TotalGSTAmt: parseFloat(cells[9].textContent) || 0,
                GrandTotalAmt: parseFloat(cells[10].textContent) || 0,
                TaxID: cells[12].textContent.trim(), // default to 1 if tax details not found
                created_by: UserLoginID,
                created_at: localtimeStamp
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
                <td class="text-end">${(item.TotalAmount || 0).toFixed(2)}</td>
                <td class="text-end">${(item.SGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.CGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.IGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.TotalGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.GrandTotalAmt || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
                </td>
                <td>${item.TaxID}</td>
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

