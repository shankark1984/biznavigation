// Declare global variable for route details
let routeDetails = [];

// Capitalize each word
function capitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Fetch route data from Supabase and populate the table
async function fetchRoutes() {
    try {
        const { data, error } = await supabaseClient
            .from('route_master')
            .select('*');

        if (error) {
            console.error('Error fetching routes:', error);
            alert('Failed to fetch route data.');
            return;
        }

        const tableBody = document.querySelector('#routeTable tbody');
        tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            console.log('No routes found');
            return;
        }

        data.sort((a, b) => (a.route_description || '').localeCompare(b.route_description || ''));

        data.forEach(route => {
            const row = document.createElement('tr');

            const canEdit = UserType === 1 || UserType === 2;
            const canDelete = canEdit;

            row.innerHTML = `
                <td>${route.route_description}</td>
                <td>${route.distance}</td>
                <td>
                    ${canEdit ? `
                        <button type="button" class="btn btn-sm btn-warning me-1" onclick="editRouteDetails(${route.id}, 
                        '${route.route_description.replace(/'/g, "\\'")}', ${route.distance}, event)" 
                        title="Edit"><i class="bi bi-pencil-square"></i></button>
                    ` : ''}
                    ${canDelete ? `
                        <button type="button" class="btn btn-sm btn-danger me-1" onclick="deleteRoute(${route.id}, event)"
                        title="Delete"><i class="bi bi-trash"></i></button>
                    ` : ''}
                    ${!canEdit && !canDelete ? `<span class="text-muted small">Read Only</span>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        routeDetails = data.map(route => ({
            routeDescription: route.route_description,
            routeDistance: route.distance
        }));

        routeDetailsSuggestions();

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Unexpected error loading routes.');
    }
}

// Add or update route
async function addRoute() {
    if (userType !== 1 && userType !== 2) {
        alert('You do not have permission to add or modify routes.');
        return;
    }

    let routeDescription = document.getElementById('routeDescription').value.trim();
    let distance = document.getElementById('distance').value.trim();

    if (!routeDescription || !distance) {
        alert('Please fill in all fields.');
        return;
    }

    routeDescription = capitalize(routeDescription);
    distance = parseFloat(distance);

    const button = document.getElementById('addRouteDetails');
    const action = button.innerText;
    const id = document.getElementById('tempFormID').value;

    const existingRoute = routeDetails.find(route => route.routeDescription.toLowerCase() === routeDescription.toLowerCase());

    if (action === 'Add') {
        if (existingRoute) {
            alert('Route already exists.');
            return;
        }

        const { error } = await supabaseClient
            .from('route_master')
            .insert([{
                route_description: routeDescription,
                distance: distance,
                created_by: userLoginID,
            }]);

        if (error) {
            console.error('Error adding route:', error);
            alert('An error occurred while adding the route.');
            return;
        }

        alert('Route added successfully.');
    } else if (action === 'Edit') {
        const { error } = await supabaseClient
            .from('route_master')
            .update({
                route_description: routeDescription,
                distance: distance,
                created_by: userLoginID,
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating route:', error);
            alert('Failed to update the route.');
            return;
        }

        alert('Route updated successfully.');
    }

    document.getElementById('routeDescription').value = '';
    document.getElementById('distance').value = '0';
    document.getElementById('tempFormID').value = '';
    button.innerText = 'Add';

    fetchRoutes();
}

// Delete a route
async function deleteRoute(id, event) {
    event.preventDefault();

    if (userType !== 1 && userType !== 2) {
        alert('You do not have permission to delete routes.');
        return;
    }

    if (!confirm('Are you sure you want to delete this route?')) return;

    const { error } = await supabaseClient
        .from('route_master')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting route:', error);
        alert('An error occurred while deleting the route.');
        return;
    }

    alert('Route deleted successfully.');
    fetchRoutes();
}

// Populate the datalist with route descriptions
function routeDetailsSuggestions() {
    const datalist = document.getElementById("routeSuggestions");
    datalist.innerHTML = '';

    routeDetails.forEach(route => {
        const option = document.createElement("option");
        option.value = route.routeDescription;
        datalist.appendChild(option);
    });
}

// Fill form when route is selected from suggestions
$("#routedetails").on("input", function () {
    const routeName = $(this).val();
    const routeData = routeDetails.find(route => route.routeDescription === routeName);

    if (routeData) {
        $("#routedetails").val(routeData.routeDescription);
        $("#routedistance").val(routeData.routeDistance);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (typeof supabaseClient === 'undefined') {
        console.error('Supabase client not initialized');
        return;
    }
    if (typeof CompanyID === 'undefined' || typeof UserType === 'undefined') {
        console.error('Company ID or userType not defined');
        return;
    }

    fetchRoutes();

    const addButton = document.getElementById('addRouteDetails');
    if (UserType === 1 || UserType === 2) {
        addButton.addEventListener('click', addRoute);
    } else {
        addButton.disabled = true;
        document.querySelectorAll('#routeForm input, #routeForm select').forEach(input => {
            input.disabled = true;
        });
    }
});

// Edit route (populate form fields)
function editRouteDetails(id, description, distance, event) {
    event.preventDefault();

    document.getElementById('tempFormID').value = id;
    document.getElementById('routeDescription').value = description;
    document.getElementById('distance').value = distance;
    document.getElementById('addRouteDetails').innerText = 'Edit';
}