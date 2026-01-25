/*************************************************
 * ROUTE DETAILS – ADD / EDIT / DELETE
 *************************************************/

// Global cache
let routeDetails = [];

/*************************************************
 * INIT
 *************************************************/
document.addEventListener('DOMContentLoaded', async () => {

    const addRouteBtn = document.getElementById('addRouteDetails');
    createLoader();
    addRouteBtn.addEventListener('click', saveRoute);

    const checkPermission = () => {
        if (canModify()) {
            addRouteBtn.disabled = false;
        } else {
            addRouteBtn.disabled = true;
        }
    };

    // Run immediately
    checkPermission();

    // Run again if UserType is set later
    setTimeout(checkPermission, 150);

    await fetchRoutes();

    const form = document.getElementById('applicationSettingsForm');
    if (form) {
        form.addEventListener('submit', e => e.preventDefault());
    }

});


/*************************************************
 * Fetch & Render Routes
 *************************************************/
async function fetchRoutes() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('route_master')
            .select('*')
            .eq('company_id', CompanyID);

        if (error) throw error;

        const tableBody = document.querySelector('#routeTable tbody');
        tableBody.innerHTML = '';

        if (!data?.length) return;

        data.sort((a, b) =>
            (a.route_description || '').localeCompare(b.route_description || '')
        );

        data.forEach(route => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${route.route_description}</td>
                <td>${route.distance}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning me-1"
                            onclick="editRouteDetails(${route.id}, 
                            '${route.route_description.replace(/'/g, "\\'")}', 
                            ${route.distance}, event)">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-danger"
                            onclick="deleteRoute(${route.id}, event)">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : '<span class="text-muted small">Read Only</span>'}
                </td>
            `;
            tableBody.appendChild(row);
        });
        routeDetails = data.map(route => ({
            id: route.id,
            routeDescription: route.route_description,
            routeDistance: route.distance
        }));
        routeDetailsSuggestions();

    } catch (err) {
        console.error(err);
        showToast('Failed to load routes.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * ADD / EDIT (SAME BUTTON)
 *************************************************/
async function saveRoute() {
    const btn = document.getElementById('addRouteDetails');
    const mode = btn.dataset.mode || 'insert';   // insert | update
    const id = Number(document.getElementById('tempFormID').value);
    let routeDescription = document.getElementById('routeDescription').value.trim();
    let distance = parseFloat(document.getElementById('distance').value);

    showLoader();

    if (!canModify()) {
        showToast('You do not have permission to add or edit routes.');
        hideLoader();
        return;
    }

    if (!routeDescription || isNaN(distance)) {
        showToast('Please enter valid route and distance.');
        hideLoader();
        return;
    }

    if (distance <= 0) {
        showToast('Distance must be greater than zero.');
        hideLoader();
        return;
    }

    routeDescription = capitalize(routeDescription);

    try {
        const exists = routeDetails.some(r =>
            r.routeDescription.toLowerCase() === routeDescription.toLowerCase() &&
            (mode === 'insert' || r.id !== id)
        );

        if (exists) {
            showToast('Route already exists.');
            hideLoader();
            return;
        }

        if (mode === 'insert') {

            // 🔹 INSERT
            const { error } = await supabaseClient
                .from('route_master')
                .insert([{
                    route_description: routeDescription,
                    distance,
                    company_id: CompanyID,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);

            if (error) throw error;

            showToast('Route added successfully.');
        } else {
            // 🔹 UPDATE
            const { error } = await supabaseClient
                .from('route_master')
                .update({
                    route_description: routeDescription,
                    distance,
                    company_id: CompanyID,
                    updated_by: UserLoginID,
                    updated_at: localtimeStamp
                })
                .eq('id', id);

            if (error) throw error;

            showToast('Route updated successfully.');
        }

        fetchRoutes();

        document.getElementById('tempFormID').value = '';
        btn.innerText = 'Add';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
        btn.dataset.mode = 'insert';
        document.getElementById('routeDescription').value = '';
        document.getElementById('distance').value = '';

    } catch (err) {
        console.error('Save error:', err);
        showToast('Failed to save route.');
    } finally {
        hideLoader();
    }
}


/*************************************************
 * DELETE
 *************************************************/
async function deleteRoute(id, event) {
    event.preventDefault();

    if (!canModify()) return;

    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
        const { error } = await supabaseClient
            .from('route_master')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Route deleted successfully.');
        fetchRoutes();

    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete route.');
    }
}

/*************************************************
 * EDIT MODE (LOAD FORM)
 *************************************************/
function editRouteDetails(id, description, distance, event) {
    event.preventDefault();

    if (!canModify()) return;

    document.getElementById('tempFormID').value = id;
    document.getElementById('routeDescription').value = description;
    document.getElementById('distance').value = distance;

    const btn = document.getElementById('addRouteDetails');
    btn.innerText = 'Edit';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-warning');
    btn.dataset.mode = 'update';
}

/*************************************************
 * Datalist Suggestions
 *************************************************/
function routeDetailsSuggestions() {
    const datalist = document.getElementById('routeSuggestions');
    datalist.innerHTML = '';

    routeDetails.forEach(route => {
        const option = document.createElement('option');
        option.value = route.routeDescription;
        datalist.appendChild(option);
    });
}

/*************************************************
 * Autofill Distance
 *************************************************/
document.getElementById('routeDescription')
    .addEventListener('input', e => {
        const route = routeDetails.find(
            r => r.routeDescription.toLowerCase() === e.target.value.toLowerCase()
        );
        if (route) {
            document.getElementById('distance').value = route.routeDistance;
        }
    });
