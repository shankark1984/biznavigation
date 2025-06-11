// Utility functions
function getValue(id) {
    return document.getElementById(id)?.value?.trim();
}

function isValidDate(dateString) {
    return !isNaN(Date.parse(dateString));
}

function debounce(func, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, arguments), delay);
    };
}

async function fetchTariffRate() {
    // Required fields
    const partyCode = getValue('partyCode');
    const bookedDate = getValue('bookedDate');
    const chargeType = getValue('chargesTypeInput');

    if (chargeType !== "Freight Amount") return;
    if (!partyCode || !bookedDate) {
        alert('Party Code and Booked Date are required');
        return;
    }
    if (!isValidDate(bookedDate)) {
        alert('Invalid date format. Please use YYYY-MM-DD');
        return;
    }

    // Optional fields
    const movementType = getValue('movementTypeI');
    const transitType = getValue('transitTypeI');
    const modeType = getValue('modeTypeI');
    const containerType = getValue('ContainerType');
    const carrier = getValue('carrierName');
    const shippingType = getValue('shippingType');
    const origin = getValue('originCountry');
    const portOfLoading = getValue('portOfLoading');
    const destination = getValue('destinationCountry');
    const portOfDischarge = getValue('portOfDischarge');
    const chargeableWeight = parseFloat(getValue('chargeableWeight') || 0);
    const currencyCode = getValue('currencyCode');


    try {
        // Build query dynamically
        let query = supabaseClient
            .from('PartyTariff')
            .select('*')
            .eq('PartyCode', partyCode)
            .lte('EffectiveDate', bookedDate)
            .eq('TariffType', 'Sell')
            .order('EffectiveDate', { ascending: false })
            .limit(1);

        if (movementType) query = query.eq('MovementType', movementType);
        if (transitType) query = query.eq('TransitType', transitType);
        if (modeType) query = query.eq('ModeType', modeType);
        if (carrier) query = query.eq('Carrier', carrier);
        if (shippingType) query = query.eq('ShippingType', shippingType);
        if (origin) query = query.eq('Origin', origin);
        if (portOfLoading) query = query.eq('PortofLoading', portOfLoading);
        if (destination) query = query.eq('Destination', destination);
        if (portOfDischarge) query = query.eq('PortofDischarge', portOfDischarge);

        const { data, error } = await query;

        if (error) throw error;

        if (data?.length) {
            const tariff = data[0];
            const rate = parseFloat(tariff.Rate);
            const total = tariff.UOM === "Fixed"
                ? rate
                : rate * chargeableWeight;

            updatefreightAmount(total, tariff.CurrencyCode);

        } else {
            alert("No matching tariff found. Please enter rate manually.");
            updatefreightAmount(null);
        }
    } catch (error) {
        console.error('Error fetching tariff:', error.message);
        alert('Error fetching tariff rate.');
    }
}

async function updatefreightAmount(value, currencyCode = '') {
    const freightAmount = document.getElementById('freightAmount');
    const currencyCodeInput = document.getElementById('currencyCode');

    const baseCurrency = currencyCode || 'INR'; // Change this if your base currency varies
    const targetCurrency = 'INR';

    if (freightAmount) {
        freightAmount.value = value?.toFixed(2) ?? '';
        if (!value) freightAmount.focus();
    }

    if (currencyCodeInput) {
        currencyCodeInput.value = targetCurrency;
    }

    // Reuse conversion logic
    const currencyConvertedAmt = await convertCurrency({
        amount: value,
        from: baseCurrency,
        to: targetCurrency
    });

    if (currencyConvertedAmt != null) {
        console.log("Converted Amount:", currencyConvertedAmt);
        // You can now use currencyConvertedAmt elsewhere
    }
}



function populateContainerTypes() {
    const table = document.getElementById('containerDetailsTable');
    const containerTypeField = document.getElementById('ContainerType');

    if (!table || !containerTypeField) return;

    const types = new Set(
        Array.from(table.querySelectorAll('tbody tr'))
            .flatMap(row => {
                const cells = row.querySelectorAll('td');
                return cells.length > 0 ? [cells[0].innerText.trim()] : [];
            })
            .filter(Boolean)
    );

    containerTypeField.innerHTML = '';
    types.forEach(type => {
        const option = new Option(type, type);
        containerTypeField.add(option);
    });
}

// Initialize with debounced fetch
document.addEventListener('DOMContentLoaded', () => {
    const debouncedFetch = debounce(fetchTariffRate, 300);

    const events = [
        ['chargesTypeInput', 'change', fetchTariffRate],
        ['chargeableWeight', 'input', debouncedFetch],
        ['ContainerType', 'change', debouncedFetch],
        ['partyCode', 'change', debouncedFetch]
    ];

    events.forEach(([id, event, handler]) => {
        document.getElementById(id)?.addEventListener(event, handler);
    });

    populateContainerTypes();
});

