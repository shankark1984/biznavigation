// Global variable declarations for reusability
const saveButton = document.getElementById('saveButton');
const modifyButton = document.getElementById('modifyButton');
const newButton = document.getElementById('newButton');

// Modify button event listener
modifyButton.addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    saveButton.disabled = false; // Enable the Save button
    modifyButton.disabled = true;
    saveButton.textContent = 'Update';
});

// New button event listener
newButton.addEventListener('click', function () {
    saveButton.disabled = false; // Enable the Save button
    modifyButton.disabled = true;
    saveButton.textContent = 'Save';
    clearForm(); // Make sure to define this function
    enableForm();
});

// Function to generate new party code
async function generateNewPartyCode(partyName) {

    const today = new Date();
    // Check if partyName is defined and is a string
    if (!partyName || typeof partyName !== 'string') {
        console.error('Invalid party name:', partyName);
        return null; // Return null if partyName is not valid
    }
    const firstLetter = partyName.charAt(0).toUpperCase();
    console.log('First letter of party name:', firstLetter); // Logging first letter
    const dateSum = convertDateToNumberAndSum(today);
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(4, '0');
    const newPartyCode = `${firstLetter}${dateSum}${randomNum}`;
    return newPartyCode;
}

function convertDateToNumberAndSum(date) {
    // Convert date to a timestamp (number of milliseconds since 1970-01-01)
    const timestamp = date.getTime();
    // Convert the timestamp to a string and split it into an array of digits
    const digits = timestamp.toString().split('');
    // Sum the digits
    const sum = digits.reduce((total, digit) => total + parseInt(digit, 10), 0);
    return sum;
}


// Save or update form data
saveButton.addEventListener('click', async function (event) {
    event.preventDefault();
    saveButton.disabled = true;
    newButton.disabled=true;
    const partyName = $("#partyName").val();
    let partyCode;

    if (saveButton.textContent === 'Save') {
        // Generate new party code
        partyCode = await generateNewPartyCode(partyName);
        console.log('New Party Code ' + partyCode);

    } else if (saveButton.textContent === 'Update') {
        partyCode = $("#partyCode").val(); // Use existing party code
    }

    // Get form values
    const formData = {
        party_code: partyCode,
        party_type: $("#partyType").val(),
        party_name: partyName,
        contact_person: $("#partyContacperson").val(), // Add logic to get this value if needed 
        contact_number: $("#partyContactNumber").val(),
        email_id: $("#partyEmailID").val(),
        address: $("#partyAddress").val(),
        city: $("#city").val(),
        pin_code: $("#pinCode").val(),
        state: $("#state").val(),
        country: $("#country").val(),
        pan_number: $("#panNumber").val(),
        gst_number: $("#gSTNumber").val(),
        default_tax: $("#defaulttax").val() || 'CGST 0% SGST 0% IGST 0%',
        current_status: $("#partyCurrentStatus").val(),
        deactive_date: $("#partyDeActiveDate").val() || null, // Set to null if empty
        company_id: companyID, // Ensure companyID is defined
        created_by: userLoginID, // Ensure userLoginID is defined
        created_at: localtimeStamp,
    };

    // Remove properties that are empty strings, especially for date fields
    Object.keys(formData).forEach(key => {
        if (formData[key] === "") {
            formData[key] = null; // Set empty strings to null
        }
    });

    const action = (saveButton.textContent === 'Save') ? 'add' : 'update';

    console.log('Action:', action, formData.party_code);

    if (action === 'add') {
        const { data, error } = await supabaseClient
            .from('party_details')
            .insert([formData]);

        if (error) {
            console.error('Error saving new party details:', error);
            alert('Error saving party details');
        } else {
            console.log('Party details saved successfully:', data);
            $("#partyCode").val(partyCode).prop('disabled', true);
            alert('Party details saved successfully!');
        }
    } else if (action === 'update') {
        const { data, error } = await supabaseClient
            .from('party_details')
            .update(formData)
            .eq('party_code', partyCode);

        if (error) {
            console.error('Error updating party details:', error);
            alert('Error updating party details');
        } else {
            console.log('Party details updated successfully:', data);
            alert('Party details updated successfully!');
        }
    }
    disableForm();
    saveButton.textContent = 'Update';
    modifyButton.disabled = false;
    newButton.disabled = false;
});


// Handle form field permissions based on user type
function handleUserTypePermissions() {
    const userType = parseInt(localStorage.getItem('UserType'), 10);
    saveButton.disabled = userType !== 1 && userType !== 2; // Only users of type 1 and 2 can modify
    newButton.disabled = userType !== 1; // Only users of type 1 can create new entries
}

// When the page loads, fetch the company data
document.addEventListener('DOMContentLoaded', function () {
    handleUserTypePermissions();
    enableForm();  // Ensure enableForm is defined
});
document.getElementById('partyCurrentStatus').addEventListener('change', function () {
    const status = document.getElementById('partyCurrentStatus').value;
    const deActiveDate = document.getElementById('partyDeActiveDate');

    if (status === 'Active') {
        deActiveDate.disabled = true;
        deActiveDate.value = ''; // Optionally clear the date field
    } else {
        deActiveDate.disabled = false;
    }
});

document.getElementById('partyName').addEventListener('change', function () {
    const partyCode = document.getElementById('partyCode').value;
    if (partyCode) { // If partyCode is not null or empty
        disableForm();
    }
});
