// ✅ Enable all form inputs
function enableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = false);
}

// ✅ Disable all form inputs
function disableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = true);
}

// ✅ Clear all input fields including selects, checkboxes, and textareas
function clearForm() {
    document.querySelectorAll("input, select, textarea").forEach(input => {
        if (input.type === "checkbox" || input.type === "radio") {
            input.checked = false;
        } else {
            input.value = "";
        }

        if (input.tagName === "SELECT") {
            input.selectedIndex = 0;
        }
    });
}

// ✅ Format currency to 2 decimal places or fallback to 0.00
function formatCurrency(input) {
    const value = parseFloat(input.value);
    input.value = isNaN(value) ? '0.00' : value.toFixed(2);
}

// ✅ Convert string to Proper Case (first letter uppercase for each word)
function toProperCase(str) {
    return str.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ✅ Format date string as dd-mm-yyyy
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// ✅ Generate a temporary form ID using timestamp and random number
function generateTempFormID() {
    return `TEMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// ✅ Set tempFormID on page load
window.addEventListener('DOMContentLoaded', () => {
    const tempFormIDElement = document.getElementById('tempFormID');
    if (tempFormIDElement) {
        const tempFormID = generateTempFormID();
        tempFormIDElement.value = tempFormID;
        console.log('TempFormID generated:', tempFormID);
    }
});

// ✅ Tab switching logic
function openTab(evt, tabName) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
    document.querySelectorAll(".tablinks").forEach(link => link.classList.remove("active"));

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}

// ✅ Capitalize first letter of each word safely
function capitalize(text) {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// ✅ Load country suggestions based on partial input
async function CountryDetails(inputValue, datalistId, inputId) {
    if (!inputValue) return;

    try {
        const { data, error } = await supabaseClient
            .from('Country_Details')
            .select('CountryCode, CountryName, Region')
            .ilike('CountryName', `%${inputValue}%`)
            .order('CountryName');

        if (error) return console.error('Supabase query error:', error);

        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = '';
        data.forEach(country => {
            const option = document.createElement('option');
            option.value = country.CountryName;
            datalist.appendChild(option);
        });
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// ✅ Add protocol if missing in website field
document.addEventListener('DOMContentLoaded', () => {
    const websiteInput = document.getElementById('website');
    websiteInput?.addEventListener('blur', function () {
        const url = this.value.trim();
        if (url && !/^https?:\/\//i.test(url)) {
            this.value = 'https://' + url;
        }
    });
});

// ✅ Toggle edit mode and disable/enable delete buttons
let isEditMode = false;
function toggleEditMode(enable) {
    isEditMode = enable;
    document.querySelectorAll('.delete-row, .remove-row').forEach(btn => {
        btn.disabled = enable;
        btn.classList.toggle('disabled', enable);
    });
}

// ✅ Load suggestions from Supabase and populate datalist with mapping
const suggestionMaps = {}; // Global map for datalist values

async function loadSuggestions(
    datalistId,
    tableName,
    companyId,
    valueField = 'PartyCode',
    displayField = 'PartyName'
) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const { data, error } = await supabaseClient
        .from(tableName)
        .select(`${valueField}, ${displayField}`)
        .eq('company_id', companyId)
        .order(displayField, { ascending: true });

    if (error) {
        console.error(`Error loading ${tableName}:`, error);
        return;
    }

    datalist.innerHTML = '';
    const map = {};

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[displayField];
        datalist.appendChild(option);
        map[item[displayField]] = item[valueField];
    });

    suggestionMaps[datalistId] = map;

    // Attach mapping function
    attachPartyCodeFiller('partyName', datalistId, 'partyCode');
    attachPartyCodeFiller('serviceProvider', 'vendorSuggestions', 'serviceProviderCode');
}


// ✅ Auto-fill party code based on selected party name
function attachPartyCodeFiller(inputId, datalistId, codeFieldId) {
    const input = document.getElementById(inputId);
    const codeField = document.getElementById(codeFieldId);
    if (!input || !codeField) return;

    input.addEventListener('input', () => {
        const typedValue = input.value.trim();
        const map = suggestionMaps[datalistId] || {};
        const code = map[typedValue] || '';
        codeField.value = code;
    });
}


// ✅ Validate individual field with test function
function validateField(selector, testFn, message) {
    const $el = $(selector);
    const value = $el.val().trim();
    const $feedback = $el.next('.invalid-feedback');
    const isValid = testFn(value);

    if (!isValid) {
        $el.addClass('is-invalid');
        if (!$feedback.length) $el.after(`<div class="invalid-feedback">${message}</div>`);
    } else {
        $el.removeClass('is-invalid');
        $feedback.remove();
    }

    return isValid;
}

// ✅ Validate form based on multiple validation rules
function validateForm(rules) {
    return rules.map(rule =>
        validateField(rule.selector, rule.test, rule.message)
    ).every(Boolean);
}

// ✅ Disable buttons and optionally parent containers
function disableButtons(selector, disableParents = true) {
    const $buttons = $(selector);
    if ($buttons.length) {
        $buttons.each(function () {
            $(this).prop("disabled", true);
            if (disableParents) $(this).closest("form, fieldset").prop("disabled", true);
        });
        console.log(`Disabled buttons: "${selector}"`);
    } else {
        console.warn(`No buttons for selector: "${selector}"`);
    }
}

// ✅ Toggle button enable/disable with optional delay and parent toggle
function toggleButtons(selector, shouldEnable = true, toggleParents = true) {
    setTimeout(() => {
        const $buttons = $(selector);
        $buttons.each(function () {
            $(this).prop('disabled', !shouldEnable);
            if (toggleParents) $(this).closest("form, fieldset").prop('disabled', !shouldEnable);
        });
    }, 100);
}

// ✅ Force input to uppercase letters only (no numbers/symbols)
function enforceUppercaseOnly(inputElement) {
    if (!inputElement) return;

    inputElement.addEventListener('input', function () {
        const cursorPos = this.selectionStart;
        this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '');
        this.setSelectionRange(cursorPos, cursorPos);
    });

    inputElement.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, text.toUpperCase().replace(/[^A-Z]/g, ''));
    });
}

// ✅ Fetch ports from Supabase filtered by name
async function fetchPortList(term = '', limit = 20) {
    const { data, error } = await supabaseClient
        .from('PortsDetails')
        .select('PortName, PortCode, PortCountry')
        .ilike('PortName', `%${term}%`)
        .order('PortName')
        .limit(limit);

    if (error) {
        console.error('Error fetching ports:', error.message);
        return [];
    }

    return data;
}

// ✅ Populate datalist with port data
function populateDatalist(datalistId, ports) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = '';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = `${port.PortName} (${port.PortCode}) - ${port.PortCountry}`;
        datalist.appendChild(option);
    });
}
//convertCurrency
// ✅ Convert currency using external API
// Note: This function uses a free API with limited requests. Consider using a paid service for production.
async function convertCurrency({ amount, from = 'INR', to = 'INR' }) {
    if (!amount || from === to) return amount;

    const apiKey = 'tg31lpk5smo4matn3tj4i8rrh58bn3sct63909f2og8aaertivioa8';
    const url = `https://anyapi.io/api/v1/exchange/convert?apiKey=${apiKey}&base=${from}&to=${to}&amount=${amount}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.converted) {
            return data.converted;
        } else {
            console.warn("Currency conversion failed:", data);
            return null;
        }
    } catch (error) {
        console.error("Error during currency conversion:", error);
        return null;
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}