// Function to load party details from Supabase
async function loadPartyDetails() {
    try {
        const { data: partyDetailsData, error } = await supabaseClient
            .from('party_details')
            .select('*')
            .eq('company_id', companyID)// Fetch rows filtered by company ID
            .order('party_name', { ascending: true }); // Order by party_name A to Z (ascending)

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        // Map the data to match the format used in the form
        partyDetails = partyDetailsData.map(row => ({
            partyType: row.party_type,
            partyCode: row.party_code,
            vendorCode:row.party_code,
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
            contactPerson:row.contact_person,
            contactNumber: row.contact_number,
            emailID: row.email_id,
            defaultTax: row.default_tax,
        }));
        // document.getElementById('saveButton').disabled = true;
        populatePartySuggestions(); // Populate the datalist with party names
        populatevendorSuggestions();
    } catch (error) {
        console.error('Error:', error);
    }
}

// Populate the datalist with party names
function populatePartySuggestions() {
    let suggestions = "";
    partyDetails.forEach(party => {
        suggestions += `<option data-party-code="${party.partyCode}" value="${party.partyName}"></option>`;
    });
    $("#partySuggestions").html(suggestions);
}



// When a party name is selected from the dropdown, populate the form with relevant details
$("#partyName").on("input", function () {
    const partyName = $(this).val();
    const partyData = partyDetails.find(party => party.partyName === partyName);

    if (partyData) {
        $("#partyType").val(partyData.partyType);
        $("#partyCode").val(partyData.partyCode);
        $("#partyCurrentStatus").val(partyData.currentStatus);
        $("#partyDeActiveDate").val(partyData.deActiveDate);
        $("#partyAddress").val(partyData.address);
        $("#pinCode").val(partyData.pinCode);
        $("#city").val(partyData.city);
        $("#state").val(partyData.state);
        $("#country").val(partyData.country);
        $("#panNumber").val(partyData.panNumber);
        $("#gSTNumber").val(partyData.gSTNumber);
        $("#partyContacperson").val(partyData.contactPerson);
        $("#partyContactNumber").val(partyData.contactNumber);
        $("#partyEmailID").val(partyData.emailID);
        $("#defaulttax").val(partyData.defaultTax);
    }
});


// Populate the datalist with party names
function populatevendorSuggestions() {
    let vendorsuggestions = "";
    partyDetails.forEach(vendor => {
        vendorsuggestions += `<option data-party-code="${vendor.vendorCode}" value="${vendor.partyName}"></option>`;
    });
    $("#vendorSuggestions").html(vendorsuggestions);
}

// When a vendor name is selected from the dropdown, populate the form with relevant details
$("#vendorName").on("input", function () {
    const vendorName = $(this).val();
    const partyData = partyDetails.find(party => party.partyName === vendorName);

    if (partyData) {
        $("#partyType").val(partyData.partyType);
        $("#vendorCode").val(partyData.partyCode);
        $("#partyCurrentStatus").val(partyData.currentStatus);
        $("#partyDeActiveDate").val(partyData.deActiveDate);
        $("#partyAddress").val(partyData.address);
        $("#pinCode").val(partyData.pinCode);
        $("#city").val(partyData.city);
        $("#state").val(partyData.state);
        $("#country").val(partyData.country);
        $("#panNumber").val(partyData.panNumber);
        $("#gSTNumber").val(partyData.gSTNumber);
        $("#partyContacperson").val(partyData.contactPerson);
        $("#partyContactNumber").val(partyData.contactNumber);
        $("#partyEmailID").val(partyData.emailID);
        $("#defaulttax").val(partyData.defaultTax);


    }
});

// Load party details on page load
$(document).ready(function () {
    loadPartyDetails();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('newButton').disabled = false;
 
});
