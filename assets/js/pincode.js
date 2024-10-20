document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener('originPinCode', 'orgincity');
    setupPincodeListener('destinationPinCode', 'destinationcity');
    setupPincodeListener('pinCode', 'city');  // Third pincode listener
});

// Fetch city, state, and country based on pin code
async function setupPincodeListener(pinCodeFieldId, cityFieldId) {
    const pincodeInput = document.getElementById(pinCodeFieldId);
    if (!pincodeInput) {
        console.error(`Pincode input not found: ${pinCodeFieldId}`);
        return;
    }

    pincodeInput.addEventListener('blur', async function () {
        const pincode = this.value.trim();

        // Validate pin code length and numeric value
        if (pincode.length !== 6 || isNaN(pincode)) {
            pincodeInput.style.border = '2px solid red'; // Add red border
            // alert('Please enter a valid 6-digit pin code.');
            return;
        } else {
            pincodeInput.style.border = ''; // Reset border if valid
        }

        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (data[0].Status === "Success") {
                const postOffice = data[0].PostOffice[0];

                // Update city, state, and country fields
                updateFieldValue(cityFieldId, postOffice.District);
                updateFieldValue('state', postOffice.State);
                updateFieldValue('country', 'India');
            } else {
                // Handle invalid pincode case
                // alert('Invalid Pincode');
                clearFields(['city', 'state', 'country']);

                // Check for the pincode in the Supabase table
                const { data: missingPincode, error } = await supabaseClient
                    .from('missing_pincodes')
                    .select('*')
                    .eq('pincode', pincode);

                if (missingPincode && missingPincode.length > 0) {
                    const row = missingPincode[0];

                    // Update city, state, and country based on the data
                    updateFieldValue(cityFieldId, row.city);
                    updateFieldValue('state', row.state);
                    updateFieldValue('country', row.country);
                } else {
                    pincodeInput.style.border = '2px solid red'; // Add red border
                    console.error('Pincode not found in missing_pincodes table', error);
                    alert('Invalid Pincode');
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    });
}

// Utility functions to update field values
function updateFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = value;
    }
}

// Helper function to update field value
function updateFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = value;
    } else {
        console.error(`Field not found: ${fieldId}`);
    }
}

// Helper function to clear multiple fields
function clearFields(fieldIds) {
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
        }
    });
}
