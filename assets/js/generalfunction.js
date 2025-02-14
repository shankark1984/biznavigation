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

// Helper function to dynamically load data based on query and type_of_value
async function loadDropdownData(query, typeOfValue, datalistId) {
    try {
        // Query the "dropdown_list" table, filter by "type_of_value"
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description')
            .eq('type_of_value', typeOfValue) // Filter by type_of_value
            .in('company_id', ['All', companyID])
            .ilike('description', `%${query}%`); // Case-insensitive partial matching on description

        if (error) {
            console.error(`Error fetching data for ${typeOfValue}:`, error);
            return;
        }

        // Populate the datalist with the fetched descriptions
        const suggestions = data
            .map(type => `<option value="${type.description}">${type.description}</option>`)
            .join('');
        document.getElementById(datalistId).innerHTML = suggestions; // Update the datalist
    } catch (error) {
        console.error(`Error loading ${typeOfValue} details:`, error);
    }
}

// Helper function to validate input
function validateInput(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const enteredValue = input.value.trim(); // Trim to avoid accidental spaces
    const datalist = document.getElementById(datalistId);
    const options = Array.from(datalist.getElementsByTagName('option'));

    const isValid = options.some(option => option.value === enteredValue);

    if (!isValid && enteredValue !== '') {
        input.setCustomValidity('Please select a valid value from the list');
    } else if (enteredValue === '') {
        // Auto-focus the next field if input is empty
        const nextInput = input.nextElementSibling;
        if (nextInput && nextInput.tagName.toLowerCase() === 'input') {
            nextInput.focus();
        }
        input.setCustomValidity('');
    } else {
        input.setCustomValidity('');
    }

    input.reportValidity(); // Trigger browser validation message
}

// General event listener for inputs to trigger validation and load data
function addInputEventListener(inputId, queryFunction, datalistId) {
    document.getElementById(inputId).addEventListener('input', (event) => {
        const query = event.target.value;
        queryFunction(query); // Call the respective function to load data based on user input
    });

    // Validation on blur (focus loss)
    document.getElementById(inputId).addEventListener('blur', () => validateInput(inputId, datalistId));
}

// Function to dynamically load Service Provider based on user input
async function serviceProviderDetails(query, typeOfValue, datalistId) {
    try {
        // Query the "party_details" table, filter by "party_name" using case-insensitive partial matching
        const { data: serviceProvider, error } = await supabaseClient
            .from('party_details')
            .select('party_name, party_code')
            .eq('company_id', companyID)
            .ilike('party_name', `%${query}%`); // Case-insensitive partial matching on party_name

        if (error) {
            console.error('Error fetching service provider details:', error);
            return;
        }

        // Populate the datalist with the fetched service providers
        const suggestions = serviceProvider
            .map(provider => `<option value="${provider.party_name}" data-code="${provider.party_code}"> (${provider.party_code})</option>`)
            .join('');
        document.getElementById('serviceProviderSuggestions').innerHTML = suggestions; // Update the datalist
    } catch (error) {
        console.error('Error loading Service Provider details:', error);
    }
}

async function PartyAddressDetails(query, typeOfValue, datalistId) {
    console.log('Fetching addresses...' + companyID);
    
    if (!query.trim()) {
        document.getElementById(datalistId).innerHTML = ''; // Clear suggestions if input is empty
        return;
    }

    try {
        const { data: partyAddress, error } = await supabaseClient
            .from('Party_Address')
            .select('Address')
            .eq('Company_ID', companyID) // Ensure companyID is defined
            .ilike('Address', `%${query}%`);

        if (error) {
            console.error('Error fetching Party Address details:', error);
            return;
        }

        const partyAddressList = partyAddress.map(row => ({
            PartyAddress: row.Address
        }));

        partyAddressSuggestions(partyAddressList, datalistId);
    } catch (error) {
        console.error('Error loading party address details:', error);
    }
}

function partyAddressSuggestions(partyAddressList, datalistId) {
    const suggestions = partyAddressList
        .map(pAddress => `<option value="${pAddress.PartyAddress}">${pAddress.PartyAddress}</option>`)
        .join('');

    document.getElementById(datalistId).innerHTML = suggestions;
}



// Initialize dynamic data loading and event listeners
function initialize() {
    // Load data for different fields
    addInputEventListener('transactionType', (query) => loadDropdownData(query, 'Transactiontype', 'transactionTypeSuggestions'), 'transactionTypeSuggestions');
    addInputEventListener('transitTypeInternational', (query) => loadDropdownData(query, 'TransitType_i', 'transitTypeInternationalSuggestions'), 'transitTypeInternationalSuggestions');
    addInputEventListener('modeType', (query) => loadDropdownData(query, 'ModeType', 'modeTypeSuggestions'), 'modeTypeSuggestions');
    addInputEventListener('shippingType', (query) => loadDropdownData(query, 'Shippingtype', 'shippingTypeSuggestions'), 'shippingTypeSuggestions');
    addInputEventListener('carrierName', (query) => loadDropdownData(query, 'Cargocarrier', 'cargoCarrierSuggestions'), 'cargoCarrierSuggestions');
    addInputEventListener('serviceProvider', (query) => serviceProviderDetails(query, 'party_details', 'serviceProviderSuggestions'), 'serviceProviderSuggestions');
    // addInputEventListener('PartyAddress', (query) => PartyAddressDetails(query, 'Party_Address', 'PartyAddressSuggestions'), 'PartyAddressSuggestions');
}

// Call initialize function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initialize);

