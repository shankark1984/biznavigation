document.addEventListener("DOMContentLoaded", async () => {

    enableForm();

    await loadSuggestions('customerNameSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
    await loadSuggestions('consignorNameSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
    await loadSuggestions('serviceProviderSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
});

const actualWeightInput = document.getElementById('actualWeight');
const volumetricWeightInput = document.getElementById('volumetricWeight');
const chargeableWeightInput = document.getElementById('chargeableWeight');

function updateChargeableWeight() {
    const actualWeight = parseFloat(actualWeightInput.value) || 0;
    const volumetricWeight = parseFloat(volumetricWeightInput.value) || 0;

    const maxWeight = Math.max(actualWeight, volumetricWeight);
    chargeableWeightInput.value = maxWeight.toFixed(2);
}

// Call this function whenever actualWeight or volumetricWeight changes
actualWeightInput.addEventListener('input', updateChargeableWeight);
volumetricWeightInput.addEventListener('input', updateChargeableWeight);

// Initialize initially
updateChargeableWeight();

const docketInput = document.getElementById('docketNo');

docketInput.addEventListener('focus', () => {
    loadAWBNoDetails('');
});

docketInput.addEventListener('input', (e) => {
    loadAWBNoDetails(e.target.value);
    fetchBookingDetails(e.target.value);
});

async function loadAWBNoDetails(query) {
    if (!query) return;

    const { data, error } = await supabaseClient
        .from('DomesticBookingDetails')
        .select('DocketNo')
        .ilike('DocketNo', `${query}%`)
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
async function fetchBookingDetails(docketNo) {
    if (!docketNo) return;

    const { data, error } = await supabaseClient
        .from('DomesticBookingDetails')
        .select('*')
        .eq('DocketNo', docketNo)
        .eq('company_id', CompanyID)
        .maybeSingle();

    if (error) {
        console.error('Error fetching booking details:', error);
        return;
    }

    if (!data) {
        // Optionally, show a message that no record was found
        // console.warn('No booking details found for this Docket No and CompanyID.');
        // Optionally reset form fields or handle UI for not found
        return;
    }

    // Populate the form fields
    document.getElementById('customerCode').value = data.CustomerCode;
    document.getElementById('customerName').value = data.CustomerName;
    document.getElementById('bookingDate').value = data.BookingDate;
    document.getElementById('shippingTypeD').value = data.ShippingType;
    document.getElementById('transitTypeD').value = data.TransitType;
    document.getElementById('modeTypeD').value = data.ModeType;
    document.getElementById('serviceProviderName').value = data.ServiceProvider;
    document.getElementById('customerReferenceNo').value = data.CustomerReferenceNo;
    document.getElementById('invoiceValue').value = data.InvoiceValue;
    document.getElementById('paymentType').value = data.PaymentType;
    document.getElementById('consignorName').value = data.ConsignorName;
    document.getElementById('originPinCode').value = data.OriginPincode;
    document.getElementById('originCity').value = data.OriginCity;
    document.getElementById('originAddress').value = data.OriginAddress;
    document.getElementById('consigneeName').value = data.ConsigneeName;
    document.getElementById('destinationPincode').value = data.DestinationPincode;
    document.getElementById('destinationCity').value = data.DestinationCity;
    document.getElementById('destinationAddress').value = data.DestinationAddress;
    document.getElementById('quantity').value = data.Quantity;
    document.getElementById('actualWeight').value = data.ActualWeight;
    document.getElementById('volumetricWeight').value = data.VolumetricWeight;
    document.getElementById('chargeableWeight').value = data.ChargeableWeight;
    document.getElementById('cargoDescription').value = data.CargoDescription;

    loadDomesticBookingCharges(data.id);

    saveButton.dataset.mode = 'update';
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    saveButton.disabled = true;
    modifyButton.disabled = false;
    reportButton.disabled = false;
    disableForm();

}


document.getElementById('saveButton').addEventListener('click', async () => {
    const docketNoInput = document.getElementById('docketNo');
    const mode = document.getElementById('saveButton').dataset.mode;

    // Helper: safely get element value
    const val = id => document.getElementById(id)?.value || "";

    // Collect form data
    const formData = {
        DocketNo: val('docketNo'),
        BookingDate: val('bookingDate'),
        CustomerCode: val('customerCode'),
        CustomerName: val('customerName'),
        ShippingType: val('shippingTypeD'),
        ConsignorName: val('consignorName'),
        OriginPincode: val('originPinCode'),
        OriginCity: val('originCity'),
        OriginAddress: val('originAddress'),
        ConsigneeName: val('consigneeName'),
        DestinationPincode: val('destinationPincode'),
        DestinationCity: val('destinationCity'),
        DestinationAddress: val('destinationAddress'),
        TransitType: val('transitTypeD'),
        ModeType: val('modeTypeD'),
        ServiceProvider: val('serviceProviderName'),
        CustomerReferenceNo: val('customerReferenceNo'),
        InvoiceValue: val('invoiceValue'),
        Quantity: val('quantity'),
        ActualWeight: val('actualWeight'),
        VolumetricWeight: val('volumetricWeight'),
        ChargeableWeight: val('chargeableWeight'),
        CargoDescription: val('cargoDescription'),
        PaymentType: val('paymentType')
    };

    // Add audit fields
    if (mode === 'insert') {
        Object.assign(formData, {
            created_by: UserLoginID,
            created_at: localtimeStamp,
            company_id: CompanyID
        });
    } else if (mode === 'update') {
        Object.assign(formData, {
            update_by: UserLoginID,
            update_at: localtimeStamp
        });
    }

    try {
        let query = supabaseClient.from('DomesticBookingDetails');
        let response;

        if (mode === 'insert') {
            response = await query.insert([formData]).select('id');
        } else if (mode === 'update') {
            response = await query
                .update(formData)
                .eq('DocketNo', docketNoInput.value)
                .eq('company_id', CompanyID)
                .select('id');
        } else {
            throw new Error('Invalid mode for saveButton');
        }

        if (response.error) throw response.error;

        insertedID = response.data?.[0]?.id;
        saveDomesticBookingCharges(insertedID);
        console.log(`Booking details ${mode} successful:`, response.data);


        // Update button states
        const saveBtn = document.getElementById('saveButton');
        saveBtn.disabled = true;
        saveBtn.dataset.mode = 'update'; // ensure mode is updated
        if (typeof modifyButton !== "undefined") modifyButton.disabled = false;

    } catch (err) {
        console.error(`Error while ${mode} booking details:`, err);
    }
});


//newbutton on click clear form & enable saveButton
document.getElementById('newButton').addEventListener('click', () => {
    // Clear form fields
    document.querySelectorAll('#root input, #root select').forEach(input => {
        input.value = '';
    });
    // Total container refresh
    // location.reload();


    //clear domestic booking charges table
    const chargesTableBody = document.getElementById('chargesBody');
    chargesTableBody.innerHTML = '';
    chargesTableBody.appendChild(createChargeRow()); // empty record = blank row
    // Enable the save button
    document.getElementById('saveButton').disabled = false;
    saveButton.mode = 'insert';
    enableForm();
});

modifyButton.addEventListener('click', () => {
    // Enable form fields for editing
    enableForm();
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
});