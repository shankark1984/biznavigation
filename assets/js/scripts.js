document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger');
    const menuBar = document.querySelector('.menu-bar');
    const menuItems = document.querySelector('.menu-items');
    const userInfo = document.querySelector('.user-info');
    const logoutBtn = document.querySelector('.logout-btn');
    const userLoginIDSpan = document.getElementById('userLoginID');

    if (hamburger && menuBar && menuItems && userInfo) {
        hamburger.addEventListener('click', function () {
            menuBar.classList.toggle('active');
            menuItems.classList.toggle('active');
            userInfo.classList.toggle('active');
        });
    } else {
        console.error('One or more menu elements not found');
    }

    function loadUserInfo() {
        const userLoginID = localStorage.getItem('UserLoginID');
        if (userLoginID && userLoginIDSpan) {
            userLoginIDSpan.textContent = userLoginID;
        } else {
            // If no user is logged in, redirect to login page
            window.location.href = 'index.html';
        }
    }

    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('EmpCode');
        localStorage.removeItem('UserName');
        localStorage.removeItem('UserLoginID');
        localStorage.removeItem('UserType');
        localStorage.removeItem('CompanyID');
        localStorage.removeItem('WorkingBranch');
        localStorage.removeItem('CompanyShortCode');

        window.location.href = 'index.html';
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('Logout button not found');
    }


    // Load user info when the page loads
    loadUserInfo();
});

function formatCurrency(input) {
    let value = parseFloat(input.value).toFixed(2);
    if (!isNaN(value)) {
        input.value = value;
    } else {
        input.value = '0.00';
    }
}

// Function to generate a unique temporary form ID
function generateTempFormID() {
    // Generate a random unique identifier, e.g., using current timestamp and random numbers
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000); // 4-digit random number

    return `TEMP-${timestamp}-${randomNum}`;
}

// Assign TempFormID when the form is opened (or page is loaded)
window.addEventListener('DOMContentLoaded', function () {
    const tempFormIDElement = document.getElementById('tempFormID');
    if (tempFormIDElement) {
        const tempFormID = generateTempFormID(); // Generate tempFormID
        tempFormIDElement.value = tempFormID; // Set the hidden input value
        console.log('TempFormID generated: ' + tempFormID); // Log for debugging
    } else {
        console.error('tempFormID element not found.');
    }
});



// Load Party Details
function getPartyDetails(partyName,callback) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PartyDetails_SHEETID}/values/${PartyDetails_RANGE}?key=${APIKEY}`;

    $.getJSON(url, function (data) {
        const rows = data.values;


        if (!rows || rows.length === 0) {
            console.log("No data found");
            return;
        }
        // Filter rows by companyID, assuming companyID is in column 31 (index 30)
        const filteredRows = rows.filter(row => row[31] === companyID && row[2] === partyName);

        if (filteredRows.length === 0) {
            console.log("No matching party details found.");
            return;
        }

        // Mapping filtered rows to a details object
        const partyDetails = filteredRows.map(row => ({
            partyType: row[1], // Assuming party type is in column 2 (index 1)
            partyCode: row[0], // Assuming party code is in column 1 (index 0)
            partyName: row[2], // Party Name (index 2)
            currentStatus: row[27], // Assuming current status is in column 28 (index 27)
            deActiveDate: row[28], // Assuming de-active date is in column 29 (index 28)
            address: row[10], // Assuming address is in column 11 (index 10)
            pinCode: row[12], // Assuming pin code is in column 13 (index 12)
            city: row[11], // Assuming city is in column 12 (index 11)
            state: row[13], // Assuming state is in column 14 (index 13)
            country: row[14], // Assuming country is in column 15 (index 14)
            panNumber: row[15], // Assuming PAN number is in column 16 (index 15)
            gSTNumber: row[16], // Assuming GST number is in column 17 (index 16)
            contactNumber: row[4], // Assuming contact number is in column 5 (index 4)
            emailID: row[9], // Assuming email ID is in column 10 (index 9)
            defaultTax: row[26], // Assuming default tax is in column 27 (index 26)
            // Add other fields as necessary
        }));

        callback(partyDetails)
        // Do something with the party details, like return or process it further
        return partyDetails;
    }).fail(function() {
        console.log("Error fetching party details from Google Sheets.");
    });
}

// Function to handle tab switching
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}
