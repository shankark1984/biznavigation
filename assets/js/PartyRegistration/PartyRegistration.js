// On DOM load
document.addEventListener("DOMContentLoaded", async () => {
    const accessGranted = await checkAccess(UserLoginID, 'PartyRegistration');
    if (!accessGranted) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }

    if (perWrite) saveButton.disabled = false;
    handleUserTypePermissions();
    enableForm();

    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
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
    toggleButtons(".edit-row, .delete-row, .editTariff", true);
});

// New button handler
newButton.addEventListener('click', () => {
    saveButton.disabled = false;
    modifyButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    document.querySelector('#billingAddressTable tbody').innerHTML = '';
    document.querySelector('#tariffTable tbody').innerHTML = '';

    clearForm();
    enableForm();
    toggleButtons(".edit-row, .delete-row, .editTariff", true);
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

document.getElementById('partyCurrentStatus').addEventListener('change', () => {
    const status = fields.partyCurrentStatus.value;
    fields.partyDeActiveDate.disabled = status === 'Active';
    if (status === 'Active') fields.partyDeActiveDate.value = '';
});

document.getElementById('partyNameReg').addEventListener('change', async () => {
    const partyCode = fields.partyCodes.value.trim();
    if (!partyCode) return;

    await fetchSelectedPartyDetails(partyCode);
    await loadBillingAddresses({ billingTableBody: document.querySelector('#billingAddressTable tbody'), partyCodeSelect: fields.partyCodes });
    await fetchTariffs(partyCode);
    disableForm();

    document.getElementById("addbillingAddress").disabled = true;
    saveButton.disabled = true;
    modifyButton.disabled = false;
    newButton.disabled = false;
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
        alert("Party Code is missing!");
        saveButton.disabled = false;
        newButton.disabled = false;
        return;
    }

    const formData = {
        PartyCode: partyCode,
        PartyType: fields.partyType.value,
        PartyName: partyName,
        ContactPerson: fields.partyContactPerson.value,
        ContactNumber: fields.partyContactNumber.value,
        EmailID: fields.partyEmailID.value,
        Address: fields.partyAddress.value,
        City: fields.city.value,
        PinCode: fields.pinCode.value,
        State: fields.state.value,
        Country: fields.country.value,
        PanNumber: fields.panNumber.value,
        GSTNumber: fields.gstNumber.value,
        DefaultTax: fields.defaultTax.value || 'CGST 0% SGST 0% IGST 0%',
        CurrentStatus: fields.partyCurrentStatus.value,
        DeactiveDate: fields.partyDeActiveDate.value || null,
        company_id: CompanyID,
        created_by: UserLoginID,
        created_at: localtimeStamp
    };

    Object.keys(formData).forEach(key => {
        if (formData[key] === "") formData[key] = null;
    });

    const isInsert = saveButton.textContent.trim() === 'Save';
    const { data, error } = isInsert
        ? await supabaseClient.from('PartyDetails').insert([formData])
        : await supabaseClient.from('PartyDetails').update(formData).eq('PartyCode', partyCode).select();

    if (error) {
        alert(`Error ${isInsert ? 'saving' : 'updating'} party details`);
        console.error(error);
    } else {
        alert(`Party details ${isInsert ? 'saved' : 'updated'} successfully!`);
        if (isInsert) fields.partyCodes.value = partyCode;
    }

    disableForm();
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    modifyButton.disabled = false;
    newButton.disabled = false;
    toggleButtons(".edit-row, .delete-row, .editTariff", false);
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