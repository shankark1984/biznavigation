const APIKEY = "AIzaSyDQzXSjDTekYX41dzeTxjCnmWZi-mgARMI"; // Your API key

const TaxSettings_SHEETID = "18RUCi9bBNF7053NNE5IMEksoLOjLxXn2ySI2yfdxPiI"; // Your Google Sheet ID "TaxSettings"
const UserLogin_SHEETID = "15oUpowoMk5zQhPoNbvxvtYJU8GWhF8xOdaNkn4UEsKM"; // Your Google Sheet ID "UserLogin"
const CompanyProfile_SHEETID = "1oywrLJWBBvLiNXnshYfXrJheOd8lPX3fC_iVJD3uyiQ"; // Your Google Sheet ID "CompanyProfile"
const PartyDetails_SHEETID ="16VIwLuGze8Pv6N0mWUpu3e171xugJJrbON00kbr_yZ8";// Your Google Sheet ID "PartyDetails"

const UserLogin_SCRIPT_ID = 'https://script.google.com/macros/s/AKfycbypu0xQ80LZHwHE1bMf76Zy0ESi0Qb9kzLtp4ltGPtIFVoA_k9hNHAFZhZFaqcO_Dzr/exec';
const CompanyProfile_URL='https://script.google.com/macros/s/AKfycbxnNE6-mBBHQ6b9F7YaSUZ85GqRX_SGC68pfNG8B_uD7gj5fRFOQXMHr6Pae8DHnm0aHg/exec';
const PartyDetails_URL ='https://script.google.com/macros/s/AKfycbxDzX0M7h5BZjOvHJztQvb4DvadBXHGqDGL9iAGq6QCeS1GOJKWEO8ScovJYMdKH_k65A/exec';

const empCode= localStorage.getItem('EmpCode');
const userName=localStorage.getItem('UserName');
const userLoginID=localStorage.getItem('UserLoginID');
const userType=localStorage.getItem('UserType');
const companyID=localStorage.getItem('CompanyID');
const workingBranch=localStorage.getItem('WorkingBranch');

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