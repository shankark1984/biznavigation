// Fetch company data from Google Sheets
function fetchCompanyData(companyID) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CompanyProfile_SHEETID}/values/${COMPANY_PROFILE_RANGE}?key=${APIKEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const rows = data.values;
            const companyData = rows.find(row => row[0] === companyID); // Match CompanyID

            if (companyData) {
                populateCompanyForm(companyData);
            } else {
                console.error('Company data not found');
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

// Populate the form fields with the company data
function populateCompanyForm(companyData) {
    document.getElementById('CompID').textContent = companyID;
    // Assuming the columns are: CompanyID, ShortCode, CompanyName, Address, City, PinCode, State, Country, PhoneNo, Email, GSTNumber, PANNumber, CINNo, UdyogAadhaarNo, WebSite, Logo, CreatedBy, CreatedOn
    document.getElementById('shortCode').value = companyData[1] || '';
    document.getElementById('companyName').textContent = companyData[2] || '';
    document.getElementById('address').value = companyData[3] || '';
    document.getElementById('city').value = companyData[4] || '';
    document.getElementById('pinCode').value = companyData[5] || '';
    document.getElementById('state').value = companyData[6] || '';
    document.getElementById('country').value = companyData[7] || '';
    document.getElementById('phoneNumber').value = companyData[8] || '';
    document.getElementById('email').value = companyData[9] || '';
    document.getElementById('gstNumber').value = companyData[10] || '';
    document.getElementById('panNumber').value = companyData[11] || '';
    document.getElementById('cinNo').value = companyData[12] || '';
    document.getElementById('uaNo').value = companyData[13] || '';
    document.getElementById('website').value = companyData[14] || '';
    document.getElementById('companylogo').src = companyData[15] || '';
    companyNamea=document.getElementById('companyName').textContent;

    if (userType == 1) {
        document.getElementById('modifyButton').disabled = false;
        document.getElementById('newButton').disabled = false;
    } else if (userType == 2) {
        document.getElementById('modifyButton').disabled = false;
    } else {
        document.getElementById('modifyButton').disabled = true;
    }

}

// When the page loads, fetch the company data
document.addEventListener('DOMContentLoaded', function () {
    disableForm();  // Disable all inputs on page load
    const companyID = localStorage.getItem('CompanyID');
    if (companyID) {
        fetchCompanyData(companyID);
    } else {
        console.error('No CompanyID found in localStorage');
    }
});