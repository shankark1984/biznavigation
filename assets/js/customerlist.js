

// Function to load party details from Google Sheets
function loadPartyDetails() {

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PartyDetails_SHEETID}/values/${PartyDetails_RANGE}?key=${APIKEY}`;
console.log ('Party Details '+url);
    $.getJSON(url, function (data) {
        const rows = data.values;
        // Filter rows by companyID, assuming companyID is in column 31 (index 30)
        const filteredRows = rows.filter(row => row[31] === companyID);

        // partyDetails = rows.map(row => ({
        partyDetails = filteredRows.map(row => ({
            partyType: row[1],
            partyCode: row[0],
            partyName: row[2], // Party Name
            currentStatus: row[27],
            deActiveDate: row[28],
            address: row[10],
            pinCode: row[12],
            city: row[11],
            state: row[13],
            country: row[14],
            panNumber: row[15],
            gSTNumber: row[16],
            contactNumber: row[4],
            emailID: row[9],
            defaultTax: row[26],

            // Add other fields as necessary
        }));
        populatePartySuggestions();
    });
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
