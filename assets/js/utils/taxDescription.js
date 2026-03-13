// Load tax data from Supabase
async function loadTaxData() {
    try {
        const { data, error } = await supabaseClient
            .from('tax_details')
            .select('tax_code, tax_description');

        if (error) throw error;
        if (!data?.length) return console.warn("No tax data found");

        // Populate all dropdowns
        populateTaxDropdown("#partyDefaultTax", data);
        populateTaxDropdown("#vendorDefaultTax", data);
        populateTaxDropdown("#defaultTax", data);

    } catch (error) {
        console.error("Error loading tax data:", error.message);
    }
}

// Reusable dropdown population function
function populateTaxDropdown(selector, data) {
    const dropdown = $(selector);
    dropdown.empty();

    dropdown.append('<option value="" disabled selected>Select Default Tax</option>');

    data.forEach(tax => {
        dropdown.append(
            `<option value="${tax.tax_description}">
                ${tax.tax_description}
            </option>`
        );
    });
}

// Fetch tax details (rate + id)
async function fetchTaxDetails(taxType) {
    if (!taxType) return null;

    try {
        const { data, error } = await supabaseClient
            .from('tax_details')
            .select('id, tax_rate')
            .eq('tax_description', taxType)
            .maybeSingle();

        if (error) throw error;

        return data
            ? { taxId: data.id, taxRate: data.tax_rate }
            : null;

    } catch (err) {
        console.error("Error fetching tax details:", err.message);
        return null;
    }
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
// document.addEventListener("DOMContentLoaded", loadTaxData);