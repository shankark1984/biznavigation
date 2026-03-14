document.getElementById("addFtlFCLButton").addEventListener("click", function () {

    const effectiveDate = document.getElementById("ftlEffectiveDate").value;
    const movementType = document.getElementById("ftlMovementType").value;
    const transitType = document.getElementById("ftlTransitType").value;
    const modeType = document.getElementById("ftlModeType").value;
    const vehicleType = document.getElementById("ftlVehicleType").value;
    const cargoWeight = document.getElementById("ftlCargoWeight").value;
    const routeDetails = document.getElementById("ftlRouteDetails").value.trim().toLowerCase();
    const uomType = document.getElementById("ftlUomType").value;
    const rate = document.getElementById("ftlRate").value;
    const tariffType = document.getElementById("ftlTariffType").value || "Sell";
    const currency = document.getElementById("ftlCurrencyCode").value || "INR";

    if (!effectiveDate || !movementType || !transitType || !modeType || !routeDetails || !uomType || !rate) {
        alert("Please fill all required fields");
        return;
    }

    if (cargoWeight <= 0) {
        alert("Cargo weight must be greater than 0");
        return;
    }

    if (rate <= 0) {
        alert("Rate must be greater than 0");
        return;
    }

    const tbody = document.getElementById("ftlFCLTariffTableBody");

    // 🔎 DUPLICATE CHECK
    const rows = tbody.querySelectorAll("tr");

    for (let r of rows) {

        if (r.dataset.status === "delete") continue;

        const cells = r.querySelectorAll("td");

        if (cells.length > 1) {

            const existingKey =
                cells[1].innerText + "|" +
                cells[2].innerText + "|" +
                cells[3].innerText + "|" +
                cells[4].innerText + "|" +
                cells[5].innerText + "|" +
                cells[6].innerText.toLowerCase() + "|" +
                cells[7].innerText + "|" +
                parseFloat(cells[8].innerText).toFixed(2) + "|" +
                cells[10].innerText;

            const newKey =
                effectiveDate + "|" +
                movementType + "|" +
                transitType + "|" +
                modeType + "|" +
                vehicleType + "|" +
                routeDetails + "|" +
                uomType + "|" +
                parseFloat(cargoWeight).toFixed(2) + "|" +
                tariffType;

            if (existingKey === newKey) {
                alert("Duplicate tariff already added.");
                return;
            }
        }
    }

    // Remove "No Data"
    if (tbody.querySelector("td[colspan]")) {
        tbody.innerHTML = "";
    }

    const rowCount = tbody.rows.length + 1;

    const row = document.createElement("tr");
    row.dataset.status = "new";

    row.innerHTML = `
        <td>${rowCount}</td>
        <td>${effectiveDate}</td>
        <td>${movementType}</td>
        <td>${transitType}</td>
        <td>${modeType}</td>
        <td>${vehicleType}</td>
        <td>${routeDetails}</td>
        <td>${uomType}</td>
        <td class="text-end">${parseFloat(cargoWeight).toFixed(2)}</td>
        <td class="text-end">${parseFloat(rate).toFixed(2)}</td>
        <td>${tariffType}</td>
        <td>${currency}</td>
        <td>
            <button class="btn btn-sm btn-danger deleteRow">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    document.getElementById("ftlCargoWeight").value = "0.00";
    document.getElementById("ftlRate").value = "0.00";
});

// DELETE ROW
document.addEventListener("click", function (e) {

    if (e.target.closest(".deleteRow")) {

        const row = e.target.closest("tr");
        const tbody = document.getElementById("ftlFCLTariffTableBody");

        if (row.dataset.status === "new") {

            // New row → remove completely
            row.remove();

        } else {

            // Existing row → mark for delete
            row.dataset.status = "delete";
            row.style.display = "none";

        }

        // Re-number rows
        const visibleRows = [...tbody.querySelectorAll("tr")]
            .filter(r => r.style.display !== "none");

        visibleRows.forEach((tr, index) => {
            tr.cells[0].innerText = index + 1;
        });

        // If no rows
        if (visibleRows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" class="text-center text-muted">
                        No tariff rates added
                    </td>
                </tr>
            `;
        }
    }

});

// SAVE DATA in to database
async function saveFCLFTLTariffs() {

    const partyCode = document.getElementById("partyCodes").value;

    if (!partyCode) {
        alert("Select Party");
        return;
    }

    const rows = document.querySelectorAll("#ftlFCLTariffTableBody tr");

    const insertData = [];
    const deleteIds = [];

    rows.forEach(row => {

        const status = row.dataset.status;
        const cells = row.querySelectorAll("td");

        if (cells.length < 12) return;

        if (status === "new") {

            insertData.push({
                PartyCode: partyCode,
                EffectiveDate: cells[1].textContent.trim(),
                MovementType: cells[2].textContent.trim(),
                TransitType: cells[3].textContent.trim(),
                ModeType: cells[4].textContent.trim(),
                VehicleType: cells[5].textContent.trim(),
                RouteDetails: cells[6].textContent.trim(),
                UOM: cells[7].textContent.trim(),
                CargoWeight: parseFloat(cells[8].textContent) || 0,
                Rate: parseFloat(cells[9].textContent) || 0,
                TariffType: cells[10].textContent.trim(),
                CurrencyCode: cells[11].textContent.trim(),
                created_by: UserLoginID,
                created_at: localtimeStamp
            });

        }

        console.log("Row status:", status, "Data:", {
            EffectiveDate: cells[1].textContent.trim(),
            MovementType: cells[2].textContent.trim(),
            TransitType: cells[3].textContent.trim(),
            ModeType: cells[4].textContent.trim(),
            VehicleType: cells[5].textContent.trim(),
            RouteDetails: cells[6].textContent.trim(),
            UOM: cells[7].textContent.trim(),
            CargoWeight: parseFloat(cells[8].textContent) || 0,
            Rate: parseFloat(cells[9].textContent) || 0,
            TariffType: cells[10].textContent.trim(),
            CurrencyCode: cells[11].textContent.trim(),
        });

        if (status === "delete" && row.dataset.id) {
            deleteIds.push(row.dataset.id);
        }

    });

    if (insertData.length > 0) {

        const { error } = await supabaseClient
            .from("FTL_FCL_Tariff")
            .insert(insertData);

        if (error) {
            console.error("Insert error:", error);
            alert("Error saving FCL & FCL tariffs");
            return;
        }
    }

    if (deleteIds.length > 0) {

        const { error } = await supabaseClient
            .from("FTL_FCL_Tariff")
            .delete()
            .in("id", deleteIds);

        if (error) console.error("Delete error:", error);
    }

    rows.forEach(row => {
        if (row.dataset.status === "new") {
            row.dataset.status = "saved";
        }
    });

    // alert("FCL & FCL Tariffs saved successfully");
}

// load data from database
async function loadFCLFTLTariffs() {

    const partyCode = document.getElementById("partyCodes").value;
    if (!partyCode) return;

    const tbody = document.getElementById("ftlFCLTariffTableBody");
    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("FTL_FCL_Tariff")
        .select("*")
        .eq("PartyCode", partyCode)
        .order("EffectiveDate", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center text-muted">
                    No tariff rates found
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(row => {
        addFCLFTLTariffRow(row);
    });

}

function addFCLFTLTariffRow(data) {

    const tbody = document.getElementById("ftlFCLTariffTableBody");

    // Remove "No Data" row if exists
    if (tbody.querySelector("td[colspan]")) {
        tbody.innerHTML = "";
    }

    const rowCount = tbody.rows.length + 1;

    const row = document.createElement("tr");

    // mark as existing row
    row.dataset.status = "saved";
    row.dataset.id = data.id;

    row.innerHTML = `
        <td>${rowCount}</td>
        <td>${data.EffectiveDate}</td>
        <td>${data.MovementType}</td>
        <td>${data.TransitType}</td>
        <td>${data.ModeType}</td>
        <td>${data.VehicleType}</td>
        <td>${data.RouteDetails}</td>
        <td>${data.UOM}</td>
        <td class="text-end">${parseFloat(data.CargoWeight).toFixed(2)}</td>
        <td class="text-end">${parseFloat(data.Rate).toFixed(2)}</td>
        <td>${data.TariffType}</td>
        <td>${data.CurrencyCode}</td>
        <td>
            <button class="btn btn-sm btn-danger deleteRow">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
}