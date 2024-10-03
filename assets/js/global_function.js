const TAX_APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycby2NbZ-5OgNIu5sSpr-u-fcIVJfmoFmPFykJ6xKb4CUJuYGrignWfX6f4AMQ0yikADX/exec';

let companyID = localStorage.getItem('CompanyID');
let user_Type = localStorage.getItem('UserType');
let user_LoginID=localStorage.getItem('UserLoginID');

// Fetch city, state, and country based on pin code
document.getElementById('pinCode').addEventListener('blur', function() {
    const pincode = this.value.trim(); // Remove any extra spaces
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
                document.getElementById('country').value = "India"; // Specific to India
            } else {
                alert('Invalid Pincode');
                document.getElementById('city').value = '';
                document.getElementById('state').value = '';
                document.getElementById('country').value = '';
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            alert('Failed to fetch data. Please check your internet connection.');
        });
});


    document.addEventListener('DOMContentLoaded', function() {
        fetch(TAX_APPS_SCRIPT_URL) // Replace with your Google Apps Script URL
            .then(response => response.json())
            .then(data => {
                const taxSelect = document.getElementById('defaulttax');
                data.forEach(description => {
                    const option = document.createElement('option');
                    option.value = description; // You can set a different value if needed
                    option.textContent = description;
                    taxSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching tax descriptions:', error));
    });

// Disable buttons based on user type
// document.addEventListener('DOMContentLoaded', () => {

//     if (user_Type == 1) {
//         document.getElementById('newButton').disabled = false;
//         document.getElementById('modifyButton').disabled = true;
//         document.getElementById('deleteButton').disabled = true;
//         document.getElementById('reportButton').disabled = true;
//         document.getElementById('saveButton').disabled = true;
//     } else if (user_Type == 2 || user_Type == 3) {
//         document.getElementById('newButton').disabled = true;
//         document.getElementById('modifyButton').disabled = true;
//         document.getElementById('deleteButton').disabled = true;
//         document.getElementById('reportButton').disabled = true;
//         document.getElementById('saveButton').disabled = true;
//     }
// });