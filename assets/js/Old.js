document.getElementById('addFreightRow').addEventListener('click', function () {
    const chargesType = document.getElementById('chargesTypeInput').value;
    const hsnNumber = document.getElementById('hsnNumber').value;
    const freightAmount = parseFloat(document.getElementById('freightAmount').value) || 0;
    const remarksDetails = document.getElementById('remarksDetails').value;
    const taxType = document.getElementById('partyDefaultTax').value; // Example: "CGST 9% SGST 9% IGST 0%"

    const quantity = 1; // Default Quantity

    // --- Extract CGST, SGST, IGST percentages ---
    let cgstPer = 0, sgstPer = 0, igstPer = 0;

    const cgstMatch = taxType.match(/CGST\s*(\d+(\.\d+)?)%/);
    const sgstMatch = taxType.match(/SGST\s*(\d+(\.\d+)?)%/);
    const igstMatch = taxType.match(/IGST\s*(\d+(\.\d+)?)%/);

    if (cgstMatch) {
        cgstPer = parseFloat(cgstMatch[1]);
    }
    if (sgstMatch) {
        sgstPer = parseFloat(sgstMatch[1]);
    }
    if (igstMatch) {
        igstPer = parseFloat(igstMatch[1]);
    }

    // --- Calculate taxes ---
    const sgstAmt = (freightAmount * sgstPer) / 100;
    const cgstAmt = (freightAmount * cgstPer) / 100;
    const igstAmt = (freightAmount * igstPer) / 100;
    const totalGstAmt = sgstAmt + cgstAmt + igstAmt;
    const grandTotal = freightAmount + totalGstAmt;

    const tableBody = document.querySelector('#freightTable tbody');
    const newRow = document.createElement('tr');

    newRow.innerHTML = `
        <td>${chargesType}</td>
        <td>${hsnNumber}</td>
        <td>${remarksDetails}</td>
        <td class="text-end">${(cgstPer + sgstPer + igstPer).toFixed(2)}%</td>
        <td class="text-end">${quantity}</td>
        <td class="text-end">${freightAmount.toFixed(2)}</td>
        <td class="text-end">${sgstAmt.toFixed(2)}</td>
        <td class="text-end">${cgstAmt.toFixed(2)}</td>
        <td class="text-end">${igstAmt.toFixed(2)}</td>
        <td class="text-end">${totalGstAmt.toFixed(2)}</td>
        <td class="text-end">${grandTotal.toFixed(2)}</td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
        </td>
    `;
    tableBody.appendChild(newRow);

    // Clear the form inputs
    document.getElementById('chargesTypeInput').value = '';
    document.getElementById('hsnNumber').value = '';
    document.getElementById('freightAmount').value = '';
    document.getElementById('remarksDetails').value = '';
    document.getElementById('partyDefaultTax').value = '';
});

// Event delegation for delete button
document.querySelector('#freightTable tbody').addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-row')) {
        e.target.closest('tr').remove();
    }
});
