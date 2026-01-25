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
    const movementType = document.getElementById("fixedChargesMovementType").value || "All";
    const transitType = document.getElementById("fixedChargesTransitType").value || "All";
    const modeType = document.getElementById("fixedChargesModeType").value || "All";
    const shippingType = document.getElementById("fixedChargesShippingType").value || "All";
    const chargesType = document.getElementById("fixedChargesType").value;
    const percentage = document.getElementById("fixedChargesPercentage").value || 0;
    const amount = document.getElementById("fixedChargesAmount").value || 0;
    const fixedFor = document.getElementById("fixedChargesFor").value || "All";

    if (!effectiveDate || !chargesType) {
        alert("Please fill required fields");
        return;
    }

    fixedChargesData.push({
        effectiveDate,
        movementType,
        transitType,
        modeType,
        shippingType,
        chargesType,
        percentage,
        amount,
        fixedFor,
        _state: "new"   // 🔥 important
    });

    renderFixedChargesTable();
    clearFixedChargesInputs();
});

function renderFixedChargesTable() {
    const tbody = document.getElementById("fixedChargesTableBody");
    tbody.innerHTML = "";

    if (fixedChargesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted">
                    No fixed charges added
                </td>
            </tr>`;
        return;
    }

    fixedChargesData.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatDate(item.effectiveDate)}</td>
                <td>${item.movementType}</td>
                <td>${item.transitType}</td>
                <td>${item.modeType}</td>
                <td>${item.shippingType}</td>
                <td>${item.chargesType}</td>
               <td>${item.percentage !== null && item.percentage !== undefined ? item.percentage + " %" : "-"}</td>
                <td>${item.amount || "-"}</td>
                <td>${item.fixedFor}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                        onclick="removeFixedCharge(${index})">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

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
        alert("Select Party Code");
        return;
    }

    const newRows = fixedChargesData.filter(r => r._state === "new");
    const deletedRows = fixedChargesData.filter(r => r._state === "deleted");

    if (newRows.length === 0 && deletedRows.length === 0) {
        alert("No changes to save");
        return;
    }

    // DELETE
    if (deletedRows.length) {
        await supabaseClient
            .from("FixedCharges")
            .delete()
            .in("id", deletedRows.map(r => r.id));
    }

    // INSERT
    if (newRows.length) {
        await supabaseClient
            .from("FixedCharges")
            .insert(
                newRows.map(r => ({
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
                }))
            );
    }

    alert("Fixed charges saved successfully ✅");
    loadFixedChargesFromDB();
}
