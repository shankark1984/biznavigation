/*************************************************
 * GLOBAL STATE
 *************************************************/
let dropdownListData = [];
let filtersInitialized = false;
let dropdownMenuListTabInitialized = false;

const valueassignedto = document.getElementById('valueassignedto');
const descriptionInput = document.getElementById('description');
const conditionInput = document.getElementById('condition');
const fixedvalueInput = document.getElementById('fixedvalue');
const hsncodeInput = document.getElementById('hsncode');
const tempFormID = document.getElementById('tempFormID');


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
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!data?.length) {
            dropdownListData = [];
            populateDropdownDatalists();
            return;
        }

        const fragment = document.createDocumentFragment();

        dropdownListData = data.map((item, i) => {
            const tr = document.createElement('tr');

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

            fragment.appendChild(tr);

            return {
                type_of_value: item.type_of_value,
                description: item.description,
                condition: item.condition,
                value: item.value,
                hsn_code: item.hsn_code
            };
        });

        tbody.appendChild(fragment);

        populateDropdownDatalists();

    } catch (err) {
        console.error(err);
        showToast('Failed to load dropdown list.');
    } finally {
        hideLoader();
    }
}

/*************************************************
 * EVENT DELEGATION (FAST)
 *************************************************/
function attachTableEvents() {
    const tbody = document.querySelector('#dropdownListTable tbody');
    if (!tbody) return;

    tbody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        // EDIT
        if (e.target.closest('.edit-btn-dropdownitem')) {
            editDropdownDetails(
                row.dataset.id,
                row.dataset.typeOfValue,
                row.dataset.description,
                row.dataset.condition,
                row.dataset.value,
                row.dataset.hsnCode
            );
        }

        // DELETE
        if (e.target.closest('.delete-btn-dropdownitem')) {
            if (!confirm(`Delete "${row.dataset.description}" ?`)) return;
            await deleteDropdownItem(row.dataset.id);
        }
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

    const type_of_value = valueassignedto.value.trim();
    const description = descriptionInput.value.trim();
    const condition = conditionInput.value.trim();
    const fixedvalue = fixedvalueInput.value.trim();
    const hsncode = hsncodeInput.value.trim();

    if (!type_of_value || !description || !condition || !fixedvalue || !hsncode) {
        return showToast('All fields are required.');
    }

    try {
        if (mode === 'insert') {

            const exists = dropdownListData.some(d =>
                d.description.toLowerCase() === description.toLowerCase() &&
                d.type_of_value.toLowerCase() === type_of_value.toLowerCase()
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
async function deleteDropdownItem(id) {
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
function editDropdownDetails(id, valueAssignedTo, desc, cond, val, hsn) {
    if (!canModify()) return;

    tempFormID.value = id;
    valueassignedto.value = valueAssignedTo;
    descriptionInput.value = desc;
    conditionInput.value = cond;
    fixedvalueInput.value = val;
    hsncodeInput.value = hsn;

    const btn = document.getElementById('addDropdownMenuList');
    btn.innerText = 'Edit';
    btn.classList.replace('btn-primary', 'btn-warning');
    btn.dataset.mode = 'update';
}

/*************************************************
 * RESET FORM
 *************************************************/
function resetDropdownForm() {
    tempFormID.value = '';
    [valueassignedto, descriptionInput, conditionInput, fixedvalueInput, hsncodeInput]
        .forEach(el => el.value = '');

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

    assignedList.innerHTML = [...assignedSet].map(v => `<option value="${v}">`).join('');
    descriptionList.innerHTML = [...descriptionSet].map(v => `<option value="${v}">`).join('');
}

/*************************************************
 * FILTERS
 *************************************************/
function setupFilterListeners() {
    if (filtersInitialized) return;
    filtersInitialized = true;

    const inputs = [
        valueassignedto,
        descriptionInput,
        conditionInput,
        fixedvalueInput,
        hsncodeInput
    ];

    inputs.forEach(input => {
        ['input', 'change', 'keyup'].forEach(evt => {
            input.addEventListener(evt, applyDropdownFilters);
        });
    });
}

function applyDropdownFilters() {
    const filters = {
        assigned: valueassignedto.value.trim().toLowerCase(),
        desc: descriptionInput.value.trim().toLowerCase(),
        cond: conditionInput.value.trim().toLowerCase(),
        value: fixedvalueInput.value.trim().toLowerCase(),
        hsn: hsncodeInput.value.trim().toLowerCase()
    };

    const rows = document.querySelectorAll('#dropdownListTable tbody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const cells = row.cells;

        const visible =
            (!filters.assigned || cells[1].textContent.toLowerCase().includes(filters.assigned)) &&
            (!filters.desc || cells[2].textContent.toLowerCase().includes(filters.desc)) &&
            (!filters.cond || cells[3].textContent.toLowerCase().includes(filters.cond)) &&
            (!filters.value || cells[4].textContent.toLowerCase().includes(filters.value)) &&
            (!filters.hsn || cells[5].textContent.toLowerCase().includes(filters.hsn));

        row.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
    });

    // Optional: No data message
    const tbody = document.querySelector('#dropdownListTable tbody');
    if (visibleCount === 0 && rows.length > 0) {
        if (!document.getElementById('noDataRow')) {
            const tr = document.createElement('tr');
            tr.id = 'noDataRow';
            tr.innerHTML = `<td colspan="7" class="text-muted">No matching records</td>`;
            tbody.appendChild(tr);
        }
    } else {
        document.getElementById('noDataRow')?.remove();
    }
}


// /*************************************************
//  * INIT
//  *************************************************/
// document.getElementById('dropdownListdetails-tab')
//     ?.addEventListener('shown.bs.tab', initDropdownTab);

// async function initDropdownTab() {
//     if (dropdownMenuListTabInitialized) return;
//     dropdownMenuListTabInitialized = true;

//     createLoader();

//     const addBtn = document.getElementById('addDropdownMenuList');
//     if (!addBtn) return;

//     // Prevent duplicate listeners
//     addBtn.onclick = saveDropdownItem;

//     const checkPermission = () => {
//         addBtn.disabled = !canModify();
//     };

//     checkPermission();
//     setTimeout(checkPermission, 150);

//     await fetchDropdownList();
//     setupFilterListeners();
//     attachTableEvents(); // ✅ delegated events
// }
