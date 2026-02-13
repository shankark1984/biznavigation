// Fetch tax data from Supabase
async function loadTaxData() {
    try {
        // console.log("Fetching tax description data from Supabase..."); // For debugging

        // Query the 'tax_details' table in Supabase
        let { data, error } = await supabaseClient
            .from('tax_details') // Replace with your actual table name
            .select('tax_code, tax_description'); // Fix the typo here

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            console.error("No data found in the table.");
            return;
        }

        // Array to store tax data
        let tax_data = [];

        // Loop through each row and store the TaxCode and TaxDescription
        data.forEach(row => {
            const taxCode = row.tax_code;  // TaxCode column
            const taxDescription = row.tax_description;  // TaxDescription column (fixed)

            // Push data to tax_data array
            tax_data.push({
                taxCode: taxCode,
                taxDescription: taxDescription
            });
        });

        // Call populateDropdown to fill the select element
        populateDropdown(tax_data);
        vendorpopulateDropdown(tax_data);
    } catch (error) {
        console.error("Error fetching data from Supabase:", error.message);
        // alert("Failed to load tax data. Please try again later.");
    }
}

// Populate the <select> dropdown with tax data
function populateDropdown(tax_data) {
    const taxSelect = $("#partyDefaultTax"); // Target the <select> element
    taxSelect.empty();  // Clear existing options

    // Add a placeholder option
    taxSelect.append('<option value="" disabled selected>Select Default Tax</option>');

    // Loop through tax_data and create <option> elements
    tax_data.forEach(tax => {
        const option = `<option value="${tax.taxDescription}">${tax.taxDescription}</option>`;
        taxSelect.append(option);
    });
}

// Populate the <select> dropdown with tax data
function vendorpopulateDropdown(tax_data) {
    const taxSelect = $("#vendorDefaultTax"); // Target the <select> element
    taxSelect.empty();  // Clear existing options

    // Add a placeholder option
    taxSelect.append('<option value="" disabled selected>Select Default Tax</option>');

    // Loop through tax_data and create <option> elements
    tax_data.forEach(tax => {
        const option = `<option value="${tax.taxDescription}">${tax.taxDescription}</option>`;
        taxSelect.append(option);
    });
}
// Load the tax data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadTaxData();
});

// Populate the <select> dropdown with tax data
function vendorpopulateDropdown(tax_data) {
    const taxSelect = $("#defaultTax"); // Target the <select> element
    taxSelect.empty();  // Clear existing options

    // Add a placeholder option
    taxSelect.append('<option value="" disabled selected>Select Default Tax</option>');

    // Loop through tax_data and create <option> elements
    tax_data.forEach(tax => {
        const option = `<option value="${tax.taxDescription}">${tax.taxDescription}</option>`;
        taxSelect.append(option);
    });
}

async function fetchTaxDetails(taxType) {
    console.log("Fetching tax details for:", taxType); // For debugging
    try {
        const { data, error } = await supabaseClient
            .from('tax_details')
            .select('id, tax_rate')
            .eq('tax_description', taxType)
            .maybeSingle(); // because we expect only 1 match

        if (error) {
            console.error('Error fetching tax details:', error.message);
            return null;
        }

        if (data) {
            // console.log('Fetched Tax Details:', data);
            return {
                taxId: data.id,
                taxRate: data.tax_rate
            };
        } else {
            console.warn('No tax details found for:', taxType);
            return null;
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        return null;
    }
}



// Function to handle the change event of the tax dropdown 
const taxInput = document.getElementById('partyDefaultTax');
const partyCodeIn = document.getElementById('partyCode'); // e.g. <select> or <input>

async function onChargeTypeOrPartyChange() {
    const partyCode = partyCodeIn.value.trim();
    if (!partyCode) {
        taxInput.value = '';
        return;
    }

    try {
        // Fetch the party's default_tax
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('DefaultTax')
            .eq('PartyCode', partyCode)
            .single();

        if (error) {
            console.error('Error loading default tax:', error.message);
            taxInput.value = '';
        } else {
            // Populate the default tax dropdown/text input
            taxInput.value = data.default_tax ?? '';
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        taxInput.value = '';
    }
}
