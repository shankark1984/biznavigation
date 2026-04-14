async function loadDropdownOptions(filterValue, dropdownId) {
    const selectElement = document.getElementById(dropdownId);
    if (!selectElement) return;

    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description, hsn_code')     // Include hsn_code here
            .in('company_id', ['All', CompanyID])
            .ilike('type_of_value', `%${filterValue}%`)
            .order('description', { ascending: true });

        if (error) {
            console.error(`Error fetching data from dropdown_list:`, error);
            return;
        }

        selectElement.innerHTML = '<option value="">Select an option</option>';

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.description;
            option.textContent = item.description;

            // Store hsn_code as a data attribute on the option element
            option.dataset.hsnCode = item.hsn_code || '';

            selectElement.appendChild(option);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Load Movement Types Example
document.addEventListener('DOMContentLoaded', () => {
    loadDropdownOptions('MovementType', 'movementType');
    loadDropdownOptions('TransitType', 'transitType');
    loadDropdownOptions('ModeType', 'modeType');
    loadDropdownOptions('Cargocarrier', 'carrierName');
    loadDropdownOptions('ShippingType', 'shippingType');
    loadDropdownOptions('UOMType', 'uomType');
    loadDropdownOptions('ChargesType', 'chargesTypeList');
});

// Centralized configuration for input and datalist IDs with their corresponding value types
const fieldMap = {
    transactionType: 'Transactiontype',
    transitTypeInternational: 'TransitType_i',
    movementType: 'MovementType',
    modeType: 'ModeType',
    shippingType: 'Shippingtype',
    carrierName: 'Cargocarrier',
    serviceProvider: 'party_name', // special case using serviceProviderDetails
    commodity: 'Commodity',
    clearanceMode: 'ClearanceMode',
    // originCountry: 'Country',
    // destinationCountry: 'Country',
    packingType: 'PackingType',
    tabPackingType: 'PackingType',
    uOMType: 'UOMType',
    partyName: 'PartyName' // example: if you're using it for validation
};

// Reusable function to load dropdown data
async function loadDropdownData(query, typeOfValue, datalistId) {
    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description')
            .eq('type_of_value', typeOfValue)
            .in('company_id', ['All', CompanyID])
            .ilike('description', `%${query}%`);

        if (error) {
            console.error(`Error fetching ${typeOfValue}:`, error);
            return;
        }

        const suggestions = data.map(item => `<option value="${item.description}"></option>`).join('');

        const datalist = document.getElementById(datalistId);
        if (!datalist) {
            // console.warn(`Datalist element with id "${datalistId}" not found.`);
            return;
        }

        datalist.innerHTML = suggestions;
    } catch (err) {
        console.error(`Error loading ${typeOfValue} details:`, err);
    }
}

function validateInput(inputId, datalistId = null) {
    const input = document.getElementById(inputId);
    const errorElementId = `${inputId}-error`;
    let errorMessageElement = document.getElementById(errorElementId);

    if (!input) return;

    const enteredValue = input.value.trim();
    let isValid = false;

    if (input.tagName === 'SELECT') {
        // For <select> elements
        isValid = Array.from(input.options).some(opt => opt.value === enteredValue);
    } else if (datalistId) {
        // For <input> + <datalist>
        const datalist = document.getElementById(datalistId);
        if (!datalist) return;
        const options = Array.from(datalist.options).map(opt => opt.value);
        isValid = options.includes(enteredValue);
    }

    if (!isValid && enteredValue !== '') {
        if (!errorMessageElement) {
            errorMessageElement = document.createElement('span');
            errorMessageElement.id = errorElementId;
            errorMessageElement.style.cssText = 'color:red; font-size:12px; margin-left:10px;';
            input.parentNode.appendChild(errorMessageElement);
        }
        errorMessageElement.textContent = 'No valid entry';
        input.reportValidity?.();
        setTimeout(() => input.focus(), 1);
    } else {
        input.setCustomValidity?.('');
        if (errorMessageElement) errorMessageElement.remove();
    }
}

// Attaches blur validation
function attachValidation(inputId, datalistId = null) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('blur', () => validateInput(inputId, datalistId));
    }
}

// Event listener for dynamic <input> / <select> loading
function addInputEventListener(inputId, typeOfValue) {
    const input = document.getElementById(inputId);
    const datalistId = `${inputId}Suggestions`;
    if (!input) return;

    const isSelect = input.tagName === 'SELECT';

    // Wrap the loader so we can call it with any query string
    const loadFunction = (query = '') =>
        loadDropdownData(query, typeOfValue, datalistId);

    if (!isSelect) {
        // Live filtering while the user types
        input.addEventListener('input', e => loadFunction(e.target.value));

        // Pre-load *all* options when the field first gains focus
        input.addEventListener('focus', () => {
            loadFunction('');
            // Trick to keep the caret at the end after reload
            const v = input.value;
            input.value = '';
            input.value = v;
        });
    }

    // Hook up any custom validation you already have
    attachValidation(inputId, isSelect ? null : datalistId);
}

// Initialize all listeners and validation
function initialize() {
    Object.entries(fieldMap).forEach(([inputId, typeOfValue]) => {
        const isCustom = inputId === 'serviceProvider'; // Add more custom handlers if needed
        addInputEventListener(inputId, typeOfValue, isCustom);
    });
}

document.addEventListener('DOMContentLoaded', initialize);

// Handler receives the event, not the value directly:
async function onChargeTypeChange(event) {
    const input = event.target;
    const descriptionType = input.value;
    const hsnInput = document.getElementById('hsnNumber');
    const datalistId = input.getAttribute('list');
    const datalist = document.getElementById(datalistId);
    const options = Array.from(datalist?.options || []);
    const isValid = options.some(option => option.value === descriptionType);

    const errorElementId = 'description-error-message';

    let errorMessageElement = document.getElementById(errorElementId);

    // Handle invalid input not in datalist
    if (!isValid && descriptionType !== '') {
        if (!errorMessageElement) {
            errorMessageElement = document.createElement('span');
            errorMessageElement.id = errorElementId;
            errorMessageElement.style.cssText = 'color:red; font-size:12px; margin-left:10px;';
            input.parentNode.appendChild(errorMessageElement);
        }
        errorMessageElement.textContent = 'No valid entry';
        input.reportValidity?.();
        setTimeout(() => input.focus(), 1);
    } else {
        input.setCustomValidity?.('');
        if (errorMessageElement) errorMessageElement.remove();
    }

    if (!descriptionType) {
        hsnInput.value = '';
        return;
    }

    // Fetch HSN code from Supabase
    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('hsn_code')
            .eq('description', descriptionType)
            .maybeSingle();

        if (error) {
            console.error('Error loading HSN code:', error.message);
            hsnInput.value = '';
        } else if (data) {
            hsnInput.value = data.hsn_code ?? '';
        } else {
            hsnInput.value = '';  // data is null (no match found)
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        hsnInput.value = '';
        input.focus();  // <-- Optional: handle unexpected error with focus
    }
}

async function setupChargeTypeValidation() {
    const chargeInput = document.getElementById('chargesTypeInput');
    const addBtn = document.getElementById('addFreightRow');
    const tableBody = document.querySelector('#freightTable tbody');

    // 1) Inject CSS for .invalid
    const style = document.createElement('style');
    style.textContent = `
      #chargesTypeInput.invalid {
        border-color: #35dc4b !important;
        box-shadow: 0 0 0 0.2rem rgba(220,53,69,.25);
      }
    `;
    document.head.appendChild(style);

    // 2) Validation logic
    function validate() {
        const sel = chargeInput.value.trim();

        if (!sel) {
            chargeInput.classList.remove('invalid');
            addBtn.disabled = false;
            return;
        }

        // get existing charge types (IGNORE deleted rows)
        const existing = Array.from(tableBody.querySelectorAll('tr'))
            .filter(tr => tr.dataset.rowState !== 'deleted')   // important
            .map(tr => tr.querySelector('td:first-child')?.textContent.trim());

        if (existing.includes(sel)) {
            chargeInput.classList.add('invalid');
            addBtn.disabled = true;
        } else {
            chargeInput.classList.remove('invalid');
            addBtn.disabled = false;
        }
    }


    // 3) Wire it up
    chargeInput.addEventListener('change', validate);

    // 4) Also re-validate whenever table changes (in case rows are added/removed)
    const observer = new MutationObserver(validate);
    observer.observe(tableBody, { childList: true });

    // initial validation
    validate();
    // call once on page load
    // setupChargeTypeValidation();
}

async function fetchDefaultTax(partyCode) {
    if (!partyCode) {
        console.warn("Party code is required to fetch default tax.");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('DefaultTax')
            .eq('PartyCode', partyCode)
            .single(); // Only one expected row

        if (error) throw error;

        if (data?.DefaultTax) {
            console.log("Default Tax:", data.DefaultTax);
            return data.DefaultTax;
        } else {
            console.warn("No DefaultTax found for PartyCode:", partyCode);
            return null;
        }
    } catch (error) {
        console.error('Error fetching DefaultTax:', error.message);
        return null;
    }
}
// Example usage
// fetchDefaultTax('somePartyCode').then(tax => console.log("Fetched Tax:", tax));

async function PartyAddressDetails(query, typeOfValue, datalistId) {
    const datalist = document.getElementById(datalistId);

    if (!query.trim()) {
        datalist.innerHTML = ''; // Clear suggestions if input is empty
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('PartyPickupAddress')
            .select('Address')
            .eq('company_ID', CompanyID)
            .ilike('Address', `%${query}%`)
            .order('Address', { ascending: true });

        if (error) throw error;

        if (Array.isArray(data) && data.length > 0) {
            updateAddressSuggestions(data, datalist);
        } else {
            datalist.innerHTML = '';
        }

    } catch (err) {
        console.error('Error fetching party addresses:', err.message || err);
    }
}

function updateAddressSuggestions(addresses, datalist) {
    datalist.innerHTML = addresses
        .map(({ Address }) => `<option value="${Address}">${Address}</option>`)
        .join('');
}
// Example usage
// PartyAddressDetails('some query', 'PartyPickupAddress', 'partyAddressSuggestions');

async function getDropdownDataValue(inputListId, listType) {
    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('*')
            .eq('description', inputListId)
            .eq('type_of_value', listType)
            .maybeSingle();
        if (error) {
            console.error('Error loading HSN code:', error.message);
            return null;
        }
        // console.log(`Fetched dropdown data for "${inputListId}" (${listType}):`, data);
        return data; // ✅ RETURN DATA
    } catch (err) {
        console.error('Unexpected error:', err);
        return null;
    }
}   