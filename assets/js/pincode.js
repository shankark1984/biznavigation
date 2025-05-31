document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener('originPinCode', 'orgincity');
    setupPincodeListener('destinationPinCode', 'destinationcity');
    setupPincodeListener('pinCode', 'city');
    setupPincodeListener('billingPinCode', 'billingCity', 'billingState', 'billingCountry');
    setupPincodeListener('branchPinCode', 'branchCity', 'branchState', 'branchCountry');
    // setupBankListener('branchIFSCCode', 'branchBankName', 'branchAcBankName', 'branchMICRCode', 'branchBankAddress');
});
$(document).on('input', '#branchIFSCCode', function () {
    setupBankListener('branchIFSCCode', 'branchBankName', 'branchAcBankName', 'branchMICRCode', 'branchBankAddress');
});

// Fetch city, state, and country based on pin code
async function setupPincodeListener(pinCodeFieldId, cityFieldId, stateFieldId = 'state', countryFieldId = 'country') {
    const pincodeInput = document.getElementById(pinCodeFieldId);
    if (!pincodeInput) {
        // console.warn(`Pincode input not found: ${pinCodeFieldId}`);
        return;
    }

    pincodeInput.addEventListener('blur', async function () {
        const pincode = this.value.trim();

        // Validate pin code length and numeric value
        if (pincode.length !== 6 || isNaN(pincode)) {
            displayError(pincodeInput, 'Please enter a valid 6-digit pin code.');
            return;
        } else {
            resetError(pincodeInput);
        }

        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (data[0].Status === "Success") {
                const postOffice = data[0].PostOffice[0];

                // Update city, state, and country fields
                updateFieldValue(cityFieldId, postOffice.District);
                updateFieldValue(stateFieldId, postOffice.State);
                updateFieldValue(countryFieldId, 'India');
            } else {
                // Clear fields and check Supabase for missing pincode
                clearFields([cityFieldId, stateFieldId, countryFieldId]);
                const { data: missingPincode, error } = await supabaseClient
                    .from('missing_pincodes')
                    .select('*')
                    .eq('pincode', pincode);

                if (missingPincode && missingPincode.length > 0) {
                    const row = missingPincode[0];
                    updateFieldValue(cityFieldId, row.city);
                    updateFieldValue(stateFieldId, row.state);
                    updateFieldValue(countryFieldId, row.country);
                } else {
                    displayError(pincodeInput, 'Invalid Pincode. Not found in the database.');
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    });
}

// Fetch Bank Name, Branch Name, MICR Code and Bank address based on IFSC
async function setupBankListener(ifscFieldId, bankNameFieldId, branchNameFieldId = 'Branch', micrCodeFieldId = 'MICR', addressFieldId = 'Address') {
    const ifscCode = document.getElementById(ifscFieldId);
    if (!ifscCode) {
        console.error(`IFSC input not found: ${ifscFieldId}`);
        return;
    }

    ifscCode.addEventListener('blur', async function () {
        const ifsc = this.value.trim();
        console.log('IFSC Code: ' + ifsc + ' | Length: ' + ifsc.length);

        // Validate IFSC code length (should be 11 characters)
        if (ifsc.length !== 11) {
            displayError(ifscCode, 'Please enter a valid 11-character IFSC code.');
            return;
        } else {
            resetError(ifscCode);
        }

        try {
            const response = await fetch(`https://bank-apis.justinclicks.com/API/V1/IFSC/${ifsc}/`);
            const data = await response.json();

            if (data && data.BANK) {
                // Update bank details
                updateFieldValue(bankNameFieldId, data.BANK || "N/A");
                updateFieldValue(branchNameFieldId, data.BRANCH || "N/A");
                updateFieldValue(micrCodeFieldId, data.MICR || "N/A");
                updateFieldValue(addressFieldId, data.ADDRESS || "N/A");
            } else {
                displayError(ifscCode, 'Invalid IFSC Code or API issue.');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            displayError(ifscCode, 'Failed to fetch bank details. Please try again.');
        }
    });
}

// Utility functions
function updateFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = value;
    } else {
        console.error(`Field not found: ${fieldId}`);
    }
}

function clearFields(fieldIds) {
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
        }
    });
}

function displayError(inputField, message) {
    inputField.style.border = '2px solid red';
    let errorElement = inputField.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('error-message')) {
        errorElement = document.createElement('span');
        errorElement.classList.add('error-message');
        errorElement.style.color = 'red';
        errorElement.style.fontSize = '12px';
        inputField.parentNode.insertBefore(errorElement, inputField.nextSibling);
    }
    errorElement.textContent = message;
}

function resetError(inputField) {
    inputField.style.border = '';
    const errorElement = inputField.nextElementSibling;
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.remove();
    }
}


//Get City Details 
function fetchCities(inputId, datalistId) {
    const query = document.getElementById(inputId).value.trim();
    const datalistElement = document.getElementById(datalistId);

    if (query.length < 2) {
        datalistElement.innerHTML = '';
        return;
    }

    supabaseClient
        .from('CityDetails')
        .select('CityName')
        .ilike('CityName', `${query}%`)
        .order('CityName', { ascending: true })
        .limit(10)
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching cities:', error);
                return;
            }

            datalistElement.innerHTML = '';

            data.forEach(city => {
                const option = document.createElement('option');
                option.value = city.CityName;
                datalistElement.appendChild(option);
            });
        });
}

document.getElementById('originList').addEventListener('input', function () {
    fetchCities('originList', 'originListDatalist');
});

document.getElementById('destinationList').addEventListener('input', function () {
    fetchCities('destinationList', 'destinationListDatalist');
});



