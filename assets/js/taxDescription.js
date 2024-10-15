// Fetch tax data from Supabase
async function loadTaxData() {
    try {
        console.log("Fetching tax description data from Supabase..."); // For debugging

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
    } catch (error) {
        console.error("Error fetching data from Supabase:", error.message);
        alert("Failed to load tax data. Please try again later.");
    }
}

// Populate the <select> dropdown with tax data
function populateDropdown(tax_data) {
    const taxSelect = $("#defaulttax"); // Target the <select> element
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
