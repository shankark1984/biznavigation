document.addEventListener('DOMContentLoaded', function () {
    // Array of button IDs to disable
    const buttonIds = ['newButton', 'modifyButton', 'deleteButton', 'reportButton', 'saveButton'];

    // Disable each button if it exists
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = true;
        }
    });
});

// Enable all form inputs
function enableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = false);
}
// Disable all form inputs
function disableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = true);
}
// Clear all input fields and select elements
function clearForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => {
        input.value = '';  // Reset the value
        if (input.type === 'checkbox') {
            input.checked = false;  // Uncheck if it's a checkbox
        }
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;  // Reset the select to the first option
        }
    });
}

async function loadcompanyShortCode() {
    try {
        // Query Supabase table to fetch company profile data
        const { data, error } = await supabaseClient
            .from('company_profile') // Replace 'CompanyProfile' with your actual table name in Supabase 
            .select('company_id, short_code');

        if (error) {
            throw error;  // Handle errors
        }

        if (!data || data.length === 0) {
            console.error("No data found in the Supabase table.");
            return;
        }

        // Loop through the fetched data and store relevant information
        data.forEach(row => {
            const companyid = row.company_id;
            const shortCode = row.short_code;
            let CompanyID = localStorage.getItem('CompanyID');

            // Assuming 'companyID' is available in your scope
            if (companyid === CompanyID) {
                localStorage.setItem('companyShortCode', shortCode); // Store shortCode in localStorage
            }
        });

        // Log the stored data for verification
        console.log("Stored Company Short Codes:", localStorage.getItem('companyShortCode'));

    } catch (error) {
        console.error("Error fetching data from Supabase:", error.message);
        alert("Failed to load data. Please try again later.");
    }
}

// Load the data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadcompanyShortCode();
});

function toProperCase(str) {
    return str
        .toLowerCase() // Convert the entire string to lowercase
        .split(' ') // Split the string into an array of words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
        .join(' '); // Join the words back into a single string
}

// Function to format date as dd-mm-yyyy
function formatDate(dateString) {
    let dateObj = new Date(dateString);  // Convert to Date object

    // Ensure the date is valid
    if (!isNaN(dateObj.getTime())) {
        let day = ("0" + dateObj.getDate()).slice(-2);  // Ensure two digits for the day
        let month = ("0" + (dateObj.getMonth() + 1)).slice(-2);  // Get month (0-indexed, add 1)
        let year = dateObj.getFullYear();  // Get the year

        return `${day}-${month}-${year}`;  // Return formatted date
    } else {
        return '';  // Return empty string if date is invalid
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

function formatCurrency(input) {
    let value = parseFloat(input.value).toFixed(2);
    if (!isNaN(value)) {
        input.value = value;
    } else {
        input.value = '0.00';
    }
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