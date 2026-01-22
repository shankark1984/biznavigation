// Global variable to store missing pincode details
let missingPincodeDetails = [];


// Initialize on page load

let missingPinCodeTabInitialized = false;

document.getElementById('missingPinCode-tab')
    .addEventListener('shown.bs.tab', async () => {

        // Prevent reloading every time
        if (missingPinCodeTabInitialized) return;
        missingPinCodeTabInitialized = true;

        createLoader();

        const addMissingPincodeButton = document.getElementById('addMissingPincode');
        if (!addMissingPincodeButton) return;

        addMissingPincodeButton.removeEventListener('click', saveMissingPincode);
        addMissingPincodeButton.addEventListener('click', saveMissingPincode);

        const checkPermission = () => {
            addMissingPincodeButton.disabled = !canModify();
        };

        checkPermission();
        setTimeout(checkPermission, 150);

        await fetchMissingPincodes();
        setupFilterListeners();
    });

/*************************************************
 * FETCH & RENDER Missing Pincodes in API
 *************************************************/

async function fetchMissingPincodes() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('missing_pincodes')
            .select('*')
            .order('city');

        if (error) throw error;

        const tableBody = document.querySelector('#missingPincodeTable tbody');
        tableBody.innerHTML = '';

        if (!data?.length) return;

        // Sort by country
        data.sort((a, b) => (a.city || '').localeCompare(b.city || ''));

        // Render table
        data.forEach((missingPincode, i) => {
            const row = document.createElement('tr');
            row.dataset.id = missingPincode.id;
            row.dataset.pincode = missingPincode.pincode;
            row.dataset.city = missingPincode.city;
            row.dataset.state = missingPincode.state;
            row.dataset.country = missingPincode.country;

            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${missingPincode.pincode}</td>
                <td>${missingPincode.city}</td>
                <td>${missingPincode.state}</td>
                <td>${missingPincode.country}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning edit-btn-missingpincode me-1">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : '<span class="text-muted small">Read Only</span>'}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update global cache
        missingPincodeDetails = data.map(missingPincode => ({
            pincode: missingPincode.pincode,
            city: missingPincode.city,
            state: missingPincode.state,
            country: missingPincode.country
        }));

        // Populate datalists
        populatemissingPincodeDatalists();

        // Attach edit/delete events
        attachMissingPincodeTableEvents();

    } catch (err) {
        console.error(err);
        alert('Failed to load ports.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * ATTACH EDIT / DELETE EVENTS
 *************************************************/
function attachMissingPincodeTableEvents() {
    document.querySelectorAll('.edit-btn-missingpincode').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = btn.closest('tr');
            editPincodeDetails(
                row.dataset.id,
                row.dataset.pincode,
                row.dataset.city,
                row.dataset.state,
                row.dataset.country,
                e
            );
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            const row = btn.closest('tr');

            await deleteMissingPincode(row.dataset.id, e);
        });
    });
}

/*************************************************
 * SAVE Pincode (ADD / EDIT)
 *************************************************/
async function saveMissingPincode() {
    showLoader();
    if (!canModify()) {
        showToast('You do not have permission to add or edit ports.');
        hideLoader();
        return;
    }

    const btn = document.getElementById('addMissingPincode');
    const mode = btn.dataset.mode; // insert | update
    const id = Number(document.getElementById('tempFormID').value);

    const missingPincode = document.getElementById('missingPincode').value.trim();
    const missingCity = capitalizeFirstLetter(document.getElementById('missingCity').value.trim());
    const missingState = document.getElementById('missingState').value.trim();
    const missingCountry = document.getElementById('missingCountry').value; // Corrected

    if (!missingPincode || !missingCity || !missingState || !missingCountry) {
        showToast('Please enter missing pincode details.');
        hideLoader();
        return;
    }

    try {
        if (mode === 'insert') {
            const { data: existing } = await supabaseClient
                .from('missing_pincodes')
                .select('id')
                .eq('pincode', missingPincode);

            if (existing?.length) {
                showToast('Pincode already exists.');
                hideLoader();
                return;
            }


            const { error } = await supabaseClient
                .from('missing_pincodes')
                .insert([{
                    pincode: missingPincode,
                    city: missingCity,
                    state: missingState,
                    country: missingCountry,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);
            if (error) throw error;

            showToast('Pincode added successfully.');

        } else {
            const { error } = await supabaseClient
                .from('missing_pincodes')
                .update({
                    pincode: missingPincode,
                    city: missingCity,
                    state: missingState,
                    country: missingCountry
                })
                .eq('id', id);
            if (error) throw error;

            showToast('Missing pincode updated successfully.');
        }

        // Reset form
        document.getElementById('tempFormID').value = '';
        btn.innerText = 'Add';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
        btn.dataset.mode = 'insert';
        document.getElementById('missingPincode').value = '';
        document.getElementById('missingCity').value = '';
        document.getElementById('missingState').value = '';
        document.getElementById('missingCountry').value = '';

        await fetchMissingPincodes();

    } catch (err) {
        console.error('Save missing pincode error:', err);
        showToast('Failed to save missing pincode.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * DELETE Pincode
 *************************************************/
async function deleteMissingPincode(id, event) {
    if (event) event.preventDefault();

    if (!canModify()) return;
    if (!confirm('Are you sure you want to delete this pincode?')) return;

    try {
        const { error } = await supabaseClient
            .from('missing_pincodes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Pincode deleted successfully.');
        await fetchMissingPincodes();

    } catch (err) {
        console.error('Delete pincode error:', err);
        showToast('Failed to delete pincode.');
    }
}

/*************************************************
 * EDIT Pincode
 *************************************************/
function editPincodeDetails(id, missingPincode, missingCity, missingState, missingCountry, event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    const pincodeInput = document.getElementById('missingPincode');
    const cityInput = document.getElementById('missingCity');
    const stateInput = document.getElementById('missingState');
    const countryInput = document.getElementById('missingCountry'); // Corrected
    const addPincodeBtn = document.getElementById('addMissingPincode');

    if (!pincodeInput || !cityInput || !stateInput || !countryInput || !addPincodeBtn) {
        console.error('Form inputs not found. Cannot edit missing pincode.');
        return;
    }

    document.getElementById('tempFormID').value = id;

    pincodeInput.value = missingPincode;
    cityInput.value = missingCity;
    stateInput.value = missingState;
    countryInput.value = missingCountry;

    addPincodeBtn.innerText = 'Edit';
    addPincodeBtn.classList.remove('btn-primary');
    addPincodeBtn.classList.add('btn-warning');
    addPincodeBtn.dataset.mode = 'update';
}

/*************************************************
 * POPULATE MISSING PINCODE DATALISTS
 * *************************************************/
function populatemissingPincodeDatalists() {
    const pincodeList = document.getElementById('missingPincodeSuggestions');
    const cityList = document.getElementById('missingCitySuggestions');
    const stateList = document.getElementById('missingStateSuggestions');
    const countryList = document.getElementById('missingCountrySuggestions');

    [pincodeList, cityList, stateList, countryList].forEach(dl => dl.innerHTML = '');

    const uniqueMissingPincodes = [...new Set(missingPincodeDetails.map(p => p.pincode).filter(c => c))];
    const uniqueMissingCities = [...new Set(missingPincodeDetails.map(p => p.city).filter(c => c))];
    const uniqueMissingStates = [...new Set(missingPincodeDetails.map(p => p.state).filter(c => c))];
    const uniqueCountries = [...new Set(missingPincodeDetails.map(p => p.country).filter(c => c))];


    uniqueMissingPincodes.forEach(c => { const o = document.createElement('option'); o.value = c; pincodeList.appendChild(o); });
    uniqueMissingCities.forEach(c => { const o = document.createElement('option'); o.value = c; cityList.appendChild(o); });
    uniqueMissingStates.forEach(n => { const o = document.createElement('option'); o.value = n; stateList.appendChild(o); });
    uniqueCountries.forEach(n => { const o = document.createElement('option'); o.value = n; countryList.appendChild(o); });
}


// -------------------------------
// Setup Filter Inputs
// -------------------------------
function setupFilterListeners() {
    const pincodeInput = document.getElementById('missingPincode');
    const cityInput = document.getElementById('missingCity');
    const stateInput = document.getElementById('missingState');
    const countryInput = document.getElementById('missingCountry'); // Corrected

    const inputs = [pincodeInput, cityInput, stateInput, countryInput];

    inputs.forEach(input => {
        if (!input) return;

        input.addEventListener('input', () => {
            const missing_pincodes = pincodeInput.value.toLowerCase();
            const missing_cities = cityInput.value.toLowerCase();
            const missing_states = stateInput.value.toLowerCase();
            const missing_countries = countryInput.value.toLowerCase();

            document.querySelectorAll('#missingPincodeTable tbody tr').forEach(row => {
                const cells = row.cells;

                const row_pincodes = cells[1]?.textContent.toLowerCase() || '';
                const row_cities = cells[2]?.textContent.toLowerCase() || '';
                const row_states = cells[3]?.textContent.toLowerCase() || '';
                const row_countries = cells[4]?.textContent.toLowerCase() || '';

                const visible =
                    (!missing_pincodes || row_pincodes.includes(missing_pincodes)) &&
                    (!missing_cities || row_cities.includes(missing_cities)) &&
                    (!missing_states || row_states.includes(missing_states)) &&
                    (!missing_countries || row_countries.includes(missing_countries));

                row.style.display = visible ? '' : 'none';
            });
        });
    });
}
