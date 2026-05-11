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
        setupFilterListeners();


    } catch (err) {
        console.error(err);
        showToast('Failed to load dropdown list.');
    } finally {
        hideLoader();
    }
}

valueassignedto.addEventListener('input', () => {
    filterDescriptionByAssigned();
    applyDropdownFilters();
});

descriptionInput.addEventListener('input', applyDropdownFilters);


function filterDescriptionByAssigned() {
    const selectedAssigned = valueassignedto.value.trim().toLowerCase();
    const descriptionList = document.getElementById('descriptionSuggestions');

    if (!descriptionList) return;

    descriptionList.innerHTML = '';

    const filteredDescriptions = dropdownListData
        .filter(d => !selectedAssigned || d.type_of_value.toLowerCase() === selectedAssigned)
        .map(d => d.description);

    const uniqueDescriptions = [...new Set(filteredDescriptions)];

    descriptionList.innerHTML = uniqueDescriptions
        .map(desc => `<option value="${desc}">`)
        .join('');
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
document.getElementById('addDropdownMenuList')
    .addEventListener('click', saveDropdownItem);

async function saveDropdownItem() {
    if (!canModify()) return alert('No permission.');

    const btn = document.getElementById('addDropdownMenuList');
    const mode = btn.dataset.mode || 'insert';
    const id = Number(document.getElementById('tempFormID').value);

    const type_of_value = valueassignedto.value.trim();
    const description = descriptionInput.value.trim();
    const condition = conditionInput.value.trim() || "No Condition";
    const fixedvalueRaw = fixedvalueInput.value.trim();
    const hsncodeRaw = hsncodeInput.value.trim();
    const fixedvalue = fixedvalueRaw === '' ? null : fixedvalueRaw;
    const hsncode = hsncodeRaw === '' ? null : hsncodeRaw;


    if (!type_of_value || !description) {
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
        setupFilterListeners();

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
/**
 * Applies filters to the dropdown list table.
 * The filters are based on the values of the input fields in the form.
 * If a filter value is empty, it is ignored.
 * The function loops through all the rows in the table and checks if
 * the values of the cells in the row match the filter values. If they do,
 * the row is displayed, otherwise it is hidden.
 * If no rows match the filter values, a "No matching records" message is displayed.
 */
function applyDropdownFilters() {
    const assigned = valueassignedto.value.trim().toLowerCase();
    const desc = descriptionInput.value.trim().toLowerCase();
    const cond = conditionInput.value.trim().toLowerCase();
    const value = fixedvalueInput.value.trim().toLowerCase();
    const hsn = hsncodeInput.value.trim().toLowerCase();

    const tbody = document.querySelector('#dropdownListTable tbody');
    const rows = tbody.querySelectorAll('tr');

    let visibleCount = 0;

    // ✅ remove old "no data"
    document.getElementById('noDataRow')?.remove();

    rows.forEach(row => {
        const cells = row.cells;

        if (cells.length < 6) return; // ✅ critical fix

        const match =
            (!assigned || cells[1].textContent.trim().toLowerCase() === assigned) &&
            (!desc || cells[2].textContent.trim().toLowerCase() === desc) &&
            (!cond || cells[3].textContent.toLowerCase().includes(cond)) &&
            (!value || cells[4].textContent.toLowerCase().includes(value)) &&
            (!hsn || cells[5].textContent.toLowerCase().includes(hsn));

        row.style.display = match ? '' : 'none';

        if (match) visibleCount++;
    });

    if (visibleCount === 0 && rows.length > 0) {
        const tr = document.createElement('tr');
        tr.id = 'noDataRow';
        tr.innerHTML = `<td colspan="7" class="text-muted text-center">No matching records</td>`;
        tbody.appendChild(tr);
    }
}

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
        input.addEventListener('input', applyDropdownFilters);
        input.addEventListener('change', applyDropdownFilters);
    });
}