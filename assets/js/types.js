const Types_RANGE = "Types!A2:E"; // Corrected Google Sheet Range (Description, TypeOfValue, Condition, Value, HSNCode)

// Array to store the fetched type data
let types_data = [];

// Fetch Vehicle Type from Google Sheets
function loadDropdownList() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${Types_SHEETID}/values/${Types_RANGE}?key=${APIKEY}`;
    
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
            const dscription = row[0];  // TaxDescription in column 1 (index 0)
            
            // Push data to tax_data array
            types_data.push({
                dscription: dscription,
            });
        });

        // Call populateDropdown to fill the select element
        populateDropdown();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Error fetching data from Google Sheets:", textStatus, errorThrown);
        alert("Failed to load vehicle types. Please try again later.");
    });
}

// Populate the <select> dropdown with tax data
function populateDropdown() {
    const typeSelect = $("#chargestype"); // Target the <select> element
    typeSelect.empty();  // Clear existing options
    
    // Add a placeholder option
    typeSelect.append('<option value="" disabled selected>Select Vehicle Type</option>');

    // Loop through tax_data and create <option> elements
    types_data.forEach(type => {
        const option = `<option value="${type.dscription}">${type.dscription}</option>`;
        // const option = `<option value="${tax.taxCode}">${tax.taxDescription} (${tax.taxCode})</option>`;
        typeSelect.append(option);
    });
}

// Load the tax data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadDropdownList();
});
