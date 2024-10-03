const SETTINGS_RANGE = "Settings!A2:G"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)

// Array to store the fetched tax data
let tax_data = [];

// Fetch tax data from Google Sheets
function loadTaxData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TaxSettings_SHEETID}/values/${SETTINGS_RANGE}?key=${APIKEY}`;
    
    console.log("Fetching data from: ", url); // For debugging

    $.getJSON(url, function (data) {
        console.log("Data fetched from Google Sheets:", data); // Log the fetched data for debugging
        
        const rows = data.values;
        if (!rows || rows.length === 0) {
            console.error("No data found in the sheet.");
            return;
        }

        // Loop through each row and store the TaxCode and TaxDescription
        rows.forEach(row => {
            const taxCode = row[1];  // TaxCode in column 2 (index 1)
            const taxDescription = row[2];  // TaxDescription in column 3 (index 2)
            
            // Push data to tax_data array
            tax_data.push({
                taxCode: taxCode,
                taxDescription: taxDescription
            });
        });

        // Call populateDropdown to fill the select element
        populateDropdown();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Error fetching data from Google Sheets:", textStatus, errorThrown);
        alert("Failed to load tax data. Please try again later.");
    });
}

// Populate the <select> dropdown with tax data
function populateDropdown() {
    const taxSelect = $("#defaulttax"); // Target the <select> element
    taxSelect.empty();  // Clear existing options
    
    // Add a placeholder option
    taxSelect.append('<option value="" disabled selected>Select Default Tax</option>');

    // Loop through tax_data and create <option> elements
    tax_data.forEach(tax => {
        const option = `<option value="${tax.taxDescription}">${tax.taxDescription}</option>`;
        // const option = `<option value="${tax.taxCode}">${tax.taxDescription} (${tax.taxCode})</option>`;
        taxSelect.append(option);
    });
}

// Load the tax data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadTaxData();
});
