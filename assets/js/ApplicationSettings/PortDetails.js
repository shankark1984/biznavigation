/*************************************************
 * PORT DETAILS – ADD / EDIT / DELETE
 *************************************************/

// Global cache
let portDetails = [];


/*************************************************
 * INIT
 *************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    createLoader();

    const addPortBtn = document.getElementById('addPortDetails');
    addPortBtn.addEventListener('click', savePort);


    const checkPermission = () => {
        addPortBtn.disabled = !canModify();
    };

    checkPermission();
    setTimeout(checkPermission, 300);

    await fetchPorts();
    setupFilterListeners();

});

/*************************************************
 * FETCH & RENDER PORTS
 *************************************************/
async function fetchPorts() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('PortsDetails')
            .select('*')
            .order('PortName');

        if (error) throw error;

        const tableBody = document.querySelector('#portTable tbody');
        tableBody.innerHTML = '';

        if (!data?.length) return;

        // Sort by country
        data.sort((a, b) => (a.PortCountry || '').localeCompare(b.PortCountry || ''));

        // Render table
        data.forEach((port, i) => {
            const row = document.createElement('tr');
            row.dataset.id = port.id;
            row.dataset.country = port.PortCountry;
            row.dataset.code = port.PortCode;
            row.dataset.name = port.PortName;
            row.dataset.type = port.PortType;

            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${port.PortCountry}</td>
                <td>${port.PortCode}</td>
                <td>${port.PortName}</td>
                <td>${port.PortType}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning edit-btn me-1">
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
        portDetails = data.map(port => ({
            portCountry: port.PortCountry,
            portCode: port.PortCode,
            portName: port.PortName,
            portType: port.PortType
        }));

        // Populate datalists
        populatePortDatalists();

        // Attach edit/delete events
        attachPortTableEvents();

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
function attachPortTableEvents() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = btn.closest('tr');
            editPortDetails(
                row.dataset.id,
                row.dataset.country,
                row.dataset.code,
                row.dataset.name,
                row.dataset.type,
                e
            );
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            const row = btn.closest('tr');
            if (!confirm(`Delete port ${row.dataset.name}?`)) return;
            await deletePort(row.dataset.id, e);
        });
    });
}

/*************************************************
 * SAVE PORT (ADD / EDIT)
 *************************************************/
async function savePort() {
    if (!canModify()) {
        alert('You do not have permission to add or edit ports.');
        return;
    }

    const btn = document.getElementById('addPortDetails');
    const mode = btn.dataset.mode; // insert | update
    const id = document.getElementById('tempFormID').value;

    const portCountryName = capitalize(document.getElementById('portCountryName').value.trim());
    const portCode = toUpperCase(document.getElementById('portCode').value.trim());
    const portName = document.getElementById('portName').value.trim();
    const portType = document.getElementById('portType').value; // Corrected

    if (!portCountryName || !portCode || !portName || !portType) {
        console.log(portCountryName, portCode, portName, portType);
        alert('Please enter all port details.');
        return;
    }

    try {
        if (mode === 'insert') {
            const exists = portDetails.some(p => p.portCode.toLowerCase() === portCode.toLowerCase());
            if (exists) {
                alert('Port code already exists.');
                return;
            }

            const { error } = await supabaseClient
                .from('PortsDetails')
                .insert([{
                    PortCountry: portCountryName,
                    PortCode: portCode,
                    PortName: portName,
                    PortType: portType,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);
            if (error) throw error;

            alert('Port added successfully.');

        } else {
            const { error } = await supabaseClient
                .from('PortsDetails')
                .update({
                    PortCountry: portCountryName,
                    PortCode: portCode,
                    PortName: portName,
                    PortType: portType,
                    updated_by: UserLoginID,
                    updated_at: localtimeStamp
                })
                .eq('id', id);
            if (error) throw error;

            alert('Port updated successfully.');
        }

        // Reset form
        document.getElementById('tempFormID').value = '';
        btn.innerText = 'Add';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
        btn.dataset.mode = 'insert';
        document.getElementById('portCountryName').value = '';
        document.getElementById('portCode').value = '';
        document.getElementById('portName').value = '';
        document.getElementById('portType').value = '';

        await fetchPorts();

    } catch (err) {
        console.error('Save port error:', err);
        alert('Failed to save port.');
    }
}

/*************************************************
 * DELETE PORT
 *************************************************/
async function deletePort(id, event) {
    if (event) event.preventDefault();

    if (!canModify()) return;
    if (!confirm('Are you sure you want to delete this port?')) return;

    try {
        const { error } = await supabaseClient
            .from('PortsDetails')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Port deleted successfully.');
        await fetchPorts();

    } catch (err) {
        console.error('Delete port error:', err);
        alert('Failed to delete port.');
    }
}

/*************************************************
 * EDIT PORT
 *************************************************/
function editPortDetails(id, portCountryName, portCode, portName, portType, event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    const countryInput = document.getElementById('portCountryName');
    const codeInput = document.getElementById('portCode');
    const nameInput = document.getElementById('portName');
    const typeInput = document.getElementById('portType'); // Corrected
    const addBtn = document.getElementById('addPortDetails');

    if (!countryInput || !codeInput || !nameInput || !portType || !addBtn) {
        console.error('Form inputs not found. Cannot edit port.');
        return;
    }

    document.getElementById('tempFormID').value = id;
    countryInput.value = portCountryName;
    codeInput.value = portCode;
    nameInput.value = portName;
    typeInput.value = portType; // Now works

    addBtn.innerText = 'Edit';
    addBtn.classList.remove('btn-primary');
    addBtn.classList.add('btn-warning');
    addBtn.dataset.mode = 'update';
}


/*************************************************
 * DATASLISTS
 *************************************************/
function populatePortDatalists() {
    const countryList = document.getElementById('portCountryNameSuggestions');
    const codeList = document.getElementById('portCodeSuggestions');
    const nameList = document.getElementById('portNameSuggestions');

    [countryList, codeList, nameList].forEach(dl => dl.innerHTML = '');

    const uniqueCountries = [...new Set(portDetails.map(p => p.portCountry).filter(c => c))];
    const uniqueCodes = [...new Set(portDetails.map(p => p.portCode).filter(c => c))];
    const uniqueNames = [...new Set(portDetails.map(p => p.portName).filter(c => c))];

    uniqueCountries.forEach(c => { const o = document.createElement('option'); o.value = c; countryList.appendChild(o); });
    uniqueCodes.forEach(c => { const o = document.createElement('option'); o.value = c; codeList.appendChild(o); });
    uniqueNames.forEach(n => { const o = document.createElement('option'); o.value = n; nameList.appendChild(o); });
}

// -------------------------------
// Setup Filter Inputs
// -------------------------------
function setupFilterListeners() {
    const countryInput = document.getElementById('portCountryName');
    const codeInput = document.getElementById('portCode');
    const nameInput = document.getElementById('portName');
    const typeInput = document.getElementById('portType'); // ✅ correct ID

    const inputs = [countryInput, codeInput, nameInput, typeInput];

    inputs.forEach(input => {
        if (!input) return;

        input.addEventListener('input', () => {
            const country = countryInput.value.toLowerCase();
            const code = codeInput.value.toLowerCase();
            const name = nameInput.value.toLowerCase();
            const type = typeInput.value.toLowerCase();

            document.querySelectorAll('#portTable tbody tr').forEach(row => {
                const cells = row.cells;

                const rowCountry = cells[1]?.textContent.toLowerCase() || '';
                const rowCode = cells[2]?.textContent.toLowerCase() || '';
                const rowName = cells[3]?.textContent.toLowerCase() || '';
                const rowType = cells[4]?.textContent.toLowerCase() || '';

                const visible =
                    (!country || rowCountry.includes(country)) &&
                    (!code || rowCode.includes(code)) &&
                    (!name || rowName.includes(name)) &&
                    (!type || rowType.includes(type));

                row.style.display = visible ? '' : 'none';
            });
        });
    });
}


