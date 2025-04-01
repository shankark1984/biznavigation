// Function to check user permissions
async function checkAccess(userLoginID, formID) {

    try {
        const { data, error } = await supabaseClient
            .from('UserAccessRules')
            .select('Read, Write, Delete, Update')
            .eq('UserLoginID', userLoginID)
            .eq('FormID', formID)
            .maybeSingle();  // Allows 0 rows without throwing an error

        if (error) {
            console.error('Database error:', error);
            alert('Error checking permissions. Please try again.');
            return false;
        }

        if (!data) {
            alert('Permission denied. Kindly contact your administrator.');
            return false;
        }

        // Assign permissions to global variables
        perRead = data.Read;
        perWrite = data.Write;
        perDelete = data.Delete;
        perUpdate = data.Update;


        // If at least Read permission is available, return true, else false
        if (perRead) {
            return true;
        } else {
            alert('Permission denied. Kindly contact your administrator.');
            return false;
        }
    } catch (err) {
        console.error('Error fetching permissions:', err);
        alert('An unexpected error occurred.');
        return false;
    }
}

// Event listener for menu click
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async function (e) {
            e.preventDefault(); // Stop default navigation immediately

            // let userLoginID = localStorage.getItem('UserLoginID'); // Fetch user ID from session/local storage
            formID = this.getAttribute('data-form-id'); // Get FormID from menu item
            let targetURL = this.getAttribute('href'); // Page URL

            console.log('Checking access for UserLoginID:', userLoginID, 'FormID:', formID);

            if (!userLoginID || !formID) {
                alert('Invalid user or form data.');
                return;
            }

            let hasAccess = await checkAccess(userLoginID, formID);


            if (hasAccess) {
                console.log('Access granted, navigating to:', targetURL);
                window.location.href = targetURL; // Redirect only if access is granted
            } else {
                console.log('Access denied, staying on the current page.');
            }
        });
    });
});

