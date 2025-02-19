
// Fetch route data from Supabase and populate the table
async function fetchRoutes() {
    const { data, error } = await supabaseClient
        .from('route_master')
        .select('*');
    if (error) {
        console.error('Error fetching routes:', error);
        return;
    }

    const tableBody = document.querySelector('#routeTable tbody');
    tableBody.innerHTML = ''; // Clear previous table content

    data.forEach((route) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.route_description}</td>
            <td>${route.distance}</td>
            <td><button onclick="deleteRoute(${route.id})">Delete</button></td>
        `;
        tableBody.appendChild(row);
    });
}

// Add new route
async function addRoute() {
    let routeDescription = document.getElementById('routeDescription').value;
    let distance = document.getElementById('distance').value;

    if (!routeDescription || !distance) {
        alert('Please fill in all fields.');
        return;
    }
    routeDescription = capitalize(routeDescription);

    const { data, error } = await supabaseClient
        .from('route_master')
        .insert([
            { route_description: routeDescription, distance: distance, created_by: userLoginID, created_at: localtimeStamp }
        ]);

    if (error) {
        console.error('Error adding route:', error);
        return;
    }

    fetchRoutes(); // Refresh the table after adding a new route
}

// Delete a route
async function deleteRoute(id) {
    const { data, error } = await supabaseClient
        .from('route_master')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting route:', error);
        return;
    }

    fetchRoutes(); // Refresh the table after deleting a route
}

// Fetch routes when the page loads
document.addEventListener('DOMContentLoaded', fetchRoutes);


// Function to load route details from Supabase
async function loadRouteDetails() {
    try {
        const { data: routeDetailsData, error } = await supabaseClient
            .from('route_master')
            .select('*');

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        // Map the data to match the format used in the form
        routeDetails = routeDetailsData.map(row => ({
            routeDescription: row.route_description,
            routeDistance: row.distance,
        }));

        routeDetailsSuggestions(); // Populate the datalist with route details

    } catch (error) {
        console.error('Error:', error);
    }
}

// Populate the datalist with route Description
function routeDetailsSuggestions() {
    let suggestions = "";
    routeDetails.forEach(route => {
        suggestions += `<option data-party-code="${route.routeDescription}" value="${route.routeDescription}"></option>`;
    });
    $("#routeSuggestions").html(suggestions);
}



// When a route details is selected from the dropdown, populate the form with relevant details
$("#routedetails").on("input", function () {
    const routeName = $(this).val();
    const routeData = routeDetails.find(route => route.routeDescription === routeName);

    if (routeData) {
        $("#routedetails").val(routeData.routeDescription);
        $("#routedistance").val(routeData.routeDistance);
    }
});

// Load route details on page load
$(document).ready(function () {
    loadRouteDetails();

});

// Fetch pincode data from Supabase and populate the table
async function fetchPinCode() {
    const { data, error } = await supabaseClient
        .from('missing_pincodes')
        .select('*');
    if (error) {
        console.error('Error fetching routes:', error);
        return;
    }

    const tableBody = document.querySelector('#pinCodeTable tbody');
    tableBody.innerHTML = ''; // Clear previous table content

    data.forEach((route) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.pincode}</td>
            <td>${route.city}</td>
            <td>${route.state}</td>
             <td>${route.country}</td>
            <td><button onclick="deletePinCode(${route.id})">Delete</button></td>
        `;
        tableBody.appendChild(row);
    });
}

// Add new route
async function addPinCode() {
    let pinCode = document.getElementById('pincode').value;
    let city = document.getElementById('city').value;
    let state = document.getElementById('state').value;
    let country = document.getElementById('country').value;

    if (!pinCode || !city || !state || !country) {
        alert('Please fill in all fields.');
        return;
    }
    city = capitalize(city);
    state = capitalize(state);
    country = capitalize(country);

    const { data, error } = await supabaseClient
        .from('missing_pincodes')
        .insert([
            { pincode: pinCode, city: city, state: state, country: country, created_by: userLoginID, created_at: localtimeStamp }
        ]);

    if (error) {
        console.error('Error adding route:', error);
        return;
    }

    fetchPinCode(); // Refresh the table after adding a new route
}

// Delete a route
async function deletePinCode(id) {
    const { data, error } = await supabaseClient
        .from('missing_pincodes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting route:', error);
        return;
    }

    fetchPinCode(); // Refresh the table after deleting a route
}

// Fetch routes when the page loads
document.addEventListener('DOMContentLoaded', fetchPinCode);



// Fetch route data from Supabase and populate the table
async function fetchDropdownMenuList(valueAssigned, description) {
    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('*')
        .ilike('type_of_value', `%${valueAssigned}%`) // Filter based on type_of_value
        .ilike('description', `%${description}%`);    // Filter based on description

    if (error) {
        console.error('Error fetching routes:', error);
        return;
    }

    const tableBody = document.querySelector('#dropdownMenuListTable tbody');
    tableBody.innerHTML = ''; // Clear previous table content

    data.forEach((route) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.type_of_value}</td>
            <td>${route.description}</td>
            <td>${route.condition}</td>
            <td>${route.value}</td>
            <td>${route.hsn_code}</td>
            <td><button onclick="deletedropdownMenuList(${route.id})">Delete</button></td>
        `;
        tableBody.appendChild(row);
    });
}

// Dropdown Menu List Table a route
async function deletedropdownMenuList(id) {
    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting route:', error);
        return;
    }

    fetchPinCode(); // Refresh the table after deleting a route
}

async function addDropdownMenuList() {
    // Retrieve values from input fields
    let valueAssignedTo = document.getElementById('valueassignedto').value.trim();
    let description = document.getElementById('description').value.trim();
    let condition = document.getElementById('condition').value.trim();
    let fixedValue = document.getElementById('fixedvalue').value.trim();
    let hsnCode = document.getElementById('hsncode').value.trim();

    console.log('valueAssignedTo: ' + valueAssignedTo);

    // Validate required fields
    if (!valueAssignedTo || !description) {
        alert('Please fill in all required fields (Value Assigned To and Description).');
        return;
    }

    // Convert numeric fields, set to null if empty
    fixedValue = fixedValue ? Number(fixedValue) : null; // Convert to number or set to null
    hsnCode = hsnCode ? Number(hsnCode) : null; // Convert to number or set to null

    // Check if conversion to number was successful
    if ((fixedValue === null && document.getElementById('fixedvalue').value.trim() !== "") ||
        (hsnCode === null && document.getElementById('hsncode').value.trim() !== "")) {
        alert('Please enter valid numeric values for Fixed Value and HSN Code.');
        return;
    }

    // Format values to proper case
    // valueAssignedTo = toProperCase(valueAssignedTo);
    // description = toProperCase(description);

    console.log('Inserting:', { valueAssignedTo, description, fixedValue, hsnCode });

    // Database insertion
    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .insert([{
            type_of_value: valueAssignedTo,
            description: description,
            condition: condition,
            value: fixedValue,  // Should be a number or null
            hsn_code: hsnCode,  // Should be a number or null
            created_by: userLoginID,
            created_at: localtimeStamp,
            company_id: companyID
        }]);

    if (error) {
        console.error('Error adding dropdown details:', error);
        alert('There was an error adding the item. Please try again.'); // User feedback
        return;
    }

    console.log('Item added successfully:', data);
    fetchDropdownMenuList(valueAssignedTo, description); // Refresh the table after adding a new route
}



//customer list
document.getElementById('valueassignedto').addEventListener('change', async function (e) {
    const valueassignedto = e.target.value.trim().toLowerCase();
    const description = document.getElementById('description').value
    console.log(description + ' ' + valueassignedto);
    await fetchDropdownMenuList(valueassignedto, description); // Pass the input value to the function

});

document.getElementById('valueassignedto').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Value Assigned To ' + inputValue);
    await loadDropdownMenuList(inputValue); // Pass the input value to the function

});
// Clear the suggestion box when input field loses focus
document.getElementById('valueassignedto').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('valueAssignedToSuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});

// Function to load party details from Supabase
async function loadDropdownMenuList(query = '') {
    try {
        let { data: dl_valueassignedto, error } = await supabaseClient
            .from('dl_valueassignedto')
            .select('*')
            .ilike('type_of_value', `%${query}%`); // Filter based on input

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        // Map the data to match the format used in the form
        const dropdownMenuList = dl_valueassignedto.map(row => ({
            valueAssignedTo: row.type_of_value,
        }));

        dropdownMenuListSuggestions(dropdownMenuList);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Populate the datalist with party names
function dropdownMenuListSuggestions(dropdownMenuList) {
    let suggestions = "";
    dropdownMenuList.forEach(list => {
        suggestions += `<option value="${list.valueAssignedTo}"></option>`;
    });
    $("#valueAssignedToSuggestions").html(suggestions);
}


document.getElementById('description').addEventListener('change', async function (e) {
    const description = e.target.value.trim().toLowerCase();
    const valueassignedto = document.getElementById('valueassignedto').value;
    console.log(description + ' ' + valueassignedto);
    await fetchDropdownMenuList(valueassignedto, description); // Pass the input value to the function

});

// Add event listener for input on 'description' element
document.getElementById('description').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Description: ' + inputValue);
    await loadDescription(inputValue); // Call the function with input value
});

// Clear suggestion box on blur after a slight delay
document.getElementById('description').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('descriptionSuggestions').innerHTML = ''; // Clear suggestions
    }, 200); // Delay to allow suggestion clicks
});

// Function to load descriptions from Supabase based on input query
async function loadDescription(query = '') {
    try {
        let { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description')
            .ilike('description', `%${query}%`); // Filter based on input

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        // Create a list of suggestions
        const dropdownMenuList = data.map(row => ({
            description: row.description,
        }));

        // Populate the suggestions
        descriptionSuggestions(dropdownMenuList);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Populate the datalist with filtered descriptions
function descriptionSuggestions(dropdownMenuList) {
    let suggestions = '';
    dropdownMenuList.forEach(list => {
        suggestions += `<option value="${list.description}"></option>`;
    });
    document.getElementById('descriptionSuggestions').innerHTML = suggestions;
}


//Country details Tab

let allCountries = [];

// Fetch and populate country details table
async function fetchCountryDetails() {
    try {
        const { data, error } = await supabaseClient.from('Country_Details').select('*');
        if (error) throw error;

        allCountries = data || [];
        renderCountryTable(allCountries);
    } catch (error) {
        console.error('Error fetching country details:', error);
        showFlashMessage('Error fetching data!', 'error');
    }
}

// Render country details table dynamically
function renderCountryTable(data) {
    const tableBody = document.querySelector('#countryDetailsTable tbody');
    tableBody.innerHTML = data.map(country => `
        <tr>
            <td>${country.CountryCode}</td>
            <td>${country.CountryName}</td>
            <td>${country.Region}</td>
            <td><button onclick="deleteCountryDetails(${country.id})">Delete</button></td>
        </tr>
    `).join('');
}

// Show flash message
function showFlashMessage(message, type = 'success') {
    const flashMessage = document.createElement('div');
    flashMessage.className = `flash-message ${type}`;
    flashMessage.textContent = message;

    Object.assign(flashMessage.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: type === 'error' ? '#f44336' : '#4CAF50',
        color: 'white',
        padding: '15px',
        borderRadius: '5px',
        zIndex: '1000',
        boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)',
        fontSize: '16px',
        fontWeight: 'bold',
        textAlign: 'center',
    });

    document.body.appendChild(flashMessage);
    setTimeout(() => flashMessage.remove(), 3000);
}

// Add new country details
async function addCountryDetails() {
    const countryCode = document.getElementById('countryCode').value.trim().toUpperCase();
    const countryName = document.getElementById('countryName').value.trim();
    const region = document.getElementById('region').value.trim();

    if (!countryCode || !countryName || !region) {
        showFlashMessage('Please fill in all fields!', 'error');
        return;
    }

    try {
        // Check for duplicate entry
        const { data: existingCountry } = await supabaseClient
            .from('Country_Details')
            .select('CountryCode')
            .eq('CountryCode', countryCode)
            .single();

        if (existingCountry) {
            showFlashMessage('Duplicate Entry!', 'error');
            return;
        }
    } catch (error) {
        if (error.code !== 'PGRST116') {
            console.error('Error checking duplicate country code:', error);
            showFlashMessage('Error checking country code!', 'error');
            return;
        }
    }

    try {
        // Insert the new record
        const { error } = await supabaseClient.from('Country_Details').insert([
            { CountryCode: countryCode, CountryName: countryName, Region: region, created_at: new Date().toISOString() }
        ]);
        if (error) throw error;

        showFlashMessage('Country details added successfully!', 'success');
        fetchCountryDetails(); // Refresh table
    } catch (error) {
        console.error('Error adding country details:', error);
        showFlashMessage('Error adding country details!', 'error');
    }
}

// Delete a country details entry with confirmation
async function deleteCountryDetails(id) {
    if (!confirm('Are you sure you want to delete this country detail?')) return;

    try {
        const { error } = await supabaseClient.from('Country_Details').delete().eq('id', id);
        if (error) throw error;

        showFlashMessage('Country details deleted successfully!', 'success');
        fetchCountryDetails(); // Refresh table
    } catch (error) {
        console.error('Error deleting country details:', error);
        showFlashMessage('Error deleting country details!', 'error');
    }
}

// Load country details for suggestions
async function loadCountryDetails() {
    try {
        const { data, error } = await supabaseClient.from('Country_Details').select('*');
        if (error) throw error;

        document.getElementById("countrySuggestions").innerHTML = (data || [])
            .map(row => `<option data-country-code="${row.CountryCode}" value="${row.CountryName}"></option>`)
            .join('');
    } catch (error) {
        console.error('Error fetching country details:', error);
    }
}

// Filter country table as user types
function filterCountryTable() {
    const nameInput = document.getElementById('countryName').value.toLowerCase();
    const regionInput = document.getElementById('region').value.toLowerCase();

    const filteredData = allCountries.filter(country =>
        country.CountryName.toLowerCase().includes(nameInput) &&
        country.Region.toLowerCase().includes(regionInput)
    );

    renderCountryTable(filteredData);
}

// Event listeners for live search
document.getElementById('countryName').addEventListener('input', filterCountryTable);
document.getElementById('region').addEventListener('input', filterCountryTable);

// Ensure table is scrollable
document.addEventListener('DOMContentLoaded', () => {
    fetchCountryDetails();
    loadCountryDetails();

    const tableContainer = document.createElement('div');
    Object.assign(tableContainer.style, {
        overflowY: 'auto',
        maxHeight: '60vh',
        border: '1px solid #ddd'
    });

    const table = document.getElementById('countryDetailsTable');
    table.parentNode.insertBefore(tableContainer, table);
    tableContainer.appendChild(table);
});
