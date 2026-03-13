document.addEventListener('DOMContentLoaded', initializeForm);

// Cache common DOM elements
const jobNoInput = document.getElementById('jobNo'); // Assuming this exists

// ========== Core Functions ==========

async function initializeForm() {
    try {
        await Promise.all([
            loadSuggestions('partySuggestions', 'PartyDetails', CompanyID),
            loadSuggestions('customsBrokerSuggestions', 'PartyDetails', CompanyID),
            loadJobNoSuggestions(CompanyID),
            loadBlAwbNumberSuggestions(CompanyID),
            loadBeNumberSuggestions(CompanyID),
        ]);
        loadTaxData();

    } catch (error) {
        console.error('Failed to load suggestions:', error);
    }
}

/**
 * Retrieves trimmed form data from input fields.
 */
function getFormData() {
    return {
        JobDate: document.getElementById('jobDate').value.trim(),
        PartyCode: document.getElementById('partyCode').value.trim(),
        PartyName: document.getElementById('partyName').value.trim(),
        MovementType: document.getElementById('movementType').value.trim(),
        TransitType: document.getElementById('transitType').value.trim(),
        ModeType: document.getElementById('modeType').value.trim(),
        BLAWBNo: document.getElementById('blAwbNumber').value.trim().toUpperCase(),
        BLAWBDate: document.getElementById('blAwbDate').value.trim(),
        BENo: document.getElementById('beNumber').value.trim().toUpperCase(),
        BEDate: document.getElementById('beDate').value.trim(),
        Consignee: document.getElementById('consigneeName').value.trim(),
        Address: document.getElementById('deliveryAddress').value.trim(),
        Quantity: parseFloat(document.getElementById('quantity').value) || 0,
        CargoWeight: parseFloat(document.getElementById('cargoWeight').value) || 0,
        CustomsBroker: document.getElementById('customsBroker').value.trim(),
        ClearancePort: clearancePortInput.value.trim(),
        ClearanceCountry: clearanceCountryInput.value.trim(),
        ClearanceMode: document.getElementById('clearanceMode').value.trim(),
        Commodity: document.getElementById('commodity').value.trim(),
        AnyInformation: document.getElementById('information').value.trim(),
        // company_id will be appended in save logic (to keep formData clean)
    };
}

/**
 * Generates unique JobID based on last record for the company.
 */
async function generateJobID(companyID) {
    const { data, error } = await supabaseClient
        .from('CustomsClearance_Details')
        .select('JobID')
        .eq('company_id', companyID)
        .order('JobID', { ascending: false })
        .limit(1);

    if (error) throw error;

    if (!data.length) return `${companyID}_CC001`;

    const lastJobID = data[0].JobID;
    const matches = lastJobID.match(/_CC(\d+)$/);
    const lastNumber = matches ? parseInt(matches[1], 10) : 0;
    const nextNumber = lastNumber + 1;

    return `${companyID}_CC${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Determines if form is in update mode based on saveButton's data-mode attribute.
 */
function isUpdateMode() {
    return saveButton.getAttribute('data-mode') === 'update';
}

/**
 * Basic validation for required fields.
 */
function validateFormData(data) {
    if (!data.PartyCode) {
        alert('Party Code is required.');
        return false;
    }
    if (!data.JobDate) {
        alert('Job Date is required.');
        return false;
    }
    return true;
}

/**
 * Main Save/Update handler
 */
async function saveFormData() {
    let formData = getFormData();

    if (!validateFormData(formData)) return;

    try {
        let response, headerData, headerRow, parentId, jobID;

        if (isUpdateMode()) {
            jobID = jobNoInput ? jobNoInput.value.trim() : '';
            if (!jobID) {
                alert('Job Number is missing for update.');
                return;
            }
            formData.update_by = UserLoginID;
            formData.update_at = localtimeStamp;

            // Get the parent id for linking to charges (needed if you want to update charges too)
            // Optionally select the record to get "id" if needed for charges linkage
            const { data: idData, error: idError } = await supabaseClient
                .from('CustomsClearance_Details')
                .select('id')
                .eq('JobID', jobID)
                .single();

            if (idError || !idData) {
                alert('Could not find record id for updating charges.');
                return;
            }
            parentId = idData.id; // id for charges table

            response = await supabaseClient
                .from('CustomsClearance_Details')
                .update(formData)
                .eq('JobID', jobID);

        } else {
            // Insert new record
            formData.JobID = await generateJobID(CompanyID);

            // Set jobNo input to new JobID
            document.getElementById('jobNo').value = formData.JobID;

            formData.created_by = UserLoginID;
            formData.created_at = localtimeStamp;
            formData.company_id = CompanyID;

            // .select() so we get inserted row back (with "id")
            response = await supabaseClient
                .from('CustomsClearance_Details')
                .insert([formData])
                .select();

            if (response.error || !response.data || !response.data[0]) {
                throw response.error || new Error("No inserted record returned.");
            }

            headerRow = response.data[0];
            parentId = headerRow.id;    // This is the parent record ID for charges
            jobID = headerRow.JobID;    // The JobID just generated
        }

        if (response.error) {
            throw response.error;
        }
        document.querySelectorAll('.btn-delete-row').forEach(button => {
            button.disabled = true;
        });
        addChargesRow.disabled = true; // Enable add row button
        disableForm();

        alert('Data saved successfully!');


        // Reset save button to insert mode after successful save
        saveButton.setAttribute('data-mode', 'insert');
        saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
        saveButton.disabled = true;
        if (modifyButton) modifyButton.disabled = false;

        // Save charges (for both insert/update, if needed)
        await saveChargesTableToSupabase(parentId, jobID);
        await saveEquipmentDetails(); // Save equipment details linked to this job

    } catch (error) {
        console.error('Error saving data:', error);
        alert(`Error saving data: ${error.message || error}`);
    }
}


// ========== Event Listeners ==========

saveButton.addEventListener('click', async function () {
    await saveFormData();                // Your main form save

});


if (clearancePortInput) {
    clearancePortInput.addEventListener('input', updateSuggestionsAndCountry);
    clearancePortInput.addEventListener('change', () => {
        const val = clearancePortInput.value.trim().toLowerCase();
        const matchedPort = currentSuggestions.find(s => s.label.toLowerCase() === val);
        clearanceCountryInput.value = matchedPort ? matchedPort.portDetails.PortCountry : '';
    });
}

if (modifyButton) {
    modifyButton.addEventListener('click', () => {
        modifyButton.disabled = true;
        saveButton.setAttribute('data-mode', 'update');
        enableForm();
        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
        saveButton.disabled = false;

        document.querySelectorAll('.btn-delete-row').forEach(button => {
            button.disabled = false;
        });
        addChargesRow.disabled = false; // Enable add row button

    });
}

async function loadJobNoSuggestions(companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearance_Details')
            .select('JobID')
            .eq('company_id', companyID)
            .limit(100)
            .order('JobID', { ascending: true });

        if (error) {
            console.error('Error fetching jobNo suggestions:', error);
            return;
        }

        const datalist = document.getElementById('jobNoSuggestions');
        datalist.innerHTML = ''; // Clear previous suggestions

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.JobID;
            datalist.appendChild(option);
        });
    } catch (err) {
        console.error('Unexpected error fetching jobNo suggestions:', err);
    }
}

async function loadBlAwbNumberSuggestions(companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearance_Details')
            .select('BLAWBNo')
            .eq('company_id', companyID)
            .limit(100)
            .order('BLAWBNo', { ascending: true });

        if (error) {
            console.error('Error fetching BLAWB suggestions:', error);
            return;
        }

        const datalist = document.getElementById('blAwbNumberSuggestions');
        datalist.innerHTML = '';

        data.forEach(item => {
            if (item.BLAWBNo) {
                const option = document.createElement('option');
                option.value = item.BLAWBNo;
                datalist.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Unexpected error fetching BLAWB suggestions:', err);
    }
}

async function loadBeNumberSuggestions(companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearance_Details')
            .select('BENo')
            .eq('company_id', companyID)
            .limit(100)
            .order('BENo', { ascending: true });

        if (error) {
            console.error('Error fetching BENo suggestions:', error);
            return;
        }

        const datalist = document.getElementById('beNumberSuggestions');
        datalist.innerHTML = '';

        data.forEach(item => {
            if (item.BENo) {
                const option = document.createElement('option');
                option.value = item.BENo;
                datalist.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Unexpected error fetching BENo suggestions:', err);
    }
}

// Cache your inputs
const blAwbNumberInput = document.getElementById('blAwbNumber');
const beNumberInput = document.getElementById('beNumber');

// Helper to populate form fields from data object
function populateForm(data) {
    if (!data) return;

    document.getElementById('tempFormID').value = data.id;
    document.getElementById('jobNo').value = data.JobID || '';
    document.getElementById('jobDate').value = data.JobDate || '';
    document.getElementById('partyCode').value = data.PartyCode || '';
    document.getElementById('partyName').value = data.PartyName || '';
    document.getElementById('movementType').value = data.MovementType || '';
    document.getElementById('transitType').value = data.TransitType || '';
    document.getElementById('modeType').value = data.ModeType || '';
    document.getElementById('blAwbNumber').value = data.BLAWBNo || '';
    document.getElementById('blAwbDate').value = data.BLAWBDate || '';
    document.getElementById('beNumber').value = data.BENo || '';
    document.getElementById('beDate').value = data.BEDate || '';
    document.getElementById('consigneeName').value = data.Consignee || '';
    document.getElementById('deliveryAddress').value = data.Address || '';
    document.getElementById('quantity').value = data.Quantity || '';
    document.getElementById('cargoWeight').value = data.CargoWeight || '';
    document.getElementById('customsBroker').value = data.CustomsBroker || '';
    document.getElementById('clearancePort').value = data.ClearancePort || '';
    document.getElementById('clearanceCountry').value = data.ClearanceCountry || '';
    document.getElementById('clearanceMode').value = data.ClearanceMode || '';
    document.getElementById('commodity').value = data.Commodity || '';
    document.getElementById('information').value = data.AnyInformation || '';


    // Also update the data-mode and enable form for updating, if applicable
    toggleContainerTab(data.ModeType);
    saveButton.setAttribute('data-mode', 'update');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    if (data.InvoiceNo === null || data.InvoiceNo === undefined || data.InvoiceNo.trim() === "") {
        modifyButton.disabled = false;
    } else {
        modifyButton.disabled = true;
    }

    disableForm(); // Disable form inputs for viewing
    // optionally enable form editing here
}

// Function to fetch record by a field and value
async function loadRecordByField(fieldName, value) {
    const trimmedValue = value?.trim();
    if (!trimmedValue) return null;

    try {
        const { data, error } = await supabaseClient
            .from('CustomsClearance_Details')
            .select('*')
            .eq(fieldName, trimmedValue)
            .single(); // since limit(1) + maybeSingle not needed

        if (error) {
            // If no record found, don't treat as critical error
            if (error.code !== 'PGRST116') {
                console.error('Error fetching form data:', error);
            }
            return null;
        }

        if (data) {
            populateForm(data);
        }

        return data || null;

    } catch (err) {
        console.error('Unexpected error loading form data:', err);
        return null;
    }
}

// Event listeners - trigger on `change` or `input` as you prefer
jobNoInput.addEventListener('change', async e => {
    let record = await loadRecordByField('JobID', e.target.value.trim());
    if (record?.JobID) {
        await loadChargesByJobID(record.JobID);
        await fetchEquipmentDetails(record.id);
    }
});

blAwbNumberInput.addEventListener('change', async e => {
    let record = await loadRecordByField('BLAWBNo', e.target.value);
    if (record?.JobID) {
        await loadChargesByJobID(record.JobID);
        await fetchEquipmentDetails(record.id);
    }
});

beNumberInput.addEventListener('change', async e => {
    let record = await loadRecordByField('BENo', e.target.value);
    if (record?.JobID) {
        await loadChargesByJobID(record.JobID);
        await fetchEquipmentDetails(record.id);
    }
});

newButton.addEventListener('click', () => {
    jobNoInput.value = ''; // Clear job number input
    saveButton.setAttribute('data-mode', 'insert');
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
    enableForm();
    clearForm();
    saveButton.disabled = false;
    if (modifyButton) modifyButton.disabled = true;
    const tbody = document.querySelector('#chargesTable tbody');
    tbody.innerHTML = ''; // Clear current rows
    resetTotalsRow();
});

