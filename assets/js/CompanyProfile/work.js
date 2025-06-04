// Fetch company data from Supabase
async function fetchCompanyData() {
    try {
        const { data, error } = await supabaseClient
            .from('company_profile')
            .select('*')
            .eq('company_id', companyID)
            .single();

        if (error) {
            console.error('Error fetching company data:', error.message);
            alert('Failed to load company data.');
        } else if (data) {
            populateCompanyForm(data);
        }
    } catch (error) {
        console.error('Unexpected error fetching data:', error);
        alert('An unexpected error occurred while fetching company data.');
    }
}

// Populate form fields with the company data
function populateCompanyForm(companyData) {
    document.getElementById('CompID').textContent = companyData.company_id || '';
    document.getElementById('shortCode').value = companyData.short_code || '';
    document.getElementById('companyName').value = companyData.company_name || '';
    document.getElementById('address').value = companyData.address || '';
    document.getElementById('city').value = companyData.city || '';
    document.getElementById('pinCode').value = companyData.pin_code || '';
    document.getElementById('state').value = companyData.state || '';
    document.getElementById('country').value = companyData.country || '';
    document.getElementById('phoneNumber').value = companyData.phone_no || '';
    document.getElementById('email').value = companyData.e_mail || '';
    document.getElementById('gstNumber').value = companyData.gst_number || '';
    document.getElementById('panNumber').value = companyData.pan_number || '';
    document.getElementById('cinNo').value = companyData.cin_no || '';
    document.getElementById('uaNo').value = companyData.Udyog_aadhaar_no || '';
    document.getElementById('website').value = companyData.web_site || '';
    document.getElementById('companylogo').src = companyData.logo_path || '';

    handleUserTypePermissions();
}