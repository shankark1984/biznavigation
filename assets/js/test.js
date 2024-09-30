const GSTIN_API="http://sheet.gstincheck.co.in/check/50ef1c32d668a8432ac5e7c2acfa48e6/";
// PAN Number Validation
document.getElementById('panNumber').addEventListener('blur', function() {
    const panNumber = this.value.trim(); // Trim to remove any extra spaces
    if (panNumber) { // Only validate if there is a value
        fetch('https://www.panvalidation.com/api/panvalidation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pan_number: panNumber }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                console.log("PAN is valid");
            } else {
                alert("Invalid PAN: " + (data.message || "Unable to validate PAN"));
            }
        })
        .catch(error => console.error('Error:', error));
    } else {
        alert("Please enter a PAN number");
    }
});

// GST Number Validation
document.getElementById('gstNumber').addEventListener('blur', function() {
    const gstNumber = this.value.trim(); // Trim to remove any extra spaces
    if (gstNumber) { // Only validate if there is a value
        fetch(`${GSTIN_API}${gstNumber}`, { // Corrected string interpolation syntax
            method: 'GET', // Use GET method as per the likely structure of the API
            headers: {
                'Content-Type': 'application/json',
            }
            // Removed body since GET request typically does not have a body
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        
        .then(data => {
            console.log(data.message);
            if (data.message === "GSTIN  found.") {
                console.log("GST is valid");
            } else {
                alert("Invalid GST: " + (data.message || "Unable to validate GST"));
                // return
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to validate GST. Please check the service or try again later.');
        });
    } else {
        alert("Please enter a GST number");
    }
});