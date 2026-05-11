let fixedChargesData = []; // temp storage before save


document.getElementById('fixedChargesMovementType').addEventListener('change', async () => {
    const movementSelect = document.getElementById('fixedChargesMovementType');
    const transitInput = document.getElementById('fixedChargesTransitType');
    const transitList = document.getElementById('transitTypeList');

    console.log('Movement Type Changed');
    if (!movementSelect || !transitInput || !transitList) return;

    const movementType = movementSelect.value;

    // clear previous value & list
    transitInput.value = '';
    transitList.innerHTML = '';

    const inwardTypes = [
        'Customs Clearance',
        'Forwarding',
        'Import',
        'Export'
    ];

    console.log('Movement Type:', movementType);

    if (inwardTypes.includes(movementType)) {
        await loadDatalist('transitTypeList', 'TransitType_i');
    }
    else if (movementType === 'FTL or FCL' || movementType === 'Domestic') {
        await loadDatalist('transitTypeList', 'TransitType');
    }
    // auto-focus so user sees suggestions
    transitInput.focus();
});

document.getElementById("addFixedChargesButton").addEventListener("click", () => {

    const effectiveDate = document.getElementById("fixedChargesEffectiveDate").value;
    const chargesType = document.getElementById("fixedChargesType").value;

    if (!effectiveDate || !chargesType) {
        alert("Please fill required fields");
        return;
    }

    fixedChargesData.push({
        effectiveDate,
        movementType: document.getElementById("fixedChargesMovementType").value || "All",
        transitType: document.getElementById("fixedChargesTransitType").value || "All",
        modeType: document.getElementById("fixedChargesModeType").value || "All",
        shippingType: document.getElementById("fixedChargesShippingType").value || "All",
        chargesType,
        percentage: parseFloat(document.getElementById("fixedChargesPercentage").value) || 0,
        amount: parseFloat(document.getElementById("fixedChargesAmount").value) || 0,
        fixedFor: document.getElementById("fixedChargesFor").value || "All",
        _state: "new"
    });

    renderFixedChargesTable();
});

function renderFixedChargesTable() {

    const tbody = document.getElementById("fixedChargesTableBody");
    tbody.innerHTML = "";

    const visibleRows = fixedChargesData.filter(r => r._state !== "deleted");

    if (visibleRows.length === 0) {
        tbody.innerHTML = `
        <tr>
            <td colspan="11" class="text-center text-muted">
                No fixed charges added
            </td>
        </tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    visibleRows.forEach((item, index) => {

        const tr = document.createElement("tr");
        tr.dataset.index = index;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatDate(item.effectiveDate)}</td>
            <td>${item.movementType}</td>
            <td>${item.transitType}</td>
            <td>${item.modeType}</td>
            <td>${item.shippingType}</td>
            <td>${item.chargesType}</td>
            <td>${item.percentage ? item.percentage + " %" : "-"}</td>
            <td>${item.amount || "-"}</td>
            <td>${item.fixedFor}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-fixedbutton">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// DELETE ROW 
document.addEventListener("click", function (e) {

    const btn = e.target.closest(".delete-fixedbutton");
    if (!btn) return;

    const row = btn.closest("tr");
    const index = row.dataset.index;

    const item = fixedChargesData[index];

    if (item._state === "new") {
        fixedChargesData.splice(index, 1);
    } else {
        item._state = "deleted";
    }

    renderFixedChargesTable();
});
function removeFixedCharge(index) {
    const item = fixedChargesData[index];

    if (item._state === "db") {
        if (!confirm("Delete this fixed charge?")) return;
        item._state = "deleted";
    }

    fixedChargesData.splice(index, 1);
    renderFixedChargesTable();
}

async function loadFixedChargesFromDB() {

    const partyCode = document.getElementById("partyCodes").value;
    if (!partyCode) return;

    const { data, error } = await supabaseClient
        .from("FixedCharges")
        .select("*")
        .eq("PartyCode", partyCode)
        .eq("company_id", CompanyID)
        .order("EffectiveDate", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    fixedChargesData = data.map(item => ({
        id: item.id,
        effectiveDate: item.EffectiveDate,
        movementType: item.MovementType || "All",
        transitType: item.TransitType || "All",
        modeType: item.ModeType || "All",
        shippingType: item.ShippingType || "All",
        chargesType: item.ChargesType,
        percentage: item.Percentage || 0,
        amount: item.Amount || 0,
        fixedFor: item.FixedChargesType || "All",
        _state: "db"
    }));

    renderFixedChargesTable();
}

async function saveFixedChargesToDB() {

    const partyCode = document.getElementById("partyCodes").value;
    if (!partyCode) {
        alert("Select Party");
        return;
    }

    const newRows = fixedChargesData.filter(r => r._state === "new");
    const deletedRows = fixedChargesData.filter(r => r._state === "deleted");

    if (deletedRows.length) {
        await supabaseClient
            .from("FixedCharges")
            .delete()
            .in("id", deletedRows.map(r => r.id));
    }

    if (newRows.length) {

        const insertData = newRows.map(r => ({
            PartyCode: partyCode,
            EffectiveDate: r.effectiveDate,
            MovementType: r.movementType,
            TransitType: r.transitType,
            ModeType: r.modeType,
            ShippingType: r.shippingType,
            ChargesType: r.chargesType,
            Percentage: r.percentage,
            Amount: r.amount,
            FixedChargesType: r.fixedFor,
            company_id: CompanyID,
            created_by: UserLoginID,
            created_at: localtimeStamp
        }));

        await supabaseClient
            .from("FixedCharges")
            .insert(insertData);
    }

    // alert("Fixed charges saved successfully ✅");

    loadFixedChargesFromDB();
}