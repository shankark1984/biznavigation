async function calculateChargeableWeight() {
    let actualWeight = parseFloat(document.getElementById("actualWeight").value) || 0;
    let volumetricWeight = parseFloat(document.getElementById("volumetricWeight").value) || 0;
    let uOMType = document.getElementById("uOMType").value;

    let chargeableWeight = Math.max(actualWeight, volumetricWeight);

    if (uOMType === "Gms") {
        chargeableWeight = Math.ceil(chargeableWeight * 2) / 2; // Round up to nearest 0.5
    } else {
        chargeableWeight = Math.ceil(chargeableWeight); // Round up to next integer
    }

    let chargeableWeightInput = document.getElementById("chargeableWeight");
    chargeableWeightInput.value = chargeableWeight;
    chargeableWeightInput.readOnly = true; // Disable manual editing
}

// Attach event listeners to update chargeable weight dynamically
document.getElementById("actualWeight").addEventListener("input", calculateChargeableWeight);
document.getElementById("volumetricWeight").addEventListener("input", calculateChargeableWeight);
document.getElementById("uOMType").addEventListener("input", calculateChargeableWeight);




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


async function consigneeDetails(query, typeOfValue, datalistId) {
    console.log('Fetching consignee...' + companyID);

    const datalist = document.getElementById(datalistId);

    if (!query.trim()) {
        datalist.innerHTML = ''; // Clear suggestions if input is empty
        return;
    }

    try {
        const { data: consignee, error } = await supabaseClient
            .from('Consignee_Details')
            .select('ConsigneeName, ConsigneeAddress')
            .eq('Company_ID', companyID)
            .ilike('ConsigneeName', `%${query}%`);

        if (error) {
            console.error('Error fetching consignee details:', error);
            return;
        }

        let suggestions = consignee.map(row =>
            `<option value="${row.ConsigneeName}" data-address="${row.ConsigneeAddress}">${row.ConsigneeName}</option>`
        ).join('');

        // If no consignee is found, always add "Add New Consignee"
        if (consignee.length === 0) {
            suggestions += `<option value="Add New Consignee">Add New Consignee</option>`;
        }

        datalist.innerHTML = suggestions;
    } catch (error) {
        console.error('Error loading consignee details:', error);
    }
}

function updateDeliveryAddress() {
    const consigneeNameInput = document.getElementById('consigneeName');
    const deliveryAddressInput = document.getElementById('deliveryAddress');
    const selectedConsignee = consigneeNameInput.value;

    if (selectedConsignee === "Add New Consignee") {
        showModal();
        consigneeNameInput.value = ''; // Clear input to prevent accidental form submission
        return;
    }

    // Find matching option in datalist
    const options = document.getElementById('consigneeNameSuggestions').children;
    for (let option of options) {
        if (option.value === selectedConsignee) {
            deliveryAddressInput.value = option.getAttribute('data-address') || '';
            return;
        }
    }
}

function showModal() {
    document.getElementById('addConsigneeModal').style.display = 'block';
}

function hideModal() {
    document.getElementById('addConsigneeModal').style.display = 'none';
}

async function addNewConsignee(event) {
    event.preventDefault(); // Prevent default form submission

    const newConsignee = {
        ConsigneeName: document.getElementById('newConsigneeName').value.trim(),
        ConsigneeAddress: document.getElementById('newConsigneeAddress').value.trim(),
        ContactPerson: document.getElementById('newContactPerson').value.trim(),
        ContactNumber: document.getElementById('newContactNumber').value.trim(),
        EmailID: document.getElementById('newEmailID').value.trim(),
        Company_ID: companyID,
        created_by: userLoginID // Ensure `userID` is defined
    };

    // Ensure required fields are filled
    if (!newConsignee.ConsigneeName || !newConsignee.ConsigneeAddress || !newConsignee.ContactPerson ||
        !newConsignee.ContactNumber || !newConsignee.EmailID) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('Consignee_Details')
            .insert([newConsignee]);

        if (error) {
            console.error('Error adding consignee:', error);
            alert('Failed to add consignee.');
            return;
        }

        alert('Consignee added successfully!');
        hideModal();

        // Update main form input fields after adding new consignee
        document.getElementById('consigneeName').value = newConsignee.ConsigneeName;
        document.getElementById('deliveryAddress').value = newConsignee.ConsigneeAddress;

        // Refresh consignee list
        consigneeDetails(newConsignee.ConsigneeName, 'ConsigneeName', 'consigneeNameSuggestions');
    } catch (error) {
        console.error('Error inserting consignee:', error);
    }
}

// Ensure datalist is always shown, including "Add New Consignee"
document.getElementById('consigneeName').addEventListener('focus', function () {
    this.setAttribute('list', 'consigneeNameSuggestions');
});

function handleDetails(detailType, value) {
    console.log(`${detailType}: ${value}`);
}
let value = "example";
// Example usage:
handleDetails('transactionType', value);
handleDetails('transitTypeInternational', value);
handleDetails('modeType', value);
handleDetails('poNo', value);
handleDetails('shippingType', value);
handleDetails('cargoCarrier', value);
handleDetails('shipperRef', value);
handleDetails('PartyAddress', value);
handleDetails('commodity', value);
handleDetails('clearanceModeDetails', value);
handleDetails('packing', value);
handleDetails('uOMType', value);


