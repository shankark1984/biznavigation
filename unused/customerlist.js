// Function to load party details from Supabase
async function loadPartyDetails(query = '') {
    try {
        const { data, error } = await supabaseClient
            .from('party_details')
            .select('*')
            .eq('company_id', companyID)
            .ilike('party_name', `%${query}%`)
            .order('party_name', { ascending: true });

        if (error) throw error;

        partyDetails = data.map(row => ({
            partyType: row.party_type,
            partyCode: row.party_code,
            vendorCode: row.party_code,
            partyName: row.party_name,
            currentStatus: row.current_status,
            deActiveDate: row.deactive_date,
            address: row.address,
            pinCode: row.pin_code,
            city: row.city,
            state: row.state,
            country: row.country,
            panNumber: row.pan_number,
            gSTNumber: row.gst_number,
            contactPerson: row.contact_person,
            contactNumber: row.contact_number,
            emailID: row.email_id,
            defaultTax: row.default_tax,
        }));

        populateSuggestions();
    } catch (error) {
        console.error('Error loading party details:', error.message);
    }
}

// Handle invalid input not in datalist
function validateInputAgainstDatalist(input, datalistId, errorElementId) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const isValid = Array.from(datalist.options).some(option => option.value === input.value);
    let errorMessageElement = document.getElementById(errorElementId);

    if (!isValid) {
        if (!errorMessageElement) {
            errorMessageElement = document.createElement('span');
            errorMessageElement.id = errorElementId;
            errorMessageElement.style.cssText = 'color:red; font-size:12px; margin-left:10px;';
            input.parentNode.appendChild(errorMessageElement);
        }
        errorMessageElement.textContent = 'No valid entry';
        input.setCustomValidity('Invalid selection'); // ✅ Required
        input.reportValidity?.();
        setTimeout(() => input.focus(), 1);
    } else {
        input.setCustomValidity?.(''); // ✅ Clear previous errors
        if (errorMessageElement) errorMessageElement.remove();
    }
}


const partyInput = document.getElementById('partyName');
if (partyInput) {
    partyInput.addEventListener('change', () => {
        validateInputAgainstDatalist(partyInput, 'partySuggestions', 'partyNameError');
    });
}

const vendorInput = document.getElementById('serviceProvider');
if (vendorInput) {
    vendorInput.addEventListener('change', () => {
        validateInputAgainstDatalist(vendorInput, 'vendorSuggestions', 'partyNameError');
    });
}


// Function to fetch billing address from Supabase
async function billingAddressfetchSupabaseData() {
    try {
        const { data, error } = await supabaseClient
            .from('billing_address')
            .select('address, city, pincode, country')
            .eq('party_code', partyCode)
            .eq('company_id', companyID);

        if (error) throw error;

        if (data?.length) {
            const { address, city, pincode, country } = data[0];
            $("#billingAddress").val(address || '');
            $("#billingCity").val(city || '');
            $("#billingPinCode").val(pincode || '');
            $("#billingCountry").val(country || '');
        }
    } catch (error) {
        console.error('Error fetching billing address:', error.message);
    }
}

// Populate both party and vendor suggestions
function populateSuggestions() {
    if (!partyDetails?.length) {
        // console.warn('No party details to display');
        return;
    }

    const options = partyDetails.map(({ partyCode, partyName }) =>
        `<option data-party-code="${partyCode}" value="${partyName}"></option>`
    ).join('');

    $("#partySuggestions").html(options);
    $("#vendorSuggestions").html(options);

}

// Handle input and populate form
function handleInput(inputSelector, type) {
    $(inputSelector).on("input", function () {
        const name = $(this).val();
        const data = partyDetails.find(p => p.partyName === name);
        if (data) populateFormFields(data, type);
    });
}

// Populate form fields
function populateFormFields(data, type) {
    const prefix = type === "party" ? "party" : "vendor";
    console.log(`Populating form for ${type}:`, data);

    const fieldMapping = {
        [`${prefix}Type`]: data.partyType,
        [`${prefix}Code`]: data.partyCode,
        [`${prefix}CurrentStatus`]: data.currentStatus,
        [`${prefix}DeActiveDate`]: data.deActiveDate,
        [`${prefix}Address`]: data.address,
        [`${prefix}PinCode`]: data.pinCode,
        [`${prefix}City`]: data.city,
        [`${prefix}State`]: data.state,
        [`${prefix}Country`]: data.country,
        [`${prefix}PanNumber`]: data.panNumber,
        [`${prefix}GSTNumber`]: data.gSTNumber,
        [`${prefix}ContactPerson`]: data.contactPerson,
        [`${prefix}ContactNumber`]: data.contactNumber,
        [`${prefix}EmailID`]: data.emailID,
        [`defaulttax`]: data.defaultTax
    };
    loadPartyDetails();
    for (const [id, value] of Object.entries(fieldMapping)) {
        $(`#${id}`).val(value || '');
    }

    if (type === "party") billingAddressfetchSupabaseData();
}

// Link datalist input to get party code
function getPartyCodeFromInput(inputElementId, datalistId) {
    $(`#${inputElementId}`).on('input', function () {
        const value = $(this).val();
        const option = $(`#${datalistId} option`).filter(function () {
            return $(this).val() === value;
        }).first();

        const partyCode = option.data('party-code');
        console.log(`Party Code for ${value}:`, partyCode); // For debugging
    });
}

// Document ready
$(document).ready(function () {
    loadPartyDetails();
    handleInput("#partyName", "party");
    handleInput("#serviceProvider", "vendor");

    ["saveButton", "newButton"].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = false;
        else console.error(`Element #${id} not found!`);
    });
});


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