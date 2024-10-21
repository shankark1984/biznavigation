
document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Update';
    document.getElementById('addButton').disabled = false;
    document.getElementById('VendoraddButton').disabled = false;
});

document.getElementById('newButton').addEventListener('click', function () {
    location.reload();
    enableForm();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('saveButton').textContent = 'Save';
    clearForm(); // Assuming there's a clearForm function
});


//Generate New LR Number
async function generateNewLRNumber() {
    const compshortCode = localStorage.getItem('companyShortCode');

    if (!compshortCode) {
        throw new Error('Company Short Code is not available');
    }

    // Fetch existing LR numbers from Supabase
    const { data: existingCodes, error } = await supabaseClient
        .from('booking_details')
        .select('lr_number')
        .like('lr_number', `${compshortCode}%`);

    if (error) {
        console.error('Error fetching LR numbers:', error);
        return;
    }

    let highestCount = 0;
    existingCodes.forEach(row => {
        const numericPart = row.lr_number.slice(compshortCode.length);
        const count = parseInt(numericPart, 10);
        if (!isNaN(count) && count > highestCount) {
            highestCount = count;
        }
    });

    const newCount = highestCount + 1;
    const lrNumber = `${compshortCode}${String(newCount).padStart(7, '0')}`;
    document.getElementById('lrnumber').value = lrNumber;

    return lrNumber;
}

//Save or Update Booking Details
document.getElementById('saveButton').addEventListener('click', async function (event) {
    event.preventDefault();
    document.getElementById('saveButton').disabled = true;
    document.getElementById('addButton').disabled = true;
    document.getElementById('VendoraddButton').disabled = true;
    if (!areRequiredFieldsFilled()) {
        document.getElementById('saveButton').disabled = false;
        return;
    }

    let lrNumber;
    if (document.getElementById('saveButton').textContent === 'Save') {
        lrNumber = await generateNewLRNumber();
    } else {
        lrNumber = document.getElementById('lrnumber').value;
    }

    const modeType = document.getElementById('modeType').value;
    const transitType = modeType === 'FTL' ? 'By Road' : 'By Sea Freight';

    const formData = {
        lr_number: lrNumber,
        pickup_date: document.getElementById('lrdate').value,
        quotation_id: document.getElementById('quotationid').value,
        movement_type: document.getElementById('movementType').value,
        transit_type: transitType,
        customer_code: document.getElementById('partyCode').value,
        customer_name: document.getElementById('partyName').value,
        origin_pincode: document.getElementById('originPinCode').value,
        origin_city: document.getElementById('orgincity').value,
        origin_address: document.getElementById('orginAddress').value,
        destination_pincode: document.getElementById('destinationPinCode').value,
        destination_city: document.getElementById('destinationcity').value,
        destination_address: document.getElementById('destinationAddress').value,
        requested_date: document.getElementById('requesteddate').value,
        vehicle_type: document.getElementById('vehicleType').value,
        reference_number: document.getElementById('referencenumber').value,
        invoice_value: parseFloat(document.getElementById('invoiceValue')) || 0,
        vendor_code: document.getElementById('vendorCode').value,
        vendor_name: document.getElementById('vendorName').value,
        vehicle_number: document.getElementById('vehiclenumber').value,
        container_number: document.getElementById('containernumber').value,
        mode_type: modeType,
        quantity: document.getElementById('quantity').value,
        actual_weight: document.getElementById('actualwt').value,
        charge_weight: document.getElementById('chargewt').value,
        description_of_goods: document.getElementById('descriptionofGoods').value,
        payment_type: document.getElementById('paymentType').value,
        created_by: userLoginID,  // Ensure userLoginID is available
        company_id: companyID,  // Ensure companyID is available
        created_at: localtimeStamp,
    };

    const action = document.getElementById('saveButton').textContent === 'Save' ? 'add' : 'update';

    let response;
    if (action === 'add') {
        response = await supabaseClient
            .from('booking_details')
            .insert([formData]);
    } else {
        response = await supabaseClient
            .from('booking_details')
            .update(formData)
            .eq('lr_number', lrNumber);
    }

    if (response.error) {
        console.error('Error saving data:', response.error);
        alert('Error saving movement details');
        return;
    }

    disableForm();
    document.getElementById('saveButton').textContent = 'Update';
    document.getElementById('modifyButton').disabled = false;
    document.getElementById('reportButton').disabled = false;

    alert(`Movement details ${action === 'add' ? 'saved' : 'updated'} successfully!\nLR Number: ${lrNumber}`);
});

//customer list
document.getElementById('partyName').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Customer Name '+inputValue);
    await loadPartyDetails(inputValue); // Pass the input value to the function
});
// Clear the suggestion box when input field loses focus
document.getElementById('partyName').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('partySuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});

//vendor name list
document.getElementById('vendorName').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Vendor Name '+inputValue);
    await loadPartyDetails(inputValue); // Pass the input value to the function
});
// Clear the suggestion box when input field loses focus
document.getElementById('vendorName').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('vendorSuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});

// Real-time event listener for user input
document.getElementById('lrnumber').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('LR Number '+inputValue);
    await loadMovementDetails(inputValue); // Pass the input value to the function
});

// Clear the suggestion box when input field loses focus
document.getElementById('lrnumber').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('lrNumberSuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});

//Fetch and Load Booking Details
async function loadMovementDetails(query = '') {
    const { data, error } = await supabaseClient
        .from('booking_details')
        .select('*')
        .eq('company_id', companyID)
        .ilike('lr_number', `%${query}%`) // Use ilike for case-insensitive partial matching
        .order('lr_number', { ascending: false }); // Order by party_name A to Z (ascending)
        
        if (data) {
            console.log(data); // Check this to ensure all data is retrieved
        }
    if (error) {
        console.error('Error fetching movement details:', error);
        return;
    }

    movementDetails = data.map(row => ({
        lrNumber: row.lr_number,
        lrDate: row.pickup_date,
        quotationID: row.quotation_id,
        movementType: row.movement_type,
        transitType: row.transit_type,
        partyCode: row.customer_code,
        partyName: row.customer_name,
        originPinCode: row.origin_pincode,
        originCity: row.origin_city,
        originAddress: row.origin_address,
        destinationPinCode: row.destination_pincode,
        destinationCity: row.destination_city,
        destinationAddress: row.destination_address,
        requestedDate: row.requested_date,
        vehicleType: row.vehicle_type,
        referenceNumber: row.reference_number,
        vendorCode: row.vendor_code,
        vendorName: row.vendor_name,
        vehicleNumber: row.vehicle_number,
        containerNumber: row.container_number,
        modeType: row.mode_type,
        quantity: row.quantity,
        actualWT: row.actual_weight,
        chargeWT: row.charge_weight,
        paymentType: row.payment_type,
        descriptionOfGoods: row.description_of_goods,
        status: row.status,
        completionDate: row.completion_date,
    }));

    populateLRNumberSuggestions();
}

function populateLRNumberSuggestions() {
    let suggestions = "";
    movementDetails.forEach(movement => {
        suggestions += `<option data-lr-numbber="${movement.lrNumber}" value="${movement.lrNumber}"></option>`;
    });
    document.getElementById("lrNumberSuggestions").innerHTML = suggestions;
}

// When a LR Number is selected from the dropdown, populate the form with relevant details
$("#lrnumber").on("input", async function () {
    const lrNumber = $(this).val();
    const movementData = movementDetails.find(movement => movement.lrNumber === lrNumber);

    const { data, error } = await supabaseClient
        .from('booking_details')
        .select('*')  // Only selecting customer_code
        .eq('lr_number', lrNumber);

    if (error) {
        console.error('Error fetching customer_code:', error);
    } else if (data.length > 0) {
        const customerId = data[0].customer_code;  // Get the customer_id from the response
        const vendorCode = data[0].vendor_code;
        console.log('Customer ID:', customerId);
        console.log('VendorpartyCode ID:', vendorCode);
        document.getElementById('partyCode').value = customerId;
        document.getElementById('vendorCode').value = vendorCode;
    } else {
        console.log('No record found for the given LR number.');
    }

    if (movementData) {
        $("#lrdate").val(movementData.lrDate);
        $("#quotationid").val(movementData.quotationID);
        $("#movementType").val(movementData.movementType);
        // $("#partyCode").val(movementData.partycode);
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
        $("#vendorName").val(movementData.vendorName);
        $("#vehiclenumber").val(movementData.vehicleNumber);
        $("#containernumber").val(movementData.containerNumber);
        $("#modeType").val(movementData.modeType);
        $("#quantity").val(movementData.quantity);
        $("#actualwt").val(movementData.actualWT);
        $("#chargewt").val(movementData.chargeWT);
        $("#paymentType").val(movementData.paymentType);
        $("#descriptionofGoods").val(movementData.descriptionOfGoods);

        populateTable(lrNumber); // Replace with actual LRNumber to match
        vendorpopulateTable(lrNumber); // Replace with actual LRNumber to match
        document.getElementById('addButton').disabled = true;
        document.getElementById('VendoraddButton').disabled = true;


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

//Populate Booking Charges Details
async function loadMovementChargesDetails(lrNumber) {
    const { data, error } = await supabaseClient
        .from('booking_charges')
        .select('*')
        .eq('lr_number', lrNumber);

    if (error) {
        console.error('Error fetching movement charges:', error);
        return;
    }

    frightCharges = 0;
    otherCharges = 0;
    cGSTAmount = 0;
    sGSTAmount = 0;
    iGSTAmount = 0;

    data.forEach(row => {
        if (row.charges_type === 'Freight Amount') {
            frightCharges = parseFloat(row.amount);
        } else {
            otherCharges += parseFloat(row.amount);
        }

        cGSTAmount += parseFloat(row.cgst_amount);
        sGSTAmount += parseFloat(row.sgst_amount);
        iGSTAmount += parseFloat(row.igst_amount);
    });

    totalGSTAmount = cGSTAmount + sGSTAmount + iGSTAmount;
    subTotal = frightCharges + otherCharges;
    grandTotal = subTotal + totalGSTAmount;

    console.log("Grand Total:", grandTotal);
}

//Check for Duplicate Entry
async function checkDuplicate(lrNumber, chargesType, accountType) {
    const { data, error } = await supabaseClient
        .from('booking_charges')
        .select('*')
        .eq('lr_number', lrNumber)
        .eq('charges_type', chargesType && 'account_type', accountType);

    if (error) {
        console.error('Error checking duplicate:', error);
        return false;
    }

    return data.length > 0;
}

// Function to check if all required fields are filled
function areRequiredFieldsFilled() {
    const requiredFields = [
        'lrdate', 'movementType', 'partyName',
        'originPinCode', 'orgincity', 'orginAddress', 'destinationPinCode',
        'destinationcity', 'destinationAddress', 'requesteddate', 'vehicleType',
        'vehiclenumber', 'quantity', 'chargewt', 'modeType', 'quantity', 'chargewt'
    ];


    for (let fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            // Set focus on the first empty required field
            field.focus();
            alert('Please fill in all required fields. ' + fieldId);
            return false; // Return false if any required field is empty
        }
    }

    return true; // Return true if all required fields are filled
}

// Function to populate table with data where LRNumber matches
async function populateTable(lrNumber) {
    const data = await fetchSupabaseData(); // Fetch the data
    const tableBody = document.querySelector('#chargesDetailsTable tbody');
    const tableFoot = document.querySelector('#chargesDetailsTable tfoot');

    // Clear existing table rows
    tableBody.innerHTML = '';

    // Variables to store total sums
    let totalAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    // Function to update the totals row
    function updateTotals() {
        // Clear any existing footer content
        if (tableFoot) {
            tableFoot.innerHTML = '';
        }
        const totalRow = document.createElement('tr');
        totalRow.innerHTML = `
            <td colspan="2"><strong>Total</strong></td>
            <td><strong>${totalAmount.toFixed(2)}</strong></td>
            <td><strong>${totalCGST.toFixed(2)}</strong></td>
            <td><strong>${totalSGST.toFixed(2)}</strong></td>
            <td><strong>${totalIGST.toFixed(2)}</strong></td>
            <td><strong>${totalGST.toFixed(2)}</strong></td>
            <td><strong>${grandTotal.toFixed(2)}</strong></td>
            <td></td>
        `;
        if (tableFoot) {
            tableFoot.appendChild(totalRow);
        } else {
            const newFooter = document.createElement('tfoot');
            newFooter.appendChild(totalRow);
            document.querySelector('#chargesDetailsTable').appendChild(newFooter);
        }
    }
    // Loop through the fetched data
    data.forEach(row => {
        if (row.lr_number === lrNumber) { // Match the LR number
            const newRow = document.createElement('tr');

            // Log the matching row
            console.log("Matching Row:", row);

            // Populate the row with relevant fields
            const fields = [
                row.charges_type, row.gst_type, row.amount,
                row.cgst_amount, row.sgst_amount, row.igst_amount,
                row.total_gst_amount, row.grand_total_billing
            ];

            // Create and append cells to the new row
            fields.forEach(cellValue => {
                const cell = document.createElement('td');
                cell.innerText = cellValue;
                newRow.appendChild(cell);
            });

            // Add delete button
            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Delete';
            deleteButton.className = 'delete-btn'; // Optional: for styling
            deleteButton.onclick = (event) => {
                event.preventDefault(); // Prevent the default form submission behavior

                // Subtract the deleted row's values from the totals
                totalAmount -= parseFloat(row.amount || 0);
                totalCGST -= parseFloat(row.cgst_amount || 0);
                totalSGST -= parseFloat(row.sgst_amount || 0);
                totalIGST -= parseFloat(row.igst_amount || 0);
                totalGST -= parseFloat(row.total_gst_amount || 0);
                grandTotal -= parseFloat(row.grand_total_billing || 0);

                // Remove the row from the table
                tableBody.removeChild(newRow);

                // Update totals after row deletion
                updateTotals();

                deleteTableRow(newRow, row.id); // Pass row ID to delete function
            };
            deleteCell.appendChild(deleteButton);
            newRow.appendChild(deleteCell);

            tableBody.appendChild(newRow);

            // Accumulate totals
            totalAmount += parseFloat(row.amount || 0);
            totalCGST += parseFloat(row.cgst_amount || 0);
            totalSGST += parseFloat(row.sgst_amount || 0);
            totalIGST += parseFloat(row.igst_amount || 0);
            totalGST += parseFloat(row.total_gst_amount || 0);
            grandTotal += parseFloat(row.grand_total_billing || 0);
        }
    });

    // Add or update totals row after the loop
    updateTotals();
}

// Function to fetch data from Supabase
async function fetchSupabaseData() {
    try {
        // Fetch data from 'booking_charges' table
        let { data, error } = await supabaseClient
            .from('booking_charges') // Table name
            .select('*') // Fetch all fields
            .eq('account_type', 'Sale')// Fetch rows filtered by company ID

        if (error) {
            console.error("Error fetching data:", error);
            return [];
        }

        console.log("Fetched Data:", data); // Log the fetched data
        return data;
    } catch (error) {
        console.error("Unexpected error fetching data:", error);
        return [];
    }
}

// Function to delete a row from the table and database
async function deleteTableRow(row, rowId) {
    // First, delete from the database
    try {
        if (document.getElementById('modifyButton').disabled == true) {
            // If successful, remove the row from the table
            let { error } = await supabaseClient
                .from('booking_charges') // Your table name
                .delete() // Perform the delete action
                .eq('id', rowId); // Specify which row to delete using the row ID

            if (error) {
                console.error("Error deleting from database:", error);
                return; // Stop further execution if there's an error
            }

            row.remove();
            alert('Charges deleted successfully.');
        }
    } catch (error) {
        console.error("Unexpected error deleting row:", error);
    }
}

document.getElementById('addButton').addEventListener('click', async function (event) {
    event.preventDefault();
    document.getElementById('addButton').disabled = true;

    let lrNumber = document.getElementById('lrnumber').value || tempFormID;
    let taxDesc = document.getElementById('defaulttax').value || 'CGST 0% SGST 0% IGST 0%';
    let chargesType = document.getElementById('chargesType').value;

    // Check for duplicate entry in Supabase
    let { data: duplicateData, error: duplicateError } = await supabaseClient
        .from('booking_charges')
        .select('*')
        .eq('lr_number', lrNumber)
        .eq('charges_type', chargesType)
        .eq('account_type', 'Sale');

    if (duplicateData && duplicateData.length > 0) {
        alert('Duplicate entry! This charges type already exists for the given LR number: ' + lrNumber + ".");
        return; // Stop further execution
    }

    let taxDescArray = taxDesc.replace(/\s+/g, ',').split(',');
    let cGSTPercentage = parseFloat(taxDescArray[1].replace('%', '')) / 100 || 0;
    let sGSTPercentage = parseFloat(taxDescArray[3].replace('%', '')) / 100 || 0;
    let iGSTPercentage = parseFloat(taxDescArray[5].replace('%', '')) / 100 || 0;

    let basicAmount = parseFloat(document.getElementById('frightcharges').value) || 0;
    let cGStAmt = basicAmount * cGSTPercentage;
    let sGSTAmt = basicAmount * sGSTPercentage;
    let iGSTAmt = basicAmount * iGSTPercentage;
    let totalGSTAmount = cGStAmt + sGSTAmt + iGSTAmt;
    let grandTotalBilling = totalGSTAmount + basicAmount;

    const formData = {
        lr_number: lrNumber,
        charges_type: chargesType,
        amount: basicAmount,
        gst_type: taxDesc,
        cgst_amount: cGStAmt,
        sgst_amount: sGSTAmt,
        igst_amount: iGSTAmt,
        total_gst_amount: totalGSTAmount,
        grand_total_billing: grandTotalBilling,
        flg: 0,  // Assuming this is a flag for active or inactive records
        created_by: userLoginID,  // Ensure userLoginID is defined
        created_at: localtimeStamp,
        account_type: 'Sale'
    };

    const action = (document.getElementById('addButton').textContent === 'Add') ? 'add' : 'update';

    // Insert or Update record in Supabase
    if (action === 'add') {
        const { data, error } = await supabaseClient
            .from('booking_charges')
            .insert([formData]);
        if (error) {
            console.error('Error adding data:', error);
        } else {
            console.log('Data added:', data);
        }
    } else {
        // For updating, you'll need an ID to identify the record
        const { data, error } = await supabaseClient
            .from('booking_charges')
            .update(formData)
            .eq('lr_number', lrNumber)
            .eq('charges_type', chargesType);
        if (error) {
            console.error('Error updating data:', error);
        } else {
            console.log('Data updated:', data);
        }
    }

    document.getElementById('addButton').disabled = false;

    // Populate table or perform any other operations needed
    populateTable(lrNumber);
});

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





async function vendorpopulateTable(lrNumber) {
    const data = await vendorfetchSupabaseData(); // Fetch the data
    const tableBody = document.querySelector('#vendorchargesDetailsTable tbody');
    const tableFoot = document.querySelector('#vendorchargesDetailsTable tfoot');

    // Clear existing table rows
    tableBody.innerHTML = '';

    // Variables to store total sums
    let totalAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    // Function to update the totals row
    function updateTotals() {
        // Clear any existing footer content
        if (tableFoot) {
            tableFoot.innerHTML = '';
        }

        const totalRow = document.createElement('tr');
        totalRow.innerHTML = `
            <td colspan="2"><strong>Total</strong></td>
            <td><strong>${totalAmount.toFixed(2)}</strong></td>
            <td><strong>${totalCGST.toFixed(2)}</strong></td>
            <td><strong>${totalSGST.toFixed(2)}</strong></td>
            <td><strong>${totalIGST.toFixed(2)}</strong></td>
            <td><strong>${totalGST.toFixed(2)}</strong></td>
            <td><strong>${grandTotal.toFixed(2)}</strong></td>
            <td></td>
        `;
        if (tableFoot) {
            tableFoot.appendChild(totalRow);
        } else {
            const newFooter = document.createElement('tfoot');
            newFooter.appendChild(totalRow);
            document.querySelector('#vendorchargesDetailsTable').appendChild(newFooter);
        }
    }

    // Loop through the fetched data
    data.forEach(row => {
        if (row.lr_number === lrNumber) { // Match the LR number
            const newRow = document.createElement('tr');

            // Log the matching row
            console.log("Matching Row:", row);

            // Populate the row with relevant fields
            const fields = [
                row.charges_type, row.gst_type, row.amount,
                row.cgst_amount, row.sgst_amount, row.igst_amount,
                row.total_gst_amount, row.grand_total_billing
            ];

            // Create and append cells to the new row
            fields.forEach(cellValue => {
                const cell = document.createElement('td');
                cell.innerText = cellValue;
                newRow.appendChild(cell);
            });

            // Add delete button
            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Delete';
            deleteButton.className = 'delete-btn'; // Optional: for styling
            deleteButton.onclick = (event) => {
                event.preventDefault(); // Prevent the default form submission behavior

                // Subtract the deleted row's values from the totals
                totalAmount -= parseFloat(row.amount || 0);
                totalCGST -= parseFloat(row.cgst_amount || 0);
                totalSGST -= parseFloat(row.sgst_amount || 0);
                totalIGST -= parseFloat(row.igst_amount || 0);
                totalGST -= parseFloat(row.total_gst_amount || 0);
                grandTotal -= parseFloat(row.grand_total_billing || 0);

                // Remove the row from the table
                tableBody.removeChild(newRow);

                // Update totals after row deletion
                updateTotals();

                vendordeleteTableRow(newRow, row.id); // Pass row ID to delete function
            };
            deleteCell.appendChild(deleteButton);
            newRow.appendChild(deleteCell);

            tableBody.appendChild(newRow);

            // Accumulate totals
            totalAmount += parseFloat(row.amount || 0);
            totalCGST += parseFloat(row.cgst_amount || 0);
            totalSGST += parseFloat(row.sgst_amount || 0);
            totalIGST += parseFloat(row.igst_amount || 0);
            totalGST += parseFloat(row.total_gst_amount || 0);
            grandTotal += parseFloat(row.grand_total_billing || 0);
        }
    });

    // Add or update totals row after the loop
    updateTotals();
}




// Function to fetch data from Supabase
async function vendorfetchSupabaseData() {
    try {
        // Fetch data from 'booking_charges' table
        let { data, error } = await supabaseClient
            .from('booking_charges') // Table name
            .select('*')// Fetch all fields
            .eq('account_type', 'Buy')// Fetch rows filtered by company ID

        if (error) {
            console.error("Error fetching data:", error);
            return [];
        }

        console.log("Fetched Data:", data); // Log the fetched data
        return data;
    } catch (error) {
        console.error("Unexpected error fetching data:", error);
        return [];
    }
}

// Function to delete a row from the table and database
async function vendordeleteTableRow(row, rowId) {
    // First, delete from the database
    try {
        if (document.getElementById('modifyButton').disabled == true) {
            // If successful, remove the row from the table
            let { error } = await supabaseClient
                .from('booking_charges') // Your table name
                .delete() // Perform the delete action
                .eq('id', rowId); // Specify which row to delete using the row ID

            if (error) {
                console.error("Error deleting from database:", error);
                return; // Stop further execution if there's an error
            }

            row.remove();
            alert('Charges deleted successfully.');
        }

    } catch (error) {
        console.error("Unexpected error deleting row:", error);
    }
}

document.getElementById('VendoraddButton').addEventListener('click', async function (event) {
    event.preventDefault();
    document.getElementById('VendoraddButton').disabled = true;

    let lrNumber = document.getElementById('lrnumber').value || tempFormID;
    let taxDesc_v = document.getElementById('vendorDefaultTax').value || 'CGST 0% SGST 0% IGST 0%';
    let chargesType_v = document.getElementById('vendorChargesType').value;

    // Check for duplicate entry in Supabase
    let { data: duplicateData, error: duplicateError } = await supabaseClient
        .from('booking_charges')
        .select('*')
        .eq('lr_number', lrNumber)
        .eq('charges_type', chargesType_v)
        .eq('account_type', 'Buy');

    if (duplicateData && duplicateData.length > 0) {
        alert('Duplicate entry! This charges type already exists for the given LR number: ' + lrNumber + ".");
        return; // Stop further execution
    }

    let taxDescArray_v = taxDesc_v.replace(/\s+/g, ',').split(',');
    let cGSTPercentage_v = parseFloat(taxDescArray_v[1].replace('%', '')) / 100 || 0;
    let sGSTPercentage_v = parseFloat(taxDescArray_v[3].replace('%', '')) / 100 || 0;
    let iGSTPercentage_v = parseFloat(taxDescArray_v[5].replace('%', '')) / 100 || 0;

    let basicAmount_v = parseFloat(document.getElementById('vendorFrightcharges').value) || 0;
    let cGStAmt_v = basicAmount_v * cGSTPercentage_v;
    let sGSTAmt_v = basicAmount_v * sGSTPercentage_v;
    let iGSTAmt_v = basicAmount_v * iGSTPercentage_v;
    let totalGSTAmount_v = cGStAmt_v + sGSTAmt_v + iGSTAmt_v;
    let grandTotalBilling_v = totalGSTAmount_v + basicAmount_v;

    const formData = {
        lr_number: lrNumber,
        charges_type: chargesType_v,
        amount: basicAmount_v,
        gst_type: taxDesc_v,
        cgst_amount: cGStAmt_v,
        sgst_amount: sGSTAmt_v,
        igst_amount: iGSTAmt_v,
        total_gst_amount: totalGSTAmount_v,
        grand_total_billing: grandTotalBilling_v,
        flg: 0,  // Assuming this is a flag for active or inactive records
        created_by: userLoginID,  // Ensure userLoginID is defined
        created_at: localtimeStamp,
        account_type: 'Buy'
    };

    const action = (document.getElementById('VendoraddButton').textContent === 'Add') ? 'add' : 'update';

    // Insert or Update record in Supabase
    if (action === 'add') {
        const { data, error } = await supabaseClient
            .from('booking_charges')
            .insert([formData]);
        if (error) {
            console.error('Error adding data:', error);
        } else {
            console.log('Data added:', data);
        }
    } else {
        // For updating, you'll need an ID to identify the record
        const { data, error } = await supabaseClient
            .from('booking_charges')
            .update(formData)
            .eq('lr_number', lrNumber)
            .eq('charges_type', chargesType_v && 'account_type', 'Buy');
        if (error) {
            console.error('Error updating data:', error);
        } else {
            console.log('Data updated:', data);
        }
    }

    document.getElementById('VendoraddButton').disabled = false;

    // Populate table or perform any other operations needed
    vendorpopulateTable(lrNumber);
});
document.getElementById('frightcharges').addEventListener('change', async function (event) {
    document.getElementById('addButton').disabled = false;
})
document.getElementById('vendorFrightcharges').addEventListener('change', async function (event) {
    document.getElementById('VendoraddButton').disabled = false;
})