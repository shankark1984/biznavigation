// Function to load party details from Supabase
async function loadPartyDetails(query = '') {
    try {
        const { data: partyDetailsData, error } = await supabaseClient
            .from('party_details')
            .select('*')
            .eq('company_id', companyID) // Filter by company ID
            .ilike('party_name', `%${query}%`) // Case-insensitive partial matching
            .order('party_name', { ascending: true }); // Order by party_name (ascending)

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        // Map the data to match the form format
        partyDetails = partyDetailsData.map(row => ({
            partyType: row.party_type,
            partyCode: row.party_code,
            vendorCode: row.party_code, // Assuming vendorCode maps to party_code
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

        // Enable or disable buttons based on data state
        // document.getElementById('saveButton').disabled = false;

        // Populate datalist options
        populatePartySuggestions();
        populateVendorSuggestions();

        // Additional functions to fetch related data
        billingAddressfetchSupabaseData();
    } catch (error) {
        console.error('Error loading party details:', error);
    }
}

// Function to fetch billing address from Supabase
async function billingAddressfetchSupabaseData() {
    try {
        console.log(partyCode + companyID);
        const { data: billingData, error } = await supabaseClient
            .from('billing_address')
            .select('address, city, pincode, country')
            .eq('party_code', partyCode)
            .eq('company_id', companyID); // Match by party_code and company_id

        if (error) {
            console.error('Error fetching billing address:', error);
            return;
        }

        if (billingData && billingData.length > 0) {
            // Assuming only one record for the given party_code and company_id
            const billingInfo = billingData[0];

            // Populate the input fields with billing address data
            $("#billingAddress").val(billingInfo.address || '');
            $("#billingCity").val(billingInfo.city || '');
            $("#billingPinCode").val(billingInfo.pincode || '');
            $("#billingCountry").val(billingInfo.country || '');
        } else {
            console.warn('No billing address found for the given party code.');
        }
    } catch (error) {
        console.error('Error in billingAddressfetchSupabaseData:', error);
    }
}

// Populate the datalist with party names
function populatePartySuggestions() {
    let suggestions = partyDetails
        .map(party => `<option data-party-code="${party.partyCode}" value="${party.partyName}"></option>`)
        .join('');
    $("#partySuggestions").html(suggestions);
}

// Populate the datalist with vendor names
function populateVendorSuggestions() {
    let vendorSuggestions = partyDetails
        .map(vendor => `<option data-party-code="${vendor.vendorCode}" value="${vendor.partyName}"></option>`)
        .join('');
    $("#vendorSuggestions").html(vendorSuggestions);
}

// Handle party name input and populate form
$("#partyName").on("input", function () {
    const partyName = $(this).val();
    const partyData = partyDetails.find(party => party.partyName === partyName);

    if (partyData) {
        populateFormFields(partyData, "party");
    }
});

// Handle vendor name input and populate form
$("#vendorName").on("input", function () {
    const vendorName = $(this).val();
    const vendorData = partyDetails.find(party => party.partyName === vendorName);

    if (vendorData) {
        populateFormFields(vendorData, "vendor");
    }
});

// Populate form fields with data
function populateFormFields(data, type) {
    const prefix = type === "party" ? "party" : "vendor";

    $(`#${prefix}Type`).val(data.partyType);
    $("#partyCode").val(data.partyCode);
    $("#partyCurrentStatus").val(data.currentStatus);
    $("#partyDeActiveDate").val(data.deActiveDate);
    $("#partyAddress").val(data.address);
    $("#pinCode").val(data.pinCode);
    $("#city").val(data.city);
    $("#state").val(data.state);
    $("#country").val(data.country);
    $("#panNumber").val(data.panNumber);
    $("#gSTNumber").val(data.gSTNumber);
    $("#partyContacperson").val(data.contactPerson);
    $("#partyContactNumber").val(data.contactNumber);
    $("#partyEmailID").val(data.emailID);
    $("#defaulttax").val(data.defaultTax);
}

// Function to get party code based on user input
function getPartyCodeFromInput(inputElementId, datalistId) {
    document.getElementById(inputElementId).addEventListener('input', function (event) {
        const inputValue = event.target.value;
        const selectedOption = $(`#${datalistId} option`).filter(function () {
            return $(this).val() === inputValue;
        }).first();

        // Get the data-party-code from the matching option
        const partyCode = selectedOption.data("party-code");
        console.log("Selected party code:", partyCode);
    });
}

$(document).ready(function () {
    loadPartyDetails(); // Fetch party details on load

    // Ensure buttons exist before modifying them
    const saveButton = document.getElementById('saveButton');
    const newButton = document.getElementById('newButton');

    if (saveButton) {
        saveButton.disabled = false;
    } else {
        console.error("Element #saveButton not found!");
    }

    if (newButton) {
        newButton.disabled = false;
    } else {
        console.error("Element #newButton not found!");
    }
});
