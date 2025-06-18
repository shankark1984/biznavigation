// Reference to input fields and datalist
const userIDInput = document.getElementById('userID');
const userNameInput = document.getElementById('userName');
const userLoginList = document.getElementById('userLoginList');
const userAccessInput = document.getElementById("userAccess");
const formNameList = document.getElementById("formNameList");
const roleTableBody = document.getElementById("roleTableBody");
const addUserRoleBtn = document.getElementById("addUserRole");

let cachedUsers = []; // Store user data to avoid redundant API calls
let cachedForms = []; // Store form data to reduce API calls

// Function to fetch user data from Supabase
async function fetchUserData() {
    if (cachedUsers.length > 0) return cachedUsers;
    try {
        const { data, error } = await supabaseClient
            .from('user_login')
            .select('user_login_id, user_name')
            .eq('company_id', CompanyID)
            .order('user_login_id', { ascending: true });

        if (error) throw error;
        cachedUsers = data;
        return data;
    } catch (err) {
        console.error('Error fetching user data:', err);
        return [];
    }
}

// Function to populate datalist when input is focused
document.getElementById("userID").addEventListener("focus", async function () {
    const userLoginList = document.getElementById("userLoginList");
    userLoginList.innerHTML = ""; // Clear existing options

    const users = await fetchUserData();
    users.forEach(form => {
        const option = document.createElement("option");
        option.value = form.user_login_id;
        userLoginList.appendChild(option);
    });
});

// Function to check user type and fetch form details from Supabase
async function fetchFormDetails() {
    if (cachedForms.length > 0) return cachedForms;

    try {
        // Check user type from user_login table
        const { data: userData, error: userError } = await supabaseClient
            .from("user_login")
            .select("user_type")
            .eq("user_login_id", UserLoginID)  // Ensure userLoginID is defined
            .single();

        if (userError) throw userError;

        // If user_type is not 1, exclude 'UserAccessRules' from FormDetails
        let query = supabaseClient.from("FormDetails").select("FormName, FormDescription");

        if (userData.user_type !== 1) {
            query = query.neq("FormName", "UserAccessRules");
        }

        const { data, error } = await query;

        if (error) throw error;

        cachedForms = data;
        return data;
    } catch (err) {
        console.error("Error fetching form details:", err);
        return [];
    }
}

// Function to populate datalist when input is focused
document.getElementById("userAccess").addEventListener("focus", async function () {
    const formNameList = document.getElementById("formNameList");
    formNameList.innerHTML = ""; // Clear existing options

    const forms = await fetchFormDetails();
    forms.forEach(form => {
        const option = document.createElement("option");
        option.value = form.FormName;
        formNameList.appendChild(option);
    });
});


// Function to populate the datalist
function populateDatalist(list, items, valueKey, textKey) {
    list.innerHTML = "";
    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = item[textKey] || item[valueKey];
        list.appendChild(option);
    });
}

// Function to find user name by user login ID
function findUserName(userID) {
    const user = cachedUsers.find(user => user.user_login_id === userID);
    return user ? user.user_name : '';
}

// Debounce function to limit API calls while typing
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

// Event listeners
userIDInput.addEventListener('input', debounce(async () => {
    const users = await fetchUserData();
    populateDatalist(userLoginList, users, "user_login_id", "user_name");
}, 300));

userIDInput.addEventListener('change', () => {
    userNameInput.value = findUserName(userIDInput.value);
    if (userIDInput.value) fetchUserRoles(userIDInput.value);
});

// Handle form search input
userAccessInput.addEventListener("input", debounce(async () => {
    const searchText = userAccessInput.value.trim().toLowerCase();
    if (!searchText) return;
    const forms = await fetchFormDetails();
    const filteredForms = forms.filter(form => form.FormName.toLowerCase().includes(searchText));
    populateDatalist(formNameList, filteredForms, "FormName", "FormDescription");
}, 300));

// Function to fetch user roles from Supabase
async function fetchUserRoles(userLoginID) {
    try {
        const { data, error } = await supabaseClient
            .from("UserAccessRules")
            .select("*")
            .eq("UserLoginID", userLoginID);
        if (error) throw error;
        updateRoleTable(data);
    } catch (err) {
        console.error("Error fetching user roles:", err);
    }
}

// Function to add a new user role to Supabase
async function addUserRole() {
    const userLoginID = userIDInput.value;
    const formID = userAccessInput.value;
    const form = cachedForms.find(f => f.FormName == formID);
    console.log(userLoginID + ' 1 ' + formID + ' 1 ' + form);

    if (!userLoginID || !formID || !form) {

        console.log(userLoginID + ' 2 ' + formID + ' 2 ' + form);

        alert("Please select a valid user and form.");
        return;
    }

    try {
        // Check for duplicate entry
        const { data: existingRoles, error: fetchError } = await supabaseClient
            .from("UserAccessRules")
            .select("id")
            .eq("UserLoginID", userLoginID)
            .eq("FormID", formID);

        if (fetchError) throw fetchError;

        if (existingRoles.length > 0) {
            alert("This user already has access to the selected form.");
            return;
        }

        // Prepare new role object
        const newRole = {
            UserLoginID: userLoginID,
            FormID: formID,
            FromDescription: form.FormDescription,
            Read: document.getElementById("roleRead").checked,
            Write: document.getElementById("roleWrite").checked,
            Delete: document.getElementById("roleDelete").checked,
            Update: document.getElementById("roleUpdate").checked,
            created_by: userLoginID,
        };

        // Insert new role
        const { error: insertError } = await supabaseClient
            .from("UserAccessRules")
            .insert([newRole]);

        if (insertError) throw insertError;

        // Refresh user roles after successful insertion
        fetchUserRoles(userLoginID);
    } catch (err) {
        console.error("Error adding user role:", err);
        alert("An error occurred while adding the user role. Please try again.");
    }
}


// Function to delete a user role
async function deleteUserRole(roleID, userLoginID) {
    try {
        const { error } = await supabaseClient.from("UserAccessRules").delete().eq("id", roleID);
        if (error) throw error;
        fetchUserRoles(userLoginID);
    } catch (err) {
        console.error("Error deleting user role:", err);
    }
}

// Function to update the role table
function updateRoleTable(roles) {
    roleTableBody.innerHTML = roles.length === 0 ? `<tr><td colspan="6" class="text-center">No roles created</td></tr>` : roles.map(role => `
        <tr>
            <td>${role.FromDescription}</td>
            <td>${role.Read ? "✔" : "✖"}</td>
            <td>${role.Write ? "✔" : "✖"}</td>
            <td>${role.Delete ? "✔" : "✖"}</td>
            <td>${role.Update ? "✔" : "✖"}</td>
            <td>
                <button class="btn btn-danger btn-sm delete-role" data-roleid="${role.id}" data-userid="${role.UserLoginID}">Delete</button>
            </td>
        </tr>`).join('');

    document.querySelectorAll(".delete-role").forEach(button => {
        button.addEventListener("click", function () {
            deleteUserRole(this.getAttribute("data-roleid"), this.getAttribute("data-userid"));
        });
    });
}

// Event listener for adding a role
addUserRoleBtn.addEventListener("click", addUserRole);

// Preload form details
fetchFormDetails();
