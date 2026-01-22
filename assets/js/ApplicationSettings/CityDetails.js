// Global variable to store city data
let cityDetails = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // createLoader();
    const addCityDetailsButton = document.getElementById('addCityDetails');
    addCityDetailsButton.addEventListener('click', saveCityDetails);

    const checkPermission = () => {
        addCityDetailsButton.disabled = !canModify();
    };

    checkPermission();
    setTimeout(checkPermission, 300);

    await fetchCityData();
    setupFilterListeners();

});

/*************************************************
 * FETCH & RENDER Missing Pincodes in API
 *************************************************/

async function fetchCityData() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('CityDetails')
            .select('*')
            .order('CityName');

        if (error) throw error;

        const tableBody = document.querySelector('#cityDetailsTable tbody');
        tableBody.innerHTML = '';

        if (!data?.length) {
            hideLoader();
            return;
        }

        // Sort by country
        data.sort((a, b) => (a.CityName || '').localeCompare(b.CityName || ''));

        // Render table
        data.forEach((city, i) => {
            const row = document.createElement('tr');
            row.dataset.id = city.id;
            row.dataset.cityName = city.CityName;
            row.dataset.stateName = city.State;
            row.dataset.zoneName = city.Zone;
            row.dataset.countryName = city.Country;


            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${city.CityName}</td>
                <td>${city.State}</td>
                <td>${city.Zone}</td>
                <td>${city.Country}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning edit-btn-citydetails me-1">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn-citydetails">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : '<span class="text-muted small">Read Only</span>'}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update global cache
        cityDetails = data.map(city => ({
            cityName: city.CityName,
            stateName: city.State,
            zoneName: city.Zone,
            countryName: city.Country
        }));


        attachCityTableEvents();
        populateCityDatalists();

    } catch (error) {
        console.error('Error fetching missing pincodes:', error);
        hideLoader();
    }
}

/*************************************************
 * ATTACH EDIT / DELETE EVENTS
 *************************************************/
function attachCityTableEvents() {
    document.querySelectorAll('.edit-btn-citydetails').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = btn.closest('tr');
            editCityData(
                row.dataset.id,
                row.dataset.cityName,
                row.dataset.stateName,
                row.dataset.zoneName,
                row.dataset.countryName,
                e
            );
        });
    });

    document.querySelectorAll('.delete-btn-citydetails').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = btn.closest('tr');
            deleteCityItem(row.dataset.id, e);
        });
    });
}


/*************************************************
 * SAVE Pincode (ADD / EDIT)
 *************************************************/
async function saveCityDetails() {
    showLoader();
    if (!canModify()) {
        showToast('You do not have permission to add or edit city.');
        hideLoader();
        return;
    }

    const btn = document.getElementById('addCityDetails');
    const mode = btn.dataset.mode || 'insert'; // insert | update
    const id = Number(document.getElementById('tempFormID').value);

    const cityName = document.getElementById('cityName').value.trim();
    const stateName = capitalizeFirstLetter(document.getElementById('stateName').value.trim());
    const zoneName = document.getElementById('zoneName').value.trim();
    const cityCountryName = document.getElementById('cityCountryName').value; // Corrected

    if (!cityName || !stateName || !zoneName || !cityCountryName) {
        showToast('Please enter city details.');
        hideLoader();
        return;
    }

    try {
        if (mode === 'insert') {
            const { data: existing } = await supabaseClient
                .from('CityDetails')
                .select('id')
                .eq('CityName', cityName);

            if (existing?.length) {
                showToast('City already exists.');
                hideLoader();
                return;
            }


            const { error } = await supabaseClient
                .from('CityDetails')
                .insert([{
                    CityName: cityName,
                    State: stateName,
                    Zone: zoneName,
                    Country: cityCountryName,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);
            if (error) throw error;

            showToast('City added successfully.');

        } else {
            const { error } = await supabaseClient
                .from('CityDetails')
                .update({
                    CityName: cityName,
                    State: stateName,
                    Zone: zoneName,
                    Country: cityCountryName,
                    updated_by: UserLoginID,
                    updated_at: localtimeStamp

                })
                .eq('id', id);
            if (error) throw error;

            showToast('City updated successfully.');
        }

        // Reset form
        document.getElementById('tempFormID').value = '';
        btn.innerText = 'Add';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
        btn.dataset.mode = 'insert';
        document.getElementById('cityName').value = '';
        document.getElementById('stateName').value = '';
        document.getElementById('zoneName').value = '';
        document.getElementById('cityCountryName').value = '';

        await fetchCityData();

    } catch (err) {
        console.error('Save city error:', err);
        showToast('Failed to save city.');
    } finally {
        hideLoader();
    }
}


/*************************************************
 * DELETE Pincode
 *************************************************/
async function deleteCityItem(id, event) {
    if (event) event.preventDefault();

    if (!canModify()) return;
    if (!confirm('Are you sure you want to delete this city?')) return;

    try {
        const { error } = await supabaseClient
            .from('CityDetails')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('City deleted successfully.');
        await fetchCityData();

    } catch (err) {
        console.error('Delete city error:', err);
        showToast('Failed to delete city.');
    }
}


/*************************************************
 * EDIT Pincode
 *************************************************/
function editCityData(id, cityName, stateName, zoneName, countryName, event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    const cityNameInput = document.getElementById('cityName');
    const stateNameInput = document.getElementById('stateName');
    const zoneNameInput = document.getElementById('zoneName');
    const countryNameInput = document.getElementById('cityCountryName');
    const addCityDetailsBtn = document.getElementById('addCityDetails');

    if (!cityNameInput || !stateNameInput || !zoneNameInput || !countryNameInput || !addCityDetailsBtn) {
        console.error('Form inputs not found. Cannot edit missing pincode.');
        return;
    }

    document.getElementById('tempFormID').value = id;

    cityNameInput.value = cityName;
    stateNameInput.value = stateName;
    zoneNameInput.value = zoneName;
    countryNameInput.value = countryName;

    addCityDetailsBtn.innerText = 'Edit';
    addCityDetailsBtn.classList.remove('btn-primary');
    addCityDetailsBtn.classList.add('btn-warning');
    addCityDetailsBtn.dataset.mode = 'update';
}

/*************************************************
 * POPULATE MISSING PINCODE DATALISTS
 * *************************************************/
function populateCityDatalists() {
    const cityNameList = document.getElementById('cityNameSuggestions');
    const stateNameList = document.getElementById('stateNameSuggestions');
    const zoneNameList = document.getElementById('zoneNameSuggestions');
    const countryNameList = document.getElementById('cityCountryNameSuggestions');

    [cityNameList, stateNameList, zoneNameList, countryNameList]
        .filter(Boolean)
        .forEach(dl => dl.innerHTML = '');


    const uniqueCityNames = [...new Set(cityDetails.map(p => p.cityName).filter(c => c))];
    const uniqueStateNames = [...new Set(cityDetails.map(p => p.stateName).filter(c => c))];
    const uniqueZoneNames = [...new Set(cityDetails.map(p => p.zoneName).filter(c => c))];
    const uniqueCountryNames = [...new Set(cityDetails.map(p => p.countryName).filter(c => c))];

    uniqueCityNames.forEach(c => { const o = document.createElement('option'); o.value = c; cityNameList.appendChild(o); });
    uniqueStateNames.forEach(c => { const o = document.createElement('option'); o.value = c; stateNameList.appendChild(o); });
    uniqueZoneNames.forEach(n => { const o = document.createElement('option'); o.value = n; zoneNameList.appendChild(o); });
    uniqueCountryNames.forEach(n => { const o = document.createElement('option'); o.value = n; countryNameList.appendChild(o); });

}

// -------------------------------
// Setup Filter Inputs
// -------------------------------
function setupFilterListeners() {

    const cityNameInput = document.getElementById('cityName');
    const stateNameInput = document.getElementById('stateName');
    const zoneNameInput = document.getElementById('zoneName');
    const countryNameInput = document.getElementById('cityCountryName');

    const inputs = [cityNameInput, stateNameInput, zoneNameInput, countryNameInput];

    inputs.forEach(input => {
        if (!input) return;

        input.addEventListener('input', () => {

            const cityName = cityNameInput.value.toLowerCase();
            const stateName = stateNameInput.value.toLowerCase();
            const zoneName = zoneNameInput.value.toLowerCase();
            const countryName = countryNameInput.value.toLowerCase();

            document.querySelectorAll('#cityDetailsTable tbody tr').forEach(row => {
                const cells = row.cells;

                const row_cityName = cells[1]?.textContent.toLowerCase() || '';
                const row_stateName = cells[2]?.textContent.toLowerCase() || '';
                const row_zoneName = cells[3]?.textContent.toLowerCase() || '';
                const row_countryName = cells[4]?.textContent.toLowerCase() || '';

                const visible =
                    (!cityName || row_cityName.includes(cityName)) &&
                    (!stateName || row_stateName.includes(stateName)) &&
                    (!zoneName || row_zoneName.includes(zoneName)) &&
                    (!countryName || row_countryName.includes(countryName));

                row.style.display = visible ? '' : 'none';
            });
        });
    });
}