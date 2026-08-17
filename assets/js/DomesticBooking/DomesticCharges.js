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

    const tbody = document.querySelector('#freightTable tbody');

    const docketNoValue = docketNo.value.trim();

    const chargesType = chargesTypeInput.value.trim();

    const freightAmountValue =
        parseFloat(freightAmount.value) || 0;

    const chargeableWeight =
        parseFloat(document.getElementById('chargeableWeight').value) || 0;

    const uOMType =
        document.getElementById('uOMType').value;

    // =========================
    // Validation
    // =========================

    if (!docketNoValue) {
        return alert('Docket No cannot be empty!');
    }

    if (!chargesType) {
        return alert('Charges Type cannot be empty!');
    }

    if (!freightAmountValue) {
        return alert('Freight Amount cannot be empty!');
    }

    // =========================
    // FSC + HSN
    // =========================

    const fscData =
        await isFSCApplicable(chargesType);

    const isFSC =
        fscData.isApplicable;

    const freightHSN =
        fscData.hsn_code || hsnNumber.value;

    // =========================
    // Tax
    // =========================

    const taxID =
        partyDefaultTax.value.trim() || 1;

    const taxes =
        await getTaxRatesById(taxID);

    const taxCalc =
        calculateTaxes(freightAmountValue, taxes);

    // =========================
    // Quantity
    // =========================

    const quantityDisplay =
        chargesType.includes('Freight')
            ? `${chargeableWeight} ${uOMType}`
            : '1 Nos';

    // =========================
    // Fuel Surcharge
    // =========================

    if (chargesType === 'Fuel Surcharge') {

        await recalcFSC();

        clearFreightInputs();

        return;
    }

    // =========================
    // Create Row
    // =========================

    const row = document.createElement('tr');

    row.dataset.type = 'freight';

    row.dataset.fscApplicable =
        isFSC ? 'true' : 'false';

    row.dataset.amount =
        freightAmountValue;

    row.dataset.rowState = 'new';

    row.innerHTML = `
        <td>${chargesType}</td>
        <td>${freightHSN}</td>
        <td>${remarksDetails.value}</td>

        <td class="text-end">
            ${taxCalc.totalRate}%
        </td>

        <td class="text-end" data-qty="${chargeableWeight}">
            ${quantityDisplay}
        </td>

        <td class="text-end">
            ${freightAmountValue.toFixed(2)}
        </td>

        <td class="text-end">
            ${freightAmountValue.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.sgstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.cgstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.igstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.totalGstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.grandTotal.toFixed(2)}
        </td>

        <td class="text-center">
            <button type="button"
                class="btn btn-sm btn-danger delete-row">
                Delete
            </button>
        </td>

        <td class="d-none">
            ${taxID}
        </td>

        <td class="d-none">
            ${isFSC ? 'Yes' : 'No'}
        </td>
    `;

    tbody.appendChild(row);

    await recalcFSC();

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

async function loadFreightCharges() {
    const awbNoValue = freightElements.docketNo.value.trim();
    const tempFormID = freightElements.tempFormID.value.trim(); // Assuming this is a hidden input field
    console.log("Loading charges for Temp Form ID:", tempFormID, "AWB No:", awbNoValue);
    if (!tempFormID) return alert('Please select a valid Temp Form ID!');
    if (!awbNoValue) return alert('Please select a valid AWB No!');

    freightElements.freightTable.innerHTML = ''; // Clear table

    try {
        const { data, error } = await supabaseClient
            .from('DomesticBookingCharges')
            .select('*')
            .eq('ID_DB  ', tempFormID);

        if (error) throw error;

        for (const item of data) {

            const row = document.createElement('tr');

            const fscData = await isFSCApplicable(item.ChargesType);
            const isFSC = fscData.isApplicable;

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
        <td class="d-none">${item.TaxID}</td>
       <td class="d-none">${isFSC ? 'Yes' : 'No'}</td>
    `;

            freightElements.freightTable.appendChild(row);
        }
        toggleEditMode(true);
        recalcTotals();
    } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to load charges 1: ' + error.message);
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

// ======================================================
// FSC RECALCULATION
// ======================================================
async function recalcFSC() {

    const tbody =
        document.querySelector('#freightTable tbody');

    if (!tbody) return;

    let totalBase = 0;

    // =========================
    // Get FSC Configuration
    // =========================
    const fsc = await getFSCCharges({
        partyCode:
            document.getElementById('partyCode')
                ?.value.trim(),

        carrierCode:
            document.getElementById('carrierCode')
                ?.value.trim(),

        movementType:
            document.getElementById('movementTypeI')
                ?.value.trim(),

        modeType:
            document.getElementById('modeTypeI')
                ?.value.trim(),

        bookingDate:
            document.getElementById('bookedDate')
                ?.value.trim()
    });

    // =========================
    // FSC Percentage
    // =========================
    let fscPercent =
        Number(fsc?.fuelSurcharge || 0);

    // Manual FSC Override
    if (Number(fscPercentManual) > 0) {
        fscPercent = Number(fscPercentManual);
    }

    // Reset Manual Override
    fscPercentManual = 0;

    // =========================
    // Remove Existing FSC Row
    // + Calculate FSC Base
    // =========================
    tbody.querySelectorAll('tr').forEach(row => {

        const chargeName =
            row.children[0]
                ?.innerText
                ?.trim();

        const fscApplicable =
            row.children[13]
                ?.innerText
                ?.trim()
                ?.toLowerCase();

        // Remove Existing FSC Row
        if (chargeName === 'Fuel Surcharge') {
            row.remove();
            return;
        }

        // Only FSC Applicable Rows
        if (fscApplicable !== 'yes') return;

        const basicAmt = parseFloat(
            row.children[5]
                ?.innerText
                ?.replace(/,/g, '')
                ?.replace(/[^\d.-]/g, '')
        ) || 0;

        totalBase += basicAmt;

        console.log(
            `Adding ${basicAmt} to FSC base from row: ${chargeName}`
        );
    });

    // =========================
    // Stop if Invalid
    // =========================
    if (totalBase <= 0 || fscPercent <= 0) {

        recalcTotals();
        return;
    }

    console.log(
        'Total Base for FSC:',
        totalBase
    );

    // =========================
    // FSC Amount
    // =========================
    const fscAmount =
        (totalBase * fscPercent) / 100;

    // =========================
    // Party Tax ID
    // =========================
    const partyCode =
        document.getElementById('partyCode')
            ?.value.trim();

    const taxID =
        await fetchDefaultTax(partyCode);

    if (!taxID) {

        console.warn(
            'Party Default Tax ID not found'
        );

        recalcTotals();
        return;
    }

    // =========================
    // Tax Details
    // =========================
    const taxes =
        await getTaxRatesById(taxID);

    // =========================
    // GST Calculation
    // =========================
    const taxCalc =
        calculateTaxes(fscAmount, taxes);

    // =========================
    // FSC HSN
    // =========================
    const fscHSN =
        fsc?.hsn_code ||
        await getFSCHSNFromDropdown();

    // =========================
    // Create FSC Row
    // =========================
    const fscRow =
        document.createElement('tr');

    fscRow.dataset.type = 'fsc';

    fscRow.innerHTML = `
        <td>Fuel Surcharge</td>

        <td>${fscHSN || ''}</td>

        <td>
            ${fsc?.description || `Fuel Surcharge ${fscPercent}%`}
        </td>

        <td class="text-end">
            ${taxCalc.totalRate.toFixed(2)}%
        </td>

        <td class="text-end">
            1 Nos
        </td>

        <td class="text-end">
            ${fscAmount.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.sgstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.cgstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.igstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.totalGstAmt.toFixed(2)}
        </td>

        <td class="text-end">
            ${taxCalc.grandTotal.toFixed(2)}
        </td>

        <td class="text-center">
            <button
                type="button"
                class="btn btn-sm btn-danger delete-row">
                Delete
            </button>
        </td>

        <td class="d-none">
            ${taxID}
        </td>

        <td class="d-none">
            No
        </td>
    `;

    // =========================
    // Append FSC Row
    // =========================
    tbody.appendChild(fscRow);

    // =========================
    // Recalculate Totals
    // =========================
    recalcTotals();
}

chargesTypeInput.addEventListener('change', (event) => {

    // Existing FOV Modal
    loadFOVModal(event);

    // Fuel Surcharge
    loadFSCModal(event);
});