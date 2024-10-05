
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
    document.getElementById('companyName').value = companyData[2] || '';
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
//Modify button event listener
document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    saveButton.textContent = 'Update';
});

//Modify button event listener
document.getElementById('newButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    saveButton.textContent = 'Save';
    clearForm();
});


// Function to generate new company code
async function generateNewCompanyID(companyName) {
    const firstLetter = companyName.charAt(0).toUpperCase();
    const existingCodes = await fetchExistingCompanyID();

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

    // Increment the highest count and format the new company code
    const newCount = highestCount + 1;
    return `C${firstLetter}${String(newCount).padStart(4, '0')}`; // Pad with zeros
}

// Function to fetch existing company codes from Google Sheets
async function fetchExistingCompanyID() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CompanyProfile_SHEETID}/values/${COMPANY_PROFILE_RANGE}?key=${APIKEY}`;
    console.log(url);
    const response = await fetch(url);
    const data = await response.json();

    return data.values ? data.values.flat() : []; // Flatten if the data is in nested arrays
}


// Save or update form data
document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();

    // const companyID = localStorage.getItem('CompanyID') || null;
    const companyName = document.getElementById('companyName').value;
    let companyID;

    if (saveButton.textContent === 'Save') {
        // Generate new party code
        companyID = await generateNewCompanyID(companyName);
    } else if (saveButton.textContent === 'Update') {
        partyCode = localStorage.getItem('CompanyID'); // Use existing Company code
    }

    // Get form values
    const formData = {
        companyID: companyID,
        shortCode: document.getElementById('shortCode').value,
        companyName: companyName,
        address: document.getElementById('address').value.charAt(0).toUpperCase() + document.getElementById('address').value.slice(1).toLowerCase(),
        city: document.getElementById('city').value,
        pinCode: document.getElementById('pinCode').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        email: document.getElementById('email').value,
        gstNumber: document.getElementById('gstNumber').value.toUpperCase(),
        panNumber: document.getElementById('panNumber').value.toUpperCase(),
        cinNo: document.getElementById('cinNo').value,
        uaNo: document.getElementById('uaNo').value,
        website: document.getElementById('website').value,
        createdBy: localStorage.getItem('UserLoginID')
    };

    const action = (saveButton.textContent === 'Save') ? 'add' : 'update';
    // const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETID}/values/${COMPANY_PROFILE_RANGE}?key=${APIKEY}`;
    fetch(CompanyProfile_URL, {
        method: 'POST',
        mode: 'no-cors',  // Changed to 'cors' to allow for JSON response
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
