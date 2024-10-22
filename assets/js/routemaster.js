
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

// Add new route
async function adddropdownMenuList() {
    let valueAssignedTo = document.getElementById('valueassignedto').value;
    let description = document.getElementById('description').value;
    let condition = document.getElementById('condition').value;
    let fixedValue = document.getElementById('fixedvalue').value;
    let hsnCode = document.getElementById('hsncode').value;

    if (!valueassignedto || !description) {
        alert('Please fill in all fields.');
        return;
    }
    valueAssignedTo = capitalize(valueassignedto);
    description = capitalize(description);


    country = capitalize(country);

    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .insert([
            { type_of_value: valueAssignedTo, description: description, condition: condition, value: fixedValue, hsn_code: hsnCode, created_by: userLoginID, created_at: localtimeStamp }
        ]);

    if (error) {
        console.error('Error adding route:', error);
        return;
    }

    fetchPinCode(); // Refresh the table after adding a new route
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
