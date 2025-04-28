const partyNameInput = document.getElementById("partyNameReg");
const partySuggestions = document.getElementById("partySuggestions");
const addBillingAddress = document.getElementById('addbillingAddress');
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



// Function to fetch and populate party details
async function fetchPartyDetails(query = '') {
    try {
        const { data, error } = await supabaseClient
            .from('party_details')
            .select('party_name')
            .eq('company_id', companyID) // Filter by company ID
            .ilike('party_name', `%${query}%`) // Case-insensitive search
            .order('party_name', { ascending: true });

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        allParties = data.map(p => p.party_name); // Store for filtering
        updatePartySuggestions(allParties);
    } catch (error) {
        console.error('Error loading party details:', error);
    }
}

// Function to update the datalist options
function updatePartySuggestions(list) {
    partySuggestions.innerHTML = ''; // Clear previous options
    list.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        partySuggestions.appendChild(option);
    });
}

// Fetch full details of the selected party
async function fetchSelectedPartyDetails(selectedParty) {
    try {
        const { data, error } = await supabaseClient
            .from('party_details')
            .select('*')
            .eq('company_id', companyID)
            .eq('party_name', selectedParty)
            .single();

        if (error) {
            console.error('Error fetching selected party details:', error);
            return;
        }

        if (data) {
            // Populate input fields safely (check if element exists before setting value)
            if (partyType) partyType.value = data.party_type || '';
            if (partyCodes) partyCodes.value = data.party_code || '';
            if (partyCurrentStatus) partyCurrentStatus.value = data.current_status || '';
            if (partyDeActiveDate) partyDeActiveDate.value = data.deactive_date || '';
            if (partyAddress) partyAddress.value = data.address || '';
            if (pinCode) pinCode.value = data.pin_code || '';
            if (city) city.value = data.city || '';
            if (state) state.value = data.state || '';
            if (country) country.value = data.country || '';
            if (panNumber) panNumber.value = data.pan_number || '';
            if (gstNumber) gstNumber.value = data.gst_number || '';
            if (partyContactPerson) partyContactPerson.value = data.contact_person || '';
            if (partyContactNumber) partyContactNumber.value = data.contact_number || '';
            if (partyEmailID) partyEmailID.value = data.email_id || '';
            if (defaultTax) defaultTax.value = data.default_tax || '';

        }
        disableForm();
        permissionType();
        saveButton.childNodes[1].textContent = " Update";
    } catch (error) {
        console.error('Error loading selected party details:', error);
    }
}


// Show all parties on focus
partyNameInput.addEventListener("focus", async () => {
    if (allParties.length === 0) {
        await fetchPartyDetails(); // Fetch only if not already loaded
    }
    updatePartySuggestions(allParties); // Show full list
});

// Filter the list while typing
partyNameInput.addEventListener("input", () => {
    const query = partyNameInput.value.toLowerCase();
    const filteredList = allParties.filter(name => name.toLowerCase().includes(query));
    updatePartySuggestions(filteredList);
});

// Load full details when a party is selected
partyNameInput.addEventListener("change", async () => {
    const selectedParty = partyNameInput.value.trim();
    if (allParties.includes(selectedParty)) {
        await fetchSelectedPartyDetails(selectedParty);
        const partyCode = document.getElementById("partyCodes").value;
        if (partyCode) {
            loadBillingAddresses(partyCode);
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    newButton.disabled = false; // Enable the button
    document.getElementById("addbillingAddress").disabled = true;
});

document.getElementById("newButton").addEventListener("click", () => {
    clearForm();
    enableForm();
    document.getElementById("partyCodes").disabled = true
    saveButton.childNodes[1].textContent = " Save";
});

document.getElementById("modifyButton").addEventListener("click", () => {
    enableForm();
    document.getElementById("partyCodes").disabled = true
    document.getElementById("partyNameReg").disabled = true
    document.getElementById("modifyButton").disabled = true
    document.getElementById("saveButton").disabled = false
    document.getElementById("addbillingAddress").disabled = false;
    // document.querySelectorAll(".editBillingAddress, .deleteBillingAddress").forEach(button => {
    //     button.disabled = false;
    // });
    tableButtons();
    if (userType == 1) {
        document.getElementById("panNumber").disabled = false
        document.getElementById("gSTNumber").disabled = false
    } else {
        document.getElementById("panNumber").disabled = true
        document.getElementById("gSTNumber").disabled = true
    }
});

async function permissionType() {
    const modifyButton = document.getElementById("modifyButton"); // Ensure modifyButton is selected
    await checkAccess(userLoginID, 'PartyRegistration');

    if (modifyButton && perWrite) { // Simplified condition
        modifyButton.disabled = false;
    }
}



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
        party_code: partyCodes,
        party_type: $("#partyType").val(),
        party_name: partyName,
        contact_person: $("#partyContactPerson").val(),
        contact_number: $("#partyContactNumber").val(),
        email_id: $("#partyEmailID").val(),
        address: $("#partyAddress").val(),
        city: $("#city").val(),
        pin_code: $("#pinCode").val(),
        state: $("#state").val(),
        country: $("#country").val(),
        pan_number: $("#panNumber").val(),
        gst_number: $("#gSTNumber").val(),
        default_tax: $("#defaultTax").val() || 'CGST 0% SGST 0% IGST 0%',
        current_status: $("#partyCurrentStatus").val(),
        deactive_date: $("#partyDeActiveDate").val() || null,
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
            $("#partyCodes").val(partyCodes).prop('disabled', true);
            alert('Party details saved successfully!');
        }
    } else if (action === 'update') {
        const { data, error } = await supabaseClient
            .from('party_details')
            .update(formData)
            .eq('party_code', partyCodes)
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
});

// Load Billing Addresses
async function loadBillingAddresses(partyCode) {
    const tableBody = document.getElementById("billingAddressTable");
    tableBody.innerHTML = `<tr><td colspan="10" class="text-center">Loading...</td></tr>`;

    try {
        const { data, error } = await supabaseClient
            .from('billing_address')
            .select('id, contact_name, contact_number, address, pincode, city, state, country, default_active, Status')
            .eq('party_code', partyCode);  // Filter by Party Code


        if (error) {
            console.error('Error fetching billing addresses:', error);
            tableBody.innerHTML = `<tr><td colspan="10" class="text-center">Error loading data</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" class="text-center">No Billing Address Created</td></tr>`;
            return;
        }

        tableBody.innerHTML = ""; // Clear the table before adding new rows

        data.forEach((entry) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${entry.contact_name || '-'}</td>
                <td>${entry.contact_number || '-'}</td>
                <td>${entry.address || '-'}</td>
                <td>${entry.pincode || '-'}</td>
                <td>${entry.city || '-'}</td>
                <td>${entry.state || '-'}</td>
                <td>${entry.country || '-'}</td>
                <td>${entry.default_active ? "✔" : "✖"}</td>
                <td>${entry.Status || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary editBillingAddress" onclick="editBillingAddress(${entry.id})" disabled>
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-danger deleteBillingAddress" onclick="deleteBillingAddress(${entry.id})" disabled>
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Unexpected error fetching billing addresses:", error);
    }
}

// Edit Billing Address
async function editBillingAddress(id) {
    try {
        // Fetch the billing address by ID
        const { data, error } = await supabaseClient
            .from("billing_address")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            console.error("Error fetching billing address:", error);
            alert("Failed to fetch billing address.");
            return;
        }

        if (!data) {
            alert("Billing address not found.");
            return;
        }

        // Populate form fields with retrieved data
        $("#billingAddressID").val(data.id); // Hidden field to store ID for update
        $("#billingContactPerson").val(data.contact_name);
        $("#billingContactNumber").val(data.contact_number);
        $("#partyBillingAddress").val(data.address);
        $("#billingPinCode").val(data.pincode);
        $("#billingCity").val(data.city);
        $("#billingState").val(data.state);
        $("#billingCountry").val(data.country);
        $("#defaultBilling").prop("checked", data.default_active);
        $("#billingAddressStatus").val(data.Status);

        // // Change button to "Update"
        $("#addbillingAddress").text("Update");

    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

async function deleteBillingAddress(id) {
    const confirmDelete = confirm("Are you sure you want to delete this address?");
    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from('billing_address')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting billing address:', error);
        alert("Error deleting address.");
    } else {
        alert("Address deleted successfully.");
        const partyCode = document.getElementById("partyCodes").value;
        loadBillingAddresses(partyCode); // Refresh table
        tableButtons();
    }
}

// Clear form fields after adding or updating an address
function clearBillingAddressForm() {
    $("#billingAddressID").val(""); // Clear hidden ID field
    $("#billingContactPerson, #billingContactNumber, #partyBillingAddress, #billingPinCode, #billingCity, #billingState, #billingCountry, #billingAddressStatus").val("");
    $("#defaultBilling").prop("checked", false);
}

// Add or Update Billing Address
addBillingAddress.addEventListener('click', async function (event) {
    event.preventDefault();
    const id = $("#billingAddressID").val().trim(); // Hidden ID field
    const buttonText = $("#addbillingAddress").text().trim(); // Get button text
    const partyCode = $("#partyCodes").val()?.trim();
    const contactName = $("#billingContactPerson").val()?.trim();
    const contactNumber = $("#billingContactNumber").val()?.trim();
    const address = $("#partyBillingAddress").val()?.trim();
    const pincode = $("#billingPinCode").val()?.trim() || null;
    const city = $("#billingCity").val()?.trim() || null;
    const state = $("#billingState").val()?.trim() || null;
    const country = $("#billingCountry").val()?.trim() || null;
    const defaultActive = $("#defaultBilling").prop("checked");
    const status = $("#billingAddressStatus").val()?.trim() || "Active";
    const companyID = localStorage.getItem('CompanyID') || null;
    const createdBy = typeof userLoginID !== 'undefined' ? userLoginID : null;
    const createdAt = typeof localtimeStamp !== 'undefined' ? localtimeStamp : new Date().toISOString();

    // Create billing data object
    const billingData = {
        party_code: partyCode,
        contact_name: contactName,
        contact_number: contactNumber,
        address: address,
        pincode: pincode,
        city: city,
        state: state,
        country: country,
        default_active: defaultActive,
        Status: status, // ✅ Fixed key case
        company_id: companyID,
        created_by: createdBy,
        created_at: createdAt
    };

    // Remove empty values
    Object.keys(billingData).forEach(key => {
        if (!billingData[key]) billingData[key] = null;
    });

    const action = buttonText === 'Add' ? 'add' : 'update';

    console.log('Action:', action, billingData.party_code);

    try {
        if (action === 'add') {
            const { data, error } = await supabaseClient
                .from('billing_address')
                .insert([billingData]);

            if (error) throw error;

            console.log('Party details saved successfully:', data);
            $("#partyCodes").prop('disabled', true);
            alert('Party details saved successfully!');

        } else if (action === 'update' && id) {
            const { data, error } = await supabaseClient
                .from('billing_address')
                .update(billingData)
                .eq('id', id)
                .select();

            if (error) throw error;
            if (!data.length) throw new Error('No matching billing address found.');

            console.log('Party billing address updated successfully:', data);
            alert('Party billing address updated successfully!');
        }

        // Reset form and UI updates
        $("#addbillingAddress").text("Add");
        $("#billingAddressID").val("");

        tableButtons();

        clearBillingAddressForm();

        // Reload billing addresses only if partyCode exists
        if (partyCode) {
            loadBillingAddresses(partyCode);
        }
    } catch (error) {
        console.error('Error:', error.message);
        alert(`Error: ${error.message}`);
    }
});

async function tableButtons(params) {
    setTimeout(() => {
        if ($(".editBillingAddress, .deleteBillingAddress").length > 0) {
            $(".editBillingAddress, .deleteBillingAddress")
                .closest("form, fieldset").prop("disabled", false); // Enable parent elements

            $(".editBillingAddress, .deleteBillingAddress").each(function () {
                $(this).removeAttr("disabled").prop("disabled", false);
            });

            console.log("Buttons enabled after delay");
        } else {
            console.log("Buttons not found in DOM.");
        }
    }, 500);
}

document.getElementById('transitType').addEventListener('change', async function () {
    const transitType = this.value;
    const containerDiv = document.getElementById('containerType').closest('.col-md-4');
    const containerLabel = document.querySelector('label[for="containerType"]');

    if (transitType === 'By Road') {
        containerLabel.textContent = 'Vehicle Type';
        containerDiv.style.display = 'block';
        await loadDropdownOptions('VehicleType', 'containerType');
    } else if (transitType === 'By Sea Freight') {
        containerLabel.textContent = 'Container Type';
        containerDiv.style.display = 'block';
        await loadDropdownOptions('ContainerType', 'containerType');
    } else {
        containerDiv.style.display = 'none';
    }
});
