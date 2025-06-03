// DOM references
const originInput = document.getElementById('originList');
const originDatalist = document.getElementById('originListDatalist');
const destinationInput = document.getElementById('destinationList');
const destinationDatalist = document.getElementById('destinationListDatalist');
const movementTypeSel = document.getElementById('movementType');
const transitTypeSel = document.getElementById('transitType');
const currencyInput = document.getElementById('currencyCode');
const currencyDatalist = document.getElementById('currencyListDatalist');

// Attach pin code listeners on DOM load
document.addEventListener('DOMContentLoaded', function () {
    setupPincodeListener('originPinCode', 'orgincity');
    setupPincodeListener('destinationPinCode', 'destinationcity');
    setupPincodeListener('pinCode', 'city');
    setupPincodeListener('billingPinCode', 'billingCity', 'billingState', 'billingCountry');
    setupPincodeListener('branchPinCode', 'branchCity', 'branchState', 'branchCountry');
    // setupBankListener('branchIFSCCode', 'branchBankName', 'branchAcBankName', 'branchMICRCode', 'branchBankAddress');
});

// Pin code blur handler
async function setupPincodeListener(pinCodeFieldId, cityFieldId, stateFieldId = 'state', countryFieldId = 'country') {
    const pincodeInput = document.getElementById(pinCodeFieldId);
    if (!pincodeInput) return;

    pincodeInput.addEventListener('blur', async function () {
        const pincode = this.value.trim();
        resetError(pincodeInput);

        if (!/^\d{6}$/.test(pincode)) {
            displayError(pincodeInput, 'Please enter a valid 6-digit pin code.');
            return;
        }

        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (data[0].Status === "Success") {
                const postOffice = data[0].PostOffice[0];
                updateFieldValue(cityFieldId, postOffice.District);
                updateFieldValue(stateFieldId, postOffice.State);
                updateFieldValue(countryFieldId, 'India');
            } else {
                clearFields([cityFieldId, stateFieldId, countryFieldId]);

                const { data: missingPincode, error } = await supabaseClient
                    .from('missing_pincodes')
                    .select('*')
                    .eq('pincode', pincode);

                if (missingPincode && missingPincode.length > 0) {
                    const row = missingPincode[0];
                    updateFieldValue(cityFieldId, row.city);
                    updateFieldValue(stateFieldId, row.state);
                    updateFieldValue(countryFieldId, row.country);
                } else {
                    displayError(pincodeInput, 'Invalid Pincode. Not found in the database.');
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            displayError(pincodeInput, 'Error fetching pin code info. Try again later.');
        }
    });

    // Clear error while editing
    pincodeInput.addEventListener('input', () => resetError(pincodeInput));
}

// Error display
function displayError(inputField, message) {
    inputField.style.border = '2px solid red';
    let errorElement = inputField.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('error-message')) {
        errorElement = document.createElement('span');
        errorElement.classList.add('error-message');
        errorElement.style.color = 'red';
        errorElement.style.fontSize = '12px';
        inputField.parentNode.insertBefore(errorElement, inputField.nextSibling);
    }
    errorElement.textContent = message;
}

function resetError(inputField) {
    inputField.style.border = '';
    const errorElement = inputField.nextElementSibling;
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.remove();
    }
}

// Utility for setting/clearing field values
function updateFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) field.value = value;
    else console.error(`Field not found: ${fieldId}`);
}

function clearFields(fieldIds) {
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

// Supabase city suggestions
async function fetchCitySuggestions(term, limit = 10) {
    if (!term) return [];
    const { data, error } = await supabaseClient
        .from('CityDetails')
        .select('CityName')
        .ilike('CityName', `${term}%`)
        .order('CityName')
        .limit(limit);

    if (error) {
        console.error('Supabase fetch error (cities):', error.message);
        return [];
    }

    return data;
}

// Supabase country suggestions
async function fetchCountrySuggestions(term, limit = 10) {
    if (!term) return [];
    const { data, error } = await supabaseClient
        .from('Country_Details')
        .select('CountryName')
        .ilike('CountryName', `%${term}%`)
        .order('CountryName')
        .limit(limit);

    if (error) {
        console.error('Supabase fetch error (countries):', error.message);
        return [];
    }

    return data;
}

// Populate datalist
function updateDatalist(datalistEl, items, key) {
    datalistEl.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[key];
        datalistEl.appendChild(option);
    });
}

// Debounce helper
function debounce(fn, delay = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Whether to suggest country vs city
function shouldSuggestCountries() {
    return (
        ['Export', 'Import'].includes(movementTypeSel.value) &&
        ['By Sea Freight', 'By Air Freight'].includes(transitTypeSel.value)
    );
}

// Input handler for origin/destination fields
async function handleInput(e, datalistEl) {
    const term = e.target.value.trim();

    if (term.length < 2) {
        datalistEl.innerHTML = '';
        return;
    }

    if (shouldSuggestCountries()) {
        const countries = await fetchCountrySuggestions(term);
        updateDatalist(datalistEl, countries, 'CountryName');
    } else {
        const cities = await fetchCitySuggestions(term);
        updateDatalist(datalistEl, cities, 'CityName');
    }
}

// Attach listeners
originInput.addEventListener('input', debounce(e => handleInput(e, originDatalist), 300));
destinationInput.addEventListener('input', debounce(e => handleInput(e, destinationDatalist), 300));

// Update suggestions if movement/transit type changes
[movementTypeSel, transitTypeSel].forEach(sel =>
    sel.addEventListener('change', () => {
        originInput.dispatchEvent(new Event('input'));
        destinationInput.dispatchEvent(new Event('input'));
    })
);
// 👇 Validate value matches one from datalist
function validateAgainstDatalist(inputEl, datalistEl, errorMessage = 'Invalid entry!') {
    const inputValue = inputEl.value.trim().toLowerCase();
    const options = Array.from(datalistEl.options).map(opt => opt.value.toLowerCase());

    if (!options.includes(inputValue)) {
        displayError(inputEl, errorMessage);
        // inputEl.value = ''; // optional: clear invalid entry
    } else {
        resetError(inputEl);
    }
}

// 👇 Attach blur + input listeners for validation
originInput.addEventListener('blur', () => {
    validateAgainstDatalist(originInput, originDatalist);
});
destinationInput.addEventListener('blur', () => {
    validateAgainstDatalist(destinationInput, destinationDatalist);
});

// 👇 Clear error as user types
originInput.addEventListener('input', () => resetError(originInput));
destinationInput.addEventListener('input', () => resetError(destinationInput));

// Fetch currency suggestions from Supabase
async function fetchCurrencySuggestions(term, limit = 10) {
    if (!term) return [];
    const { data, error } = await supabaseClient
        .from('Country_Details')
        .select('CurrencyCode')
        .ilike('CurrencyCode', `${term}%`)
        .order('CurrencyCode')
        .limit(limit);

    if (error) {
        console.error('Supabase fetch error (currency):', error.message);
        return [];
    }

    return data;
}


function updateCurrencyDatalist(datalistEl, items) {
    datalistEl.innerHTML = '';
    const seen = new Set(); // Avoid duplicates if same code in multiple countries
    items.forEach(item => {
        if (!seen.has(item.CurrencyCode)) {
            const option = document.createElement('option');
            option.value = item.CurrencyCode;
            datalistEl.appendChild(option);
            seen.add(item.CurrencyCode);
        }
    });
}

currencyInput.addEventListener('input', debounce(async function (e) {
    const term = e.target.value.trim();
    const currencies = await fetchCurrencySuggestions(term);
    updateCurrencyDatalist(currencyDatalist, currencies);
}, 300));

currencyInput.addEventListener('blur', () => {
    validateAgainstDatalist(currencyInput, currencyDatalist, 'Invalid currency code!');
});
currencyInput.addEventListener('input', () => resetError(currencyInput));

document.addEventListener('DOMContentLoaded', () => {
    enforceUppercaseOnly(document.getElementById('currencyList'));
});