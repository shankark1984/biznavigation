async function calculateChargeableWeight() {
    let actualWeight = parseFloat(document.getElementById("actualWeight").value) || 0;
    let volumetricWeight = parseFloat(document.getElementById("volumetricWeight").value) || 0;
    let uOMType = document.getElementById("uOMType").value;

    let chargeableWeight = Math.max(actualWeight, volumetricWeight);

    if (uOMType === "Gms") {
        chargeableWeight = Math.ceil(chargeableWeight * 2) / 2; // Round up to nearest 0.5
    } else {
        chargeableWeight = Math.ceil(chargeableWeight); // Round up to next integer
    }

    let chargeableWeightInput = document.getElementById("chargeableWeight");
    chargeableWeightInput.value = chargeableWeight;
    chargeableWeightInput.readOnly = true; // Disable manual editing
}

// Attach event listeners to update chargeable weight dynamically
document.getElementById("actualWeight").addEventListener("input", calculateChargeableWeight);
document.getElementById("volumetricWeight").addEventListener("input", calculateChargeableWeight);
document.getElementById("uOMType").addEventListener("input", calculateChargeableWeight);

