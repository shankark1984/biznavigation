loadSuggestions('partySuggestions', 'PartyDetails', companyID, 'PartyCode', 'PartyName');
loadSuggestions('vendorSuggestions', 'PartyDetails', companyID, 'PartyCode', 'PartyName');

async function loadAWBNoDetails(query) {
    if (!query) return;

    const { data, error } = await supabaseClient
        .from('international_booking')
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

const awbNoInput = document.getElementById('awbNo');

awbNoInput.addEventListener('change', async () => {
    const docketNo = awbNoInput.value.trim();

    if (!docketNo) return; // Guard clause for empty input

    try {
        await fetchDocketDetails(docketNo);
        await setupChargeTypeValidation();

        const tempFormID = freightElements.tempFormID.value.trim();
        console.log('tempFormID:', tempFormID);

        // Skip loading additional details if it's a TEMP form
        if (tempFormID.includes('TEMP')) return;

        console.log('Loading AWB details for ID:', tempFormID);

        // Load other sections in parallel if independent
        await Promise.all([
            loadFreightCharges(),
            loadVolumetricDetails(),
            fetchContainerDetails(tempFormID),
            loadBookingStatus(docketNo, companyID)
        ]);

    } catch (error) {
        console.error('Error loading AWB details:', error);
        alert('Failed to load docket details. Please try again.');
    }
});


async function fetchDocketDetails(docketNo) {
    const { data, error } = await supabaseClient
        .from('international_booking')
        .select('*')
        .eq('DocketNo', docketNo)
        .eq('company_id', companyID)
        .maybeSingle();

    if (error) {
        console.error('Error fetching docket details:', error);
        return;
    }

    if (!data) {
        console.log('No record found for this Docket No');
        return;
    }
    // Map fields

    document.getElementById('tempFormID').value = data.id;
    document.getElementById('status').value = data.Status
    document.getElementById('partyCode').value = data.CustomerCode
    document.getElementById('partyName').value = data.CustomerName;
    document.getElementById('bookedDate').value = data.BookedDate;
    document.getElementById('status').value = data.Status;
    document.getElementById('movementTypeI').value = data.MovementType;
    document.getElementById('transitTypeI').value = data.TransitType;
    document.getElementById('modeTypeI').value = data.ModeType;
    document.getElementById('poNo').value = data.PONo;
    document.getElementById('shippingType').value = data.ShippingType;
    document.getElementById('carrierName').value = data.CourierName;
    document.getElementById('serviceProviderCode').value = data.ServiceProviderCode;
    document.getElementById('serviceProvider').value = data.ServiceProviderName;
    document.getElementById('shipperRef').value = data.ShipperRef;
    document.getElementById('invoiceValue').value = data.ConsignmentValue;
    document.getElementById('PartyAddress').value = data.PickupAddress;
    document.getElementById('consigneeName').value = data.Consignee;
    document.getElementById('deliveryAddress').value = data.DeliveryAddress;
    document.getElementById('commodity').value = data.Commodity;
    document.getElementById('clearanceMode').value = data.ClearanceMode;
    document.getElementById('originCountry').value = data.OriginName;
    document.getElementById('portOfLoading').value = data.PortofLoading;
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
    document.getElementById('addFreightRow').disabled = true;
}


document.getElementById('newButton').addEventListener('click', function () {
    clearForm();
    enableForm();
    toggleEditMode(true);

    // Button States
    saveButton.disabled = false;
    modifyButton.disabled = true;
    deleteButton.disabled = true;
    reportButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';

    // Enable adding freight
    document.getElementById('addFreightRow').disabled = false;

    // Clear Freight Table
    document.querySelector('#freightTable tbody').innerHTML = '';

    // Clear Container Details Table
    document.querySelector('#containerDetailsTable tbody').innerHTML = '';

    // Clear Volumetric Table
    document.querySelector('#volumetricTable tbody').innerHTML = '';

    // Recalculate Totals
    recalcTotals();
    updateTotals(); // Reset totals display
    const tbody = document.querySelector('#bookingStatusTable tbody').innerHTML = ''; // Clear previous data

    // Disable calculated weight fields
    ['totalActualWtV', 'volumeWtV', 'totalVolumeWtV', 'chargeableWtV', 'chargeableWeight'].forEach(id => {
        document.getElementById(id).disabled = true;
    });
});



document.getElementById('modifyButton').addEventListener('click', async function () {
    enableForm();
    saveButton.disabled = false;
    modifyButton.disabled = true;
    deleteButton.disabled = false;
    reportButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    document.getElementById('awbNo').disabled = true;
    document.getElementById('addFreightRow').disabled = false;

    document.getElementById('chargeableWeight').disabled = true;
    document.getElementById('totalActualWtV').disabled = true;
    document.getElementById('volumeWtV').disabled = true;
    document.getElementById('totalVolumeWtV').disabled = true;
    document.getElementById('chargeableWtV').disabled = true;

    toggleEditMode(false);
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

    console.log('userType: ', userType, '| DocketNo: ', docketNo);

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
        const modal = new bootstrap.Modal(document.getElementById('addConsigneeModal'));
        modal.show();
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
    const modalElement = document.getElementById('addConsigneeModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
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

async function saveOrUpdateInternationalBooking() {
    // Get the button type: "save" or "update"
    const actionType = document.getElementById("saveButton").textContent.trim();
    const updateID = document.getElementById('tempFormID').value;
    console.log('Action Type:', actionType);
    const formData = {
        DocketNo: document.getElementById("awbNo").value,
        BookedDate: document.getElementById("bookedDate").value,
        CustomerCode: document.getElementById("partyCode").value,
        CustomerName: document.getElementById("partyName").value,
        MovementType: document.getElementById("movementTypeI").value,
        TransitType: document.getElementById("transitTypeI").value,
        ModeType: document.getElementById("modeTypeI").value,
        Status: document.getElementById("status").value,
        ServiceProviderCode: document.getElementById("serviceProviderCode").value,
        ServiceProviderName: document.getElementById("serviceProvider").value,
        CourierName: document.getElementById("carrierName").value,
        Consignee: document.getElementById("consigneeName").value,
        ShipperRef: document.getElementById("shipperRef").value,
        Commodity: document.getElementById("commodity").value,
        Origin: document.getElementById("originCountry").value,
        OriginName: document.getElementById("originCountry").value,
        PortofLoading: document.getElementById("portOfLoading").value,
        PickupAddress: document.getElementById("PartyAddress").value,
        Destination: document.getElementById("destinationCountry").value,
        DestinationName: document.getElementById("destinationCountry").value,
        PortofDischarge: document.getElementById("portOfDischarge").value,
        DeliveryAddress: document.getElementById("deliveryAddress").value,
        ClearanceMode: document.getElementById("clearanceMode").value,
        PackingType: document.getElementById("packingType").value,
        ConsignmentValue: parseFloat(document.getElementById("invoiceValue").value) || 0,
        UOMType: document.getElementById("uOMType").value,
        NoofUnit: parseInt(document.getElementById("quantity").value) || 0,
        AcutalWeight: parseFloat(document.getElementById("actualWeight").value) || 0,
        VolumeWeight: parseFloat(document.getElementById("volumetricWeight").value) || 0,
        ChargableWeight: parseFloat(document.getElementById("chargeableWeight").value) || 0,
        CurrencyType: "INR",
        Infomation: document.getElementById("infomation").value,
        PONo: document.getElementById("poNo").value,
        ShippingType: document.getElementById("shippingType").value || 'NA',
        company_id: companyID,
        CreatedBy: userLoginID,
        created_at: localtimeStamp
    };

    let result;

    if (actionType === "Save") {
        // Insert new record
        const { data, error } = await supabaseClient
            .from("international_booking")
            .insert([formData])
            .select(); // Ensure it returns inserted rows

        result = { data, error };
        // console.log("Insert result:", result);

        if (data && data.length > 0) {
            insertedID = data[0].id; // Assuming "id" is the primary key
            // console.log("Inserted ID:", insertedID);
            document.getElementById("tempFormID").value = insertedID;
        }
        const bookingData = {
            ID_IB: insertedID,
            docketNo: document.getElementById("awbNo").value,
            statusDate: document.getElementById("bookedDate").value,
            arrivedAt: workingBranch,
            information: 'Shimpemt Booked',
        };
        const success = await insertBookingStatus(bookingData);

    } else if (actionType === "Update") {
        // Update existing record
        const { data, error } = await supabaseClient
            .from("international_booking")
            .update(formData)
            .eq("id", updateID);
        result = { data, error };
    } else {
        alert("Invalid action type!");
        return;
    }
    // console.log("Inserted ID:", insertedID);
    if (result.error) {
        console.error("Save/Update failed:", result.error.message);
        alert("Failed to save data: " + result.error.message);
    } else {
        alert("Data saved successfully!");
        console.log("Success:", result.data);
    }
}

document.getElementById('saveButton').addEventListener('click', async function () {
    await saveOrUpdateInternationalBooking();

    saveButton.disabled = true;
    modifyButton.disabled = false;
    reportButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    deleteButton.disabled = true;
    await saveFreightCharges();
    await saveNewVolumetricRows();
    await saveContainerDetails();
    document.getElementById('addFreightRow').disabled = true;
    disableForm();
    toggleEditMode(true);
    insertedID = null; // Reset insertedID after save
});

document.addEventListener("DOMContentLoaded", function () {
    const actualWeightInput = document.getElementById("actualWeight");
    const volumetricWeightInput = document.getElementById("volumetricWeight");
    const chargeableWeightInput = document.getElementById("chargeableWeight");
    const uOMTypeInput = document.getElementById("uOMType");

    function applyRounding(uom, chargeable, actual) {
        uom = uom?.trim().toLowerCase();
        switch (uom) {
            case 'kgs':
            case 'tons':
                return Math.ceil(chargeable);
            case 'gms':
                if (Number.isInteger(chargeable)) {
                    return chargeable;
                } else {
                    const decimal = chargeable - Math.floor(chargeable);
                    return (decimal <= 0.5)
                        ? Math.floor(chargeable) + 0.5
                        : Math.ceil(chargeable);
                }
            case 'fixed':
                return actual;
            default:
                return chargeable;
        }
    }

    function updateChargeableWeight() {
        const actualVal = actualWeightInput.value;
        const volVal = volumetricWeightInput.value;
        const uomVal = uOMTypeInput?.value;

        // Only proceed if all three values are entered
        if (actualVal === "" || volVal === "" || !uomVal) {
            chargeableWeightInput.value = ""; // Clear if incomplete
            return;
        }

        const actual = parseFloat(actualVal);
        const volumetric = parseFloat(volVal);
        const rawChargeable = Math.max(actual, volumetric);
        const roundedChargeable = applyRounding(uomVal, rawChargeable, actual);
        chargeableWeightInput.value = roundedChargeable.toFixed(2);
    }

    actualWeightInput.addEventListener("input", updateChargeableWeight);
    volumetricWeightInput.addEventListener("input", updateChargeableWeight);
    uOMTypeInput.addEventListener("change", updateChargeableWeight);
});



document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('modeTypeI').addEventListener('change', async function () {
        const modeType = this.value;
        const containerElement = document.getElementById('containerType');

        if (!containerElement) {
            console.error('Element with id="containerType" not found.');
            return;
        }
        if (modeType === 'FTL') {
            await loadDropdownOptions('VehicleType', 'containerType');
        } else if (modeType === 'FCL') {
            await loadDropdownOptions('ContainerType', 'containerType');
        } else {
            containerElement.innerHTML = ''; // Clear options if modeType is neither FTL nor FCL
        }
    });
});
document.addEventListener('DOMContentLoaded', async () => {
    const ports = await fetchPortList();
    populateDatalist('portOfLoadingDatalist', ports);
    populateDatalist('portOfDischargeDatalist', ports);
});