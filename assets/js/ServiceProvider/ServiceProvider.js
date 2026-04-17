document.addEventListener('DOMContentLoaded', () => {

    loadCourierSuggestions();
});

document.getElementById('saveButton').addEventListener('click', async () => {
    clearForm(); // your existing function
    await generateCourierCode();
});

// ================= SUGGESTIONS ================= 
// Function to generate a new code*/
async function generateCourierCode() {
    try {
        const { data, error } = await supabaseClient
            .from('ServiceProviderDetails')
            .select('CourierCode')
            .order('CourierCode', { ascending: false })
            .limit(1);

        if (error) throw error;

        let newCode = 'CR001'; // default

        if (data && data.length > 0 && data[0].CourierCode) {
            const lastCode = data[0].CourierCode;

            // Extract number from code (CR001 → 001)
            const numberPart = lastCode.replace(/\D/g, '');
            const nextNumber = parseInt(numberPart || '0', 10) + 1;

            // Format with leading zeros
            newCode = 'CR' + String(nextNumber).padStart(3, '0');
        }
        document.getElementById('courierCode').value = newCode;

    } catch (err) {
        console.error('Error generating code:', err);
    }
}

async function saveCourierDetails() {
    const form = document.querySelector('.needs-validation');
    const saveBtn = document.getElementById('saveButton');

    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    try {
        saveBtn.disabled = true;

        const courierDetails = {
            CourierCode: document.getElementById('courierCode').value,
            CourierName: document.getElementById('courierName').value,
            Status: document.getElementById('serviceProviderStatus').value,
            De_ActiveDate: document.getElementById('deActiveDate').value || null,
            ContactPerson: document.getElementById('partyContactPerson').value,
            ContactNumber: document.getElementById('phoneNumber').value,
            EmailID: document.getElementById('emailID').value,
            company_id: CompanyID
        };

        let response;

        // ==========================
        // INSERT
        // ==========================
        if (mode === "insert") {

            courierDetails.created_by = UserLoginID;
            courierDetails.created_at = new Date().toISOString();

            response = await supabaseClient
                .from('ServiceProviderDetails')
                .insert([courierDetails]);

        }

        // ==========================
        // UPDATE
        // ==========================
        if (mode === "update") {

            courierDetails.updated_by = UserLoginID;
            courierDetails.updated_at = new Date().toISOString();

            response = await supabaseClient
                .from('ServiceProviderDetails')
                .update(courierDetails)
                .eq('CourierCode', courierDetails.CourierCode)
                .eq('company_id', CompanyID);

        }

        if (response.error) throw response.error;

        alert(mode === "insert"
            ? 'Courier details saved successfully!'
            : 'Courier details updated successfully!');

        // Optional: reset form
        // clearForm();

    } catch (err) {
        console.error('Error saving courier details:', err);
        alert(err.message || 'Failed to save courier details.');
    } finally {
        saveBtn.disabled = false;
    }
}


