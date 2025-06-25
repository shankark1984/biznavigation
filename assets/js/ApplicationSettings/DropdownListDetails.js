// Global variable to store dropdown list data
let dropdownListData = [];

// Helper function to safely escape strings for HTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/'/g, "\\'");
}

// Helper function to safely capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Fetch dropdown list data from Supabase
async function fetchDropdownList() {
    try {
        let query = supabaseClient
            .from('dropdown_list')
            .select('*');

        if (UserType !== 1) {
            // Admin and below: Only get items for their company or 'All'
            query = query.in('company_id', ['All', CompanyID]);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching dropdown list:', error);
            alert('Failed to fetch dropdown list data.');
            return;
        }

        const tableBody = document.querySelector('#dropdownMenuTable tbody');
        tableBody.innerHTML = ''; // Clear previous data

        if (!data || data.length === 0) {
            console.log('No dropdown list items found');
            return;
        }

        // Sort by type_of_value
        data.sort((a, b) => (a.type_of_value || '').localeCompare(b.type_of_value || ''));

        data.forEach(item => {
            const row = document.createElement('tr');

            const isGlobalItem = item.company_id === 'All';
            const canEdit = (UserType === 1) || (UserType === 2 && !isGlobalItem && item.company_id === CompanyID);
            const canDelete = canEdit;

            row.innerHTML = `
                <td>${escapeHtml(item.type_of_value)}</td>
                <td>${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.condition)}</td>
                <td>${item.value || 0}</td>
                <td>${escapeHtml(item.hsn_code)}</td>
                <td>
                    ${canEdit ? `
                        <button type="button" class="btn btn-sm btn-warning me-1" 
                            onclick="editDropdownItem(${item.id}, '${escapeHtml(item.type_of_value)}', 
                            '${escapeHtml(item.description)}', '${escapeHtml(item.condition)}', 
                            ${item.value || 0}, '${escapeHtml(item.hsn_code)}', event)" 
                            title="Edit"><i class="bi bi-pencil-square"></i></button>
                    ` : ''}
                    ${canDelete ? `
                        <button type="button" class="btn btn-sm btn-danger me-1"
                            onclick="deleteDropdownItem(${item.id}, event)" 
                            title="Delete"><i class="bi bi-trash"></i></button>
                    ` : ''}
                    ${!canEdit && !canDelete ? `<span class="text-muted small">Read Only</span>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        dropdownListData = data;
        populateDropdownSuggestions();

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Unexpected error loading dropdown list.');
    }
}

// Populate datalist suggestions
function populateDropdownSuggestions() {
    const valueAssignedToList = document.getElementById('valueAssignedToSuggestions');
    const descriptionList = document.getElementById('descriptionSuggestions');

    valueAssignedToList.innerHTML = '';
    descriptionList.innerHTML = '';

    const uniqueValues = [...new Set(dropdownListData.map(item => item.type_of_value))];
    const uniqueDescriptions = [...new Set(dropdownListData.map(item => item.description))];

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        valueAssignedToList.appendChild(option);
    });

    uniqueDescriptions.forEach(desc => {
        const option = document.createElement('option');
        option.value = desc;
        descriptionList.appendChild(option);
    });
}

// Add or update dropdown list item
async function addDropdownItem() {
    const valueAssignedTo = capitalize(document.getElementById('valueassignedto').value.trim());
    const description = capitalize(document.getElementById('description').value.trim());
    const condition = capitalize(document.getElementById('condition').value.trim());
    const fixedValue = parseFloat(document.getElementById('fixedvalue').value) || 0;
    const hsnCode = document.getElementById('hsncode').value.trim();

    if (!valueAssignedTo || !description) {
        alert('Value Assigned To and Description are required fields.');
        return;
    }

    if (UserType !== 1 && UserType !== 2) {
        alert('You do not have permission to modify dropdown items.');
        return;
    }

    if (UserType === 2 && CompanyID === 'All') {
        alert('Admins cannot modify items for global company "All".');
        return;
    }

    const button = document.getElementById('addDropdownMenuList');
    const action = button.innerText;
    const id = document.getElementById('tempFormID').value;

    const itemData = {
        type_of_value: valueAssignedTo,
        description: description,
        condition: condition,
        value: fixedValue,
        hsn_code: hsnCode,
        company_id: CompanyID,
        created_by: userLoginID,
        created_at: localtimeStamp
    };

    if (action === 'Add') {
        const exists = dropdownListData.some(item =>
            item.type_of_value.toLowerCase() === valueAssignedTo.toLowerCase() &&
            item.description.toLowerCase() === description.toLowerCase() &&
            item.company_id === CompanyID
        );

        if (exists) {
            alert('This dropdown item already exists for your company.');
            return;
        }

        const { error } = await supabaseClient
            .from('dropdown_list')
            .insert([itemData]);

        if (error) {
            console.error('Error adding dropdown item:', error);
            alert('Failed to add dropdown item.');
            return;
        }

        alert('Dropdown item added successfully.');
    } else if (action === 'Edit') {
        const originalItem = dropdownListData.find(item => item.id == id);

        if (!originalItem) {
            alert('Original item not found.');
            return;
        }

        if (UserType === 2 && originalItem.company_id === 'All') {
            alert('Admins cannot edit global dropdown items.');
            return;
        }

        if (userType !== 1 && originalItem.company_id !== CompanyID) {
            alert('You can only edit dropdown items for your company.');
            return;
        }

        const { error } = await supabaseClient
            .from('dropdown_list')
            .update(itemData)
            .eq('id', id);

        if (error) {
            console.error('Error updating dropdown item:', error);
            alert('Failed to update dropdown item.');
            return;
        }

        alert('Dropdown item updated successfully.');
    }

    ['valueassignedto', 'description', 'condition', 'fixedvalue', 'hsncode'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('tempFormID').value = '';
    button.innerText = 'Add';

    fetchDropdownList();
}

// Edit dropdown item
function editDropdownItem(id, valueAssignedTo, description, condition, fixedValue, hsnCode, event) {
    event.preventDefault();
    document.getElementById('tempFormID').value = id;
    document.getElementById('valueassignedto').value = valueAssignedTo;
    document.getElementById('description').value = description;
    document.getElementById('condition').value = condition;
    document.getElementById('fixedvalue').value = fixedValue;
    document.getElementById('hsncode').value = hsnCode;
    document.getElementById('addDropdownMenuList').innerText = 'Edit';
}

// Delete dropdown item
async function deleteDropdownItem(id, event) {
    event.preventDefault();
    const item = dropdownListData.find(x => x.id === id);

    if (UserType !== 1 && (item.company_id === 'All' || item.company_id !== CompanyID)) {
        alert('You do not have permission to delete this item.');
        return;
    }

    if (!confirm('Are you sure you want to delete this dropdown item?')) return;

    const { error } = await supabaseClient
        .from('dropdown_list')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting dropdown item:', error);
        alert('Failed to delete dropdown item.');
        return;
    }

    alert('Dropdown item deleted successfully.');
    fetchDropdownList();
}

// Auto-fill form from datalist
document.getElementById('valueassignedto').addEventListener('input', function () {
    const value = this.value;
    const match = dropdownListData.find(item => item.type_of_value === value);

    if (match) {
        document.getElementById('description').value = match.description;
        document.getElementById('condition').value = match.condition;
        document.getElementById('fixedvalue').value = match.fixed_value;
        document.getElementById('hsncode').value = match.hsn_code;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (typeof supabaseClient === 'undefined') {
        console.error('Supabase client not initialized');
        return;
    }
    if (typeof CompanyID === 'undefined' || typeof UserType === 'undefined') {
        console.error('Company ID or userType not defined');
        return;
    }

    fetchDropdownList();

    const addButton = document.getElementById('addDropdownMenuList');
    if (UserType === 1 || UserType === 2) {
        addButton.addEventListener('click', addDropdownItem);
    } else {
        addButton.disabled = true;
        document.querySelectorAll('#dropdownForm input, #dropdownForm select').forEach(input => {
            input.disabled = true;
        });
    }
});
