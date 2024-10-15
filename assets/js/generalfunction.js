document.addEventListener('DOMContentLoaded', function () {
    // Array of button IDs to disable
    const buttonIds = ['newButton', 'modifyButton', 'deleteButton', 'reportButton', 'saveButton'];

    // Disable each button if it exists
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = true;
        }
    });
});

// Enable all form inputs
function enableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = false);
}
// Disable all form inputs
function disableForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => input.disabled = true);
}
// Clear all input fields and select elements
function clearForm() {
    const inputs = document.querySelectorAll('#userForm input, #userForm select, #userForm textarea');
    inputs.forEach(input => {
        input.value = '';  // Reset the value
        if (input.type === 'checkbox') {
            input.checked = false;  // Uncheck if it's a checkbox
        }
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;  // Reset the select to the first option
        }
    });
}

async function loadcompanyShortCode() {
    try {
        // Query Supabase table to fetch company profile data
        const { data, error } = await supabaseClient
            .from('company_profile') // Replace 'CompanyProfile' with your actual table name in Supabase 
            .select('company_id, short_code');

        if (error) {
            throw error;  // Handle errors
        }

        if (!data || data.length === 0) {
            console.error("No data found in the Supabase table.");
            return;
        }

        // Loop through the fetched data and store relevant information
        data.forEach(row => {
            const companyid = row.company_id;
            const shortCode = row.short_code;
            let CompanyID = localStorage.getItem('CompanyID');

            // Assuming 'companyID' is available in your scope
            if (companyid === CompanyID) {
                localStorage.setItem('companyShortCode', shortCode); // Store shortCode in localStorage
            }
        });

        // Log the stored data for verification
        console.log("Stored Company Short Codes:", localStorage.getItem('companyShortCode'));

    } catch (error) {
        console.error("Error fetching data from Supabase:", error.message);
        alert("Failed to load data. Please try again later.");
    }
}

// Load the data once the page is ready
document.addEventListener('DOMContentLoaded', function () {
    loadcompanyShortCode();
});
