// Enable all form inputs
function enableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = false);
}
// Disable all form inputs, selects, textareas, and options
function disableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = true);
}

// Clear all input fields and select elements
function clearForm() {
    const inputs = document.querySelectorAll("input, select, textarea");

    inputs.forEach(input => {
        if (input.type === "checkbox" || input.type === "radio") {
            input.checked = false; // Uncheck checkboxes and radio buttons
        } else {
            input.value = ""; // Clear text inputs and textareas
        }

        if (input.tagName === "SELECT") {
            input.selectedIndex = 0; // Reset <select> dropdowns to first option
        }
    });
}

function formatCurrency(input) {
    let value = parseFloat(input.value).toFixed(2);
    if (!isNaN(value)) {
        input.value = value;
    } else {
        input.value = '0.00';
    }
}

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

// Helper function to capitalize first letter of each word
function capitalize(text) {
    if (typeof text !== 'string') {
        console.error('Input must be a string:', text);
        return ''; // Return an empty string or handle the error as needed
    }

    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Country Details
async function CountryDetails(inputValue, datalistId, inputId) {
    if (!inputValue) return;

    try {
        const { data, error } = await supabaseClient
            .from('Country_Details')
            .select('CountryCode, CountryName, Region')
            .ilike('CountryName', `%${inputValue}%`)
            .order('CountryName', { ascending: true });

        if (error) {
            console.error('Supabase query error:', error);
            return;
        }

        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = ''; // Clear old options

        data.forEach(country => {
            const option = document.createElement('option');
            option.value = country.CountryName;
            datalist.appendChild(option);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}


document.addEventListener('DOMContentLoaded', function () {
    const websiteInput = document.getElementById('website');
    if (websiteInput) {
        websiteInput.addEventListener('blur', function () {
            let url = this.value.trim();
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                this.value = 'https://' + url; // Default to HTTPS for security
            }
        });
    } else {
        console.warn("Element with ID 'website' not found.");
    }
});


// Function to toggle edit mode for delete buttons
// This function enables or disables the delete buttons based on the edit mode state    
let isEditMode = false;

function toggleEditMode(enable) {
    isEditMode = enable;
    document.querySelectorAll('.delete-row').forEach(btn => {
        btn.disabled = enable;
        enable ? btn.classList.add('disabled') : btn.classList.remove('disabled');
    });
    // Call this when entering edit/save mode:
    // toggleEditMode(true);
    // Call this when done:
    // toggleEditMode(false);
}

