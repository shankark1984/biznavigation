document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener('originPinCode', 'orgincity');
    setupPincodeListener('destinationPinCode', 'destinationcity');
    setupPincodeListener('pinCode', 'city');
    setupPincodeListener('billingPinCode', 'billingCity', 'billingState', 'billingCountry');
});

// Fetch city, state, and country based on pin code
async function setupPincodeListener(pinCodeFieldId, cityFieldId, stateFieldId = 'state', countryFieldId = 'country') {
    const pincodeInput = document.getElementById(pinCodeFieldId);
    if (!pincodeInput) {
        console.error(`Pincode input not found: ${pinCodeFieldId}`);
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
