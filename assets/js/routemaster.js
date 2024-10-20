
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
