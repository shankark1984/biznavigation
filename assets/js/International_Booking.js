function populateDocketNoSuggestions() {
    const suggestions = docketNoDetails
        .map(docket => `<option value="${docket.awbNo}">${docket.awbNo}</option>`) // Populate the AWB No
        .join('');
    document.getElementById('docketNoSuggestions').innerHTML = suggestions; // Update the datalist
}

// Example: Call this function after successfully loading data
async function loadAWBNoDetails(query = '') {
    try {
        const { data: docketNoData, error } = await supabaseClient
            .from('international_booking')
            .select('*')
            .eq('company_id', companyID) // Filter by company ID
            .ilike('DocketNo', `${query}%`) // Case-insensitive partial matching
            .order('DocketNo', { ascending: true }); // Order by DocketNo

        if (error) {
            console.error('Error fetching party details:', error);
            return;
        }

        docketNoDetails = docketNoData.map(row => ({
            awbNo: row.DocketNo,
            bookedDate: row.BookedDate,
            transactionType: row.TransctionType,
            partyName: row.CustomerName,
            mode: row.Mode,
            loadType: row.LoadType,
            status: row.Status,
            serviceProvider: row.ServiceProviderName,
            courierName: row.CourierName,
            consigneeName: row.Consignee,
            shipperRef: row.ShipperRef,
            commodity: row.Commodity,
            origin: row.OriginName,
            destination: row.DestinationName,
            clearanceMode: row.ClearanceMode,
            packingType: row.PackingType,
            pickupAddress: row.PickupAddress,
            deliveryAddress: row.DeliveryAddress,
            invoiceValue: row.ConsignmentValue,
            quantity: row.NoofUnit,
            actualWeight: row.AcutalWeight,
            volumetricWeight: row.VolumeWeight,
            chargeableWeight: row.ChargableWeight,
            information: row.Information,
            poNo: row.PONo,
            shippingType: row.ShippingType,
        }));

        // Populate the datalist with the fetched data
        populateDocketNoSuggestions();
    } catch (error) {
        console.error('Error loading docket details:', error);
    }
}


