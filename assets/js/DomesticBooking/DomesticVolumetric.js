/* -------------------- Packing type datalist -------------------- */
tabPackingType.addEventListener('change', () =>
    handleDatalistInsert(tabPackingType, 'tabPackingTypeSuggestions', 'PackingType')
);

/* -------------------- CFT CACHE -------------------- */
let cachedCFT = null;
let cachedTransit = null;

async function fetchCFTDetails() {
    try {
        const transitTypeInput = document.getElementById('transitTypeD')?.value;

        if (!transitTypeInput) return null;

        const TRANSIT_MAP = {
            'By Road': 'roadDomestic',
            'By Air': 'airDomestic',
            'By Courier': 'courierDomestic',
            'By Rail': 'railDomestic',
            'By Sea': 'seaDomestic'
        };

        const transitSelected = TRANSIT_MAP[transitTypeInput];
        if (!transitSelected) return null;

        const { data, error } = await supabaseClient
            .from('SettingParameters')
            .select('FieldValue')
            .eq('InputFieldID', transitSelected)
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (error) throw error;

        return Number(data?.FieldValue) || null;

    } catch (err) {
        console.error('Error fetching CFT:', err.message);
        return null;
    }
}

async function getCachedCFT() {
    const transit = document.getElementById('transitTypeD')?.value;
    if (!transit) return null;

    if (cachedTransit !== transit) {
        cachedTransit = transit;
        cachedCFT = await fetchCFTDetails();
    }
    return cachedCFT;
}

/* -------------------- DEBOUNCE -------------------- */
function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* -------------------- EVENT BINDING -------------------- */
const debouncedCalculate = debounce(calculateVolumetric, 300);

[
    'lengthCM', 'widthCM', 'heightCM',
    'quantityV', 'actualWtV', 'transitTypeD', 'uOMType'
].forEach(id => {
    document.getElementById(id)
        ?.addEventListener('input', debouncedCalculate);
});


/* -------------------- CALCULATION -------------------- */
async function calculateVolumetric() {
    try {
        const length = Number(document.getElementById('lengthCM')?.value);
        const width = Number(document.getElementById('widthCM')?.value);
        const height = Number(document.getElementById('heightCM')?.value);
        const quantity = Number(document.getElementById('quantityV')?.value);
        const actualWt = Number(document.getElementById('actualWtV')?.value);
        let uomVal = document.getElementById('uOMType')?.value?.trim().toLowerCase();

        if (![length, width, height, quantity, actualWt].every(v => v > 0)) return;

        const cft = await getCachedCFT();
        if (!cft) return;

        const actualWeight = actualWt * quantity;
        const volumetricWeight = (length * width * height) / cft;
        const totalVolumeWeight = volumetricWeight * quantity;

        const maxChargeableWeight = Math.max(actualWeight, totalVolumeWeight);

        document.getElementById('totalActualWtV').value = actualWeight.toFixed(2);
        document.getElementById('volumeWtV').value = volumetricWeight.toFixed(2);
        document.getElementById('totalVolumeWtV').value = totalVolumeWeight.toFixed(2);

        let chargeableWeight;

        switch (uomVal) {
            case 'kgs':
                chargeableWeight = Math.ceil(maxChargeableWeight);
                break;
            case 'tons':
                chargeableWeight = Math.ceil(maxChargeableWeight * 1000) / 1000;
                break;

            case 'gms':
                chargeableWeight = Math.round(maxChargeableWeight * 2) / 2;
                break;

            case 'fixed':
                chargeableWeight = maxChargeableWeight;
                break;

            default:
                chargeableWeight = maxChargeableWeight;
        }

        document.getElementById('chargeableWtV').value = chargeableWeight.toFixed(2);

    } catch (err) {
        console.error('Error calculating volumetric:', err.message);
    }
}

/* -------------------- ADD ROW -------------------- */
document.getElementById("addVolumetricRow").addEventListener("click", function () {

    const packingTypeRow = document.getElementById("tabPackingType").value.trim();
    const lengthRow = parseFloat(document.getElementById("lengthCM").value) || 0;
    const widthRow = parseFloat(document.getElementById("widthCM").value) || 0;
    const heightRow = parseFloat(document.getElementById("heightCM").value) || 0;
    const quantityRow = parseInt(document.getElementById("quantityV").value) || 0;
    const actualWtRow = parseFloat(document.getElementById("actualWtV").value) || 0;
    const totalActualWtRow = parseFloat(document.getElementById("totalActualWtV").value) || 0;
    const volumeWtRow = parseFloat(document.getElementById("volumeWtV").value) || 0;
    const totalVolWtRow = parseFloat(document.getElementById("totalVolumeWtV").value) || 0;
    const chargableWtRow = parseFloat(document.getElementById("chargeableWtV").value) || 0;

    if (!packingTypeRow) return alert("Packing Type required.");
    if (!quantityRow) return alert("Quantity required.");
    if (!lengthRow || !widthRow || !heightRow) return alert("Dimensions required.");

    const table = document.querySelector("#volumetricTable tbody");

    const row = document.createElement("tr");
    row.setAttribute("data-volumetric-status", "new");

    row.innerHTML = `
        <td>${packingTypeRow}</td>
        <td>${lengthRow}</td>
        <td>${widthRow}</td>
        <td>${heightRow}</td>
        <td>${quantityRow}</td>
        <td>${actualWtRow}</td>
        <td>${totalActualWtRow}</td>
        <td>${volumeWtRow}</td>
        <td>${totalVolWtRow}</td>
        <td>${chargableWtRow}</td>
        <td><button class="btn btn-sm btn-danger remove-row">Delete</button></td>
    `;

    table.appendChild(row);

    ['tabPackingType', 'lengthCM', 'widthCM', 'heightCM', 'quantityV', 'actualWtV']
        .forEach(id => document.getElementById(id).value = '');

    ['totalActualWtV', 'volumeWtV', 'totalVolumeWtV', 'chargeableWtV']
        .forEach(id => document.getElementById(id).value = '');


    updateTotals();
});


/* -------------------- TOTALS -------------------- */
function updateTotals() {
    let totalQuantity = 0, totalActualWt = 0, totalActualWtSum = 0;
    let totalVolumeWt = 0, totalVolWtSum = 0, totalChargableWt = 0;

    document.querySelectorAll("#volumetricTable tbody tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        totalQuantity += parseFloat(cells[4].textContent) || 0;
        totalActualWt += parseFloat(cells[5].textContent) || 0;
        totalActualWtSum += parseFloat(cells[6].textContent) || 0;
        totalVolumeWt += parseFloat(cells[7].textContent) || 0;
        totalVolWtSum += parseFloat(cells[8].textContent) || 0;
        totalChargableWt += parseFloat(cells[9].textContent) || 0;
    });

    document.getElementById("totalQuantity").textContent = totalQuantity.toFixed(2);
    document.getElementById("totalActualWt").textContent = totalActualWt.toFixed(2);
    document.getElementById("totalActualWtSum").textContent = totalActualWtSum.toFixed(2);
    document.getElementById("totalVolumeWt").textContent = totalVolumeWt.toFixed(2);
    document.getElementById("totalVolWtSum").textContent = totalVolWtSum.toFixed(2);
    document.getElementById("totalChargeableWt").textContent = totalChargableWt.toFixed(2);

    document.getElementById("quantity").value = totalQuantity.toFixed(2);
    document.getElementById("actualWeight").value = totalActualWt.toFixed(2);
    document.getElementById("volumetricWeight").value = totalVolumeWt.toFixed(2);
    document.getElementById("chargeableWeight").value = totalChargableWt.toFixed(2);
}

async function saveNewVolumetricRows() {
    try {

        const ID_DB = document.getElementById('tempFormID').value;
        const DocketNo = document.getElementById('docketNo').value;

        if (!ID_DB || !DocketNo) {
            return { success: false, error: 'ID_IB or DocketNo is missing.' };
        }
        const newRows = Array.from(
            document.querySelectorAll('#volumetricTable tbody tr[data-volumetric-status="new"]')
        );

        if (!newRows.length) {
            return { success: true, count: 0, message: 'No new volumetric rows to save.' };
        }

        const rowsToInsert = newRows.map(tr => {
            const td = txt => parseFloat(txt) || 0;
            return {
                ID_DB: ID_DB,
                DocketNo: DocketNo,
                PackingType: tr.cells[0].textContent.trim(),
                Lengths: td(tr.cells[1].textContent),
                Widths: td(tr.cells[2].textContent),
                Heights: td(tr.cells[3].textContent),
                Quantity: parseInt(tr.cells[4].textContent) || 0,
                ActualWtPcs: td(tr.cells[5].textContent),
                ActualWt: td(tr.cells[6].textContent),
                VolumePerPcs: td(tr.cells[7].textContent),
                VolumeWt: td(tr.cells[8].textContent),
                ChargableWt: td(tr.cells[9].textContent),
                created_by: UserLoginID,
                created_at: localtimeStamp
            };
        });

        console.log('Rows to insert:', rowsToInsert);
        if (rowsToInsert.length === 0) {
            return { success: true, count: 0, message: 'No new rows to insert.' };
        }

        const { data, error } = await supabaseClient
            .from('DomesticVolumetric')
            .insert(rowsToInsert)
            .select();

        if (error) throw error;

        data.forEach((row, i) => {
            newRows[i].dataset.volumetricStatus = 'saved';
            newRows[i].dataset.volumetricId = row.id;
        });

        return { success: true, count: data.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function loadVolumetricDetails() {
    try {
        const ID_DB = document.getElementById('tempFormID').value;
        const docketNo = document.getElementById('docketNo').value;
        const tbody = document.querySelector('#volumetricTable tbody');
        tbody.innerHTML = ''; // Clear previous rows

        const { data, error } = await supabaseClient
            .from('DomesticVolumetric')
            .select('*')
            .eq('ID_DB', ID_DB)
            .eq('DocketNo', docketNo);

        if (error) {
            console.error('Failed to load volumetric data:', error);
            return;
        }

        if (!data || data.length === 0) {
            // console.log('No volumetric records found.');
            return;
        }

        for (const row of data) {
            const tr = document.createElement('tr');
            tr.dataset.volumetricStatus = 'saved';
            tr.dataset.volumetricId = row.id;

            tr.innerHTML = `
                <td>${row.PackingType}</td>
                <td>${row.Lengths}</td>
                <td>${row.Widths}</td>
                <td>${row.Heights}</td>
                <td>${row.Quantity}</td>
                <td>${row.ActualWtPcs}</td>
                <td>${row.ActualWt}</td>
                <td>${row.VolumePerPcs}</td>
                <td>${row.VolumeWt}</td>
                <td>${row.ChargableWt}</td>
                <td><button class="btn btn-sm btn-danger remove-row">Delete</button></td>
            `;
            tbody.appendChild(tr);
        }
        toggleEditMode(true); // Enable delete buttons
        updateTotals(); // Recalculate table footer totals
    } catch (err) {
        console.error('Error loading volumetric rows:', err.message);
    }
}

function resetVolumetricTotals() {
    document.getElementById("totalQuantity").textContent = "0.00";
    document.getElementById("totalActualWt").textContent = "0.00";
    document.getElementById("totalActualWtSum").textContent = "0.00";
    document.getElementById("totalVolumeWt").textContent = "0.00";
    document.getElementById("totalVolWtSum").textContent = "0.00";
    document.getElementById("totalChargeableWt").textContent = "0.00";

    // Also clear hidden/summary inputs if used
    document.getElementById("quantity").value = "0.00";
    document.getElementById("actualWeight").value = "0.00";
    document.getElementById("volumetricWeight").value = "0.00";
    document.getElementById("chargeableWeight").value = "0.00";
}


