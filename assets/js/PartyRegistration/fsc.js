let fuelSurchargeList = [];
document.getElementById("addFuelSurchargeButton").addEventListener("click", () => {
    const data = getFuelFormData();

    if (!data) return; // ✅ important
    // ✅ ADD DUPLICATE CHECK HERE
    const exists = fuelSurchargeList.some(item =>
        item.effectiveDate === data.effectiveDate &&
        item.movementType === data.movementType &&
        item.modeType === data.modeType &&
        item.fuelType === data.fuelType
    );

    if (exists) {
        showToast("Duplicate entry not allowed", "danger");
        // alert("Duplicate entry not allowed");
        return;
    }
    fuelSurchargeList.push(data); // ✅ ADD THIS
    addRowToTable(data);
});

function getFuelFormData() {
    const effectiveDate = document.getElementById("fuelEffectiveDate").value;
    const movementType = document.getElementById("fuelMovementType").value || "All";
    const modeType = document.getElementById("fuelModeType").value || "All";
    const percentage = parseFloat(document.getElementById("fuelPercentage").value);
    const fuelType = document.getElementById("fuelType").value || "Sell";
    const Description = "Fuel Surcharge " + percentage + "%";

    if (!effectiveDate || !percentage || isNaN(percentage) || percentage <= 0) {
        alert("Enter valid percentage");
        return null;
    }

    return {   // ✅ THIS WAS MISSING
        effectiveDate,
        movementType,
        modeType,
        percentage,
        Description,
        fuelType
    };
}


function addRowToTable(item, index = null) {
    const tbody = document.getElementById("fuelSurchargesTableBody");

    if (tbody.innerText.includes("No data")) {
        tbody.innerHTML = "";
    }

    const row = document.createElement("tr");

    row.innerHTML = `
        <td>${index || tbody.children.length + 1}</td>
        <td>${formatDate(item.effectiveDate)}</td>
        <td>${item.movementType}</td>
        <td>${item.modeType}</td>
        <td>${item.Description}</td>
        <td>${item.percentage ? parseFloat(item.percentage).toFixed(2) : "0.00"} %</td>
        <td>${item.fuelType}</td>
        <td>
            <button class="btn btn-sm btn-danger deleteFuelRow"><i class="bi bi-trash"></i></button>
        </td>
    `;

    tbody.appendChild(row);

    document.getElementById("fuelEffectiveDate").value = "";
    document.getElementById("fuelMovementType").value = "All";
    document.getElementById("fuelModeType").value = "All";
    document.getElementById("fuelPercentage").value = "";
    document.getElementById("fuelType").value = "Sell";

    updateRowNumbers();

}

async function saveFuelSurcharge() {
    const partyCode = document.getElementById("partyCodes").value;

    if (!partyCode) {
        showToast("Select Party Code", "warning");
        return;
    }

    try {
        const rows = fuelSurchargeList.map(item => ({
            PartyID: partyCode,
            EffectiveDate: item.effectiveDate,
            Mode: item.modeType,
            MovementType: item.movementType,
            FuelSurcharge: item.percentage,
            Description: item.Description,
            FSCType: item.fuelType,
            created_by: UserLoginID,
            created_at: localtimeStamp
        }));
        console.log(rows);
        // ✅ STEP 1: Delete old records
        const { error: deleteError } = await supabaseClient
            .from('FuelSurcharge')
            .delete()
            .eq('PartyID', partyCode);

        if (deleteError) throw deleteError;

        // ✅ STEP 2: Insert fresh records
        const { error: insertError } = await supabaseClient
            .from('FuelSurcharge')
            .insert(rows);

        if (insertError) throw insertError;

        // ✅ Success
        // showToast("Fuel surcharge saved successfully", "success");

        fuelSurchargeList = [];
        // document.getElementById("fuelSurchargesTableBody").innerHTML =
        //     `<tr><td colspan="8">No data</td></tr>`;

    } catch (err) {
        console.error("Error saving fuel surcharge:", err);
        showToast("Error saving data", "danger");
    }
}

document.getElementById("fuelSurchargesTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".deleteFuelRow");

    if (btn) {
        const row = btn.closest("tr");
        const index = Array.from(row.parentNode.children).indexOf(row);

        fuelSurchargeList.splice(index, 1);
        row.remove();

        if (!fuelSurchargeList.length) {
            document.getElementById("fuelSurchargesTableBody").innerHTML =
                `<tr><td colspan="8">No data</td></tr>`;
        }

        updateRowNumbers();
    }
});

function updateRowNumbers() {
    const rows = document.querySelectorAll("#fuelSurchargesTableBody tr");

    rows.forEach((row, index) => {
        // ❌ Skip "No data" row
        if (row.children.length === 1) return;

        row.cells[0].innerText = index + 1;
    });
}

async function loadFuelSurcharge(partyCode) {
    try {

        const { data, error } = await supabaseClient
            .from('FuelSurcharge')
            .select('*')
            .eq('PartyID', partyCode)
            .order('EffectiveDate', { ascending: true });

        if (error) throw error;

        // Clear existing
        fuelSurchargeList = [];
        const tbody = document.getElementById("fuelSurchargesTableBody");
        tbody.innerHTML = "";

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="8">No data</td></tr>`;
            return;
        }

        // Map DB → UI format
        data.forEach((item, index) => {
            const mappedItem = {
                effectiveDate: item.EffectiveDate,
                movementType: item.MovementType,
                modeType: item.Mode,
                percentage: item.FuelSurcharge,
                Description: item.Description,
                fuelType: item.FSCType
            };

            fuelSurchargeList.push(mappedItem);
            addRowToTable(mappedItem, index + 1);
        });

    } catch (err) {
        console.error("Error loading fuel surcharge:", err);
    }
    finally {
        document.getElementById("addFuelSurchargeButton").disabled = false;
    }
}
