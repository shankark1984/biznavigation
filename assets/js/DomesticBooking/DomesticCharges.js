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
    const chargeableWeightInput = document.getElementById('chargeableWeight');
    const chargeableWeight = parseFloat(chargeableWeightInput?.value) || 0;

    const uOMType = document.getElementById('uOMType')?.value || '';

    // console.log("chargeableWeight", chargeableWeight + uOMType);
    // Validation
    if (!docketNoValue) return alert('Docket no cannot be empty!');
    if (!chargesType) return alert('Charges Type cannot be empty!');
    if (!freightAmountValue) return alert('Freight Amount cannot be empty!');
    const taxID = partyDefaultTax.value.trim() || 1;
    console.log("Selected tax ID:", taxID);

    const taxes = await getTaxRatesById(taxID);
    // const taxID = taxDetails?.taxId;
    console.log("Fetched tax details:", taxes);

    if (!taxID) return alert('Tax details not found!');

    const taxCalculations = calculateTaxes(freightAmountValue, taxes);
    const isFreight = chargesType.includes('Freight');

    let quantityDisplay = isFreight
        ? `${chargeableWeight} ${uOMType}`
        : '1 Nos';

    let perQty = freightAmountValue;

    if (isFreight) {
        if (!chargeableWeight || chargeableWeight <= 0) {
            return alert("Chargeable weight must be greater than 0");
        }
        perQty = freightAmountValue / chargeableWeight;
    }


    const newRow = document.createElement('tr');
    newRow.dataset.rowState = "new";
    newRow.innerHTML = `
        <td>${chargesType}</td>
        <td>${hsnNumber.value}</td>
        <td>${remarksDetails.value}</td>
        <td class="text-end">${taxCalculations.totalRate}%</td>
        <td class="text-end" data-qty="${isFreight ? chargeableWeight : 1}">${quantityDisplay}</td>
        <td class="text-end">${(perQty).toFixed(2)}</td>
        <td class="text-end">${freightAmountValue.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.sgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.cgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.igstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.totalGstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.grandTotal.toFixed(2)}</td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
        </td>
        <td class="d-none">${partyDefaultTax.value}</td>
        <td class="d-none">${taxID}</td>
    `;

    freightElements.freightTable.appendChild(newRow);
    recalcTotals();
    clearFreightInputs();
}

freightElements.freightTable.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-row')) return;

    const row = e.target.closest('tr');
    if (!confirm("Remove this row?")) return;

    if (row.dataset.rowState === "old") {
        row.dataset.rowState = "deleted";
        row.style.display = "none";
    } else {
        row.remove(); // new rows removed directly
    }

    recalcTotals();
});

async function saveFreightCharges(masterID) {

    const rows = Array.from(freightElements.freightTable.querySelectorAll('tr'));

    const insertData = [];
    const deleteIDs = [];

    saveButton.disabled = true; // Disable save until next change
    modifyButton.disabled = false;
    reportButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    rows.forEach(row => {

        const state = row.dataset.rowState;
        const cells = row.querySelectorAll('td');

        // Handle deleted rows
        if (state === "deleted" && row.dataset.id) {
            deleteIDs.push(row.dataset.id);
            return;
        }

        // Handle new rows
        if (state === "new") {
            insertData.push({
                DocketNo: freightElements.docketNo.value.trim(),
                ID_DB: masterID,
                ChargesType: cells[0].textContent.trim(),
                HSNCode: cells[1].textContent.trim(),
                Remarks: cells[2].textContent.trim(),
                TaxRate: parseFloat(cells[3].textContent) || 0,
                Quantity: parseFloat(cells[4].dataset.qty) || 0,
                PerQtyAmt: parseFloat(cells[5].textContent) || 0,
                TotalAmount: parseFloat(cells[6].textContent) || 0,
                SGSTAmt: parseFloat(cells[7].textContent) || 0,
                CGSTAmt: parseFloat(cells[8].textContent) || 0,
                IGSTAmt: parseFloat(cells[9].textContent) || 0,
                TotalGSTAmt: parseFloat(cells[10].textContent) || 0,
                GrandTotalAmt: parseFloat(cells[11].textContent) || 0,
                TaxID: cells[14].textContent.trim(),
                created_by: UserLoginID,
                created_at: localtimeStamp
            });
        }
    });

    if (deleteIDs.length) {
        await supabaseClient
            .from('DomesticBookingCharges')
            .delete()
            .in('id', deleteIDs);
        rows.forEach(r => {
            if (r.dataset.rowState === "deleted")
                r.remove();
        });
    }

    if (insertData.length) {

        const { data, error } = await supabaseClient
            .from('DomesticBookingCharges')
            .insert(insertData)
            .select('id');

        if (error) {
            console.error("Insert error:", error);
            alert("Insert failed: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.warn("Insert returned no IDs");
            return;
        }

        let i = 0;
        rows.forEach(r => {
            if (r.dataset.rowState === "new") {
                r.dataset.rowState = "old";
                r.dataset.id = data[i]?.id || '';
                i++;
            }
        });
    }

};


async function loadFreightCharges(masterID) {

    const docketNoValue = freightElements.docketNo.value.trim();
    if (!masterID) return;
    if (!docketNoValue) return alert('Please select a valid Docket No!');

    const tbody = freightElements.freightTable;
    tbody.replaceChildren();

    try {
        const { data, error } = await supabaseClient
            .from('DomesticBookingCharges')
            .select('*')
            .eq('ID_DB', masterID);

        if (error) throw error;

        if (!data || data.length === 0) {
            recalcTotals();
            return;
        }

        data.forEach(item => {

            const row = document.createElement('tr');
            row.dataset.rowState = "old";
            row.dataset.id = item.id ? String(item.id) : '';

            row.innerHTML = `
                <td>${item.ChargesType || ''}</td>
                <td>${item.HSNCode || ''}</td>
                <td>${item.Remarks || ''}</td>
                <td class="text-end">${parseFloat(item.TaxRate || 0).toFixed(2)}%</td>
                <td class="text-end" data-qty="${item.Quantity}">${item.Quantity} ${item.UOM || ''}</td>
                <td class="text-end">${(item.PerQtyAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.TotalAmount || 0).toFixed(2)}</td>
                <td class="text-end">${(item.SGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.CGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.IGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.TotalGSTAmt || 0).toFixed(2)}</td>
                <td class="text-end">${(item.GrandTotalAmt || 0).toFixed(2)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-danger delete-row">Delete</button>
                </td>
                <td class="text-center d-none"">${getTaxTypeText(item)}</td>
                <td class="text-center d-none"">${item.TaxID || ''}</td>
            `;

            tbody.appendChild(row);
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

    if (item.TotalAmount > 0) {
        if (item.SGSTAmt)
            parts.push(`SGST ${((item.SGSTAmt / item.TotalAmount) * 100).toFixed(2)}%`);

        if (item.CGSTAmt)
            parts.push(`CGST ${((item.CGSTAmt / item.TotalAmount) * 100).toFixed(2)}%`);

        if (item.IGSTAmt)
            parts.push(`IGST ${((item.IGSTAmt / item.TotalAmount) * 100).toFixed(2)}%`);
    }

    return parts.join(' ') || 'No taxes';
}

function recalcTotals() {
    const rows = freightElements.freightTable.querySelectorAll('tr');
    const totals = { freight: 0, sgst: 0, cgst: 0, igst: 0, gst: 0, grand: 0 };

    rows.forEach(row => {

        if (row.dataset.rowState === "deleted") return;

        const cells = row.querySelectorAll('td');
        if (cells.length < 11) return;

        totals.freight += parseFloat(cells[6].textContent) || 0;
        totals.sgst += parseFloat(cells[7].textContent) || 0;
        totals.cgst += parseFloat(cells[8].textContent) || 0;
        totals.igst += parseFloat(cells[9].textContent) || 0;
        totals.gst += parseFloat(cells[10].textContent) || 0;
        totals.grand += parseFloat(cells[11].textContent) || 0;
    });

    Object.entries(freightElements.totalElements).forEach(([key, el]) => {
        el.textContent = totals[key].toFixed(2);
    });
}
