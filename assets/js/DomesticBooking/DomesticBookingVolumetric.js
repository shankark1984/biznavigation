function getValue(id) {
    return document.getElementById(id)?.value?.trim();
}

async function fetchTariffRate() {
    const partyCode = getValue('customerCode');
    const bookedDate = getValue('bookingDate');
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

//when customer as been selected, fetch tariff rate for Freight Amount & other fixed charges details from table "FixedCharges" 
// in the database supabase table and add to charges table

document.getElementById('customerCode').addEventListener('change', async () => {
    await fetchTariffRate();
});