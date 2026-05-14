let mode = "insert"; // default
let fuelSurchargeList = [];
document.addEventListener('DOMContentLoaded', () => {

    loadCourierSuggestions();
    document.getElementById('modifyButton').disabled = true;
    const courierInput = document.getElementById('courierName');
    const datalist = document.getElementById('courierSuggestions');
    const codeInput = document.getElementById('serviceProviderCode');

    courierInput.addEventListener('input', () => {

        const selectedValue = courierInput.value;

        // Find matching option
        const option = Array.from(datalist.options).find(
            opt => opt.value === selectedValue
        );

        if (option) {
            codeInput.value = option.dataset.code || '';
            fetchAndCourierDetails(option.dataset.code);
            loadFuelSurcharge(option.dataset.code);
        } else {
            // If user types manually (no match)
            codeInput.value = '';
        }
    });

    // ✅ FIXED event bindings
    document.getElementById('saveButton')
        .addEventListener('click', saveCourierDetails);

    document.getElementById('addFuelSurchargeButton')
        .addEventListener('click', addFuelSurchargeRow);

});

document.getElementById('newButton').addEventListener('click', () => {
    mode = "insert";
    fuelSurchargeList = [];
    clearForm();
    enableForm();
    document.getElementById('deActiveDate').disabled = true;
    document.getElementById('courierCode').disabled = true;
    document.getElementById('fuelSurchargeTableBody').innerHTML = '';
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('addFuelSurchargeButton').disabled = false;
    document.getElementById('saveButton').innerHTML = '<i class="bi bi-save"></i> Save';

});

document.getElementById('modifyButton').addEventListener('click', () => {
    mode = "update";
    enableForm();
    document.getElementById('deActiveDate').disabled = true;
    document.getElementById('courierCode').disabled = true;
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('addFuelSurchargeButton').disabled = false;
    document.querySelectorAll('.deleteFuelRow').forEach(btn => {
        btn.disabled = false;
    });
});

// ================= SUGGESTIONS ================= 
// Function to generate a new code*/
async function generateCourierCode() {
    try {
        const { data, error } = await supabaseClient
            .from('CourierRegistration')
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
        return newCode;
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
            CourierName: document.getElementById('courierName').value,
            Status: document.getElementById('serviceProviderStatus').value || "Active",
            De_ActiveDate: document.getElementById('deActiveDate').value || null,
            ContactPerson: document.getElementById('contactPerson').value,
            ContactNumber: document.getElementById('phoneNumber').value,
            EmailID: document.getElementById('emailID').value,
            company_id: CompanyID
        };

        let response;

        // ==========================
        // INSERT
        // ==========================
        if (mode === "insert") {
            const generatedCode = await generateCourierCode();
            console.log("Generated Courier Code:", generatedCode);
            courierDetails.CourierCode = generatedCode;
            courierDetails.created_by = UserLoginID;
            courierDetails.created_at = new Date().toISOString();

            response = await supabaseClient
                .from('CourierRegistration')
                .insert([courierDetails]);

            if (response.error) throw response.error;

            // ✅ SAVE FSC
            await saveFuelSurcharge(courierDetails.CourierCode);

        }

        // ==========================
        // UPDATE
        // ==========================
        if (mode === "update") {
            courierDetails.CourierCode = document.getElementById('courierCode').value;
            courierDetails.updated_by = UserLoginID;
            courierDetails.updated_at = new Date().toISOString();

            response = await supabaseClient
                .from('CourierRegistration')
                .update(courierDetails)
                .eq('CourierCode', courierDetails.CourierCode)
                .eq('company_id', CompanyID);

            if (response.error) throw response.error;

            // 🔥 DELETE OLD FSC
            await supabaseClient
                .from('FuelSurcharge')
                .delete()
                .eq('PartyID', courierDetails.CourierCode);

            // ✅ INSERT NEW FSC
            await saveFuelSurcharge(courierDetails.CourierCode);

        }

        if (response.error) throw response.error;

        showToast(mode === "insert"
            ? 'Courier details saved successfully!'
            : 'Courier details updated successfully!');

        // Optional: reset form
        // clearForm();

    } catch (err) {
        console.error('Error saving courier details:', err);
        alert(err.message || 'Failed to save courier details.');
    } finally {

        saveBtn.disabled = false;

        disableForm();

        document.getElementById('modifyButton').disabled = false;

        renderFuelTable();
    }
}

async function fetchAndCourierDetails(CourierCode) {
    try {
        const { data, error } = await supabaseClient
            .from('CourierRegistration')
            .select('*')
            .eq('CourierCode', CourierCode);

        if (error) throw error;

        if (!data || data.length === 0) {
            showToast("Courier not found", "warning");
            return;
        }

        document.getElementById('courierCode').value = data[0].CourierCode || '';
        document.getElementById('courierName').value = data[0].CourierName || '';
        document.getElementById('serviceProviderStatus').value = data[0].Status || '';
        document.getElementById('deActiveDate').value = data[0].De_ActiveDate
            ? new Date(data[0].De_ActiveDate).toISOString().split('T')[0]
            : '';
        document.getElementById('contactPerson').value = data[0].ContactPerson || '';
        document.getElementById('phoneNumber').value = data[0].ContactNumber || '';
        document.getElementById('emailID').value = data[0].EmailID || '';

        disableForm();
        document.getElementById('modifyButton').disabled = false;
        document.getElementById('deleteButton').disabled = true;
        document.getElementById('reportButton').disabled = true;

        document.getElementById('saveButton').disabled = true;
        document.getElementById('saveButton').innerHTML = '<i class="bi bi-save"></i> Update';
        document.getElementById('addFuelSurchargeButton').disabled = true;

    } catch (err) {
        console.error('Error fetching courier details:', err);
    }
}

function addFuelSurchargeRow() {

    const dateInput = document.getElementById('effectiveDate');
    const fuelInput = document.getElementById('fuelSurcharge');

    const PartyID = document.getElementById('courierCode').value;

    const date = dateInput.value;
    const fuel = parseFloat(fuelInput.value);

    // 🔒 Validation
    if (!date || isNaN(fuel)) {
        showToast("Please enter Effective Date and Fuel %", "danger");
        return;
    }

    // 🚫 Prevent duplicate FSC entry
    const isDuplicate = fuelSurchargeList.some(item =>
        item.PartyID === PartyID &&
        item.EffectiveDate === date &&
        item.Mode === "All" &&
        item.MovementType === "All" &&
        item.FSCType === "Sell"
    );

    if (isDuplicate) {
        showToast(
            "Duplicate FSC already exists for same Date/Mode/Movement/FSC Type",
            "warning"
        );
        return;
    }

    // ✅ 👉 ADD THIS HERE (IMPORTANT)
    fuelSurchargeList.push({
        PartyID: PartyID,
        EffectiveDate: date,
        Mode: "All",
        MovementType: "All",
        FuelSurcharge: fuel,
        Description: `Fuel Surcharge ${fuel}%`,
        FSCType: "Sell"
    });

    // 🔄 Render table from array
    renderFuelTable();

    // 🔄 Clear inputs
    dateInput.value = '';
    fuelInput.value = '';
}

function renderFuelTable() {

    const tableBody = document.getElementById('fuelSurchargeTableBody');
    tableBody.innerHTML = '';

    fuelSurchargeList.forEach((item, index) => {

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${formatDate(item.EffectiveDate)}</td>
            <td>${item.Description}</td>
            <td class="text-end">
                    ${item.FuelSurcharge ? parseFloat(item.FuelSurcharge).toFixed(2) + '%' : ''}
            </td>
            <td>
                <button class="btn btn-sm btn-danger deleteFuelRow"
                         onclick="removeFuelRow(${index})"
                         ${mode !== "update" ? "disabled" : ""}><i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function removeFuelRow(index) {
    fuelSurchargeList.splice(index, 1);
    renderFuelTable();
}

async function saveFuelSurcharge(CourierCode) {

    if (!fuelSurchargeList.length) return;

    try {
        const rows = fuelSurchargeList.map(item => ({
            PartyID: CourierCode,
            EffectiveDate: item.EffectiveDate,
            Mode: "All",
            MovementType: "All",
            FuelSurcharge: item.FuelSurcharge,
            Description: item.Description,
            FSCType: item.FSCType || "Sell",
            created_by: UserLoginID,
            created_at: localtimeStamp
        }));

        const { error } = await supabaseClient
            .from('FuelSurcharge')
            .insert(rows);

        if (error) throw error;

    } catch (err) {
        console.error("Error saving fuel surcharge:", err);
        throw err;
    }
}

async function loadFuelSurcharge(CourierCode) {
    try {
        const { data, error } = await supabaseClient
            .from('FuelSurcharge')
            .select('*')
            .eq('PartyID', CourierCode) // ⚠️ using CourierCode as per your current design
            .order('EffectiveDate', { ascending: true });

        if (error) throw error;

        // 🔄 Reset array
        fuelSurchargeList = [];

        // ✅ Map DB → UI structure
        fuelSurchargeList = (data || []).map(item => ({
            EffectiveDate: item.EffectiveDate,
            FuelSurcharge: parseFloat(item.FuelSurcharge),
            Description: item.Description,
        }));

        // 🔄 Render table
        renderFuelTable();

    } catch (err) {
        console.error("Error loading fuel surcharge:", err);
        showToast("Failed to load fuel surcharge", "danger");
    }
}
