document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pincodeForm');
    const tableBody = document.getElementById('pincodeTableBody');


    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Sanitize inputs
        const pincode = DOMPurify.sanitize(form.pincode.value.trim());
        const areaName = DOMPurify.sanitize(form.areaName.value.trim());
        const city = DOMPurify.sanitize(form.city.value.trim());
        const state = DOMPurify.sanitize(form.state.value.trim());
        const country = DOMPurify.sanitize(form.country.value.trim());
        const serviceType = DOMPurify.sanitize(form.serviceType.value);

        // Prepare object to insert
        const newPincode = {
            pincode: pincode,
            areaname: areaName,
            cityname: city,
            statename: state,
            country: country,
            servicetype: serviceType,
            created_by: UserLoginID,
            created_at: localtimeStamp,
            company_id: CompanyID,
        };

        try {
            const { data, error } = await supabaseClient
                .from('ServiceablePincode')
                .insert([newPincode]);

            if (error) {
                console.error('Error inserting data:', error);
                alert('Failed to save data. Please try again.');
                return;
            }

            // Append new data to table
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${pincode}</td>
        <td>${areaName}</td>
        <td>${city}</td>
        <td>${state}</td>
        <td>${country}</td>
        <td>${serviceType}</td>
        
      `;
            tableBody.appendChild(row);

            form.reset();
            alert('Pincode details saved successfully.');
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        }
    });
});
