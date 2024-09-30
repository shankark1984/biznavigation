const CP_SCRIPT_APP_URL = 'https://script.google.com/macros/s/AKfycbxn8YqaGU6nWqzilFgByhY5e54CQ0SvjrXGdLx5zMGb_tizdjd7dcdFuCjg64cwxmcJ/exec';


// Function to handle tab switching
function openTab(event, tabId) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }

    const tabLinks = document.getElementsByClassName('tab-links')[0].children;
    for (let j = 0; j < tabLinks.length; j++) {
        tabLinks[j].classList.remove('active');
    }

    document.getElementById(tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
}

// Initially show the first tab content (branchDetails)
document.getElementById('branchDetails').style.display = 'block';

// DOM content loaded event for fetching company data
document.addEventListener('DOMContentLoaded', () => {
    const companyID = localStorage.getItem('CompanyID');
    document.getElementById('CompID').textContent = companyID;
    if (companyID) {
        fetch(`${CP_SCRIPT_APP_URL}?CompanyID=${companyID}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Company not found');
                } else {
                    // Fill in the form fields with fetched data
                    document.getElementById('shortCode').value = data.ShortCode || '';
                    document.getElementById('companyName').value = data.CompanyName || '';
                    document.getElementById('address').value = data.Address || '';
                    document.getElementById('city').value = data.City || '';
                    document.getElementById('pinCode').value = data.PinCode || '';
                    document.getElementById('state').value = data.State || '';
                    document.getElementById('country').value = data.Country || '';
                    document.getElementById('phoneNumber').value = data.PhoneNo || '';
                    document.getElementById('email').value = data.Email || '';
                    document.getElementById('gstNumber').value = data.GSTNumber || '';
                    document.getElementById('panNumber').value = data.PANNumber || '';
                    document.getElementById('cinNo').value = data.CINNo || '';
                    document.getElementById('uaNo').value = data.UdyogAadhaarNo || '';
                    document.getElementById('website').value = data.Website || '';

                    if (user_Type == 1 || user_Type == 2) {
                        document.getElementById('modifyButton').disabled = false;
                    } else {
                        document.getElementById('modifyButton').disabled = true;
                    }
                    // Display the logo if available
                    const logoElement = document.querySelector('.company-logo');

                    if (data.Logo && logoElement) {
                        logoElement.src = data.Logo;
                        logoElement.style.display = 'block';
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching company data:', error);
            });
    } else {
        alert('No CompanyID found in localStorage');
    }
});

// Disable buttons based on user type
document.addEventListener('DOMContentLoaded', () => {

    if (user_Type == 1) {
        document.getElementById('newButton').disabled = false;
        document.getElementById('modifyButton').disabled = true;
        document.getElementById('deleteButton').disabled = true;
        document.getElementById('reportButton').disabled = true;
        document.getElementById('saveButton').disabled = true;
    } else if (user_Type == 2 || user_Type == 3) {
        document.getElementById('newButton').disabled = true;
        document.getElementById('modifyButton').disabled = true;
        document.getElementById('deleteButton').disabled = true;
        document.getElementById('reportButton').disabled = true;
        document.getElementById('saveButton').disabled = true;
    }
});

// Form modification logic
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('companyForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    const modifyButton = document.getElementById('modifyButton');
    const saveButton = document.getElementById('saveButton');
    const newButton = document.getElementById('newButton');

    // Disable all input fields on page load
    inputs.forEach(input => input.disabled = true);
    saveButton.disabled = true;

    // Enable inputs when Modify button is clicked
    modifyButton.addEventListener('click', () => {
        inputs.forEach(input => input.disabled = false);
        saveButton.disabled = false;
        saveButton.textContent = 'Update';
        modifyButton.disabled = true;
    });

    // Clear and enable inputs when New button is clicked
    if (newButton) {
        newButton.addEventListener('click', () => {
            inputs.forEach(input => {
                input.disabled = false;
                input.value = '';  // Clear form for new entry
            });
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
            modifyButton.disabled = true;
        });
    }
});

// Save or update form data
document.getElementById('saveButton').addEventListener('click', function (event) {
    event.preventDefault();

    const companyID = localStorage.getItem('CompanyID') || null;

    // Get form values
    const formData = {
        companyID: companyID,
        shortCode: document.getElementById('shortCode').value,
        companyName: document.getElementById('companyName').value,
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

    fetch(CP_SCRIPT_APP_URL, {
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
