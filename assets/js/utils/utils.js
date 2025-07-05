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
    CompanyID,
    valueField = 'PartyCode',
    displayField = 'PartyName'
) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const { data, error } = await supabaseClient
        .from(tableName)
        .select(`${valueField}, ${displayField}`)
        .eq('company_id', CompanyID)
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
    attachPartyCodeFiller('partyNameReg', datalistId, 'partyCodes');
    attachPartyCodeFiller('serviceProvider', 'vendorSuggestions', 'serviceProviderCode');
    attachPartyCodeFiller('userID', 'userLoginSuggestions', 'userName')
    attachPartyCodeFiller('partyName', 'partySuggestions', 'partyCode');
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
// ✅ Set a message for an empty table body
// This function will replace the content of a table body with a message when there are no rows
function setEmptyTableMessage(tableBodyId, message) {
    const tableBody = document.getElementById(tableBodyId);
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center">${message}</td></tr>`;
    }
}
// ✅ Validate GST input with Supabase check
// This function checks the GST input against a regex pattern and queries Supabase for duplicates
async function validateGSTInput(
    gstInputElementID,
    feedbackElementID,
    tableName = 'company_profile',
    fieldName = 'gst_number') {

    const input = document.getElementById(gstInputElementID);
    const feedback = document.getElementById(feedbackElementID);
    const gstInput = input.value.trim().toUpperCase();
    input.value = gstInput; // Ensure uppercase in the input field

    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!gstRegex.test(gstInput)) {
        showInvalidGST('Invalid GST format.');
        return false;
    }

    const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq(fieldName, gstInput);

    if (error) {
        console.error('Error checking GST:', error.message);
        showInvalidGST('Error validating GST.');
        return false;
    }

    // If duplicate exists and not editing the same record
    if (data.length > 0) {
        showInvalidGST('Duplicate GST Number found.');
        return false;
    }

    hideInvalidGST();
    return true;

    function showInvalidGST(msg) {
        feedback.textContent = msg;
        feedback.classList.remove('d-none');
        input.classList.add('is-invalid');
    }

    function hideInvalidGST() {
        feedback.classList.add('d-none');
        input.classList.remove('is-invalid');
    }
}
// ✅ Validate PAN input with regex and Supabase check
async function validatePANInput(
    panInputElementID,
    feedbackElementID,
    tableName = 'company_profile',
    fieldName = 'pan_number') {

    const input = document.getElementById(panInputElementID);
    const feedback = document.getElementById(feedbackElementID);
    const panInput = input.value.trim().toUpperCase();
    input.value = panInput; // Ensure uppercase in the input field

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (!panRegex.test(panInput)) {
        showInvalidPAN('Invalid PAN format.');
        return false;
    }

    const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq(fieldName, panInput);

    if (error) {
        console.error('Error checking PAN:', error.message);
        showInvalidPAN('Error validating PAN.');
        return false;
    }

    // If duplicate exists and not editing the same record
    if (data.length > 0) {
        showInvalidPAN('Duplicate PAN Number found.');
        return false;
    }

    hideInvalidPAN();
    return true;

    function showInvalidPAN(msg) {
        feedback.textContent = msg;
        feedback.classList.remove('d-none');
        input.classList.add('is-invalid');
    }

    function hideInvalidPAN() {
        feedback.classList.add('d-none');
        input.classList.remove('is-invalid');
    }
}
let bankMap = {}; // Global mapping: DisplayName -> BankID
let bankID = null; // Selected Bank ID

// Load bank suggestions from Supabase
async function loadBankNameSuggestions() {
    const datalist = document.getElementById('bankNameSuggestions');
    datalist.innerHTML = '';
    bankMap = {}; // Clear previous suggestions

    try {
        const { data, error } = await supabaseClient
            .from('CompanyBankDetails')
            .select('id, BankName, AccountNo')
            .eq('CompanyID', CompanyID)
            .eq('DefaultBank', 'Yes');

        if (error) {
            console.error('Error loading bank data:', error.message);
            return;
        }

        data.forEach(bank => {
            const lastFour = bank.AccountNo.slice(-4);
            const displayName = `${bank.BankName} - ${lastFour}`;
            bankMap[displayName] = bank.id;

            const option = document.createElement('option');
            option.value = displayName;
            datalist.appendChild(option);
        });
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}


// Load the default bank and set the input values
async function loadDefaultBank() {
    try {
        const { data, error } = await supabaseClient
            .from('CompanyBankDetails')
            .select('id, BankName, AccountNo')
            .eq('CompanyID', CompanyID)
            .eq('DefaultBank', 'Yes')
            .single();

        if (error) throw error;

        if (!data) {
            console.warn('No default bank found.');
            return null;
        }

        const { id, BankName, AccountNo } = data;
        const lastFourDigits = AccountNo.slice(-4);
        const displayName = `${BankName} - ${lastFourDigits}`;

        const bankNameInput = document.getElementById('bankName');
        const bankIDInput = document.getElementById('bankIDs');
        const hiddenInput = getOrCreateHiddenBankInput();

        if (bankNameInput) bankNameInput.value = displayName;
        hiddenInput.value = displayName;
        hiddenInput.setAttribute('data-bank-id', id);
        bankIDInput.value = id;

        bankID = id; // ✅ Store in global variable

        return id;
    } catch (err) {
        console.error('Error loading default bank:', err.message);
        return null;
    }
}

// Create hidden input if not present
function getOrCreateHiddenBankInput() {
    let hiddenInput = document.getElementById('inputBankName');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'inputBankName';
        document.body.appendChild(hiddenInput);
    }
    return hiddenInput;
}

async function unlockShipmentRecord(shipId) {
    try {
        const { error } = await supabaseClient
            .from('international_booking')
            .update({
                IsLocked: false,
                LockedBy: null,
                LockedAt: null
            })
            .eq('id', shipId);

        if (error) {
            console.error('Error unlocking shipment:', error.message);
        } else {
            console.log(`Shipment ${shipId} unlocked successfully.`);
        }
    } catch (err) {
        console.error('Error unlocking shipment:', err.message);
    }
}


async function autoUnlockRecords() {
    if (lockedBookingIds.length === 0) return;

    try {
        const { error } = await supabaseClient
            .from('international_booking')
            .update({
                IsLocked: false,
                LockedBy: null,
                LockedAt: null
            })
            .in('id', lockedBookingIds);

        if (error) throw error;

        console.log('Records unlocked automatically.');

        // Clear the locked IDs and timer
        lockedBookingIds = [];
        if (autoUnlockTimer) {
            clearTimeout(autoUnlockTimer);
            autoUnlockTimer = null;
        }

    } catch (err) {
        console.error('Error auto-unlocking records:', err.message);
    }
}
let autoUnlockTimer = null;

function startAutoUnlockTimer() {
    // Auto-unlock after 10 minutes (600,000 ms)
    autoUnlockTimer = setTimeout(() => {
        autoUnlockRecords();
    }, 600000);
}

function resetAutoUnlockTimer() {
    if (autoUnlockTimer) {
        clearTimeout(autoUnlockTimer);
    }
    startAutoUnlockTimer();
}

async function getPartyDetailsByCode(partyCode) {
    try {
        console.log('Fetching party details for code:', partyCode);
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('*')
            .eq('PartyCode', partyCode)
            .eq('company_id', CompanyID)
            .single(); // Expecting one record per party code

        if (error) throw error;

        return data || null;
    } catch (err) {
        console.error('Error fetching party details:', err.message);
        return null;
    }
}

async function getBankNameByCode(bankID) {
    try {
        const { data, error } = await supabaseClient
            .from('CompanyBankDetails')
            .select('id, BankName, AccountNo')
            .eq('CompanyID', CompanyID)
            .eq('id', bankID)
            .single();

        if (error) throw error;

        if (!data) {
            console.warn('No default bank found.');
            return null;
        }

        const { id, BankName, AccountNo } = data;
        const lastFourDigits = AccountNo.slice(-4);
        const displayName = `${BankName} - ${lastFourDigits}`;

        const bankNameInput = document.getElementById('bankName');
        const bankIDInput = document.getElementById('bankIDs');
        const hiddenInput = getOrCreateHiddenBankInput();

        if (bankNameInput) bankNameInput.value = displayName;
        hiddenInput.value = displayName;
        hiddenInput.setAttribute('data-bank-id', id);
        bankIDInput.value = id;

        return id;
    } catch (err) {
        console.error('Error loading default bank:', err.message);
        return null;
    }
}

async function loadInvoiceNoSuggestions() {
    const datalist = document.getElementById('invoiceNoSuggestions');
    datalist.innerHTML = ''; // Clear previous options

    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    try {
        while (hasMore) {
            const { data, error, count } = await supabaseClient
                .from('InvoiceDetails')
                .select('InvoiceNo', { count: 'exact' })
                .eq('company_id', CompanyID)
                .range(from, from + batchSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                data.forEach(invoice => {
                    const option = document.createElement('option');
                    option.value = invoice.InvoiceNo;
                    datalist.appendChild(option);
                });

                from += batchSize;
                hasMore = data.length === batchSize; // Continue if full batch fetched
            } else {
                hasMore = false;
            }
        }
    } catch (err) {
        console.error('Error loading invoice suggestions:', err.message);
    }
}

