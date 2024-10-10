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
    document.getElementById('reportButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Update';
});

document.getElementById('newButton').addEventListener('click', function () {
    location.reload();
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

    // Check if all required fields are filled
    if (!areRequiredFieldsFilled()) {
        return;
    }


    chargesDetailsConfirmation(lrNumber);

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


    disableForm();
    saveButton.textContent = 'Update';
    modifyButton.disabled = false;
    saveButton.disabled = true;
    reportButton.disabled = false;
    document.getElementById('newButton').disabled = false;
    document.getElementById('addButton').disabled = true;
    alert(`Movement details ${action === 'add' ? 'saved' : 'updated'} successfully!\nLR Number : ${lrNumber}`);
});

// Function to check if all required fields are filled
function areRequiredFieldsFilled() {
    const requiredFields = [
        'lrdate', 'quotationid', 'movementType', 'partyCode', 'partyName',
        'originPinCode', 'orgincity', 'orginAddress', 'destinationPinCode',
        'destinationcity', 'destinationAddress', 'requesteddate', 'vehicleType',
        'referencenumber', 'invoicevalue', 'vehiclenumber', 'containernumber',
        'quantity', 'cargowt', 'descriptionofGoods'
    ];

    for (let fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            // Set focus on the first empty required field
            field.focus();
            alert('Please fill in all required fields.');
            return false; // Return false if any required field is empty
        }
    }

    return true; // Return true if all required fields are filled
}


async function chargesDetailsConfirmation(lrnumber) {

    let lrNumber = document.getElementById('lrnumber').value || tempFormID;
    // Create form data object
    const formData = {
        tempFormID: lrNumber,
        lrNumber: lrNumber
    };

    // Determine if we're adding or updating
    const action = 'chargesConfirm';

    console.log('Action:', action, formData);

    // Perform the fetch request

    const response = await fetch(MovementChargesDetails_URL, {
        method: 'POST',
        mode: 'no-cors',  // Use 'cors' to allow JSON responses
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action, data: formData })
    });
}


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
            descriptionOfGoods: row[22],
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
    getPartyDetails(movementData.partyName, function (partyDetails) {
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

        populateTable(lrNumber); // Replace with actual LRNumber to match
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

document.getElementById('addButton').addEventListener('click', async function (event) {
    event.preventDefault();

    // Ensure lrNumber is either from input or tempFormID
    let lrNumber = document.getElementById('lrnumber').value || tempFormID;
    let taxDesc = document.getElementById('defaulttax').value || 'CGST 0% SGST 0% IGST 0%';
    let chargesType = document.getElementById('chargesType').value;
    // Check for duplicate entry
    const isDuplicate = await checkDuplicate(lrNumber, chargesType);
    if (isDuplicate) {
        alert('Duplicate entry! This charges type already exists for the given LR number: ' + lrNumber + ".");
        return; // Stop further execution
    }

    // Replace spaces with commas and split into array
    let taxDescArray = taxDesc.replace(/\s+/g, ',').split(',');

    // Parse percentages (remove % symbol and divide by 100)
    let cGSTPercentage = parseFloat(taxDescArray[1].replace('%', '')) / 100 || 0;
    let sGSTPercentage = parseFloat(taxDescArray[3].replace('%', '')) / 100 || 0;
    let iGSTPercentage = parseFloat(taxDescArray[5].replace('%', '')) / 100 || 0;

    console.log('CGST Percentage:', cGSTPercentage, 'SGST Percentage:', sGSTPercentage, 'IGST Percentage:', iGSTPercentage);

    // Get basic amount
    let basicAmount = parseFloat(document.getElementById('frightcharges').value) || 0;

    // Calculate tax amounts
    let cGStAmt = basicAmount * cGSTPercentage;
    let sGSTAmt = basicAmount * sGSTPercentage;
    let iGSTAmt = basicAmount * iGSTPercentage;
    let totalGSTAmount = cGStAmt + sGSTAmt + iGSTAmt;
    let grandTotalBilling = totalGSTAmount + basicAmount;

    // Create form data object
    const formData = {
        lrNumber: lrNumber,
        chargesType: document.getElementById('chargesType').value,
        basicAmount: basicAmount,
        gSTType: taxDesc,
        cGSTAmount: cGStAmt,
        sGSTAmount: sGSTAmt,
        iGSTAmount: iGSTAmt,
        totalGSTAmount: totalGSTAmount,
        grandTotalBilling: grandTotalBilling,
        companyID: companyID,  // Ensure companyID is defined
        createdBy: userLoginID, // Ensure userLoginID is defined
        flg: 0
    };

    // Determine if we're adding or updating
    const action = (document.getElementById('addButton').textContent === 'Add') ? 'add' : 'update';

    console.log('Action:', action, formData);

    // Perform the fetch request
    console.log('Movement Charges Details google sheet ' + MovementChargesDetails_URL)
    const response = await fetch(MovementChargesDetails_URL, {
        method: 'POST',
        mode: 'no-cors',  // Use 'cors' to allow JSON responses
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action, data: formData })
    });
    populateTable(lrNumber); // Replace with actual LRNumber to match
});

async function checkDuplicate(lrNumber, chargesType) {
    // Construct the URL for Google Sheets API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementChargesDetails_SHEETID}/values/${MovementChargesDetails_Range}?key=${APIKEY}`;

    try {
        // Fetch data from Google Sheets
        const response = await $.getJSON(url);
        const rows = response.values;

        // Assuming LR Number is in column 35 (index 34) and chargesType is in column X (replace X with the correct index)
        const filteredRows = rows.filter(row => row[0] === lrNumber && row[1] === chargesType);

        // If a matching entry is found, return true for duplicate
        if (filteredRows.length > 0) {
            return true; // Duplicate found
        }

        return false; // No duplicate found
    } catch (error) {
        console.error("Error fetching data:", error);
        return false; // Handle errors, assume no duplicate
    }
}

// Function to fetch data from Google Sheets
async function fetchGoogleSheetData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementChargesDetails_SHEETID}/values/${MovementChargesDetails_Range}?key=${APIKEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Fetched Data:", data.values); // Log the fetched data
    return data.values;
}

// Function to populate table with data where LRNumber matches
async function populateTable(lrNumber) {
    const data = await fetchGoogleSheetData();
    const tableBody = document.querySelector('#chargesDetailsTable tbody');

    // Clear existing table rows
    tableBody.innerHTML = '';

    // Assuming LRNumber is in the first column (index 0), adjust as needed
    data.forEach((row, index) => {
        if (row[0] === lrNumber) { // Match LRNumber
            const newRow = document.createElement('tr');

            // Log matching row
            console.log("Matching Row:", row);

            // Populate the row with ChargesDetails columns (start from column 1 or adjust as needed)
            row.slice(1).forEach((cellValue) => {
                const cell = document.createElement('td');
                cell.innerText = cellValue;
                newRow.appendChild(cell);
            });

            tableBody.appendChild(newRow);
        }
    });
}
// function openReport() {
//     lrNumber=document.getElementById('lrnumber').value,
//     window.open('lrReport.html', '_blank'); // Opens lr_report.html in a new tab/window
// }
document.getElementById('reportButton').addEventListener('click', async function (event) {
    event.preventDefault();

    // Assuming lrNumber is defined elsewhere in your script
    let lrNumber = document.getElementById('lrnumber').value; // Get lrNumber value from input

    // Store lrNumber in localStorage
    localStorage.setItem('lrNumber', lrNumber);

    // Function to open the report window
    function openReport() {
        var newWindow = window.open('lrReport.html', 'LR Report', 'width=800,height=600');
        if (newWindow) {
            newWindow.focus();
        } else {
            alert('Please allow popups for this site.');
        }
    }

    openReport();
});

