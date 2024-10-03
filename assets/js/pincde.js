document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener();
});

// Fetch city, state, and country based on pin code
function setupPincodeListener() {
    const pincodeInput = document.getElementById('pinCode');
    if (!pincodeInput) {
        console.error('Pincode input not found');
        return;
    }

    pincodeInput.addEventListener('blur', function () {
        const pincode = this.value.trim();
        if (pincode.length !== 6) {
            alert('Please enter a valid 6-digit pin code.');
            return;
        }

        fetch(`https://api.postalpincode.in/pincode/${pincode}`)
            .then(response => response.json())
            .then(data => {
                if (data[0].Status === "Success") {
                    const postOffice = data[0].PostOffice[0];
                    document.getElementById('city').value = postOffice.District;
                    document.getElementById('state').value = postOffice.State;
                    document.getElementById('country').value = "India";
                } else {
                    alert('Invalid Pincode');
                    ['city', 'state', 'country'].forEach(id => document.getElementById(id).value = '');
                }
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                alert('Failed to fetch data.');
            })
            // .finally(() => hideLoading('pinCode', ''));
    });
}
