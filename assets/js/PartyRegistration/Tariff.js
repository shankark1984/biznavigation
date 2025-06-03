// Global state for editing
let isEditingTariff = false;
let editingTariffId = null;

// Add button listener
const addTariffButton = document.getElementById('addTariffButton');
addTariffButton.addEventListener('click', () => {
    addOrUpdateTariffDetails(isEditingTariff, editingTariffId);
});

// Edit button listener
$(document).on('click', '.editTariff', function () {
    const id = $(this).data('id');
    editTariffDetails(id);
});

// Field mappings
const fieldIds = [
    'partyCodes', 'effectiveDate', 'movementType', 'transitType',
    'modeType', 'shippingType', 'containerType', 'carrierName',
    'originList', 'destinationList', 'uomType', 'minimumWeight',
    'uptoWeight', 'rate', 'tariffType', 'currencyCode'
];

const tariffFieldMap = {
    effectiveDate: 'EffectiveDate',
    movementType: 'MovementType',
    transitType: 'TransitType',
    modeType: 'ModeType',
    shippingType: 'ShippingType',
    containerType: 'ContainerType',
    carrierName: 'Carrier',
    originList: 'Origin',
    destinationList: 'Destination',
    uomType: 'UOM',
    minimumWeight: 'MinimumWtKgs',
    uptoWeight: 'UptoWeightKgs',
    rate: 'Rate',
    tariffType: 'TariffType',
    currencyCode: 'CurrencyCode'
};

// Fetch tariffs for a party
async function fetchTariffs(partyCode) {
    const tableBody = document.getElementById('tariffTableBody');
    tableBody.innerHTML = '<tr><td colspan="16" class="text-center">Loading tariffs...</td></tr>';

    const { data, error } = await supabaseClient
        .from('PartyTariff')
        .select('*')
        .eq('PartyCode', partyCode)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching tariffs:', error);
        tableBody.innerHTML = '<tr><td colspan="16" class="text-center text-danger">Failed to fetch data</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="16" class="text-center">No Tariff added for this party</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    data.forEach((tariff, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>  <!-- Serial number -->
            <td>${tariff.EffectiveDate}</td>
            <td>${tariff.MovementType}</td>
            <td>${tariff.TransitType}</td>
            <td>${tariff.ModeType}</td>
            <td>${tariff.ShippingType}</td>
            <td>${tariff.ContainerType || 'N/A'}</td>
            <td>${tariff.Carrier}</td>
            <td>${tariff.Origin}</td>
            <td>${tariff.Destination}</td>
            <td>${tariff.UOM}</td>
            <td>${tariff.MinimumWtKgs}</td>
            <td>${tariff.UptoWeightKgs}</td>
            <td>${tariff.Rate}</td>
            <td>${tariff.TariffType}</td>
            <td>${tariff.CurrencyCode}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1 editTariff" data-id="${tariff.id}">
                    <i class="bi bi-pencil-square"></i> Edit
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    toggleButtons(".editTariff", true);
}

// Add or update tariff
async function addOrUpdateTariffDetails(isEdit = false, tariffId = null) {
    const form = document.getElementById('tariff');
    const formFields = form.querySelectorAll('input, select, button');

    formFields.forEach(f => f.disabled = true);
    addTariffButton.textContent = isEdit ? 'Updating…' : 'Adding…';

    const fieldValues = Object.fromEntries(fieldIds.map(id => [id, document.getElementById(id)?.value ?? '']));

    const payload = {
        PartyCode: fieldValues.partyCodes,
        EffectiveDate: fieldValues.effectiveDate,
        MovementType: fieldValues.movementType,
        TransitType: fieldValues.transitType,
        ModeType: fieldValues.modeType,
        ShippingType: fieldValues.shippingType,
        ContainerType: fieldValues.containerType,
        Carrier: fieldValues.carrierName,
        Origin: fieldValues.originList,
        Destination: fieldValues.destinationList,
        UOM: fieldValues.uomType,
        MinimumWtKgs: fieldValues.minimumWeight,
        UptoWeightKgs: fieldValues.uptoWeight,
        Rate: fieldValues.rate,
        TariffType: fieldValues.tariffType,
        CurrencyCode: fieldValues.currencyCode,
        created_by: userLoginID,
        created_at: localtimeStamp
    };

    try {
        // Check duplicate: Query with key fields that define uniqueness
        let duplicateQuery = supabaseClient
            .from('PartyTariff')
            .select('id')
            .eq('PartyCode', payload.PartyCode)
            .eq('EffectiveDate', payload.EffectiveDate)
            .eq('MovementType', payload.MovementType)
            .eq('TransitType', payload.TransitType)
            .eq('ModeType', payload.ModeType)
            .eq('ShippingType', payload.ShippingType)
            .eq('ContainerType', payload.ContainerType)
            .eq('Carrier', payload.Carrier)
            .eq('Origin', payload.Origin)
            .eq('Destination', payload.Destination)
            .eq('TariffType', payload.TariffType);

        if (isEdit && tariffId) {
            duplicateQuery = duplicateQuery.neq('id', tariffId);  // exclude current row when editing
        }

        const { data: existingDuplicates, error: dupError } = await duplicateQuery;

        if (dupError) throw dupError;

        if (existingDuplicates && existingDuplicates.length > 0) {
            alert('Duplicate tariff entry detected. Please modify your entry.');
            return;  // Stop saving
        }

        // No duplicate found - proceed with insert or update
        const { error } = isEdit
            ? await supabaseClient.from('PartyTariff').update(payload).eq('id', tariffId)
            : await supabaseClient.from('PartyTariff').insert([payload]);

        if (error) throw error;

        alert(isEdit ? 'Tariff updated successfully!' : 'Tariff added successfully!');
        addTariffButton.textContent = 'Add Tariff';

        if (typeof form.reset === 'function') {
            form.reset();
        } else {
            fieldIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }

        fetchTariffs(fieldValues.partyCodes);
        toggleButtons(".editTariff", true);

        // Reset edit state after successful save
        isEditingTariff = false;
        editingTariffId = null;

    } catch (error) {
        console.error('Error saving tariff:', error);
        alert('Failed to save tariff. Check console for details.');
    } finally {
        formFields.forEach(f => f.disabled = false);
        addTariffButton.textContent = 'Add Tariff';
    }
}


// Edit tariff
async function editTariffDetails(tariffId) {
    const form = document.getElementById('tariff');
    const formFields = form.querySelectorAll('input, select, button');

    formFields.forEach(f => f.disabled = true);

    try {
        const { data, error } = await supabaseClient
            .from('PartyTariff')
            .select('*')
            .eq('id', tariffId)
            .single();

        if (error) throw error;

        for (const [elementId, field] of Object.entries(tariffFieldMap)) {
            const el = document.getElementById(elementId);
            if (el) {
                el.value = data[field] ?? '';
                el.classList.add('highlight-field');
                setTimeout(() => el.classList.remove('highlight-field'), 1000);
            }
        }

        // Set edit state
        isEditingTariff = true;
        editingTariffId = tariffId;

        addTariffButton.textContent = 'Update Tariff';
        form.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('effectiveDate')?.focus();

    } catch (error) {
        console.error('Error fetching tariff:', error);
        alert('Failed to fetch tariff details.');
    } finally {
        formFields.forEach(f => f.disabled = false);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    enforceUppercaseOnly(document.getElementById('currencyCode'));
});

async function fetchFilteredTariffs(partyCode) {
    const filters = {
        EffectiveDate: document.getElementById('effectiveDate')?.value,
        MovementType: document.getElementById('movementType')?.value,
        TransitType: document.getElementById('transitType')?.value,
        ModeType: document.getElementById('modeType')?.value,
        Carrier: document.getElementById('carrierName')?.value,
        ShippingType: document.getElementById('shippingType')?.value,
        ContainerType: document.getElementById('containerType')?.value,
        Origin: document.getElementById('originListFilter')?.value,
        Destination: document.getElementById('destinationList')?.value,
        TariffType: document.getElementById('tariffType')?.value,
    };

    const tableBody = document.getElementById('tariffTableBody');
    tableBody.innerHTML = '<tr><td colspan="16" class="text-center">Loading tariffs...</td></tr>';

    // Build Supabase query with dynamic filters
    let query = supabaseClient
        .from('PartyTariff')
        .select('*')
        .eq('PartyCode', partyCode)
        .order('id', { ascending: true });

    // Apply filters only if values exist (and not empty strings)
    for (const [key, value] of Object.entries(filters)) {
        if (value && value.trim() !== '') {
            if (key === 'EffectiveDate') {
                query = query.eq(key, value); // exact date match
            } else {
                query = query.ilike(key, `%${value}%`); // case-insensitive partial match
            }
        }
    }

    // Optional: order results by id ascending
    query = query.order('id', { ascending: true });

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching filtered tariffs:', error);
        tableBody.innerHTML = '<tr><td colspan="16" class="text-center text-danger">Failed to fetch data</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="16" class="text-center">No Tariff matched the filters</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    data.forEach((tariff, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${index + 1}</td> <!-- Serial number -->
      <td>${tariff.EffectiveDate}</td>
      <td>${tariff.MovementType}</td>
      <td>${tariff.TransitType}</td>
      <td>${tariff.ModeType}</td>
      <td>${tariff.ShippingType}</td>
      <td>${tariff.ContainerType || 'N/A'}</td>
      <td>${tariff.Carrier}</td>
      <td>${tariff.Origin}</td>
      <td>${tariff.Destination}</td>
      <td>${tariff.UOM}</td>
      <td>${tariff.MinimumWtKgs}</td>
      <td>${tariff.UptoWeightKgs}</td>
      <td>${tariff.Rate}</td>
      <td>${tariff.TariffType}</td>
      <td>${tariff.CurrencyCode}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 editTariff" data-id="${tariff.id}">
          <i class="bi bi-pencil-square"></i> Edit
        </button>
      </td>
    `;
        tableBody.appendChild(row);
    });

    toggleButtons(".editTariff", true);
}

const filterFields = [
    'effectiveDate', 'movementType', 'transitType',
    'modeType', 'carrierName', 'shippingType',
    'containerType', 'originList', 'destinationList',
    'tariffType'  // Make sure this matches your element ID exactly
];

filterFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', () => {
            const partyCode = document.getElementById('partyCodes').value;
            fetchFilteredTariffs(partyCode);
        });
    }
});

