// Load tax data from Supabase
let taxCache = [];

async function loadTaxData() {
    try {
        const { data, error } = await supabaseClient
            .from('tax_details')
            .select('id, tax_code, tax_description, tax_rate');

        if (error) throw error;

        taxCache = data || [];

        populateTaxDropdown("#partyDefaultTax", taxCache);
        populateTaxDropdown("#vendorDefaultTax", taxCache);
        populateTaxDropdown("#defaultTax", taxCache);

    } catch (error) {
        console.error("Error loading tax data:", error.message);
    }
}

// Reusable dropdown population function
function populateTaxDropdown(selector, data) {
    const dropdown = document.querySelector(selector);

    console.log("Dropdown:", dropdown);
    console.log("Data:", data);

    if (!dropdown) return;

    dropdown.innerHTML = `<option value="">Select Default Tax</option>`;

    data.forEach(tax => {
        const option = document.createElement("option");
        option.value = tax.id;
        option.textContent = tax.tax_description;
        dropdown.appendChild(option);
    });
}

// Fetch tax details (rate + id)
function fetchTaxDetails(taxType) {
    if (!taxType) return null;

    const tax = taxCache.find(t => t.tax_description === taxType);

    return tax
        ? { taxId: tax.id, taxRate: tax.tax_rate }
        : null;
}

// Load party default tax
async function onChargeTypeOrPartyChange() {

    const partyCode = document.getElementById("partyCode").value.trim();
    const taxInput = document.getElementById("partyDefaultTax");

    if (!partyCode) {
        taxInput.value = "";
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('DefaultTax')
            .eq('PartyCode', partyCode)
            .maybeSingle();

        if (error) throw error;

        taxInput.value = data?.DefaultTax || "";

    } catch (err) {
        console.error("Error loading party tax:", err.message);
        taxInput.value = "";
    }
}

// Run on page load
document.addEventListener("DOMContentLoaded", loadTaxData);