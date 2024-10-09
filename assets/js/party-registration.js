
//Modify button event listener
document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    saveButton.textContent = 'Update';
});

//Modify button event listener
document.getElementById('newButton').addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById('saveButton').disabled = false; // Enable the Save button
    document.getElementById('modifyButton').disabled = true;
    saveButton.textContent = 'Save';
    clearForm();
});

// Function to generate new party code
async function generateNewPartyCode(partyName) {
    const firstLetter = partyName.charAt(0).toUpperCase();
    const existingCodes = await fetchExistingPartyCodes();

    // Filter codes that start with the same first letter
    const filteredCodes = existingCodes.filter(code => code.startsWith(firstLetter));

    // Find the highest numeric suffix
    let highestCount = 0;
    filteredCodes.forEach(code => {
        const count = parseInt(code.slice(1), 10); // Get the number part of the code
        if (count > highestCount) {
            highestCount = count;
        }
    });

    // Increment the highest count and format the new party code
    const newCount = highestCount + 1;
    return `${firstLetter}${String(newCount).padStart(4, '0')}`; // Pad with zeros
}

// Function to fetch existing party codes from Google Sheets
async function fetchExistingPartyCodes() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PartyDetails_SHEETID}/values/${PartyDetails_RANGE}?key=${APIKEY}`;
    console.log(url);

    const response = await fetch(url);
    const data = await response.json();

    return data.values ? data.values.flat() : []; // Flatten if the data is in nested arrays
}


// Save or update form data
document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();

    const partyName = $("#partyName").val();
    let partyCode;

    if (saveButton.textContent === 'Save') {
        // Generate new party code
        partyCode = await generateNewPartyCode(partyName);
    } else if (saveButton.textContent === 'Update') {
        partyCode = $("#partyCode").val(); // Use existing party code
    }
    console.log(partyCode);

    // Get form values
    const formData = {
        partyCode: partyCode,
        partyType: $("#partyType").val(),
        partyName: $("#partyName").val(),
        partyContactPerson: "", // Add logic to get this value if needed
        partyContactNumber: $("#partyContactNumber").val(),
        partyOperationPerson: "", // Add logic to get this value if needed
        partyOperationPersonNo: "", // Add logic to get this value if needed
        partyAccountPerson: "", // Add logic to get this value if needed
        partyAccountContactNo: "", // Add logic to get this value if needed
        partyEmailID: $("#partyEmailID").val(),
        partyAddress: $("#partyAddress").val(),
        city: $("#city").val(),
        pinCode: $("#pinCode").val(),
        state: $("#state").val(),
        country: $("#country").val(),
        panNumber: $("#panNumber").val(),
        gSTNumber: $("#gSTNumber").val(),
        tDSPercentage: '',
        tDSEndDate: '',
        tDSStatus: '',
        pymentTandC: '',
        accountNo: '',
        bankName: '',
        branchName: '',
        iFSCCode: '',
        accountType: '',
        defaulttax: $("#defaulttax").val(),
        partyCurrentStatus: $("#partyCurrentStatus").val(),
        partyDeActiveDate: $("#partyDeActiveDate").val(),
        createdBy: userLoginID,
        companyID: companyID,
    };

    const action = (saveButton.textContent === 'Save') ? 'add' : 'update';

    console.log('Show Action ' + action + ' ' + formData.partyCode + 'Corrected data ' + formData.partyAddress);

    if (action == 'add') {
        $("#partyCode").val(partyCode).prop('disabled', true);
    }

    fetch(PartyDetails_URL, {
        method: 'POST',
        mode: 'no-cors',  // Changed to 'cors' to allow for JSON response
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action, data: formData })
    })

    saveButton.textContent = 'Update';
    modifyButton.disabled = false
    saveButton.disabled = true
    document.getElementById('newButton').disabled = false;
    alert(`Party details ${action === 'add' ? 'saved' : 'updated'} successfully!`);

});