// ---------- Utility Functions ----------
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

// ---------- Populate Edit Form ----------
function populateEditForm(existingData) {
    if (!existingData) {
        console.warn("No data provided to populate form.");
        return;
    }

    const fields = [
        'partyCode', 'bookedDate', 'movementTypeI', 'transitTypeI', 'modeTypeI',
        'ContainerType', 'carrierName', 'shippingType',
        'originCountry', 'portOfLoading', 'destinationCountry', 'portOfDischarge',
        'chargeableWeight'
    ];

    fields.forEach(field => {
        document.getElementById(field).value = existingData[field] || '';
    });

    setTimeout(() => fetchTariffRate(), 100);
}

// ---------- Fetch Default Tax ----------
async function fetchDefaultTax(partyCode) {
    const { data, error } = await supabaseClient
        .from('PartyDetails')
        .select('DefaultTax')
        .eq('PartyCode', partyCode)
        .single();

    if (error) {
        console.warn('Failed to fetch DefaultTax:', error.message);
        return null;
    }

    return data?.DefaultTax ?? null;
}

// ---------- Update Freight Amount ----------
async function updatefreightAmount(value, currencyCode = '') {
    const freightAmount = document.getElementById('freightAmount');
    const currencyCodeInput = document.getElementById('currencyCode');
    const baseCurrency = currencyCode || 'INR';
    const targetCurrency = 'INR';

    if (freightAmount) {
        freightAmount.value = value?.toFixed(2) ?? '';
        if (!value) freightAmount.focus();
    }

    if (currencyCodeInput) {
        currencyCodeInput.value = targetCurrency;
    }

    if (value && baseCurrency !== targetCurrency) {
        const currencyConvertedAmt = await convertCurrency({
            amount: value,
            from: baseCurrency,
            to: targetCurrency
        });

        if (currencyConvertedAmt != null) {
            console.log("Converted Amount:", currencyConvertedAmt);
        }
    }
}

// ---------- Fetch Tariff Rate ----------
async function fetchTariffRate() {
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

    const movementType = getValue('movementTypeI');
    const transitType = getValue('transitTypeI');
    const modeType = getValue('modeTypeI');
    const containerType = getValue('ContainerType');
    const carrier = getValue('carrierName');
    const shippingType = getValue('shippingType');
    const origin = getValue('originCountry');
    const portOfLoading = getValue('portOfLoading') || 'NA';
    const destination = getValue('destinationCountry');
    const portOfDischarge = getValue('portOfDischarge') || 'NA';
    const chargeableWeight = parseFloat(getValue('chargeableWeight') || 0);
    const currencyCode = getValue('currencyCode');

    try {
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
            const total = tariff.UOM === "Fixed" ? rate : rate * chargeableWeight;
            updatefreightAmount(total, tariff.CurrencyCode);
        } else {
            console.warn("No tariff found for the given criteria.");
            updatefreightAmount(null);
        }
    } catch (error) {
        console.error('Error fetching tariff:', error.message);
        alert('Error fetching tariff rate.');
    }
}

// ---------- Populate Container Types ----------
function populateContainerTypes() {
    const table = document.getElementById('containerDetailsTable');
    const containerTypeField = document.getElementById('ContainerType');

    if (!table || !containerTypeField) return;

    const types = new Set(
        Array.from(table.querySelectorAll('tbody tr'))
            .map(row => row.querySelector('td')?.innerText.trim())
            .filter(Boolean)
    );

    containerTypeField.innerHTML = '';
    types.forEach(type => {
        containerTypeField.add(new Option(type, type));
    });
}

// ---------- Event Listener Setup ----------
function setupEventListeners() {
    const debouncedFetch = debounce(fetchTariffRate, 300);

    [
        ['chargeableWeight', 'input', debouncedFetch],
        ['ContainerType', 'change', debouncedFetch],
        ['partyCode', 'change', debouncedFetch]
    ].forEach(([id, event, handler]) => {
        document.getElementById(id)?.addEventListener(event, handler);
    });

    document.getElementById('chargesTypeInput')?.addEventListener('change', async function () {
        const selectedValue = this.value;
        const partyCode = getValue('partyCode');

        if (!partyCode) {
            alert('Please enter a Party Code before selecting Charges Type.');
            return;
        }

        document.getElementById('chargesTypeList').value = selectedValue;

        if (selectedValue === "Freight Amount") {
            await fetchTariffRate();
        }

        const tax = await fetchDefaultTax(partyCode);
        if (tax != null) {
            document.getElementById('partyDefaultTax').value = tax;
        }
    });
}

// ---------- DOM Ready ----------
document.addEventListener('DOMContentLoaded', () => {
    populateContainerTypes();
    setupEventListeners();
});
