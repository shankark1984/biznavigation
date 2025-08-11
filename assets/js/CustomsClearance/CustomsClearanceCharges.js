// Your parsing function to extract tax rates from a string
function parseTaxPercentages(taxString) {
    const taxes = { cgst: 0, sgst: 0, igst: 0 };
    const patterns = {
        cgst: /CGST\s*(\d+(\.\d+)?)%/i,
        sgst: /SGST\s*(\d+(\.\d+)?)%/i,
        igst: /IGST\s*(\d+(\.\d+)?)%/i
    };

    for (const [tax, pattern] of Object.entries(patterns)) {
        const match = taxString.match(pattern);
        if (match) taxes[tax] = parseFloat(match[1]);
    }
    return taxes;
}

// Your helper function to calculate tax amounts based on rates
function calculateTaxes(amount, { cgst, sgst, igst }) {
    const sgstAmt = (amount * sgst) / 100;
    const cgstAmt = (amount * cgst) / 100;
    const igstAmt = (amount * igst) / 100;
    const totalGstAmt = sgstAmt + cgstAmt + igstAmt;
    const grandTotal = amount + totalGstAmt;
    console.log('Tax Calculation:', (cgst + sgst + igst).toFixed(2))
    return {
        sgstAmt,
        cgstAmt,
        igstAmt,
        totalGstAmt,
        grandTotal,
        totalRate: (cgst + sgst + igst).toFixed(2)
    };
}

document.getElementById('addChargesRow').addEventListener('click', function () {
    const chargesType = document.getElementById('chargesTypeInput').value.trim();
    const hsnNumber = document.getElementById('hsnNumber').value.trim();
    const amountValue = parseFloat(document.getElementById('freightAmount').value);
    const remarks = document.getElementById('remarksDetails').value.trim();
    const taxInput = document.getElementById('partyDefaultTax').value.trim(); // This should contain a string like "CGST 9%, SGST 9%"
    const currency = document.getElementById('currencyCode').value.trim().toUpperCase();

    if (!chargesType) {
        alert('Please enter Charges Type.');
        return;
    }
    if (!hsnNumber) {
        alert('Please enter HSN Number.');
        return;
    }
    if (isNaN(amountValue) || amountValue <= 0) {
        alert('Please enter a valid Amount.');
        return;
    }
    if (!taxInput) {
        alert('Please enter/select a valid Tax Rate.');
        return;
    }
    if (!currency) {
        alert('Currency code is required.');
        return;
    }

    // Parse tax rates from the taxInput string
    const taxRates = parseTaxPercentages(taxInput);

    // Calculate tax amounts
    const taxAmounts = calculateTaxes(amountValue, taxRates);

    const quantity = 1;  // default quantity, can be made dynamic if needed

    // Create table row
    const tbody = document.querySelector('#chargesTable tbody');
    const tr = document.createElement('tr');

    // Compose tax rate display string based on parsed taxes
    const taxRateDisplay = [];
    if (taxRates.cgst) taxRateDisplay.push(`CGST ${taxRates.cgst}%`);
    if (taxRates.sgst) taxRateDisplay.push(`SGST ${taxRates.sgst}%`);
    if (taxRates.igst) taxRateDisplay.push(`IGST ${taxRates.igst}%`);
    const taxType = taxRateDisplay.join(' / ');
    const totalRate = (taxRates.cgst + taxRates.sgst + taxRates.igst).toFixed(2);


    tr.innerHTML = `
      <td>${chargesType}</td>
      <td>${hsnNumber}</td>
      <td>${remarks}</td>
      <td class="text-end">${totalRate}%</td>
      <td class="text-end">${quantity}</td>
      <td class="text-end">${amountValue.toFixed(2)}</td>
      <td class="text-end">${taxAmounts.sgstAmt.toFixed(2)}</td>
      <td class="text-end">${taxAmounts.cgstAmt.toFixed(2)}</td>
      <td class="text-end">${taxAmounts.igstAmt.toFixed(2)}</td>
      <td class="text-end">${taxAmounts.totalGstAmt.toFixed(2)}</td>
      <td class="text-end">${taxAmounts.grandTotal.toFixed(2)}</td>
      <td><button type="button" class="btn btn-sm btn-danger btn-delete-row">Delete</button></td>
      <td class="hide-col-13">${taxType}</td>
    `;

    tbody.appendChild(tr);

    // Clear inputs 
    document.getElementById('chargesTypeInput').value = '';
    document.getElementById('hsnNumber').value = '';
    document.getElementById('freightAmount').value = '';
    document.getElementById('remarksDetails').value = '';
    document.getElementById('partyDefaultTax').value = '';

    updateTotals();

    tr.querySelector('.btn-delete-row').addEventListener('click', function () {
        tr.remove();
        updateTotals();
    });
});

function updateTotals() {
    const tbody = document.querySelector('#chargesTable tbody');
    let totalFreight = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let totalGrand = 0;

    tbody.querySelectorAll('tr').forEach(row => {
        totalFreight += parseFloat(row.cells[5].textContent) || 0;
        totalSGST += parseFloat(row.cells[6].textContent) || 0;
        totalCGST += parseFloat(row.cells[7].textContent) || 0;
        totalIGST += parseFloat(row.cells[8].textContent) || 0;
        totalGST += parseFloat(row.cells[9].textContent) || 0;
        totalGrand += parseFloat(row.cells[10].textContent) || 0;
    });

    document.getElementById('totalFreight').textContent = totalFreight.toFixed(2);
    document.getElementById('totalSGST').textContent = totalSGST.toFixed(2);
    document.getElementById('totalCGST').textContent = totalCGST.toFixed(2);
    document.getElementById('totalIGST').textContent = totalIGST.toFixed(2);
    document.getElementById('totalGST').textContent = totalGST.toFixed(2);
    document.getElementById('totalGrand').textContent = totalGrand.toFixed(2);
}

async function saveChargesTableToSupabase(parentId, jobID) {
    const table = document.getElementById('chargesTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Map out new records
    const records = rows.map(tr => {
        const cells = tr.querySelectorAll('td');
        // Use index 13 for hidden TaxID cell if used, or tr.dataset.taxId for attribute approach
        return {
            JobID: jobID,
            ID_CC: parentId ? Number(parentId) : null,
            ChargesType: cells[0].textContent.trim(),
            HSNCode: cells[1].textContent.trim(),
            Remarks: cells[2].textContent.trim(),
            TaxRate: cells[3].textContent.trim(),
            Quantity: Number(cells[4].textContent.trim()) || 1,
            PerQtyAmt: Number(cells[5].textContent.trim()) || 0,
            TotalAmount: Number(cells[5].textContent.trim()) || 0,
            SGSTAmt: Number(cells[6].textContent.trim()) || 0,
            CGSTAmt: Number(cells[7].textContent.trim()) || 0,
            IGSTAmt: Number(cells[8].textContent.trim()) || 0,
            TotalGSTAmt: Number(cells[9].textContent.trim()) || 0,
            GrandTotalAmt: Number(cells[10].textContent.trim()) || 0,
            TaxID: cells[12]?.textContent.trim() || 0, // or tr.dataset.taxId
            created_by: UserLoginID,
            created_at: localtimeStamp
        };
    });

    try {
        // 1. Delete previous charges for this parent/job
        const { error: deleteError } = await supabaseClient
            .from('CustomsClearanceCharges')
            .delete()
            .eq('ID_CC', parentId);

        if (deleteError) throw deleteError;
        if (!records.length) {
            // alert("No charges to save!");
            return;
        }
        // 2. Insert new records
        const { data, error } = await supabaseClient
            .from('CustomsClearanceCharges')
            .insert(records);

        if (error) throw error;

        // alert("Charges saved!");
    } catch (err) {
        console.error("Error saving charges:", err);
        alert("Error saving charges: " + (err.message || err));
    }
}

async function loadChargesByJobID(jobID) {
    if (!jobID) {
        console.warn('JobID is required to load charges');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearanceCharges')
            .select('*')
            .eq('JobID', jobID)
            .order('ID_CC', { ascending: true });  // Or order as needed

        if (error) {
            console.error('Error fetching charges:', error);
            return;
        }

        // Reference to table tbody
        const tbody = document.querySelector('#chargesTable tbody');
        tbody.innerHTML = ''; // Clear current rows

        data.forEach(charge => {
            // Create a new row <tr>
            const tr = document.createElement('tr');

            // Fill columns as per your table structure. Example assuming columns:

            tr.innerHTML = `
        <td>${charge.ChargesType || ''}</td>
        <td>${charge.HSNCode || ''}</td>
        <td>${charge.Remarks || ''}</td>
        <td>${charge.TaxRate || ''}</td>
        <td>${charge.Quantity || ''}</td>
        <td class="text-end">${charge.PerQtyAmt?.toFixed(2) || '0.00'}</td>
        <td class="text-end">${charge.SGSTAmt?.toFixed(2) || '0.00'}</td>
        <td class="text-end">${charge.CGSTAmt?.toFixed(2) || '0.00'}</td>
        <td class="text-end">${charge.IGSTAmt?.toFixed(2) || '0.00'}</td>
        <td class="text-end">${charge.TotalGSTAmt?.toFixed(2) || '0.00'}</td>
        <td class="text-end">${charge.GrandTotalAmt?.toFixed(2) || '0.00'}</td>
        <td><button type="button" class="btn btn-sm btn-danger btn-delete-row" disabled>Delete</button></td>
        <td class="hide-col-13">${charge.TaxID || ''}</td>
      `;
            addChargesRow.disabled = true;
            tbody.appendChild(tr);

            // Optional: bind delete button event if needed
            tr.querySelector('.btn-delete-row').addEventListener('click', () => {
                tr.remove();
                updateTotals();  // if you have a totals update function
            });
        });

        updateTotals(); // Update totals based on loaded charges if you have this function

    } catch (err) {
        console.error('Unexpected error loading charges:', err);
    }
}

function resetTotalsRow() {
    document.getElementById('totalFreight').textContent = "0.00";
    document.getElementById('totalSGST').textContent = "0.00";
    document.getElementById('totalCGST').textContent = "0.00";
    document.getElementById('totalIGST').textContent = "0.00";
    document.getElementById('totalGST').textContent = "0.00";
    document.getElementById('totalGrand').textContent = "0.00";
}