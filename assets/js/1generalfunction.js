// document.addEventListener('DOMContentLoaded', function () {
//     // Array of button IDs to disable
//     const buttonIds = ['newButton', 'modifyButton', 'deleteButton', 'reportButton', 'saveButton'];

//     // Disable each button if it exists
//     buttonIds.forEach(id => {
//         const button = document.getElementById(id);
//         if (button) {
//             button.disabled = true;
//         }
//     });
// });

// document.querySelectorAll('input[type="number"]').forEach(function (input) {
//     input.addEventListener("blur", function () {
//         if (this.value) {
//             this.value = parseFloat(this.value).toFixed(2);
//         }
//     });
// });


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

    let errorMessageElement = document.getElementById(`${inputId}-error`);

    // Check if entered value matches any option
    const isValid = options.some(option => option.value === enteredValue);

    if (!isValid && enteredValue !== '') {
        if (!errorMessageElement) {
            errorMessageElement = document.createElement('span');
            errorMessageElement.id = `${inputId}-error`;
            errorMessageElement.style.color = 'red';
            errorMessageElement.style.fontSize = '12px';
            errorMessageElement.style.marginLeft = '10px';
            input.parentNode.appendChild(errorMessageElement);
        }
        errorMessageElement.textContent = 'No valid entry';
        input.setCustomValidity('Invalid selection');
        input.reportValidity();
        setTimeout(() => input.focus(), 1); // Keep focus on the input field
    } else {
        input.setCustomValidity('');
        if (errorMessageElement) {
            errorMessageElement.remove(); // **Remove the error message element**
        }
    }

    input.reportValidity();
}



// Attach validation event to inputs
function attachValidation(inputId, datalistId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;

    inputElement.addEventListener('blur', () => validateInput(inputId, datalistId));
}

// Call `attachValidation` for all fields that require validation
function initializeValidation() {
    attachValidation('partyName', 'partySuggestions');
    attachValidation('transactionType', 'transactionTypeSuggestions');
    attachValidation('transitTypeInternational', 'transitTypeInternationalSuggestions');
    attachValidation('movementType', 'movementTypeSuggestions');
    attachValidation('modeType', 'modeTypeSuggestions');
    attachValidation('shippingType', 'shippingTypeSuggestions');
    attachValidation('carrierName', 'cargoCarrierSuggestions');
    attachValidation('serviceProvider', 'serviceProviderSuggestions');
    attachValidation('commodity', 'commoditySuggestions');
    attachValidation('clearanceMode', 'clearanceModeSuggestions');
    attachValidation('originCountry', 'originCountrySuggestions');
    attachValidation('destinationCountry', 'destinationCountrySuggestions');
    attachValidation('packingType', 'packingTypeSuggestions');
    attachValidation('uOMType', 'uOMTypeSuggestions');
}

// Ensure validation runs when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeValidation);


// General event listener for inputs to trigger validation and load data
function addInputEventListener(inputId, callback, datalistId) {
    const inputElement = document.getElementById(inputId);

    if (!inputElement) return;

    inputElement.addEventListener('input', (event) => {
        const query = event.target.value;
        callback(query);
    });

    inputElement.addEventListener('focus', () => {
        callback(''); // Trigger search with an empty query to load all options
    });
}


// Initialize dynamic data loading and event listeners
function initialize() {
    // Load data for different fields
    addInputEventListener('transactionType', (query) => loadDropdownData(query, 'Transactiontype', 'transactionTypeSuggestions'), 'transactionTypeSuggestions');
    addInputEventListener('transitTypeInternational', (query) => loadDropdownData(query, 'TransitType_i', 'transitTypeInternationalSuggestions'), 'transitTypeInternationalSuggestions');
    addInputEventListener('modeType', (query) => loadDropdownData(query, 'ModeType', 'modeTypeSuggestions'), 'modeTypeSuggestions');
    addInputEventListener('shippingType', (query) => loadDropdownData(query, 'Shippingtype', 'shippingTypeSuggestions'), 'shippingTypeSuggestions');
    addInputEventListener('carrierName', (query) => loadDropdownData(query, 'Cargocarrier', 'cargoCarrierSuggestions'), 'cargoCarrierSuggestions');
    addInputEventListener('serviceProvider', (query) => serviceProviderDetails(query, 'party_name', 'serviceProviderSuggestions'), 'serviceProviderSuggestions');
    addInputEventListener('commodity', (query) => loadDropdownData(query, 'Commodity', 'commoditySuggestions'), 'commoditySuggestions');
    addInputEventListener('clearanceMode', (query) => loadDropdownData(query, 'ClearanceMode', 'clearanceModeSuggestions'), 'clearanceModeSuggestions');
    addInputEventListener('packingType', (query) => loadDropdownData(query, 'PackingType', 'packingTypeSuggestions'), 'packingTypeSuggestions');
    addInputEventListener('uOMType', (query) => loadDropdownData(query, 'UOMType', 'uOMTypeSuggestions'), 'uOMTypeSuggestions');
    // addInputEventListener('movementType', (query) => loadDropdownData(query, 'movementType', 'movementTypeSuggestions'), 'movementTypeSuggestions');


}

// Call initialize function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initialize);

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
