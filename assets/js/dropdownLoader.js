async function loadDropdownOptions(filterValue, dropdownId) {
    const selectElement = document.getElementById(dropdownId);
    if (!selectElement) {
        // console.log(`Dropdown with ID "${dropdownId}" not found. Skipping.`);
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description')
            .in('company_id', ['All', companyID])
            .ilike('type_of_value', `%${filterValue}%`);

        if (error) {
            console.error(`Error fetching data from dropdown_list:`, error);
            return;
        }

        const selectElement = document.getElementById(dropdownId);
        if (!selectElement) {
            console.log(`Dropdown with ID "${dropdownId}" not found.`);
            return;
        }

        selectElement.innerHTML = '<option value="">Select an option</option>'; // Default option

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.description;
            option.textContent = item.description;
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
    // loadDropdownOptions('ChargesType', 'chargesType');
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
            .in('company_id', ['All', companyID])
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


function validateInput(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);
    if (!input || !datalist) return;

    const enteredValue = input.value.trim();
    const options = Array.from(datalist.options).map(opt => opt.value);
    const errorElementId = `${inputId}-error`;
    let errorMessageElement = document.getElementById(errorElementId);

    const isValid = options.includes(enteredValue);

    if (!isValid && enteredValue !== '') {
        if (!errorMessageElement) {
            errorMessageElement = document.createElement('span');
            errorMessageElement.id = errorElementId;
            errorMessageElement.style.cssText = 'color:red; font-size:12px; margin-left:10px;';
            input.parentNode.appendChild(errorMessageElement);
        }
        errorMessageElement.textContent = 'No valid entry';
        // input.setCustomValidity('Invalid selection');    
        input.reportValidity();
        setTimeout(() => input.focus(), 1);
    } else {
        input.setCustomValidity('');
        if (errorMessageElement) errorMessageElement.remove();
    }
}

// Attaches blur validation
function attachValidation(inputId, datalistId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('blur', () => validateInput(inputId, datalistId));
    }
}

// Event listener for dynamic loading
function addInputEventListener(inputId, typeOfValue, isCustom = false) {
    const input = document.getElementById(inputId);
    const datalistId = `${inputId}Suggestions`;
    if (!input) return;

    const loadFunction = isCustom
        ? (query) => loadPartyDetails(query, typeOfValue, datalistId)
        : (query) => loadDropdownData(query, typeOfValue, datalistId);

    input.addEventListener('input', (e) => loadFunction(e.target.value));
    input.addEventListener('focus', () => {
        loadFunction('');
        const value = input.value;
        input.value = '';
        input.value = value;
    }); // Load all on focus
    attachValidation(inputId, datalistId);
}

// Initialize all listeners and validation
function initialize() {
    Object.entries(fieldMap).forEach(([inputId, typeOfValue]) => {
        const isCustom = inputId === 'serviceProvider'; // Add more custom handlers if needed
        addInputEventListener(inputId, typeOfValue, isCustom);
    });
}

document.addEventListener('DOMContentLoaded', initialize);

chargesTypeInput.addEventListener('input', function () {
    const query = chargesTypeInput.value.trim();
    if (query.length > 0) {
        loadDropdownOptions('ChargesType', 'chargesTypeList');
        // loadDropdownData(query, 'Charges', 'chargesTypeList');
    }
});

// Handler receives the event, not the value directly:
async function onChargeTypeChange(event) {
    const descriptionType = event.target.value;
    const hsnInput = document.getElementById('hsnNumber');

    if (!descriptionType) {
        hsnInput.value = '';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('hsn_code')
            .eq('description', descriptionType)
            .single();

        if (error) {
            console.error('Error loading HSN code:', error.message);
            hsnInput.value = '';
        } else {
            hsnInput.value = data.hsn_code ?? '';
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        hsnInput.value = '';
    }
}

function setupChargeTypeValidation() {
    const chargeInput = document.getElementById('chargesTypeInput');
    const addBtn = document.getElementById('addFreightRow');
    const tableBody = document.querySelector('#freightTable tbody');

    // 1) Inject CSS for .invalid
    const style = document.createElement('style');
    style.textContent = `
      #chargesTypeInput.invalid {
        border-color: #dc3545 !important;
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
        // get existing charge types
        const existing = Array.from(tableBody.querySelectorAll('tr td:first-child'))
            .map(td => td.textContent.trim());
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



