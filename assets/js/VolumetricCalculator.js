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
    updateTotals(); // 👈 update after adding
});

document.getElementById("volumetricTable").addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-row")) {
        e.target.closest("tr").remove();
        updateTotals(); // 👈 update after removing
    }
});
