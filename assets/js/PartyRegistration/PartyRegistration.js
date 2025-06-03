
loadSuggestions('partySuggestions', 'PartyDetails', companyID); // Load party suggestions from the server

const partyNameInput = document.getElementById("partyNameReg");
const partySuggestions = document.getElementById("partySuggestions");
// const addBillingAddress = document.getElementById('addbillingAddress');
let allParties = []; // Store all party names for filtering

// Reference to other input fields
const partyType = document.getElementById("partyType");
const partyCodes = document.getElementById("partyCodes");
const partyCurrentStatus = document.getElementById("partyCurrentStatus");
const partyDeActiveDate = document.getElementById("partyDeActiveDate");
const partyAddress = document.getElementById("partyAddress");
const pinCode = document.getElementById("pinCode");
const city = document.getElementById("city");
const state = document.getElementById("state");
const country = document.getElementById("country");
const panNumber = document.getElementById("panNumber");
const gstNumber = document.getElementById("gSTNumber");
const partyContactPerson = document.getElementById("partyContactPerson");
const partyContactNumber = document.getElementById("partyContactNumber");
const partyEmailID = document.getElementById("partyEmailID");
const defaultTax = document.getElementById("defaultTax");
const billingTableBody = document.querySelector('#billingAddressTable tbody');



// Modify button event listener
modifyButton.addEventListener('click', function () {
    enableForm();  // Enable the form inputs when "Modify" button is clicked
    document.getElementById("partyCodes").disabled = true
    document.getElementById("partyNameReg").disabled = true
    saveButton.disabled = false; // Enable the Save button
    modifyButton.disabled = true;
    document.getElementById("addbillingAddress").disabled = false;
    toggleButtons(".edit-row, .delete-row, .editTariff", true); //Disable edit and delete buttons
});

// New button event listener
newButton.addEventListener('click', function () {
    saveButton.disabled = false; // Enable the Save button
    modifyButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    const tableBody = document.querySelector('#billingAddressTable tbody');
    tableBody.innerHTML = ``;
    const tariffTableBody = document.querySelector('#tariffTable tbody');
    tariffTableBody.innerHTML = ``;
    clearForm(); // Make sure to define this function
    enableForm();
    toggleButtons(".edit-row, .delete-row, .editTariff", true); //Disable edit and delete buttons
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
// Function to convert date to a number and sum its digits
function convertDateToNumberAndSum(date) {
    // Convert date to a timestamp (number of milliseconds since 1970-01-01)
    const timestamp = date.getTime();
    // Convert the timestamp to a string and split it into an array of digits
    const digits = timestamp.toString().split('');
    // Sum the digits
    const sum = digits.reduce((total, digit) => total + parseInt(digit, 10), 0);
    return sum;
}

// Handle form field permissions based on user type
function handleUserTypePermissions() {
    saveButton.disabled = userType !== 1 && userType !== 2; // Only users of type 1 and 2 can modify
    newButton.disabled = userType !== 1; // Only users of type 1 can create new entries
}
// When the page loads, fetch the company data
document.addEventListener('DOMContentLoaded', function () {
    handleUserTypePermissions();
    enableForm();  // Ensure enableForm is defined
});
// Function to enable form fields
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
// Function to enable form fields
document.getElementById('partyNameReg').addEventListener('change', async () => {
    const partyCode = document.getElementById('partyCodes').value.trim();
    const partyCodeSelect = document.getElementById('partyCodes');
    if (partyCode) {
        fetchSelectedPartyDetails(partyCode);
        loadBillingAddresses({ billingTableBody, partyCodeSelect })
        fetchTariffs(partyCode); // Fetch tariffs for the selected party
        disableForm(); // Disable form fields after selection

        addbillingAddress.disabled = true; // Enable the Add Billing Address button
        saveButton.disabled = true; // Enable the Save button
        modifyButton.disabled = false; // Enable the Modify button

    }
});


// Function to fetch party details based on the selected party code
async function fetchSelectedPartyDetails(partyCodeValue) {
    try {
        const partyCode = typeof partyCodeValue === 'string'
            ? partyCodeValue.trim()
            : partyCodeValue?.value?.trim();

        if (!partyCode) {
            console.warn('Party code is missing.');
            return;
        }

        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('*')
            .eq('company_id', companyID)
            .eq('PartyCode', partyCode)
            .maybeSingle();

        if (error) {
            console.error('Supabase fetch error:', error.message);
            return;
        }

        if (!data) {
            console.warn(`No party found for PartyCode: ${partyCode}`);
            return;
        }
        const fieldMap = {
            partyType: 'PartyType',
            partyCodes: 'PartyCode',
            partyCurrentStatus: 'CurrentStatus',
            partyDeActiveDate: 'DeactiveDate',
            partyAddress: 'Address',
            pinCode: 'PinCode',
            city: 'City',
            state: 'State',
            country: 'Country',
            panNumber: 'PanNumber',
            gSTNumber: 'GSTNumber',
            partyContactPerson: 'ContactPerson',
            partyContactNumber: 'ContactNumber',
            partyEmailID: 'EmailID',
            defaultTax: 'DefaultTax'
        };

        for (const [fieldId, columnName] of Object.entries(fieldMap)) {
            const element = window[fieldId];
            if (element) {
                element.value = data[columnName] ?? '';
            } else {
                console.warn(`Element not found: ${fieldId}`);
            }
        }

        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    } catch (err) {
        console.error('Unexpected error loading party details:', err);
    }
}
// Save & edit party details
saveButton.addEventListener('click', async function (event) {
    event.preventDefault();
    saveButton.disabled = true;
    newButton.disabled = true;
    const partyName = $("#partyNameReg").val();
    let partyCodes;

    if (saveButton.textContent.trim() === 'Save') { // Trim to avoid space issues
        // Generate new party code
        partyCodes = await generateNewPartyCode(partyName);
        console.log('New Party Code:', partyCodes);
    } else if (saveButton.textContent.trim() === 'Update') {
        partyCodes = $("#partyCodes").val(); // Use existing party code
        console.log('Existing Party Code:', partyCodes);
    }

    if (!partyCodes) {
        console.error("Error: Party Code is missing.");
        alert("Party Code is missing!");
        saveButton.disabled = false;
        newButton.disabled = false;
        return;
    }
    console.log('GST Type:', $("#defaultTax").val());

    // Get form values
    const formData = {
        PartyCode: partyCodes,
        PartyType: $("#partyType").val(),
        PartyName: partyName,
        ContactPerson: $("#partyContactPerson").val(),
        ContactNumber: $("#partyContactNumber").val(),
        EmailID: $("#partyEmailID").val(),
        Address: $("#partyAddress").val(),
        City: $("#city").val(),
        PinCode: $("#pinCode").val(),
        State: $("#state").val(),
        Country: $("#country").val(),
        PanNumber: $("#panNumber").val(),
        GSTNumber: $("#gSTNumber").val(),
        DefaultTax: $("#defaultTax").val() || 'CGST 0% SGST 0% IGST 0%',
        CurrentStatus: $("#partyCurrentStatus").val(),
        DeactiveDate: $("#partyDeActiveDate").val() || null,
        company_id: companyID,
        created_by: userLoginID,
        created_at: localtimeStamp,
    };

    // Remove empty values
    Object.keys(formData).forEach(key => {
        if (formData[key] === "") {
            formData[key] = null;
        }
    });

    const action = saveButton.textContent.trim() === 'Save' ? 'add' : 'update';

    console.log('Action:', action, formData.PartyCode);

    if (action === 'add') {
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .insert([formData]);

        if (error) {
            console.error('Error saving new party details:', error);
            alert('Error saving party details');
        } else {
            console.log('Party details saved successfully:', data);
            $("#partyCodes").val(partyCodes).prop('disabled', true);
            alert('Party details saved successfully!');
        }
    } else if (action === 'update') {
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .update(formData)
            .eq('PartyCode', partyCodes)
            .select(); // Ensure data is returned

        if (error) {
            console.error('Error updating party details:', error);
            alert('Error updating party details');
        } else if (data.length === 0) {
            console.error('No matching record found for update.');
            alert('Error: No matching party found.');
        } else {
            console.log('Party details updated successfully:', data);
            alert('Party details updated successfully!');
        }
    }

    disableForm();
    saveButton.childNodes[1].textContent = " Update";
    modifyButton.disabled = false;
    newButton.disabled = false;
    toggleButtons(".edit-row, .delete-row, .editTariff", false); //Disable edit and delete buttons
});

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('modeType').addEventListener('change', async function () {
        const modeType = this.value;
        const containerElement = document.getElementById('containerType');

        if (!containerElement) {
            console.error('Element with id="containerType" not found.');
            return;
        }

        const containerDiv = containerElement.closest('.col-md-2');
        const containerLabel = document.querySelector('label[for="containerType"]');

        if (!containerDiv || !containerLabel) {
            console.error('Container or label not found.');
            return;
        }

        if (modeType === 'FTL') {
            containerLabel.textContent = 'Vehicle Type';
            containerDiv.classList.remove('d-none');
            await loadDropdownOptions('VehicleType', 'containerType');
        } else if (modeType === 'FCL') {
            containerLabel.textContent = 'Container Type';
            containerDiv.classList.remove('d-none');
            await loadDropdownOptions('ContainerType', 'containerType');
        } else {
            containerDiv.classList.add('d-none');
        }
    });
});

