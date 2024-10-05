function openTab(evt, tabName) {
    let tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }

    let tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.className += " active";
}

document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Update';
});

document.getElementById('newButton').addEventListener('click', function () {
    enableForm();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Save';
    clearForm(); // Assuming there's a clearForm function
});

async function generateNewLRNumber() {
    const compshortCode = localStorage.getItem('companyShortCode');

    if (!compshortCode) {
        throw new Error('Company Short Code is not available');
    }

    console.log('Company Short Code: ' + compshortCode);

    const existingCodes = await fetchExistingLRNumber();

    const filteredCodes = existingCodes.filter(code => code.startsWith(compshortCode));

    let highestCount = 0;
    filteredCodes.forEach(code => {
        const numericPart = code.slice(compshortCode.length);
        const count = parseInt(numericPart, 10);
        if (!isNaN(count) && count > highestCount) {
            highestCount = count;
        }
    });

    const newCount = highestCount + 1;
    lrNumber = `${compshortCode}${String(newCount).padStart(7, '0')}`;
    console.log('Generated LR Number: ' + lrNumber);
    document.getElementById('lrnumber').value = lrNumber;
    return lrNumber;
}

async function fetchExistingLRNumber() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementDetails_SHEETID}/values/${MovementDetails_RANGE}?key=${APIKEY}`;

    console.log('Fetching data from URL: ' + url);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const data = await response.json();
        return data.values ? data.values.flat() : [];
    } catch (error) {
        console.error('Error fetching LR Numbers: ', error);
        return [];
    }
}

document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();

    if (document.getElementById('saveButton').textContent === 'Save') {
        lrNumber = await generateNewLRNumber();
    } else if (document.getElementById('saveButton').textContent === 'Update') {
        lrNumber = document.getElementById('lrnumber').value;
    }

    const modeType = document.getElementById('modeType').value;
    if (modeType === 'FTL') {
        transitType = 'By Road';
    } else if (modeType === 'FCL') {
        transitType = 'By Sea Freight';
    }

    const formData = {
        tempFormID: tempFormID,
        lrNumber: lrNumber,
        lrDate: document.getElementById('lrdate').value,
        quotationID: document.getElementById('quotationid').value,
        movementType: document.getElementById('movementType').value,
        transitType: transitType,
        partyCode: document.getElementById('partyCode').value,
        partyName: document.getElementById('partyName').value,
        originPinCode: document.getElementById('originPinCode').value,
        originCity: document.getElementById('orgincity').value,
        originAddress: document.getElementById('orginAddress').value,
        destinationPinCode: document.getElementById('destinationPinCode').value,
        destinationCity: document.getElementById('destinationcity').value,
        destinationAddress: document.getElementById('destinationAddress').value,
        requestedDate: document.getElementById('requesteddate').value,
        vehicleType: document.getElementById('vehicleType').value,
        referenceNumber: document.getElementById('referencenumber').value,
        invoiceValue: document.getElementById('invoicevalue').value,
        vehicleNumber: document.getElementById('vehiclenumber').value,
        containerNumber: document.getElementById('containernumber').value,
        modeType: modeType,
        quantity: document.getElementById('quantity').value,
        cargoWT: document.getElementById('cargowt').value,
        descriptionOfGoods: document.getElementById('descriptionofGoods').value,
        status: '',
        completionDate: '',
        frightCharges: '',
        otherCharges: '',
        subTotal: '',
        cGSTAmount: '',
        sGSTAmount: '',
        iGSTAmount: '',
        totalGSTAmount: '',
        grandTotalBilling: '',
        invoiceNumber: '',
        companyID: companyID,
        createdBy: userLoginID,
    };

    const action = (document.getElementById('saveButton').textContent === 'Save') ? 'add' : 'update';

    console.log('Action: ' + action, formData);

    const response = await fetch(MovementDetails_URL, {
        method: 'POST',
        mode: 'no-cors',  // Changed to 'cors' to allow for JSON response
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action, data: formData })
    });

    saveButton.textContent = 'Update';
    modifyButton.disabled = false;
    saveButton.disabled = true;
    reportButton.disabled = false;
    disableForm();
    document.getElementById('newButton').disabled = false;
    alert(`Party details ${action === 'add' ? 'saved' : 'updated'} successfully!`);
});



// Function to load Movement details from Google Sheets
function loadMovementDetails() {

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementDetails_SHEETID}/values/${MovementDetails_RANGE}?key=${APIKEY}`;

    $.getJSON(url, function (data) {
        const rows = data.values;
        // Filter rows by companyID, assuming LR Number is in column 35 (index 34)
        const filteredRows = rows.filter(row => row[34] === companyID);

        
        // partyDetails = rows.map(row => ({
        movementDetails = filteredRows.map(row => ({
            lrNumber: row[0],
            lrDate: row[1],
            quotationID: row[2],
            movementType: row[3],
            transitType: row[4],
            partyCode: row[5],
            partyName: row[6],
            originPinCode: row[7],
            originCity: row[8],
            originAddress: row[9],
            destinationPinCode: row[10],
            destinationCity: row[11],
            destinationAddress: row[12],
            requestedDate: row[13],
            vehicleType: row[14],
            referenceNumber: row[15],
            invoiceValue: row[16],
            vehicleNumber: row[17],
            containerNumber: row[18],
            modeType: row[19],
            quantity: row[20],
            cargoWT: row[21],
            descriptionOfGoods:row[22],
            status: row[23],
            completionDate: row[24],
            frightCharges: row[25],
            otherCharges: row[26],
            subTotal: row[27],
            cGSTAmount: row[28],
            sGSTAmount: row[29],
            iGSTAmount: row[30],
            totalGSTAmount: row[31],
            grandTotalBilling: row[32],
            invoiceNumber: row[33],
            // Add other fields as necessary
        }));
        populateLRNumberSuggestions();
    });
}

// Populate the datalist with LR Number
function populateLRNumberSuggestions() {
    let suggestions = "";
    movementDetails.forEach(movement => {
        suggestions += `<option data-lr-numbber="${movement.lrNumber}" value="${movement.lrNumber}"></option>`;
    });
    $("#lrNumberSuggestions").html(suggestions);
}

// When a LR Number is selected from the dropdown, populate the form with relevant details
$("#lrnumber").on("input", function () {
    const lrNumber = $(this).val();
    const movementData = movementDetails.find(movement => movement.lrNumber === lrNumber);
    getPartyDetails(movementData.partyName, function(partyDetails) {
           // Assuming you want to use the first matching party's partyCode
           const partycode = partyDetails[0].partyCode;
           // Set the value of the input field with id 'partyCode'
           document.getElementById('partyCode').value = partycode;
    });


    if (movementData) {
        $("#lrdate").val(movementData.lrDate);
        $("#quotationid").val(movementData.quotationID);
        $("#movementType").val(movementData.movementType);
        // $("#partyCode").val(partycode);
        $("#partyName").val(movementData.partyName);
        $("#originPinCode").val(movementData.originPinCode);
        $("#orgincity").val(movementData.originCity);
        $("#orginAddress").val(movementData.originAddress);
        $("#destinationPinCode").val(movementData.destinationPinCode);
        $("#destinationcity").val(movementData.destinationCity);
        $("#destinationAddress").val(movementData.destinationAddress);
        $("#requesteddate").val(movementData.requestedDate);
        $("#vehicleType").val(movementData.vehicleType);
        $("#referencenumber").val(movementData.referenceNumber);
        $("#invoicevalue").val(movementData.invoiceValue);
        $("#vehiclenumber").val(movementData.vehicleNumber);
        $("#containernumber").val(movementData.containerNumber);
        $("#modeType").val(movementData.modeType);
        $("#quantity").val(movementData.quantity);
        $("#cargowt").val(movementData.cargoWT);
        $("#descriptionofGoods").val(movementData.descriptionOfGoods);

        // Populate other fields as necessary
        saveButton.textContent = 'Update';
        disableForm();

        if (userType == 1 || userType == 2) {
            document.getElementById('modifyButton').disabled = false;
            document.getElementById('newButton').disabled = false;
            document.getElementById('saveButton').disabled = true;

        } else {
            document.getElementById('modifyButton').disabled = true;
            document.getElementById('saveButton').disabled = true;
        }
        document.getElementById('reportButton').disabled = false;
    }
});

// Load party details on page load
$(document).ready(function () {
    loadMovementDetails();

});
