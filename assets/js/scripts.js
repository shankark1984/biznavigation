document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger');
    const menuBar = document.querySelector('.menu-bar');
    const menuItems = document.querySelector('.menu-items');
    const userInfo = document.querySelector('.user-info');
    const logoutBtn = document.querySelector('.logout-btn');
    const userLoginIDSpan = document.getElementById('userLoginID');

    if (hamburger && menuBar && menuItems && userInfo) {
        hamburger.addEventListener('click', function () {
            menuBar.classList.toggle('active');
            menuItems.classList.toggle('active');
            userInfo.classList.toggle('active');
        });
    } else {
        console.error('One or more menu elements not found');
    }

    function loadUserInfo() {
        const userLoginID = localStorage.getItem('UserLoginID');
        if (userLoginID && userLoginIDSpan) {
            userLoginIDSpan.textContent = userLoginID;
        } else {
            // If no user is logged in, redirect to login page
            window.location.href = 'index.html';
        }
    }

    function logout() {
        logoutlocalstorage();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('Logout button not found');
    }


    // Load user info when the page loads
    loadUserInfo();
});





// Load Party Details from Supabase
async function getPartyDetails(partyName, companyID, callback) {
    try {
        const { data, error } = await supabaseClient
            .from('party_details') // Replace 'PartyDetails' with the actual table name
            .select('*') // Select all columns or specify the ones you need
            .eq('company_id', companyID) // Assuming companyID is a column
            .eq('party_name', partyName); // Assuming partyName is a column

        if (error) {
            console.log("Error fetching party details:", error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.log("No matching party details found.");
            return;
        }

        // Map the results to a partyDetails object
        const partyDetails = data.map(row => ({
            partyCode: row.party_code,
            partyType: row.party_type, // Replace with actual column names
            partyName: row.party_name,
            contactNumber: row.contact_number,
            emailID: row.email_id,
            address: row.address,
            city: row.city,
            pinCode: row.pin_code,
            state: row.state,
            country: row.country,
            panNumber: row.pan_number,
            gSTNumber: row.gst_number,
            defaultTax: row.default_tax,
            currentStatus: row.current_status,
            deActiveDate: row.deActiveDate,
            // Add other fields as necessary
        }));

        // Invoke the callback with the party details
        callback(partyDetails);

    } catch (err) {
        console.log("Error fetching party details:", err.message);
    }
}



