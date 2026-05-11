// On DOM load
document.addEventListener("DOMContentLoaded", async () => {

    createLoader();
    if (perWrite) saveButton.disabled = false;
    enableForm();
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await loadDatalist('fixedChargesModeTypeList', 'ModeType');
    await loadDatalist('fixedChargesShippingTypeList', 'ShippingType');
    await loadDatalist('fixedChargesTypelist', 'ChargesType');
    await loadDropdownOptions('VehicleType', 'ftlVehicleType');
    await loadRouteSuggestions();

    loadTaxData();
});

// Global variables
const partyNameInput = document.getElementById("partyNameReg");
const partySuggestions = document.getElementById("partySuggestions");
let allParties = [];

// Field references
const fields = {
    partyType: document.getElementById("partyType"),
    partyCodes: document.getElementById("partyCodes"),
    partyNameReg: document.getElementById("partyNameReg"), // ✅ Add this line
    partyCurrentStatus: document.getElementById("partyCurrentStatus"),
    partyDeActiveDate: document.getElementById("partyDeActiveDate"),
    partyAddress: document.getElementById("partyAddress"),
    pinCode: document.getElementById("pinCode"),
    city: document.getElementById("city"),
    state: document.getElementById("state"),
    country: document.getElementById("country"),
    panNumber: document.getElementById("panNumber"),
    gstNumber: document.getElementById("gSTNumber"),
    partyContactPerson: document.getElementById("partyContactPerson"),
    partyContactNumber: document.getElementById("partyContactNumber"),
    partyEmailID: document.getElementById("partyEmailID"),
    defaultTax: document.getElementById("defaultTax")
};

// Modify button handler
modifyButton.addEventListener('click', () => {
    enableForm();
    fields.partyCodes.disabled = true;
    partyNameInput.disabled = true;
    saveButton.disabled = false;
    modifyButton.disabled = true;
    document.getElementById("addbillingAddress").disabled = false;
    toggleButtons(".edit-row, .delete-row, .editTariff, .deleteRow,.delete-fixedbutton, .deleteFuelRow", true);
    document.getElementById("addTariffButton").disabled = false;
    document.getElementById("addFtlFCLButton").disabled = false;
    document.getElementById("addFixedChargesButton").disabled = false;
    document.getElementById("addFuelSurchargeButton").disabled = false;
});

// New button handler
newButton.addEventListener('click', () => {
    saveButton.disabled = false;
    modifyButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    document.querySelector('#billingAddressTable tbody').innerHTML = '';
    document.querySelector('#tariffTable tbody').innerHTML = '';
    document.querySelector('#ftlFCLTable tbody').innerHTML = '';
    document.querySelector('#fixedChargesTable tbody').innerHTML = '';
    document.querySelector('#fuelSurchargesTable tbody').innerHTML = '';

    clearForm();
    enableForm();
    toggleButtons(".edit-row, .delete-row, .editTariff, .deleteRow, .delete-fixedbutton, .deleteFuelRow", true);
    document.getElementById("addbillingAddress").disabled = false;
    document.getElementById("addTariffButton").disabled = false;
    document.getElementById("addFtlFCLButton").disabled = false;
    document.getElementById("addFixedChargesButton").disabled = false;
    document.getElementById("addFuelSurchargeButton").disabled = false;
});

async function generateNewPartyCode(partyName) {
    if (!partyName || typeof partyName !== 'string') return null;
    const firstLetter = partyName.charAt(0).toUpperCase();
    const dateSum = convertDateToNumberAndSum(new Date());
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(4, '0');
    return `${firstLetter}${dateSum}${randomNum}`;
}

function convertDateToNumberAndSum(date) {
    return date.getTime().toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
}

document.getElementById('partyCurrentStatus').addEventListener('change', async () => {
    const status = fields.partyCurrentStatus.value;
    fields.partyDeActiveDate.disabled = status === 'Active';
    if (status === 'Active') fields.partyDeActiveDate.value = '';
});

document.getElementById('partyNameReg').addEventListener('change', async () => {
    const partyCode = fields.partyCodes.value.trim();
    if (!partyCode) return;
    disableForm();

    document.getElementById("addbillingAddress").disabled = true;
    document.getElementById("addTariffButton").disabled = true;
    document.getElementById("addFtlFCLButton").disabled = true;
    document.getElementById("addFixedChargesButton").disabled = true;
    saveButton.disabled = true;
    modifyButton.disabled = false;
    newButton.disabled = false;

    await fetchSelectedPartyDetails(partyCode);
    await loadBillingAddresses({
        billingTableBody: document.querySelector('#billingAddressTable tbody'),
        partyCodeSelect: fields.partyCodes
    });
    await fetchTariffs(partyCode);
    await loadFixedChargesFromDB();
    await loadFCLFTLTariffs(partyCode);
    await loadFuelSurcharge(partyCode);

    toggleButtons(".edit-row, .delete-row, .editTariff, .deleteRow, .delete-fixedbutton, .deleteFuelRow", false);

});

async function fetchSelectedPartyDetails(partyCode) {
    try {
        const { data, error } = await supabaseClient
            .from('PartyDetails')
            .select('*')
            .eq('company_id', CompanyID)
            .eq('PartyCode', partyCode)
            .maybeSingle();

        if (error || !data) return;

        const fieldMap = {
            partyType: 'PartyType',
            partyCodes: 'PartyCode',
            partyCurrentStatus: 'CurrentStatus',
            partyDeActiveDate: 'DeactiveDate',
            partyAddress: 'Address',
            pinCode: 'PinCode',
            city: 'City',
            state: 'State',
            country: 'Country',
            panNumber: 'PanNumber',
            gstNumber: 'GSTNumber',
            partyContactPerson: 'ContactPerson',
            partyContactNumber: 'ContactNumber',
            partyEmailID: 'EmailID',
            defaultTax: 'DefaultTax'
        };

        Object.entries(fieldMap).forEach(([id, column]) => {
            if (fields[id]) fields[id].value = data[column] ?? '';
        });

        saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    } catch (err) {
        console.error('Error fetching party:', err);
    }
}

saveButton.addEventListener('click', async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    newButton.disabled = true;

    const partyName = fields.partyNameReg?.value?.trim() || "";

    let partyCode = saveButton.textContent.trim() === 'Save'
        ? await generateNewPartyCode(partyName)
        : fields.partyCodes.value.trim();

    if (!partyCode) {
        showToast("Party Code is missing!");
        saveButton.disabled = false;
        newButton.disabled = false;
        return;
    }

    fields.partyType.value = fields.partyType.value || "Customer";
    fields.partyCurrentStatus.value =
        fields.partyCurrentStatus.value || "Active";

    const partyType = fields.partyType.value;
    const partyStatus = fields.partyCurrentStatus.value;

    const isInsert = saveButton.textContent.trim() === 'Save';

    const formData = {
        PartyCode: partyCode,
        PartyType: partyType,
        PartyName: partyName,
        ContactPerson: fields.partyContactPerson.value || null,
        ContactNumber: fields.partyContactNumber.value || null,
        EmailID: fields.partyEmailID.value || null,
        Address: fields.partyAddress.value || null,
        City: fields.city.value || null,
        PinCode: fields.pinCode.value || null,
        State: fields.state.value || null,
        Country: fields.country.value || null,
        PanNumber: fields.panNumber.value || null,
        GSTNumber: fields.gstNumber.value || null,
        DefaultTax: fields.defaultTax.value || 'CGST 0% SGST 0% IGST 0%',
        CurrentStatus: partyStatus,
        DeactiveDate: fields.partyDeActiveDate.value || null,
        company_id: CompanyID
    };

    let response;

    if (isInsert) {
        response = await supabaseClient
            .from('PartyDetails')
            .insert([{
                ...formData,
                created_by: UserLoginID,
                created_at: localtimeStamp
            }])
            .select();
    } else {
        response = await supabaseClient
            .from('PartyDetails')
            .update({
                ...formData,
                updated_by: UserLoginID,
                updated_at: localtimeStamp
            })
            .eq('PartyCode', partyCode)
            .select();
    }

    const { data, error } = response;

    if (error) {
        showToast(`Error ${isInsert ? 'saving' : 'updating'} party details`);
        console.error(error);
        saveButton.disabled = false;
        newButton.disabled = false;
        return; // 🚨 STOP HERE
    }

    if (isInsert) {
        fields.partyCodes.value = partyCode;

        // ✅ Insert default billing address ONLY on insert
        const { error: billingError } = await supabaseClient
            .from('PartyBillingAddress')
            .insert([{
                PartyCode: partyCode,
                ContactName: formData.ContactPerson || "NA",
                ContactNumber: formData.ContactNumber || "9999999999",
                Address: formData.Address,
                PinCode: formData.PinCode,
                City: formData.City,
                State: formData.State,
                Country: formData.Country,
                DefaultActive: true,
                Status: 'Active',
                company_id: CompanyID,
                created_by: UserLoginID,
                created_at: localtimeStamp
            }]);

        if (billingError) {
            console.error('Billing insert error:', billingError);
            alert('Party saved, but billing address failed');
        }
    }

    await loadBillingAddresses({
        billingTableBody: document.querySelector('#billingAddressTable tbody'),
        partyCodeSelect: fields.partyCodes
    });

    await saveFixedChargesToDB();

    await saveFCLFTLTariffs(); // ✅ Save FTL/FCL tariffs after party is saved
    await saveFuelSurcharge();

    showToast(`Party ${isInsert ? 'saved' : 'updated'} successfully!`);

    disableForm();
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    modifyButton.disabled = false;
    newButton.disabled = false;
    toggleButtons(".edit-row, .delete-row, .editTariff, .deleteRow,.delete-fixedbutton", false);
    document.getElementById("addbillingAddress").disabled = true;
    document.getElementById("addTariffButton").disabled = true;
    document.getElementById("addFtlFCLButton").disabled = true;
    document.getElementById("addFixedChargesButton").disabled = true;

});


document.getElementById('modeType').addEventListener('change', async function () {
    const container = document.getElementById('containerType')?.closest('.col-md-2');
    const label = document.querySelector('label[for="containerType"]');

    if (!container || !label) return;

    if (this.value === 'FTL') {
        label.textContent = 'Vehicle Type';
        container.classList.remove('d-none');
        await loadDropdownOptions('VehicleType', 'containerType');
    } else if (this.value === 'FCL') {
        label.textContent = 'Container Type';
        container.classList.remove('d-none');
        await loadDropdownOptions('ContainerType', 'containerType');
    } else {
        container.classList.add('d-none');
    }
});

document.getElementById('partyNameReg').addEventListener('input', async () => {
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
});
