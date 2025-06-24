// Element References
const userIDInput = document.getElementById('userID');
const userNameInput = document.getElementById('userName');
const userAccessFormName = document.getElementById('userAccessFormName');
const userAccessFormID = document.getElementById('userAccessFormID');
const saveSpinner = document.getElementById('saveSpinner');
const addUserRoleButton = document.getElementById('addUserRole');
const roleTableBody = document.getElementById('roleTableBody');
const emptyRoleRow = document.getElementById('emptyRoleRow');
const formSuggestions = document.getElementById('formNameListSuggestion');

let existingForms = new Set();
let formDetailsMap = {};
let userRoles = [];

// On DOM load
document.addEventListener("DOMContentLoaded", async () => {
    if (!await checkAccess(UserLoginID, 'UserAccessRules')) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }
    handleUserTypePermissions();
    if (perWrite) {
        saveButton.disabled = false;
        newButton.disabled = false; // Enable new button when form is accessible
        deleteButton.disabled = true;
        modifyButton.disabled = true;
    }
    enableForm();

    await loadSuggestions('userLoginSuggestions', 'EmployeeMaster', CompanyID, 'LoginID', 'EmployeeName');

    userIDInput.addEventListener("change", async () => {
        await loadUserAccessRoles(userNameInput.value);
        await loadFormSuggestions();
        disableForm();
        addUserRoleButton.disabled = true;
        document.querySelectorAll('.remove-role-btn').forEach(btn => btn.disabled = true);
        saveButton.disabled = true;
        modifyButton.disabled = false;

    });
});

// Load Form Suggestions
async function loadFormSuggestions() {
    const { data, error } = await supabaseClient.from('FormDetails').select('FormID, FormDescription');

    if (error) return console.error('Error loading forms:', error);

    formSuggestions.innerHTML = '';
    formDetailsMap = {};

    data.forEach(form => {
        const option = document.createElement('option');
        option.value = form.FormDescription;
        formSuggestions.appendChild(option);
        formDetailsMap[form.FormDescription] = form.FormID;
    });
}

// Auto-fill Form ID on input
userAccessFormName.addEventListener("input", (e) => {
    const formName = e.target.value.trim();
    userAccessFormID.value = formDetailsMap[formName] || '';
});

// Load User Access Roles
async function loadUserAccessRoles(userID) {
    roleTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("UserAccessRules")
        .select("id, FormID, FromDescription, CanRead, CanWrite, CanDelete, CanUpdate")
        .eq("UserLoginID", userID);

    if (error) {
        console.error("Error fetching roles:", error.message);
        roleTableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Failed to load roles</td></tr>`;
        return;
    }

    if (!data.length) {
        roleTableBody.innerHTML = `<tr id="emptyRoleRow"><td colspan="6" class="text-muted text-center">No roles found</td></tr>`;
        return;
    }

    roleTableBody.innerHTML = '';
    userRoles = data.map(role => ({
        id: role.id,
        formID: role.FormID,
        formName: role.FromDescription,
        read: role.CanRead,
        write: role.CanWrite,
        del: role.CanDelete,
        update: role.CanUpdate
    }));

    renderRoleTable();
}

// Render Roles in Table
function renderRoleTable() {
    roleTableBody.innerHTML = '';

    if (userRoles.length === 0) {
        roleTableBody.innerHTML = `<tr id="emptyRoleRow"><td colspan="6" class="text-center">No roles created</td></tr>`;
        return;
    }

    userRoles.forEach(role => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${role.formName}</td>
            <td class="d-none">${role.formID}</td>
            <td class="text-center">${role.read ? '✔️' : '❌'}</td>
            <td class="text-center">${role.write ? '✔️' : '❌'}</td>
            <td class="text-center">${role.del ? '✔️' : '❌'}</td>
            <td class="text-center">${role.update ? '✔️' : '❌'}</td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-danger remove-role-btn">Remove</button>
            </td>
        `;
        roleTableBody.appendChild(tr);
    });
}

// Save Roles
saveButton.addEventListener('click', async () => {
    if (!validateForm()) return;

    saveButton.disabled = true;
    saveSpinner.classList.remove('d-none');

    // Clear previous roles
    const { error: deleteError } = await supabaseClient
        .from('UserAccessRules')
        .delete()
        .eq('UserLoginID', userNameInput.value.trim());

    if (deleteError) console.warn('Previous roles deletion failed:', deleteError);

    const insertData = userRoles.map(role => ({
        UserLoginID: userNameInput.value.trim(),
        FormID: role.formID,
        FromDescription: role.formName,
        CanRead: role.read,
        CanWrite: role.write,
        CanDelete: role.del,
        CanUpdate: role.update,
        created_by: UserLoginID,
        created_at: localtimeStamp
    }));

    const { error: insertError } = await supabaseClient
        .from('UserAccessRules')
        .insert(insertData);

    if (insertError) {
        alert('Error saving roles.');
        console.error(insertError);
    } else {
        alert('Roles saved successfully.');
    }

    saveButton.disabled = false;
    saveSpinner.classList.add('d-none');
});

// Validate Form
function validateForm() {
    let valid = true;

    if (!userIDInput.value.trim()) {
        userIDInput.classList.add('is-invalid');
        valid = false;
    } else {
        userIDInput.classList.remove('is-invalid');
    }

    if (userRoles.length === 0) {
        alert('Please add at least one role.');
        valid = false;
    }

    return valid;
}

// Clear Role Inputs
function clearFormInputs() {
    userAccessFormName.value = '';
    userAccessFormID.value = '';
    document.getElementById('roleRead').checked = false;
    document.getElementById('roleWrite').checked = false;
    document.getElementById('roleDelete').checked = false;
    document.getElementById('roleUpdate').checked = false;
}

// Add Role
addUserRoleButton.addEventListener('click', () => {
    const formName = userAccessFormName.value.trim();
    const formID = userAccessFormID.value.trim(); // Fixed: Should be the Form ID

    if (!formName || !formID) return alert('Please select a valid form.');

    const read = document.getElementById('roleRead').checked;
    const write = document.getElementById('roleWrite').checked;
    const del = document.getElementById('roleDelete').checked;
    const update = document.getElementById('roleUpdate').checked;

    if (!read && !write && !del && !update) return alert('Please select at least one permission.');

    // ✅ Check for duplicates in roleTableBody
    const duplicateFound = Array.from(roleTableBody.rows).some(row => {
        return row.cells[0]?.textContent.trim().toLowerCase() === formName.toLowerCase();
    });

    if (duplicateFound) return alert('Role for this form already exists.');

    // ✅ Add role to userRoles array
    userRoles.push({ formID, formName, read, write, del, update });

    // ✅ Render the updated table
    renderRoleTable();

    // ✅ Clear the input fields
    clearFormInputs();
});


// Remove Role
roleTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-role-btn')) {
        const row = e.target.closest('tr');
        const formName = row.children[0].textContent.trim();

        userRoles = userRoles.filter(role => role.formName !== formName);
        renderRoleTable();
    }
});

newButton.addEventListener('click', () => {
    // Clear input fields
    userIDInput.value = '';
    userNameInput.value = '';
    clearFormInputs();

    // Clear roles
    userRoles = [];
    renderRoleTable();

    // Enable Save button (if you want to make sure it's clickable)
    saveButton.disabled = false;

    // Optional: Reset user suggestions if needed
    // Optional: Focus on user ID input
    userIDInput.focus();
    enableForm();
    addUserRoleButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
});

modifyButton.addEventListener('click', () => {

    // Enable Save button (if you want to make sure it's clickable)
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    // Optional: Reset user suggestions if needed
    // Optional: Focus on user ID input
    userIDInput.focus();
    enableForm();
    addUserRoleButton.disabled = false;
    document.querySelectorAll('.remove-role-btn').forEach(btn => btn.disabled = false);
    modifyButton.disabled = true;
});
