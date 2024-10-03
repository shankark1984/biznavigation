const PD_sheetID = "1L_x7vb35dryppT-Ihq0FW6mfVzQKe86ajdv7mqbIW6k"; // Your Google Sheet ID
const PD_apiKey = "AIzaSyDQzXSjDTekYX41dzeTxjCnmWZi-mgARMI"; // Your API key
const PD_range = "PartyDetails!A2:AE"; // Specify the range of the sheet
const PD_SCRIPT_APP_URL = 'https://script.google.com/macros/s/AKfycbwILa-7_dctukUYOugfdhzTrD6Sp8yFu-IaVpKzkUxR-WqGUIrGe3-j9Gf9sZeGWgdK/exec';

let partyDetails = [];

// Function to load party details from Google Sheets
function loadPartyDetails() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PD_sheetID}/values/${PD_range}?key=${PD_apiKey}`;
    console.log(url);
    // Fetch the data
    $.getJSON(url, function (data) {
        const rows = data.values;
        rows.forEach(row => {
            partyDetails.push({
                partyCode: row[0],
                partyType: row[1],
                partyName: row[2], // Party Name
                partyContactPerson: row[3],
                partyContactNumber: row[4],
                partyOperationPerson: row[5],
                partyOperationPersonNo: row[6],
                partyAccountPerson: row[7],
                partyAccountContactNo: row[8],
                partyEmailID: row[9],
                partyAddress: row[10],
                city: row[11],
                pinCode: row[12],
                state: row[13],
                country: row[14],
                panNumber: row[15],
                gSTNumber: row[16],
                partyTDSPercentage: row[17],
                partyTDSEndDate: row[18],
                partyTDSStatus: row[19],
                partyPaymentTandC: row[20],
                partyAccountNo: row[21],
                partyBankName: row[22],
                partyBranchName: row[23],
                partyIFSCCode: row[24],
                partyAccountType: row[25],
                defaulttax: row[26],
                partyCurrentStatus: row[27],
                partyDeActiveDate: row[28]
            });
        });

        // Populate dropdown after loading data
        populateDropdown();
    });
}

// Populate datalist dropdown with party names
function populateDropdown() {
    const partySuggestions = $("#partySuggestions");
    partyDetails.forEach(party => {
        const option = `<option value="${party.partyName}" data-party-code="${party.partyCode}">${party.partyName}</option>`;
        partySuggestions.append(option);
    });
}

// When the user selects a party from the dropdown, populate the form
$("#partyName").on("change", function () {
    const selectedPartyName = $(this).val();
    const partyData = partyDetails.find(party => party.partyName === selectedPartyName);

    if (partyData) {
        console.log("Selected Party Data:", partyData); // Check the data for debugging

        $("#partyType").val(partyData.partyType).prop('disabled', true);
        $("#partyCode").val(partyData.partyCode).prop('disabled', true);
        $("#partyCurrentStatus").val(partyData.partyCurrentStatus).prop('disabled', true);

        const formattedDeActiveDate = formatDate(partyData.partyDeActiveDate);
        $("#partyDeActiveDate").val(formattedDeActiveDate).prop('disabled', true);

        $("#partyAddress").val(partyData.partyAddress).prop('disabled', true);
        $("#city").val(partyData.city).prop('disabled', true);
        $("#pinCode").val(partyData.pinCode).prop('disabled', true);
        $("#state").val(partyData.state).prop('disabled', true);
        $("#country").val(partyData.country).prop('disabled', true);
        $("#panNumber").val(partyData.panNumber).prop('disabled', true);
        $("#gSTNumber").val(partyData.gSTNumber).prop('disabled', true);
        $("#partyContactNumber").val(partyData.partyContactNumber).prop('disabled', true);
        $("#partyEmailID").val(partyData.partyEmailID).prop('disabled', true);
        $("#defaulttax").val(partyData.defaulttax).prop('disabled', true);

        saveButton.textContent = 'Update';
        document.getElementById('newButton').disabled = false;
        document.getElementById('modifyButton').disabled = false;
        document.getElementById('saveButton').disabled = true;
    }
});
document.getElementById('modifyButton').addEventListener('click', function () {
    // Enable the saveButton and disable the modifyButton
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;

    // Enable all input fields and select boxes except for the partyCode field
    const fieldsToEnable = ['partyType', 'partyCurrentStatus', 'partyDeActiveDate', 'partyAddress',
        'city', 'pinCode', 'state', 'country', 'panNumber', 'gSTNumber',
        'partyContactNumber', 'partyEmailID', 'defaulttax'];

    fieldsToEnable.forEach(function (fieldId) {
        document.getElementById(fieldId).disabled = false; // Enable each field
    });

    // Optionally, you can enable all fields in a form by querying them and setting disabled = false:
    // const inputs = document.querySelectorAll('input, select'); // This selects all inputs and select boxes
    // inputs.forEach(input => {
    //     if (input.id !== 'partyCode') { // Exclude partyCode from being enabled
    //         input.disabled = false;
    //     }
    // });
});
document.getElementById('newButton').addEventListener('click', function () {
    // Clear all input fields and reset selects in the form
    document.getElementById('formID').reset();

    // Ensure the partyCode field remains disabled and unchanged
    document.getElementById('partyCode').disabled = true;
    document.getElementById('partyCode').value = '';

    // Re-enable other fields (except partyCode)
    const inputs = document.querySelectorAll('#formID input, #formID select, #formID textarea');
    inputs.forEach(input => {
        if (input.id !== 'partyCode') {
            input.disabled = false; // Enable all fields except partyCode
        }
    });

    // Optionally, reset formData if you have any stored data in JavaScript
    formData = {}; // Reset formData variable if you use it

    // Enable saveButton, disable modifyButton
    document.getElementById('saveButton').disabled = false;
    document.getElementById('newButton').disabled = true;
    document.getElementById('modifyButton').disabled = true;
    saveButton.textContent = 'Save';
});




// Load party details on page load
$(document).ready(function () {
    loadPartyDetails();
});
// Utility function to convert date from MM/DD/YYYY to yyyy-MM-dd
function formatDate(dateString) {
    if (!dateString) {
        return '';
    }
    const parts = dateString.split("/");
    if (parts.length === 3) {
        const month = parts[0].padStart(2, '0'); // Add leading zero if necessary
        const day = parts[1].padStart(2, '0');   // Add leading zero if necessary
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return dateString; // Return original if not in expected format
}

// Disable buttons based on user type
document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('newButton').disabled = true;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('saveButton').disabled = false;

});

// Function to generate new party code
async function generateNewPartyCode(partyName) {
    const firstLetter = partyName.charAt(0).toUpperCase();
    const existingCodes = await fetchExistingPartyCodes();

    // Filter codes that start with the same first letter
    const filteredCodes = existingCodes.filter(code => code.startsWith(firstLetter));

    // Find the highest numeric suffix
    let highestCount = 0;
    filteredCodes.forEach(code => {
        const count = parseInt(code.slice(1), 10); // Get the number part of the code
        if (count > highestCount) {
            highestCount = count;
        }
    });

    // Increment the highest count and format the new party code
    const newCount = highestCount + 1;
    return `${firstLetter}${String(newCount).padStart(4, '0')}`; // Pad with zeros
}

// Function to fetch existing party codes from Google Sheets
async function fetchExistingPartyCodes() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PD_sheetID}/values/${PD_range}?key=${PD_apiKey}`;
console.log(url);
    const response = await fetch(url);
    const data = await response.json();

    return data.values ? data.values.flat() : []; // Flatten if the data is in nested arrays
}


// Function to save or update party details
async function savePartyDetails() {
    const partyName = $("#partyName").val();
    let partyCode;

    if (saveButton.textContent === 'Save') {
        // Generate new party code
        partyCode = await generateNewPartyCode(partyName);
    } else if (saveButton.textContent === 'Update') {
        partyCode = $("#partyCode").val(); // Use existing party code
    }
    console.log(partyCode);

    const partyData = {
        partyType: $("#partyType").val(),
        partyCode: $("#partyCode").val(),
        partyName: $("#partyName").val(),
        partyContactPerson: "", // Add logic to get this value if needed
        partyContactNumber: $("#partyContactNumber").val(),
        partyOperationPerson: "", // Add logic to get this value if needed
        partyOperationPersonNo: "", // Add logic to get this value if needed
        partyAccountPerson: "", // Add logic to get this value if needed
        partyAccountContactNo: "", // Add logic to get this value if needed
        partyEmailID: $("#partyEmailID").val(),
        partyAddress: $("#partyAddress").val(),
        city: $("#city").val(),
        pinCode: $("#pinCode").val(),
        state: $("#state").val(),
        country: $("#country").val(),
        panNumber: $("#panNumber").val(),
        gSTNumber: $("#gSTNumber").val(),
        defaulttax: $("#defaulttax").val(),
        partyCurrentStatus: $("#partyCurrentStatus").val(),
        partyDeActiveDate: $("#partyDeActiveDate").val(),
        createdBy: user_LoginID,
    };

    if (saveButton.textContent === 'Save') {
        // Add a new record
        addNewRecord(partyData);
    } else if (saveButton.textContent === 'Update') {
        // Update existing record
        updateRecord(partyData.partyCode, partyData);
    }
}

// Save or update form data
document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();

    const partyName = $("#partyName").val();
    let partyCode;

    if (saveButton.textContent === 'Save') {
        // Generate new party code
        partyCode = await generateNewPartyCode(partyName);
    } else if (saveButton.textContent === 'Update') {
        partyCode = $("#partyCode").val(); // Use existing party code
    }
    console.log(partyCode);

    // Get form values
    const formData = {
        partyCode: partyCode,
        partyType: $("#partyType").val(),
        partyName: $("#partyName").val(),
        partyContactPerson: "", // Add logic to get this value if needed
        partyContactNumber: $("#partyContactNumber").val(),
        partyOperationPerson: "", // Add logic to get this value if needed
        partyOperationPersonNo: "", // Add logic to get this value if needed
        partyAccountPerson: "", // Add logic to get this value if needed
        partyAccountContactNo: "", // Add logic to get this value if needed
        partyEmailID: $("#partyEmailID").val(),
        partyAddress: $("#partyAddress").val(),
        city: $("#city").val(),
        pinCode: $("#pinCode").val(),
        state: $("#state").val(),
        country: $("#country").val(),
        panNumber: $("#panNumber").val(),
        gSTNumber: $("#gSTNumber").val(),
        tDSPercentage: '',
        tDSEndDate: '',
        tDSStatus: '',
        pymentTandC: '',
        accountNo: '',
        bankName: '',
        branchName: '',
        iFSCCode: '',
        accountType: '',
        defaulttax: $("#defaulttax").val(),
        partyCurrentStatus: $("#partyCurrentStatus").val(),
        partyDeActiveDate: $("#partyDeActiveDate").val(),
        createdBy: user_LoginID,
    };

    const action = (saveButton.textContent === 'Save') ? 'add' : 'update';

    fetch(PD_SCRIPT_APP_URL, {
        method: 'POST',
        mode: 'cors',  // Changed to 'cors' to allow for JSON response
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action, data: formData })
    })

        .then(response => response.json())  // Ensure proper response handling
        .then(data => {
            if (data.success) {
                alert(`Company ${action === 'add' ? 'saved' : 'updated'} successfully!`);
                if (action === 'add') {
                    // localStorage.setItem('CompanyID', data.companyID);
                    saveButton.textContent = 'Update';
                    modifyButton.disabled = false;
                }
            } else {
                alert(`Failed to ${action === 'add' ? 'save' : 'update'} company.`);
            }
        })
        .catch(error => console.error('Error:', error));
});
