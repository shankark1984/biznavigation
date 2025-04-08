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
    disableForm();
    deleteButton.disabled = true;
    saveButton.disabled = true;
    modifyButton.disabled = false;
    reportButton.disabled = false;
}

// Event listener for selection
const awbNoInput = document.getElementById('awbNo');
awbNoInput.addEventListener('change', () => fetchDocketDetails(awbNoInput.value));

document.getElementById('newButton').addEventListener('click', function () {
    location.reload();
    enableForm();
    saveButton.disabled = false;
    modifyButton.disabled = true;
    saveButton.textContent = 'Save';
    clearForm(); // Assuming there's a clearForm function
});


document.getElementById('modifyButton').addEventListener('click', async function () {
    enableForm();
    saveButton.disabled = false;
    modifyButton.disabled = true;
    deleteButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    if (userType === 1 || userType === 2) {
        const { data, error } = await supabaseClient
            .from('international_booking')
            .delete()
            .eq('DocketNo', awbNoInput); // Replace `docketNo` with your variable

        if (error) {
            console.error("Error deleting record:", error.message);
        } else {
            console.log("Record deleted successfully:", data);
        }
    }

});

document.getElementById('deleteButton').addEventListener('click', async function () {
    const awbNoInput = document.getElementById('awbNo');
    const docketNo = awbNoInput.value.trim();

    // Reset button states
    saveButton.disabled = false;
    modifyButton.disabled = true;
    deleteButton.disabled = true;
    reportButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    console.log('userType:', userType, '| DocketNo:', docketNo);

    if (userType === 1 || userType === 2) {
        const { data, error } = await supabaseClient
            .from('international_booking')
            .delete()
            .eq('DocketNo', docketNo);

        if (error) {
            console.error("Error deleting record:", error.message);
        } else {
            console.log("Record deleted successfully:", data);
            // Optional: reload page after deletion
            // location.reload();
        }
    } else {
        console.warn("You do not have permission to delete this record.");
    }
});


