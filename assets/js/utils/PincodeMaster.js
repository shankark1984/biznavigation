document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('pincodeForm');
    const tableBody = document.getElementById('pincodeTableBody');

    // Assign button references for toggling
    const submitButton = document.getElementById('submitButton');
    let updateButton = document.getElementById('updateButton');
    let resetButton = document.getElementById('resetButton');

    // If update/reset buttons do not exist, create them dynamically
    if (!updateButton) {
        updateButton = document.createElement('button');
        updateButton.type = 'button';
        updateButton.id = 'updateButton';
        updateButton.className = 'btn btn-success w-100 d-none';
        updateButton.textContent = 'Update';
        submitButton.parentElement.appendChild(updateButton);
    }
    if (!resetButton) {
        resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.id = 'resetButton';
        resetButton.className = 'btn btn-secondary w-100 ms-2 d-none';
        resetButton.textContent = 'Cancel';
        submitButton.parentElement.appendChild(resetButton);
    }

    // Hidden input to keep track of editing record id
    let editIdInput = document.getElementById('editId');
    if (!editIdInput) {
        editIdInput = document.createElement('input');
        editIdInput.type = 'hidden';
        editIdInput.id = 'editId';
        form.appendChild(editIdInput);
    }

    // Load existing data into table on page load
    await loadPincodeData();

    // Add new record on form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Sanitize inputs
        const pincode = DOMPurify.sanitize(form.pinCode.value.trim());
        const areaName = DOMPurify.sanitize(form.areaName.value.trim());
        const city = DOMPurify.sanitize(form.city.value.trim());
        const state = DOMPurify.sanitize(form.state.value.trim());
        const country = DOMPurify.sanitize(form.country.value.trim());
        const serviceType = DOMPurify.sanitize(form.serviceType.value);

        const newPincode = {
            Pincode: pincode,
            AreaName: areaName,
            CityName: city,
            StateName: state,
            Country: country,
            ServiceType: serviceType,
            created_by: UserLoginID,      // Make sure these are defined in your scope
            created_at: localtimeStamp,   // E.g., new Date().toISOString()
            company_id: CompanyID,
        };

        try {
            const { data, error } = await supabaseClient
                .from('ServiceablePincode')
                .insert([newPincode])
                .select();

            if (error) {
                console.error('Insert error:', error);
                alert('Failed to save data. Please try again.');
                return;
            }

            if (!data || data.length === 0) {
                alert('Insert succeeded but no data returned.');
                return;
            }

            const insertedRecord = data[0];

            // Append new row in table
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${insertedRecord.Pincode}</td>
        <td>${insertedRecord.AreaName}</td>
        <td>${insertedRecord.CityName}</td>
        <td>${insertedRecord.StateName}</td>
        <td>${insertedRecord.Country}</td>
        <td>${insertedRecord.ServiceType}</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary me-1 edit-row" data-id="${insertedRecord.id}">
            <i class="bi bi-pencil-square"></i> Edit
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-row" data-id="${insertedRecord.id}">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      `;
            tableBody.appendChild(row);

            form.reset();
            alert('Pincode details saved successfully.');
            await loadPincodeData();
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        }
    });

    // Update existing record
    updateButton.addEventListener('click', async () => {
        const id = editIdInput.value;
        if (!id) {
            alert('No record selected for update.');
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Sanitize inputs again
        const pincode = DOMPurify.sanitize(form.pincode.value.trim());
        const areaName = DOMPurify.sanitize(form.areaName.value.trim());
        const city = DOMPurify.sanitize(form.city.value.trim());
        const state = DOMPurify.sanitize(form.state.value.trim());
        const country = DOMPurify.sanitize(form.country.value.trim());
        const serviceType = DOMPurify.sanitize(form.serviceType.value);

        const updatedPincode = {
            Pincode: pincode,
            AreaName: areaName,
            CityName: city,
            StateName: state,
            Country: country,
            ServiceType: serviceType,
        };

        try {
            const { data, error } = await supabaseClient
                .from('ServiceablePincode')
                .update(updatedPincode)
                .eq('id', id)
                .select();

            if (error) {
                console.error('Update error:', error);
                alert('Failed to update data.');
                return;
            }

            if (!data || data.length === 0) {
                alert('Update succeeded but no data returned.');
                return;
            }

            // Reload all data or update the single row manually
            await loadPincodeData();

            form.reset();
            editIdInput.value = '';
            submitButton.classList.remove('d-none');
            updateButton.classList.add('d-none');
            resetButton.classList.add('d-none');

            alert('Pincode details updated successfully.');
        } catch (err) {
            console.error('Unexpected update error:', err);
            alert('An unexpected error occurred during update.');
        }
    });

    // Cancel update/reset form UI
    resetButton.addEventListener('click', () => {
        form.reset();
        editIdInput.value = '';
        submitButton.classList.remove('d-none');
        updateButton.classList.add('d-none');
        resetButton.classList.add('d-none');
    });

    // Delegated event handlers for edit and delete buttons using jQuery
    $(document).on('click', '.edit-row', async function () {
        const id = $(this).data('id');
        if (!id) {
            alert('Invalid ID for edit.');
            return;
        }

        const { data, error } = await supabaseClient
            .from('ServiceablePincode')
            .select()
            .eq('id', id)
            .single();

        if (error) {
            console.error('Edit error:', error);
            alert('Failed to fetch data for edit.');
            return;
        }

        const row = data;
        if (!row) {
            alert('No data found for edit.');
            return;
        }

        form.pincode.value = row.Pincode;
        form.areaName.value = row.AreaName;
        form.city.value = row.CityName;
        form.state.value = row.StateName;
        form.country.value = row.Country;
        form.serviceType.value = row.ServiceType;

        editIdInput.value = row.id;

        submitButton.classList.add('d-none');
        updateButton.classList.remove('d-none');
        resetButton.classList.remove('d-none');
    });

    $(document).on('click', '.delete-row', async function () {
        const id = $(this).data('id');
        if (!id) {
            alert('Invalid ID for deletion.');
            return;
        }

        if (confirm('Are you sure you want to delete this pincode?')) {
            try {
                const { error } = await supabaseClient
                    .from('ServiceablePincode')
                    .delete()
                    .eq('id', id);

                if (error) {
                    throw new Error(error.message);
                }

                $(this).closest('tr').remove();
                alert('Pincode deleted successfully!');
            } catch (err) {
                console.error(err);
                alert(`Failed to delete pincode.\nError: ${err.message}`);
            }
        }
    });

    // Load all data and populate table rows
    async function loadPincodeData() {
        const { data, error } = await supabaseClient
            .from('ServiceablePincode')
            .select()
            .eq('company_id', CompanyID);

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        tableBody.innerHTML = "";

        data.forEach(row => {
            const rowHTML = `
      <tr>
        <td>${row.Pincode}</td>
        <td>${row.AreaName}</td>
        <td>${row.CityName}</td>
        <td>${row.StateName}</td>
        <td>${row.Country}</td>
        <td>${row.ServiceType}</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary me-1 edit-row" data-id="${row.id}">
            <i class="bi bi-pencil-square"></i> Edit
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-row" data-id="${row.id}">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      </tr>
    `;
            tableBody.insertAdjacentHTML('beforeend', rowHTML);
        });
    }
});

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    }
}

const tableBody = document.getElementById('pincodeTableBody');

['pinCode', 'areaName', 'city', 'state', 'country', 'serviceType'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
        input.addEventListener('input', debounce(filterTableRows, 300));  // debounce of 300ms
    }
});


async function filterTableRows() {
    const pinCodeFilter = document.getElementById('pinCode').value.trim().toLowerCase();
    const areaNameFilter = document.getElementById('areaName').value.trim().toLowerCase();
    const cityFilter = document.getElementById('city').value.trim().toLowerCase();
    const stateFilter = document.getElementById('state').value.trim().toLowerCase();
    const countryFilter = document.getElementById('country').value.trim().toLowerCase();
    const serviceTypeFilter = document.getElementById('serviceType').value.trim().toLowerCase();
    const { data, error } = await supabaseClient
        .from('ServiceablePincode')
        .select()
        .eq('company_id', CompanyID)
        .ilike('Pincode', `%${pinCodeFilter}%`)
        .ilike('AreaName', `%${areaNameFilter}%`)
        .ilike('CityName', `%${cityFilter}%`)
        .ilike('StateName', `%${stateFilter}%`)
        .ilike('Country', `%${countryFilter}%`)
        .ilike('ServiceType', `%${serviceTypeFilter}%`);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    tableBody.innerHTML = "";

    data.forEach(row => {
        const rowHTML = `
      <tr>
        <td>${row.Pincode}</td>
        <td>${row.AreaName}</td>
        <td>${row.CityName}</td>
        <td>${row.StateName}</td>
        <td>${row.Country}</td>
        <td>${row.ServiceType}</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary me-1 edit-row" data-id="${row.id}">
            <i class="bi bi-pencil-square"></i> Edit
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-row" data-id="${row.id}">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      </tr>
    `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// document.getElementById('pinCode').addEventListener('change', async () => {
//     const pincode = document.getElementById('pinCode').value;
//     console.log('Selected Pincode:', pincode);
//     getAllPincodeData(pincode)
//         .then(results => {
//             console.log('All Post Office data:', results);
//         })
//         .catch(err => {
//             console.error('Error:', err.message);
//         });
// });
document.getElementById('pinCode').addEventListener('input', async () => {
    const pincode = document.getElementById('pinCode').value.trim();  // use same ID here
    if (pincode.length === 6) {  // optionally trigger only on full length
        try {
            await getPincodeDetails(pincode);
        } catch (err) {
            alert(err.message);
        }
    }
});

async function getPincodeDetails(pincode) {
    if (!pincode || typeof pincode !== 'string') {
        throw new Error('Invalid pincode');
    }

    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0 || data[0].Status !== "Success") {
        console.log('No data found for the given pincode', data);
        throw new Error('No data found for the given pincode');
    }

    const postOffices = data[0].PostOffice;
    if (!postOffices || postOffices.length === 0) {
        throw new Error('No PostOffice data available for the given pincode');
    }


    // If only one PostOffice → autofill inputs
    if (postOffices.length === 1) {
        const office = postOffices[0];
        document.getElementById("areaNameContainer").innerHTML =
            `<input type="text" id="areaName" class="form-control" value="${office.Name}" required />`;
        document.getElementById("city").value = office.District || '';
        document.getElementById("state").value = office.State || '';
        document.getElementById("country").value = office.Country || '';
    }
    // If multiple → create dropdown selector
    else {
        let select = `<select id="areaName" class="form-select" required>
                        <option value="">Select Area</option>`;
        postOffices.forEach(office => {
            select += `<option value="${office.Name}"
                            data-district="${office.District}"
                            data-state="${office.State}"
                            data-country="${office.Country}">
                            ${office.Name}</option>`;
        });
        select += `</select>`;

        document.getElementById("areaNameContainer").innerHTML = select;

        // update city, state, country on area selection
        document.getElementById("areaName").addEventListener("change", (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            document.getElementById("city").value = selectedOption.dataset.district || '';
            document.getElementById("state").value = selectedOption.dataset.state || '';
            document.getElementById("country").value = selectedOption.dataset.country || '';
        });
    }
}
