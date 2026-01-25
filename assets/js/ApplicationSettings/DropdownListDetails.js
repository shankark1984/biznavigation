/*************************************************
 * GLOBAL STATE
 *************************************************/
let dropdownListData = [];
let filtersInitialized = false;

/*************************************************
 * INIT
 *************************************************/

let dropdownMenuListTabInitialized = false;

document.getElementById('dropdownListdetails-tab')
    .addEventListener('shown.bs.tab', async () => {

        // Prevent reloading every time
        if (dropdownMenuListTabInitialized) return;
        dropdownMenuListTabInitialized = true;

        createLoader();

        const addDropdownMenuListBtn = document.getElementById('addDropdownMenuList');
        if (!addDropdownMenuListBtn) return;

        addDropdownMenuListBtn.removeEventListener('click', saveDropdownItem);
        addDropdownMenuListBtn.addEventListener('click', saveDropdownItem);

        const checkPermission = () => {
            addDropdownMenuListBtn.disabled = !canModify();
        };

        checkPermission();
        setTimeout(checkPermission, 150);

        await fetchDropdownList();
        setupFilterListeners();
    });

/*************************************************
 * FETCH DROPDOWN LIST
 *************************************************/
async function fetchDropdownList() {
    showLoader();

    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('*')
            .order('type_of_value')
            .order('description');

        if (error) throw error;

        const tbody = document.querySelector('#dropdownListTable tbody');
        tbody.innerHTML = '';

        if (!data?.length) {
            dropdownListData = [];
            populateDropdownDatalists();
            return;
        }

        data.forEach((item, i) => {
            const tr = document.createElement('tr');

            // ✅ dataset (camelCase ONLY)
            tr.dataset.id = item.id;
            tr.dataset.typeOfValue = item.type_of_value;
            tr.dataset.description = item.description;
            tr.dataset.condition = item.condition;
            tr.dataset.value = item.value;
            tr.dataset.hsnCode = item.hsn_code;

            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${item.type_of_value}</td>
                <td>${item.description}</td>
                <td>${item.condition}</td>
                <td>${item.value}</td>
                <td>${item.hsn_code}</td>
                <td>
                    ${canModify() ? `
                        <button class="btn btn-sm btn-warning edit-btn-dropdownitem me-1">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn-dropdownitem">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : '<span class="text-muted small">Read Only</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // ✅ global cache (correct keys)
        dropdownListData = data.map(d => ({
            type_of_value: d.type_of_value,
            description: d.description,
            condition: d.condition,
            value: d.value,
            hsn_code: d.hsn_code
        }));

        populateDropdownDatalists();
        attachDropdownListTableEvents();

    } catch (err) {
        console.error(err);
        showToast('Failed to load dropdown list.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * ATTACH EDIT / DELETE EVENTS
 *************************************************/
function attachDropdownListTableEvents() {
    document.querySelectorAll('.edit-btn-dropdownitem').forEach(btn => {
        btn.onclick = e => {
            const row = btn.closest('tr');
            editDropdownDetails(
                row.dataset.id,
                row.dataset.typeOfValue,
                row.dataset.description,
                row.dataset.condition,
                row.dataset.value,
                row.dataset.hsnCode,
                e
            );
        };
    });

    document.querySelectorAll('.delete-btn-dropdownitem').forEach(btn => {
        btn.onclick = async e => {
            const row = btn.closest('tr');
            if (!confirm(`Delete "${row.dataset.description}" ?`)) return;
            await deleteDropdownItem(row.dataset.id, e);
        };
    });
}

/*************************************************
 * SAVE (ADD / UPDATE)
 *************************************************/
async function saveDropdownItem() {
    if (!canModify()) return alert('No permission.');

    const btn = document.getElementById('addDropdownMenuList');
    const mode = btn.dataset.mode || 'insert';
    const id = Number(document.getElementById('tempFormID').value);

    const type_of_value = document.getElementById('valueassignedto').value.trim();
    const description = document.getElementById('description').value.trim();
    const condition = document.getElementById('condition').value.trim();
    const fixedvalue = document.getElementById('fixedvalue').value.trim();
    const hsncode = document.getElementById('hsncode').value.trim();

    if (!type_of_value || !description || !condition || !fixedvalue || !hsncode) {
        return showToast('All fields are required.');
    }

    try {
        if (mode === 'insert') {
            const exists = dropdownListData.some(d =>
                d.description?.toLowerCase() === description.toLowerCase() &&
                d.type_of_value?.toLowerCase() === type_of_value.toLowerCase()
            );

            if (exists) return showToast('Item already exists.');

            const { error } = await supabaseClient
                .from('dropdown_list')
                .insert([{
                    type_of_value,
                    description,
                    condition,
                    value: fixedvalue,
                    hsn_code: hsncode,
                    company_id: CompanyID,
                    created_by: UserLoginID,
                    created_at: localtimeStamp
                }]);

            if (error) throw error;
            showToast('Dropdown item added.');

        } else {
            const { error } = await supabaseClient
                .from('dropdown_list')
                .update({
                    type_of_value,
                    description,
                    condition,
                    value: fixedvalue,
                    hsn_code: hsncode
                })
                .eq('id', id);

            if (error) throw error;
            showToast('Dropdown item updated.');
        }

        resetDropdownForm();
        await fetchDropdownList();

    } catch (err) {
        console.error(err);
        showToast('Save failed.');
    }
}


/*************************************************
 * DELETE
 *************************************************/
async function deleteDropdownItem(id, event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    try {
        const { error } = await supabaseClient
            .from('dropdown_list')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Deleted successfully.');
        await fetchDropdownList();

    } catch (err) {
        console.error(err);
        showToast('Delete failed.');
    }
}

/*************************************************
 * EDIT
 *************************************************/
function editDropdownDetails(id, valueAssignedTo, description, condition, fixedValue, hsnCode, event) {
    if (event) event.preventDefault();
    if (!canModify()) return;

    document.getElementById('tempFormID').value = id;
    document.getElementById('valueassignedto').value = valueAssignedTo;
    document.getElementById('description').value = description;
    document.getElementById('condition').value = condition;
    document.getElementById('fixedvalue').value = fixedValue;
    document.getElementById('hsncode').value = hsnCode;

    const btn = document.getElementById('addDropdownMenuList');
    btn.innerText = 'Edit';
    btn.classList.replace('btn-primary', 'btn-warning');
    btn.dataset.mode = 'update';
}

/*************************************************
 * RESET FORM
 *************************************************/
function resetDropdownForm() {
    document.getElementById('tempFormID').value = '';
    ['valueassignedto', 'description', 'condition', 'fixedvalue', 'hsncode']
        .forEach(id => document.getElementById(id).value = '');

    const btn = document.getElementById('addDropdownMenuList');
    btn.innerText = 'Add';
    btn.classList.replace('btn-warning', 'btn-primary');
    btn.dataset.mode = 'insert';
}

/*************************************************
 * DATALISTS
 *************************************************/
function populateDropdownDatalists() {
    const assignedList = document.getElementById('valueAssignedToSuggestions');
    const descriptionList = document.getElementById('descriptionSuggestions');

    if (!assignedList || !descriptionList) return;

    assignedList.innerHTML = '';
    descriptionList.innerHTML = '';

    const assignedSet = new Set();
    const descriptionSet = new Set();

    dropdownListData.forEach(d => {
        if (d.type_of_value) assignedSet.add(d.type_of_value);
        if (d.description) descriptionSet.add(d.description);
    });

    assignedSet.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        assignedList.appendChild(o);
    });

    descriptionSet.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        descriptionList.appendChild(o);
    });
}

/*************************************************
 * FILTERS (INIT ONCE)
 *************************************************/
function setupFilterListeners() {
    if (filtersInitialized) return;
    filtersInitialized = true;

    const inputs = [
        'valueassignedto',
        'description',
        'condition',
        'fixedvalue',
        'hsncode'
    ].map(id => document.getElementById(id));

    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('input', applyDropdownFilters);
    });
}

function applyDropdownFilters() {
    const filters = {
        assigned: document.getElementById('valueassignedto').value.toLowerCase(),
        desc: document.getElementById('description').value.toLowerCase(),
        cond: document.getElementById('condition').value.toLowerCase(),
        value: document.getElementById('fixedvalue').value.toLowerCase(),
        hsn: document.getElementById('hsncode').value.toLowerCase()
    };

    document.querySelectorAll('#dropdownListTable tbody tr').forEach(row => {
        const cells = row.cells;
        const visible =
            (!filters.assigned || cells[1].textContent.toLowerCase().includes(filters.assigned)) &&
            (!filters.desc || cells[2].textContent.toLowerCase().includes(filters.desc)) &&
            (!filters.cond || cells[3].textContent.toLowerCase().includes(filters.cond)) &&
            (!filters.value || cells[4].textContent.toLowerCase().includes(filters.value)) &&
            (!filters.hsn || cells[5].textContent.toLowerCase().includes(filters.hsn));

        row.style.display = visible ? '' : 'none';
    });
}
