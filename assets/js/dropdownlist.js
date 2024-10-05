const TypesList_RANGE = "TypesList!A2:E"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)

// Arrays to store the fetched data for different types
let vehicleTypeData = [];
let bankNameData = [];
let bloodGroupData = [];
let chargesTypeData = [];
let modeTypeData = [];
let movementTypeData = [];
let transitTypeData = [];

// Fetch data from Google Sheets
function loadTypeList() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TypesList_SHEETID}/values/${TypesList_RANGE}?key=${APIKEY}`;

    console.log("Fetching data from: ", url); // For debugging

    $.getJSON(url, function (data) {
        console.log("Data fetched from Google Sheets:", data); // Log the fetched data for debugging

        const rows = data.values;
        if (!rows || rows.length === 0) {
            console.error("No data found in the sheet.");
            return;
        }

        // Loop through each row and store the relevant data
        rows.forEach(row => {
            const description = row[0];  // TaxDescription in column 1 (index 0)
            const typeOfValue = row[1];

            if (typeOfValue === "VehicleType") {
                vehicleTypeData.push({ description });
            } else if (typeOfValue === "BankName") {
                bankNameData.push({ description });
            } else if (typeOfValue === "BloodGroup") {
                bloodGroupData.push({ description });
            } else if (typeOfValue === "ChargesType") {
                chargesTypeData.push({ description });
            } else if (typeOfValue === "ModeType") {
                modeTypeData.push({ description });
            } else if (typeOfValue === "MovementType") {
                movementTypeData.push({ description });
            } else if (typeOfValue === "TransitType") {
                transitTypeData.push({ description });
            }
        });

        // Populate the dropdowns after data is fetched
        populateVehicleTypeDropdown();
        populateBankNameDropdown();
        populateBloodGroupDropdown();
        populateChargesTypeDropdown();
        populateModeTypeDropdown();
        populateMovementTypeDropdown();
        populateTransitTypeDropdown();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Error fetching data from Google Sheets:", textStatus, errorThrown);
        alert("Failed to load data. Please try again later.");
    });
}

// Populate the <select> dropdowns for VehicleType
function populateVehicleTypeDropdown() {
    const vehicleTypeSelect = $("#vehicleType"); // Target the <select> element
    vehicleTypeSelect.empty();  // Clear existing options

    // Add a placeholder option
    vehicleTypeSelect.append('<option value="" disabled selected>Select Vehicle Type</option>');

    // Loop through vehicleTypeData and create <option> elements
    vehicleTypeData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        vehicleTypeSelect.append(option);
    });
}

// Populate the <select> dropdowns for BankName
function populateBankNameDropdown() {
    const bankNameSelect = $("#bankName"); // Target the <select> element
    bankNameSelect.empty();  // Clear existing options

    // Add a placeholder option
    bankNameSelect.append('<option value="" disabled selected>Select Bank Name</option>');

    // Loop through bankNameData and create <option> elements
    bankNameData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        bankNameSelect.append(option);
    });
}

// Populate the <select> dropdowns for BloodGroup
function populateBloodGroupDropdown() {
    const bloodGroupSelect = $("#bloodGroup"); // Target the <select> element
    bloodGroupSelect.empty();  // Clear existing options

    // Add a placeholder option
    bloodGroupSelect.append('<option value="" disabled selected>Select Blood Group</option>');

    // Loop through bloodGroupData and create <option> elements
    bloodGroupData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        bloodGroupSelect.append(option);
    });
}

// Populate the <select> dropdowns for ChargesType
function populateChargesTypeDropdown() {
    const chargesTypeSelect = $("#chargesType"); // Target the <select> element
    chargesTypeSelect.empty();  // Clear existing options

    // Add a placeholder option
    chargesTypeSelect.append('<option value="" disabled selected>Select Charges Type</option>');

    // Loop through chargesTypeData and create <option> elements
    chargesTypeData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        chargesTypeSelect.append(option);
    });
}

// Populate the <select> dropdowns for ModeType
function populateModeTypeDropdown() {
    const modeTypeSelect = $("#modeType"); // Target the <select> element
    modeTypeSelect.empty();  // Clear existing options

    // Add a placeholder option
    modeTypeSelect.append('<option value="" disabled selected>Select Mode Type</option>');

    // Loop through modeTypeData and create <option> elements
    modeTypeData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        modeTypeSelect.append(option);
    });
}

// Populate the <select> dropdowns for MovementType
function populateMovementTypeDropdown() {
    const movementTypeSelect = $("#movementType"); // Target the <select> element
    movementTypeSelect.empty();  // Clear existing options

    // Add a placeholder option
    movementTypeSelect.append('<option value="" disabled selected>Select Movement Type</option>');

    // Loop through movementTypeData and create <option> elements
    movementTypeData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        movementTypeSelect.append(option);
    });
}

// Populate the <select> dropdowns for TransitType
function populateTransitTypeDropdown() {
    const transitTypeSelect = $("#transitType"); // Target the <select> element
    transitTypeSelect.empty();  // Clear existing options

    // Add a placeholder option
    transitTypeSelect.append('<option value="" disabled selected>Select Transit Type</option>');

    // Loop through transitTypeData and create <option> elements
    transitTypeData.forEach(type => {
        const option = `<option value="${type.description}">${type.description}</option>`;
        transitTypeSelect.append(option);
    });
}

// Load the data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadTypeList();
});