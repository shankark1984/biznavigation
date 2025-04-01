async function loadAWBNoDetails(query) {
    if (!query) return;

    const { data, error } = await supabaseClient
        .from('international_booking')
        .select('DocketNo')
        .ilike('DocketNo', `%${query}%`)
        .limit(10);

    if (error) {
        console.error('Error fetching docket numbers:', error);
        return;
    }

    const dataList = document.getElementById('docketNoSuggestions');
    dataList.innerHTML = '';

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.DocketNo;
        dataList.appendChild(option);
    });
}

async function fetchDocketDetails(docketNo) {
    const { data, error } = await supabaseClient
        .from('international_booking')
        .select('*')
        .eq('DocketNo', docketNo)
        .single();

    if (error) {
        console.error('Error fetching docket details:', error);
        return;
    }

    // Map fields
    document.getElementById('partyName').value = data.CustomerName;
    document.getElementById('bookedDate').value = data.BookedDate;
    document.getElementById('status').value = data.Status;
    document.getElementById('transactionType').value = data.TransctionType;
    document.getElementById('transitTypeInternational').value = data.Mode;
    document.getElementById('modeType').value = data.LoadType;
    document.getElementById('poNo').value = data.PONo;
    document.getElementById('shippingType').value = data.ShippingType;
    document.getElementById('carrierName').value = data.CourierName;
    document.getElementById('serviceProvider').value = data.ServiceProviderName;
    document.getElementById('shipperRef').value = data.ShipperRef;
    document.getElementById('invoiceValue').value = data.ConsignmentValue;
    document.getElementById('PartyAddress').value = data.PickupAddress;
    document.getElementById('consigneeName').value = data.Consignee;
    document.getElementById('deliveryAddress').value = data.DeliveryAddress;
    document.getElementById('commodity').value = data.Commodity;
    document.getElementById('clearanceMode').value = data.ClearanceMode;
    document.getElementById('originCountry').value = data.OriginName;
    document.getElementById('destinationCountry').value = data.DestinationName;
    document.getElementById('packingType').value = data.PackingType;
    document.getElementById('uOMType').value = data.UOMType;
    document.getElementById('quantity').value = data.NoofUnit;
    document.getElementById('actualWeight').value = data.AcutalWeight;
    document.getElementById('volumetricWeight').value = data.VolumeWeight;
    document.getElementById('chargeableWeight').value = data.ChargableWeight;
    document.getElementById('infomation').value = data.Infomation;
}

// Event listener for selection
const awbNoInput = document.getElementById('awbNo');
awbNoInput.addEventListener('change', () => fetchDocketDetails(awbNoInput.value));
