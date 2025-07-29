function addChargesRow() {
    const tbody = document.getElementById('chargesTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm" placeholder="Type"></td>
            <td><input type="text" class="form-control form-control-sm" placeholder="HSN No"></td>
            <td><input type="text" class="form-control form-control-sm" placeholder="Remarks"></td>
            <td><input type="number" class="form-control form-control-sm" step="0.01" placeholder="Tax %" onchange="recalculateRow(this)"></td>
            <td><input type="number" class="form-control form-control-sm" step="1" placeholder="Qty" onchange="recalculateRow(this)"></td>
            <td><input type="number" class="form-control form-control-sm" step="0.01" placeholder="Basic" onchange="recalculateRow(this)"></td>
            <td><input type="number" class="form-control form-control-sm" readonly></td>
            <td><input type="number" class="form-control form-control-sm" readonly></td>
            <td><input type="number" class="form-control form-control-sm" readonly></td>
            <td><input type="number" class="form-control form-control-sm" readonly></td>
            <td><input type="number" class="form-control form-control-sm" readonly></td>
            <td><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">Delete</button></td>
            <td class="d-none"><input type="text" class="form-control form-control-sm" value="GST"></td>
        `;
    tbody.appendChild(row);
}

function recalculateRow(element) {
    const row = element.closest('tr');
    const taxRate = parseFloat(row.cells[3].querySelector('input').value) || 0;
    const quantity = parseFloat(row.cells[4].querySelector('input').value) || 0;
    const basic = parseFloat(row.cells[5].querySelector('input').value) || 0;

    const totalBasic = quantity * basic;
    const gstAmount = (totalBasic * taxRate) / 100;

    const sgst = +(gstAmount / 2).toFixed(2);
    const cgst = +(gstAmount / 2).toFixed(2);
    const igst = 0; // adjust if IGST is applicable
    const totalGST = +(sgst + cgst + igst).toFixed(2);
    const grandTotal = +(totalBasic + totalGST).toFixed(2);

    row.cells[6].querySelector('input').value = sgst;
    row.cells[7].querySelector('input').value = cgst;
    row.cells[8].querySelector('input').value = igst;
    row.cells[9].querySelector('input').value = totalGST;
    row.cells[10].querySelector('input').value = grandTotal;
}