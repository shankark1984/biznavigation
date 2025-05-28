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
    document.getElementById("totalChargableWt").textContent = totalChargableWt.toFixed(2);

    document.getElementById("quantity").value = totalQuantity.toFixed(2);
    document.getElementById("actualWeight").value = totalActualWt.toFixed(2);
    document.getElementById("volumetricWeight").value = totalVolumeWt.toFixed(2);
    document.getElementById("chargeableWeight").value = totalChargableWt.toFixed(2);
}

document.getElementById("addVolumetricRow").addEventListener("click", function () {
    const packingType = document.getElementById("tabpackingType").value.trim();
    const length = parseFloat(document.getElementById("lenghtCM").value) || 0;
    const width = parseFloat(document.getElementById("widthCM").value) || 0;
    const height = parseFloat(document.getElementById("heightCM").value) || 0;
    const quantity = parseInt(document.getElementById("quantityV").value) || 0;
    const actualWt = parseFloat(document.getElementById("actualWtV").value) || 0;
    const totalActualWt = parseFloat(document.getElementById("totalActualWtV").value) || 0;
    const volumeWt = parseFloat(document.getElementById("volumeWtV").value) || 0;
    const totalVolWt = parseFloat(document.getElementById("totalvolumeWtV").value) || 0;
    const chargableWt = parseFloat(document.getElementById("chargableWtV").value) || 0;

    if (!packingType) {
        alert("Packing Type is required.");
        return;
    }

    const table = document.getElementById("volumetricTable").querySelector("tbody");

    const row = document.createElement("tr");
    row.setAttribute("data-volumetric-status", "new");

    row.innerHTML = `
        <td>${packingType}</td>
        <td>${length}</td>
        <td>${width}</td>
        <td>${height}</td>
        <td>${quantity}</td>
        <td>${actualWt}</td>
        <td>${totalActualWt}</td>
        <td>${volumeWt}</td>
        <td>${totalVolWt}</td>
        <td>${chargableWt}</td>
        <td><button class="btn btn-sm btn-danger remove-row">Delete</button></td>
    `;

    table.appendChild(row);

    document.querySelectorAll("#volumetric input").forEach(input => input.value = "");

    updateTotals();
});



document.getElementById("volumetricTable").addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-row")) {
        e.target.closest("tr").remove();
        updateTotals(); // 👈 update after removing
    }
});


/* -------------------------------------------------
   VolumetricCalculator.js
   Volumetric weight calculation logic (modular)
   ------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Constants & helpers ---------- */
    const $ = id => /** @type {HTMLInputElement} */(document.getElementById(id));
    const num = v => Number.parseFloat(v) || 0;
    const PAGE = (() => {
        const f = location.pathname.split('/').pop();
        return f.replace(/\.html$/i, '')
            .replace(/booking$/i, '')
            .replace(/^./, s => s.toUpperCase());
    })();

    /* ---------- Element cache ---------- */
    const el = {
        qty: $('quantityV'),
        act: $('actualWtV'),
        len: $('lenghtCM'),
        wid: $('widthCM'),
        hgt: $('heightCM'),
        trn: $('transitTypeI'),
        totAct: $('totalActualWtV'),
        volWt: $('volumeWtV'),
        totVol: $('totalvolumeWtV'),
        chg: $('chargableWtV'),
    };

    if (Object.values(el).some(e => !e)) {
        console.error('Volumetric calc: one or more elements missing – aborting.');
        return;
    }
    if (typeof supabaseClient === 'undefined' || typeof companyID === 'undefined') {
        console.error('Volumetric calc: supabaseClient or companyID not on window – aborting.');
        return;
    }

    /* ---------- Runtime state ---------- */
    const cache = new Map();
    let divisor = 5000;
    let minCWT = 0;

    const baseID = txt =>
        (txt || '')
            .replace(/By|Freight/gi, '')
            .trim()
            .toLowerCase() + PAGE;

    async function loadParameters() {
        const bID = baseID(el.trn.value);
        if (!bID) { recalc(); return; }

        if (!cache.has(bID)) {
            try {
                const { data, error } = await supabaseClient
                    .from('SettingParameters')
                    .select('InputFieldID, FieldValue')
                    .in('InputFieldID', [bID, `${bID}CFT`])
                    .eq('company_id', companyID);

                if (error) console.warn('Supabase:', error.message);

                const record = { divisor: 5000, minCWT: 0 };
                data?.forEach(r => {
                    const val = Number(r.FieldValue);
                    if (r.InputFieldID === bID && val > 0) record.divisor = val;
                    if (r.InputFieldID === `${bID}CFT` && val > 0) record.minCWT = val;
                });
                cache.set(bID, record);
            } catch (e) { console.error('Fetch error:', e); }
        }

        const p = cache.get(bID);
        divisor = p.divisor;
        minCWT = p.minCWT;
        recalc();
    }

    function recalc() {
        const { qty, act, len, wid, hgt, totAct, volWt, totVol, chg } = el;
        const q = num(qty.value);
        const a = num(act.value);
        const l = num(len.value);
        const w = num(wid.value);
        const h = num(hgt.value);

        const totalActual = q * a;
        const pieceVolWt = (l && w && h) ? (l * w * h) / divisor : 0;
        const totalVolWt = q * pieceVolWt;

        let chargeable = Math.max(totalActual, totalVolWt);
        if (minCWT && chargeable < minCWT) chargeable = minCWT;

        totAct.value = totalActual.toFixed(2);
        volWt.value = pieceVolWt.toFixed(2);
        totVol.value = totalVolWt.toFixed(2);
        chg.value = chargeable.toFixed(2);
    }

    let rafID = 0;
    const onInput = () => {
        if (rafID) cancelAnimationFrame(rafID);
        rafID = requestAnimationFrame(recalc);
    };

    ['qty', 'act', 'len', 'wid', 'hgt'].forEach(k => el[k].addEventListener('input', onInput));
    el.trn.addEventListener('change', loadParameters);

    if (el.trn.value?.trim()) {
        loadParameters();
    } else {
        const observer = new MutationObserver(() => {
            if (el.trn.value?.trim()) {
                loadParameters();
                observer.disconnect();
            }
        });
        observer.observe(el.trn, { attributes: true, childList: true, subtree: true });
    }
});


async function saveNewVolumetricRows() {
    try {
        const ID_IB = document.getElementById('tempFormID').value;
        const DocketNo = document.getElementById('awbNo').value;

        console.log('Saving new volumetric rows for DocketNo:', DocketNo);
        if (!ID_IB || !DocketNo) {
            return { success: false, error: 'ID_IB or DocketNo is missing.' };
        }
        const newRows = Array.from(
            document.querySelectorAll('#volumetricTable tbody tr[data-volumetric-status="new"]')
        );
        console.log('New rows to save:', newRows.length);

        if (!newRows.length) {
            return { success: true, count: 0, message: 'No new volumetric rows to save.' };
        }

        const rowsToInsert = newRows.map(tr => {
            const td = txt => parseFloat(txt) || 0;
            return {
                ID_IB: ID_IB,
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
                created_by: userLoginID,
                created_at: localtimeStamp
            };
        });

        if (rowsToInsert.length === 0) {
            return { success: true, count: 0, message: 'No new rows to insert.' };
        }

        const { data, error } = await supabaseClient
            .from('VolumetricDetails')
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
        const ID_IB = document.getElementById('tempFormID').value;
        const DocketNo = document.getElementById('awbNo').value;
        const tbody = document.querySelector('#volumetricTable tbody');
        tbody.innerHTML = ''; // Clear previous rows

        const { data, error } = await supabaseClient
            .from('VolumetricDetails')
            .select('*')
            .eq('ID_IB', ID_IB)
            .eq('DocketNo', DocketNo);

        if (error) {
            console.error('Failed to load volumetric data:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('No volumetric records found.');
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

document.getElementById('volumetricTable').addEventListener('click', async function (e) {
    if (e.target.classList.contains('remove-row')) {
        const row = e.target.closest('tr');
        const status = row.dataset.volumetricStatus;
        const id = row.dataset.volumetricId;

        // Confirm delete
        if (!confirm('Are you sure you want to delete this row?')) return;

        // If it's a saved row, delete from Supabase
        if (status === 'saved' && id) {
            const { error } = await supabaseClient
                .from('VolumetricDetails')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Error deleting row from database: ' + error.message);
                return;
            }
        }

        // Remove row from DOM
        row.remove();
        updateTotals();
    }
});
