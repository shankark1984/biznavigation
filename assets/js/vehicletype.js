const VehicleType_RANGE = "VehicleType!A2:C"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)

// Array to store the fetched tax data
let type_data = [];

// Fetch Vehicle Type from Google Sheets
function loadVehicleType() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${VehicleType_SHEETID}/values/${VehicleType_RANGE}?key=${APIKEY}`;
    
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
            const vehicleType = row[0];  // TaxDescription in column 1 (index 0)
            
            // Push data to tax_data array
            type_data.push({
                vehicleType: vehicleType,
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
    const vehicleSelect = $("#vehicleTypelist"); // Target the <select> element
    vehicleSelect.empty();  // Clear existing options
    
    // Add a placeholder option
    vehicleSelect.append('<option value="" disabled selected>Select Vehicle Type</option>');

    // Loop through tax_data and create <option> elements
    type_data.forEach(type => {
        const option = `<option value="${type.vehicleType}">${type.vehicleType}</option>`;
        // const option = `<option value="${tax.taxCode}">${tax.taxDescription} (${tax.taxCode})</option>`;
        vehicleSelect.append(option);
    });
}

// Load the tax data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadVehicleType();
});
