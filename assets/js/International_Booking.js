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

async function addNewConsignee() {
    const newConsignee = {
        ConsigneeName: document.getElementById('newConsigneeName').value,
        ConsigneeAddress: document.getElementById('newConsigneeAddress').value,
        ContactPerson: document.getElementById('newContactPerson').value,
        ContactNumber: document.getElementById('newContactNumber').value,
        EmailID: document.getElementById('newEmailID').value,
        Company_ID: companyID,
        created_by: userID // Ensure `userID` is defined
    };

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
        consigneeDetails(newConsignee.ConsigneeName, 'ConsigneeName', 'consigneeNameSuggestions'); // Refresh list
    } catch (error) {
        console.error('Error inserting consignee:', error);
    }
}

// Ensure datalist is always shown, including "Add New Consignee"
document.getElementById('consigneeName').addEventListener('focus', function () {
    this.setAttribute('list', 'consigneeNameSuggestions');
});