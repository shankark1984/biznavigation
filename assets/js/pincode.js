document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener('originPinCode', 'orgincity');
    setupPincodeListener('destinationPinCode', 'destinationcity');
    setupPincodeListener('pinCode', 'city');  // Third pincode listener
});

// Fetch city, state, and country based on pin code
function setupPincodeListener(pinCodeFieldId, cityFieldId) {
    const pincodeInput = document.getElementById(pinCodeFieldId);
    if (!pincodeInput) {
        console.error(`Pincode input not found: ${pinCodeFieldId}`);
        return;
    }

    pincodeInput.addEventListener('blur', function () {
        const pincode = this.value.trim();
        if (pincode.length !== 6 || isNaN(pincode)) {
            pincodeInput.style.border = '2px solid red'; // Add red border
            // alert('Please enter a valid 6-digit pin code.');
            return;
        }else{
            pincodeInput.style.border = ''; // Reset border if valid
        }

        fetch(`https://api.postalpincode.in/pincode/${pincode}`)
            .then(response => response.json())
            .then(data => {
                if (data[0].Status === "Success") {
                    const postOffice = data[0].PostOffice[0];

                    // Null check before setting the value
                    updateFieldValue(cityFieldId, postOffice.District);
                    updateFieldValue('state', postOffice.State);
                    updateFieldValue('country', 'India');
                } else {
                    alert('Invalid Pincode');
                    clearFields(['city', 'state', 'country']);
                }
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    });
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
