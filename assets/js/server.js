const APIKEY = "AIzaSyDQzXSjDTekYX41dzeTxjCnmWZi-mgARMI"; // Your API key

const TaxSettings_SHEETID = "18RUCi9bBNF7053NNE5IMEksoLOjLxXn2ySI2yfdxPiI"; // Your Google Sheet ID "TaxSettings"
const UserLogin_SHEETID = "15oUpowoMk5zQhPoNbvxvtYJU8GWhF8xOdaNkn4UEsKM"; // Your Google Sheet ID "UserLogin"
const CompanyProfile_SHEETID = "1oywrLJWBBvLiNXnshYfXrJheOd8lPX3fC_iVJD3uyiQ"; // Your Google Sheet ID "CompanyProfile"
const PartyDetails_SHEETID = "16VIwLuGze8Pv6N0mWUpu3e171xugJJrbON00kbr_yZ8";// Your Google Sheet ID "PartyDetails"
const VehicleType_SHEETID = '1lH67VSgtESmHRN54uZQpQBgDOkykq-4VQAU66Miw0IM';
const TypesList_SHEETID = '1z2d7KZQWuHILakrdG3kTe76rQmZSzk8x9wt_h92RXFg';
const MovementDetails_SHEETID='1WoiRk7RK1dAWR52TH1boPBnlSZASZp3wddOX5HeWS4Y';

const UserLogin_SCRIPT_ID = 'https://script.google.com/macros/s/AKfycbypu0xQ80LZHwHE1bMf76Zy0ESi0Qb9kzLtp4ltGPtIFVoA_k9hNHAFZhZFaqcO_Dzr/exec';
const CompanyProfile_URL = 'https://script.google.com/macros/s/AKfycbxnNE6-mBBHQ6b9F7YaSUZ85GqRX_SGC68pfNG8B_uD7gj5fRFOQXMHr6Pae8DHnm0aHg/exec';
const PartyDetails_URL = 'https://script.google.com/macros/s/AKfycbxDzX0M7h5BZjOvHJztQvb4DvadBXHGqDGL9iAGq6QCeS1GOJKWEO8ScovJYMdKH_k65A/exec';
const MovementDetails_URL='https://script.google.com/macros/s/AKfycbwk-hmR9wz5g2Pokr35qopYqrvsv6D7XDzXbA_pO2L3C5xFfGbLMe6OBzLDVlw3BbBbgw/exec';

let partyDetails = [];
const range = "PartyDetails!A2:AF"; // Specify the range of the sheet

const empCode = localStorage.getItem('EmpCode');
const userName = localStorage.getItem('UserName');
const userLoginID = localStorage.getItem('UserLoginID');
const userType = localStorage.getItem('UserType');
const companyID = localStorage.getItem('CompanyID');
const workingBranch = localStorage.getItem('WorkingBranch');


document.addEventListener('DOMContentLoaded', function () {
    // Initially disable buttons
    document.getElementById('newButton').disabled = true;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('deleteButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('saveButton').disabled = true;
});

// Enable all form inputs
function enableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = false);
}
// Disable all form inputs
function disableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = true);
}
// Clear all input fields and select elements
function clearForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => {
        input.value = '';  // Reset the value
        if (input.type === 'checkbox') {
            input.checked = false;  // Uncheck if it's a checkbox
        }
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;  // Reset the select to the first option
        }
    });
}

// Fetch data from Google Sheets
function loadcompanyShortCode() {
    const CompanyProfile_RANGE = "CompanyProfile!A2:B"; // Google Sheet Range (CompanyID, ShortCode)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CompanyProfile_SHEETID}/values/${CompanyProfile_RANGE}?key=${APIKEY}`;
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
            const companyid = row[0];  // CompanyID in column 1 (index 0)
            const shortCode = row[1];   // ShortCode in column 2 (index 1)
            if (companyid === companyID) {
                localStorage.setItem('companyShortCode', shortCode); // Store the array as a string
            }
        });

        // Optional: Log the stored data for verification
        console.log("Stored Company Short Codes:", localStorage.getItem('companyShortCode'));

    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Error fetching data from Google Sheets:", textStatus, errorThrown);
        alert("Failed to load data. Please try again later.");
    });
}
// Load the data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadcompanyShortCode();
});


