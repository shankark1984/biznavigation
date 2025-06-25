// Global variable to store city data
let cityData = [];
let currentPage = 1;
let rowsPerPage = 100;
let totalRows = 0;
let totalPages = 1;


// Escape special characters for HTML rendering
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "\\'");
}

async function fetchCityData() {
    try {
        let allData = [];
        let from = 0;
        const chunkSize = 1000;
        let fetchMore = true;

        while (fetchMore) {
            const { data, error, count } = await supabaseClient
                .from('CityDetails')
                .select('*', { count: 'exact' })
                .order('CityName', { ascending: true })
                .range(from, from + chunkSize - 1);

            if (error) throw error;

            allData = allData.concat(data);
            fetchMore = data.length === chunkSize;
            from += chunkSize;
        }

        const tableBody = document.querySelector('#cityDetailsTable tbody');
        tableBody.innerHTML = '';

        if (allData.length === 0) {
            tableBody.innerHTML =
                `<tr><td colspan="6" class="text-center text-muted">No records found.</td></tr>`;
            return;
        }

        cityData = allData;

        allData.forEach((item, index) => {
            const row = document.createElement('tr');
            const canEdit = UserType === 1 || UserType === 2;
            const canDelete = UserType === 1;

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(item.CityName)}</td>
                <td>${escapeHtml(item.State)}</td>
                <td>${escapeHtml(item.Zone)}</td>
                <td>${escapeHtml(item.Country)}</td>
                <td>
                  ${canEdit ? `
                    <button type="button" class="btn btn-sm btn-warning me-1"
                      onclick="editCityItem(${item.id}, '${escapeHtml(item.CityName)}',
                      '${escapeHtml(item.State)}', '${escapeHtml(item.Zone)}',
                      '${escapeHtml(item.Country)}', event)"
                      title="Edit"><i class="bi bi-pencil-square"></i></button>` : ''}
                  ${canDelete ? `
                    <button type="button" class="btn btn-sm btn-danger me-1"
                      onclick="deleteCityItem(${item.id}, event)"
                      title="Delete"><i class="bi bi-trash"></i></button>` : ''}
                  ${!canEdit && !canDelete ? `<span class="text-muted small">Read Only</span>` : ''}
                </td>`;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching city data:', error);
        alert('Failed to fetch city data.');
    }
}



// Clear form fields
function clearForm() {
    document.getElementById('cityName').value = '';
    document.getElementById('stateName').value = '';
    document.getElementById('zoneName').value = '';
    document.getElementById('cityCountryName').value = '';
    document.getElementById('tempFormID').value = '';
    document.getElementById('addCityDetails').innerText = 'Add';
}

// Add or update city
async function addCityItem() {
    const cityName = capitalize(document.getElementById('cityName').value.trim());
    const stateName = capitalize(document.getElementById('stateName').value.trim());
    const zoneName = capitalize(document.getElementById('zoneName').value.trim());
    const cityCountryName = capitalize(document.getElementById('cityCountryName').value.trim());

    if (!cityName || !stateName || !zoneName || !cityCountryName) {
        alert('City, State, Zone and Country are required fields.');
        return;
    }

    const button = document.getElementById('addCityDetails');
    const action = button.innerText;
    const id = document.getElementById('tempFormID').value;

    const cityObj = {
        CityName: cityName,
        State: stateName,
        Zone: zoneName,
        Country: cityCountryName,
    };

    try {
        if (action === 'Add') {
            const exists = cityData.some(item =>
                item.CityName.trim().toLowerCase() === cityName.toLowerCase() &&
                item.State.trim().toLowerCase() === stateName.toLowerCase() &&
                item.Zone.trim().toLowerCase() === zoneName.toLowerCase() &&
                item.Country.trim().toLowerCase() === cityCountryName.toLowerCase()
            );

            if (exists) {
                alert('This city already exists.');
                return;
            }

            const { error } = await supabaseClient
                .from('CityDetails')
                .insert([{ ...cityObj, created_by: UserLoginID, created_at: localtimeStamp }]);

            if (error) throw error;

            alert('City item added successfully.');

        } else if (action === 'Edit') {
            const original = cityData.find(item => item.id == id);
            if (!original) {
                alert('Original item not found.');
                return;
            }

            const { error } = await supabaseClient
                .from('CityDetails')
                .update({ ...cityObj, updated_by: UserLoginID, updated_at: localtimeStamp })
                .eq('id', id);

            if (error) throw error;

            alert('City item updated successfully.');
        }

        clearForm();
        await fetchCityData();

    } catch (error) {
        console.error('Error saving city item:', error);
        alert('Failed to save city item.');
    }
}

// Fill form to edit a city
function editCityItem(id, cityName, stateName, zoneName, countryName, event) {
    event.preventDefault();
    console.log(`Editing city item with ID: ${countryName}`);
    document.getElementById('tempFormID').value = id;
    document.getElementById('cityName').value = cityName;
    document.getElementById('stateName').value = stateName;
    document.getElementById('zoneName').value = zoneName;
    document.getElementById('cityCountryName').value = countryName;
    document.getElementById('addCityDetails').innerText = 'Edit';
}

// Delete a city
async function deleteCityItem(id, event) {
    event.preventDefault();
    if (UserType !== 1) {
        alert('You do not have permission to delete this item.');
        return;
    }

    if (!confirm('Are you sure you want to delete this city item?')) return;

    try {
        const { error } = await supabaseClient
            .from('CityDetails')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('City item deleted successfully.');
        await fetchCityData();

    } catch (error) {
        console.error('Error deleting city item:', error);
        alert('Failed to delete city item.');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {

    fetchCityData();

    const addButton = document.getElementById('addCityDetails');
    if (UserType === 1 || UserType === 2) {
        addButton.addEventListener('click', addCityItem);
    } else {
        addButton.disabled = true;
        document.querySelectorAll('#cityDetailsForm input').forEach(input => input.disabled = true);
    }
});


function filterTable() {
    const city = document.getElementById('cityName').value.trim().toLowerCase();
    const state = document.getElementById('stateName').value.trim().toLowerCase();
    const zone = document.getElementById('zoneName').value.trim().toLowerCase();
    const country = document.getElementById('cityCountryName').value.trim().toLowerCase();

    const tableBody = document.querySelector('#cityDetailsTable tbody');
    tableBody.innerHTML = '';

    const filteredData = cityData.filter(item =>
        item.CityName.toLowerCase().includes(city) &&
        item.State.toLowerCase().includes(state) &&
        item.Zone.toLowerCase().includes(zone) &&
        item.Country.toLowerCase().includes(country)
    );

    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="5" class="text-muted">No matching records found.</td>`;
        tableBody.appendChild(row);
        return;
    }

    filteredData.forEach((item, index) => {
        const row = document.createElement('tr');
        const canEdit = UserType === 1 || UserType === 2;
        const canDelete = UserType === 1;

        row.innerHTML = `
             <td>${index + 1}</td>
            <td>${escapeHtml(item.CityName)}</td>
            <td>${escapeHtml(item.State)}</td>
            <td>${escapeHtml(item.Zone)}</td>
            <td>${escapeHtml(item.Country)}</td>
            <td>
                ${canEdit ? `
                    <button type="button" class="btn btn-sm btn-warning me-1" 
                        onclick="editCityItem(${item.id}, '${escapeHtml(item.CityName)}', 
                        '${escapeHtml(item.State)}', '${escapeHtml(item.Zone)}', 
                        '${escapeHtml(item.Country)}', event)" 
                        title="Edit"><i class="bi bi-pencil-square"></i></button>
                ` : ''}
                ${canDelete ? `
                    <button type="button" class="btn btn-sm btn-danger me-1"
                        onclick="deleteCityItem(${item.id}, event)" 
                        title="Delete"><i class="bi bi-trash"></i></button>
                ` : ''}
                ${!canEdit && !canDelete ? `<span class="text-muted small">Read Only</span>` : ''}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateSuggestions(field, key) {
    const uniqueValues = [...new Set(cityData.map(item => item[key]))]
        .filter(val => val && val.toLowerCase().includes(field.value.toLowerCase()))
        .sort();

    const datalistId = field.getAttribute('list');
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = '';

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = capitalize(value);
        datalist.appendChild(option);
    });
}

// Attach events
['cityName', 'stateName', 'zoneName', 'cityCountryName'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
        filterTable();
        let key = '';
        switch (id) {
            case 'cityName': key = 'CityName'; break;
            case 'stateName': key = 'State'; break;
            case 'zoneName': key = 'Zone'; break;
            case 'cityCountryName': key = 'Country'; break;
        }
        populateSuggestions(input, key);
    });
});