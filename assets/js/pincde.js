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
        if (pincode.length !== 6) {
            // alert('Please enter a valid 6-digit pin code.');
            return;
        }

        fetch(`https://api.postalpincode.in/pincode/${pincode}`)
            .then(response => response.json())
            .then(data => {
                if (data[0].Status === "Success") {
                    const postOffice = data[0].PostOffice[0];

                    // Null check before setting the value
                    const cityField = document.getElementById(cityFieldId);
                    if (cityField) {
                        cityField.value = postOffice.District;
                    } else {
                        console.error(`City field not found: ${cityFieldId}`);
                    }

                    const stateField = document.getElementById('state');
                    if (stateField) {
                        stateField.value = postOffice.State;
                    } else {
                        console.error(`State field not found`);
                    }

                    const countryField = document.getElementById('country');
                    if (countryField) {
                        countryField.value = "India";
                    } else {
                        console.error(`Country field not found`);
                    }
                } else {
                    alert('Invalid Pincode');
                    ['city', 'state', 'country'].forEach(id => {
                        const field = document.getElementById(id);
                        if (field) field.value = '';
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    });
}
