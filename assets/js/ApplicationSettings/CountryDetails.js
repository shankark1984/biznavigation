// Global variable to store country data
let countryDetails = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {

    const addCountryButton = document.getElementById('addCountry');
    addCountryButton.addEventListener('click', saveCountry);

    const checkPermission = () => {
        addCountryButton.disabled = !canModify();
    };

    checkPermission();
    setTimeout(checkPermission, 300);

    await fetchCountryData();
    setupFilterListeners();

});

let countryTabInitialized = false;

document.getElementById('dropdownListdetails-tab')
    .addEventListener('shown.bs.tab', async () => {

        // Prevent reloading every time
        if (countryTabInitialized) return;
        countryTabInitialized = true;

        createLoader();

        const addCountryButton = document.getElementById('addCountry');
        if (!addCountryButton) return;

        addCountryButton.removeEventListener('click', saveCountry);
        addCountryButton.addEventListener('click', saveCountry);

        const checkPermission = () => {
            addCountryButton.disabled = !canModify();
        };

        checkPermission();
        setTimeout(checkPermission, 150);

        await fetchDropdownList();
        setupFilterListeners();
    });

/*************************************************
 * FETCH & RENDER Missing Pincodes in API
 *************************************************/

async function fetchCountryData() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('Country_Details')
            .select('*')
            .order('CountryName');

        if (error) throw error;

        const tableBody = document.querySelector('#countryListTable tbody');
        tableBody.innerHTML = '';

        if (!data?.length) return;

        // Sort by country
        data.sort((a, b) => (a.CountryName || '').localeCompare(b.CountryName || ''));

        // Render table
        data.forEach((country, i) => {
            const row = document.createElement('tr');
            row.dataset.id = country.id;
            row.dataset.countryCode = country.CountryCode;
            row.dataset.countryName = country.CountryName;
            row.dataset.currencyRegion = country.Region;
            row.dataset.currencyCode = country.CurrencyCode;
            row.dataset.currencyName = country.CurrencyName;

            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${country.CountryCode}</td>
                <td>${country.CountryName}</td>
                <td>${country.Region}</td>
                <td>${country.CurrencyCode}</td>
                <td>${country.CurrencyName}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning edit-btn-countryList me-1">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn-countryList">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : '<span class="text-muted small">Read Only</span>'}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update global cache
        countryDetails = data.map(countryList => ({
            countryCode: countryList.CountryCode,
            countryName: countryList.CountryName,
            currencyRegion: countryList.Region,
            currencyCode: countryList.CurrencyCode,
            currencyName: countryList.CurrencyName

        }));

        // Populate datalists
        populateCountryDatalists();

        // Attach edit/delete events
        attachCountryTableEvents();

    } catch (err) {
        console.error(err);
        alert('Failed to load country data.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * ATTACH EDIT / DELETE EVENTS
 *************************************************/
function attachCountryTableEvents() {
    document.querySelectorAll('.edit-btn-countryList').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = btn.closest('tr');
            editCountryDetails(
                row.dataset.id,
                row.dataset.countryCode,
                row.dataset.countryName,
                row.dataset.currencyRegion,
                row.dataset.currencyCode,
                row.dataset.currencyName,
                e
            );
        });
    });

    document.querySelectorAll('.delete-btn-countryList').forEach(btn => {
        btn.addEventListener('click', async e => {
            const row = btn.closest('tr');

            await deleteCountryItem(row.dataset.id, e);
        });
    });
}

/*************************************************
 * SAVE Pincode (ADD / EDIT)
 *************************************************/
async function saveCountry() {
    showLoader();
    if (!canModify()) {
        showToast('You do not have permission to add or edit countries.');
        hideLoader();
        return;
    }

    const btncountry = document.getElementById('addCountry');
    const mode = btncountry.dataset.mode || 'insert'; // ✅ HERE; // insert | update
    const id = Number(document.getElementById('tempFormID').value);

    const countryCode = document.getElementById('countryCode').value.trim();
    const countryName = capitalizeFirstLetter(document.getElementById('countryName').value.trim());
    const currencyRegion = document.getElementById('currencyRegion').value.trim();
    const currencyCode = document.getElementById('currencyCode').value;
    const currencyName = document.getElementById('currencyName').value;

    if (!countryCode || !countryName || !currencyRegion || !currencyCode || !currencyName) {
        showToast('Please enter country details.');
        hideLoader();
        return;
    }

    try {
        if (mode === 'insert') {
            const { data: existing } = await supabaseClient
                .from('Country_Details')
                .select('id')
                .eq('CountryCode', countryCode);

            if (existing?.length) {
                showToast('Country already exists.');
                hideLoader();
                return;
            }


            const { error } = await supabaseClient
                .from('Country_Details')
                .insert([{
                    CountryCode: countryCode,
                    CountryName: countryName,
                    Region: currencyRegion,
                    CurrencyCode: currencyCode,
                    CurrencyName: currencyName,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);
            if (error) throw error;

            showToast('New country added successfully.');

        } else {
            const { error } = await supabaseClient
                .from('Country_Details')
                .update({
                    CountryCode: countryCode,
                    CountryName: countryName,
                    Region: currencyRegion,
                    CurrencyCode: currencyCode,
                    CurrencyName: currencyName,
                })
                .eq('id', id);
            if (error) throw error;

            showToast('Country details updated successfully.');
        }

        // Reset form
        document.getElementById('tempFormID').value = '';
        btncountry.innerText = 'Add';
        btncountry.classList.remove('btn-warning');
        btncountry.classList.add('btn-primary');
        btncountry.dataset.mode = 'insert';
        document.getElementById('countryCode').value = '';
        document.getElementById('countryName').value = '';
        document.getElementById('currencyRegion').value = '';
        document.getElementById('currencyCode').value = '';
        document.getElementById('currencyName').value = '';

        await fetchCountryData();

    } catch (err) {
        console.error('Save country details error:', err);
        showToast('Failed to save country details.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * DELETE Pincode
 *************************************************/
async function deleteCountryItem(id, event) {
    if (event) event.preventDefault();

    if (!canModify()) return;
    if (!confirm('Are you sure you want to delete this country?')) return;

    try {
        const { error } = await supabaseClient
            .from('Country_Details')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Country deleted successfully.');
        await fetchCountryData();

    } catch (err) {
        console.error('Delete country error:', err);
        showToast('Failed to delete country.');
    }
}


/*************************************************
 * EDIT Country
 *************************************************/
function editCountryDetails(id, countryCode, countryName, currencyRegion, currencyCode, currencyName,
    event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    const countryCodeInput = document.getElementById('countryCode');
    const countryNameInput = document.getElementById('countryName');
    const currencyRegionInput = document.getElementById('currencyRegion');
    const currencyCodeInput = document.getElementById('currencyCode');
    const currencyNameInput = document.getElementById('currencyName');
    const addCountryBtn = document.getElementById('addCountry');

    if (!countryCodeInput || !countryNameInput || !currencyRegionInput || !currencyCodeInput || !currencyNameInput || !addCountryBtn) {
        console.error('Form inputs not found. Cannot edit missing pincode.');
        return;
    }

    document.getElementById('tempFormID').value = id;

    countryCodeInput.value = countryCode;
    countryNameInput.value = countryName;
    currencyRegionInput.value = currencyRegion;
    currencyCodeInput.value = currencyCode;
    currencyNameInput.value = currencyName;

    addCountryBtn.innerText = 'Edit';
    addCountryBtn.classList.remove('btn-primary');
    addCountryBtn.classList.add('btn-warning');
    addCountryBtn.dataset.mode = 'update';
}

/*************************************************
 * POPULATE MISSING PINCODE DATALISTS
 * *************************************************/
function populateCountryDatalists() {
    const countryCodeList = document.getElementById('countryCodeSuggestions');
    const countryNameList = document.getElementById('countryNameSuggestions');
    const currencyRegionList = document.getElementById('currencyRegionSuggestions');
    const currencyCodeList = document.getElementById('currencyCodeSuggestions');
    const currencyNameList = document.getElementById('currencyNameSuggestions');

    [countryCodeList, countryNameList, currencyRegionList, currencyCodeList, currencyNameList].forEach(dl => dl.innerHTML = '');

    const uniqueCountryCodes = [...new Set(countryDetails.map(p => p.countryCode).filter(c => c))];
    const uniqueCountryNames = [...new Set(countryDetails.map(p => p.countryName).filter(c => c))];
    const uniqueCurrencyRegion = [...new Set(countryDetails.map(p => p.currencyRegion).filter(c => c))];
    const uniqueCurrencyCodes = [...new Set(countryDetails.map(p => p.currencyCode).filter(c => c))];
    const uniqueCurrencyNames = [...new Set(countryDetails.map(p => p.currencyName).filter(c => c))];


    uniqueCountryCodes.forEach(c => { const o = document.createElement('option'); o.value = c; countryCodeList.appendChild(o); });
    uniqueCountryNames.forEach(c => { const o = document.createElement('option'); o.value = c; countryNameList.appendChild(o); });
    uniqueCurrencyRegion.forEach(c => { const o = document.createElement('option'); o.value = c; currencyRegionList.appendChild(o); });
    uniqueCurrencyCodes.forEach(c => { const o = document.createElement('option'); o.value = c; currencyCodeList.appendChild(o); });
    uniqueCurrencyNames.forEach(c => { const o = document.createElement('option'); o.value = c; currencyNameList.appendChild(o); });
}


// -------------------------------
// Setup Filter Inputs
// -------------------------------
function setupFilterListeners() {
    const countryCodeInput = document.getElementById('countryCode');
    const countryNameInput = document.getElementById('countryName');
    const currencyRegionInput = document.getElementById('currencyRegion');
    const currencyCodeInput = document.getElementById('currencyCode');
    const currencyNameInput = document.getElementById('currencyName');

    const inputs = [countryCodeInput, countryNameInput, currencyRegionInput, currencyCodeInput, currencyNameInput];

    inputs.forEach(input => {
        if (!input) return;

        input.addEventListener('input', () => {
            const countryCode = countryCodeInput.value.toLowerCase();
            const countryName = countryNameInput.value.toLowerCase();
            const currencyRegion = currencyRegionInput.value.toLowerCase();
            const currencyCode = currencyCodeInput.value.toLowerCase();
            const currencyName = currencyNameInput.value.toLowerCase();

            document.querySelectorAll('#countryListTable tbody tr').forEach(row => {
                const cells = row.cells;

                const row_countryCode = cells[1]?.textContent.toLowerCase() || '';
                const row_countryName = cells[2]?.textContent.toLowerCase() || '';
                const row_currencyRegion = cells[3]?.textContent.toLowerCase() || '';
                const row_currencyCode = cells[4]?.textContent.toLowerCase() || '';
                const row_currencyName = cells[5]?.textContent.toLowerCase() || '';

                const visible =
                    (!countryCode || row_countryCode.includes(countryCode)) &&
                    (!countryName || row_countryName.includes(countryName)) &&
                    (!currencyRegion || row_currencyRegion.includes(currencyRegion)) &&
                    (!currencyCode || row_currencyCode.includes(currencyCode)) &&
                    (!currencyName || row_currencyName.includes(currencyName));

                row.style.display = visible ? 'table-row' : 'none';
            });
        });
    })
}