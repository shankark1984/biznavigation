// Add event listener for add button
const addButton = document.getElementById('addOrUpdateTariff');
addButton.addEventListener('click', () => addOrUpdateTariff());


$(document).on('click', '.editTariff', function () {
    const tariffId = $(this).data('id');
    editTariffDetails(tariffId);
});
async function fetchTariffs(partyCode) {
    const tableBody = document.getElementById('tariffTableBody');
    tableBody.innerHTML = '';
    console.log('Fetching tariffs for party code:', partyCode);
    const { data, error } = await supabaseClient
        .from('PartyTariff')
        .select('*')
        .eq('PartyCode', partyCode);

    if (error) {
        console.error('Error fetching tariffs:', error);
        return;
    }

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="15" class="text-center">No Tariff added for this party</td></tr>';
        return;
    }

    data.forEach(tariff => {
        const row = document.createElement('tr');
        row.innerHTML = `
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
            <td>
                                <button type="button"
                            class="btn btn-sm btn-outline-primary me-1 editTariff"
                            data-id="${tariff.id}">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
        
            </td>
        `;
        tableBody.appendChild(row);

        toggleButtons(".editTariff", false); //Disable edit and delete buttons
    });
}

async function addOrUpdateTariff(isEdit = false, tariffId = null) {
    const partyCode = document.getElementById('partyCodes').value;
    const effectiveDate = document.getElementById('effectiveDate').value;
    const movementType = document.getElementById('movementType').value;
    const transitType = document.getElementById('transitType').value;
    const modeType = document.getElementById('modeType').value;
    const shippingType = document.getElementById('shippingType').value;
    const containerType = document.getElementById('containerType').value;
    const carrierName = document.getElementById('carrierName').value;
    const origin = document.getElementById('originList').value;
    const destination = document.getElementById('destinationList').value;
    const uomType = document.getElementById('uomType').value;
    const minimumWeight = document.getElementById('minimumWeight').value;
    const uptoWeight = document.getElementById('uptoWeight').value;
    const rate = document.getElementById('rate').value;
    const tariffType = document.getElementById('tariffType').value;

    const payload = {
        PartyCode: partyCode,
        EffectiveDate: effectiveDate,
        MovementType: movementType,
        TransitType: transitType,
        ModeType: modeType,
        ShippingType: shippingType,
        ContainerType: containerType,
        Carrier: carrierName,
        Origin: origin,
        Destination: destination,
        UOM: uomType,
        MinimumWtKgs: minimumWeight,
        UptoWeightKgs: uptoWeight,
        Rate: rate,
        TariffType: tariffType,
        created_by: 'admin',
    };

    let response;
    if (isEdit) {
        response = await supabaseClient
            .from('PartyTariff')
            .update(payload)
            .eq('id', tariffId);
    } else {
        response = await supabaseClient
            .from('PartyTariff')
            .insert([payload]);
    }

    if (response.error) {
        console.error('Error saving tariff:', response.error);
        return;
    }

    alert(isEdit ? 'Tariff updated successfully!' : 'Tariff added successfully!');
    fetchTariffs(partyCode);
}

function editTariffDetails(tariffId) {
    supabaseClient
        .from('PartyTariff')
        .select('*')
        .eq('id', tariffId)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching tariff:', error);
                return;
            }

            document.getElementById('effectiveDate').value = data.EffectiveDate;
            document.getElementById('movementType').value = data.MovementType;
            document.getElementById('transitType').value = data.TransitType;
            document.getElementById('modeType').value = data.ModeType;
            document.getElementById('shippingType').value = data.ShippingType;
            document.getElementById('containerType').value = data.ContainerType;
            document.getElementById('carrierName').value = data.Carrier;
            document.getElementById('originList').value = data.Origin;
            document.getElementById('destinationList').value = data.Destination;
            document.getElementById('uomType').value = data.UOM;
            document.getElementById('minimumWeight').value = data.MinimumWtKgs;
            document.getElementById('uptoWeight').value = data.UptoWeightKgs;
            document.getElementById('rate').value = data.Rate;
            document.getElementById('tariffType').value = data.TariffType;

            addButton.textContent = 'Update Tariff';
            addButton.onclick = function () {
                addOrUpdateTariff(true, tariffId);
            };
        });
}
