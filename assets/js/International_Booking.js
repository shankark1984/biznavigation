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
    document.getElementById('movementType').value = data.TransctionType;
    document.getElementById('transitTypeI').value = data.TransitType;
    document.getElementById('modeTypeI').value = data.ModeType;
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
    saveButton.innerHTML = '<i class="bi bi-save"></i> Save';
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
    // Get values from HTML fields
    const formData = {
        DocketNo: document.getElementById("awbNo").value,
        BookedDate: document.getElementById("bookedDate").value,
        CustomerCode: document.getElementById("partyCode").value,
        CustomerName: document.getElementById("partyName").value,
        MovementType: document.getElementById("MovementTypeI").value,
        TransitType: document.getElementById("transitTypeI").value,
        ModeType: document.getElementById("modeTypeI").value,
        Status: document.getElementById("status").value,
        ServiceProviderCode: document.getElementById("vendorCode").value,
        ServiceProviderName: document.getElementById("serviceProvider").value,
        CourierCode: document.getElementById("carrierCode").value,
        CourierName: document.getElementById("carrierName").value,
        Consignee: document.getElementById("consigneeName").value,
        ShipperRef: document.getElementById("shipperRef").value,
        Commodity: document.getElementById("commodity").value,
        Origin: document.getElementById("originCountry").value,
        OriginName: document.getElementById("originCountry").value,
        PickupAddress: document.getElementById("PartyAddress").value,
        Destination: document.getElementById("destinationCountry").value,
        DestinationName: document.getElementById("destinationCountry").value,
        DeliveryAddress: document.getElementById("deliveryAddress").value,
        ClearanceMode: document.getElementById("clearanceMode").value,
        PackingType: document.getElementById("packingType").value,
        ConsignmentValue: parseFloat(document.getElementById("invoiceValue").value) || 0,
        UOMType: document.getElementById("uOMType").value,
        NoofUnit: parseInt(document.getElementById("quantity").value) || 0,
        AcutalWeight: parseFloat(document.getElementById("actualWeight").value) || 0,
        VolumeWeight: parseFloat(document.getElementById("volumetricWeight").value) || 0,
        ChargableWeight: parseFloat(document.getElementById("chargeableWeight").value) || 0,
        // BasicFrightAmt: parseFloat(document.getElementById("BasicFrightAmt").value) || 0,
        // FSCAmt: parseFloat(document.getElementById("FSCAmt").value) || 0,
        // OtherAmt: parseFloat(document.getElementById("OtherAmt").value) || 0,
        // TotalAmount: parseFloat(document.getElementById("TotalAmount").value) || 0,
        CurrencyType: "INR",
        Infomation: document.getElementById("infomation").value,
        PONo: document.getElementById("poNo").value,
        // InvoiceStatus: document.getElementById("InvoiceStatus").value,
        // InvoiceNumber: document.getElementById("InvoiceNumber").value,
        // InvAmdNo: document.getElementById("InvAmdNo").value,
        // FrightType: document.getElementById("FrightType").value,
        ShippingType: document.getElementById("shippingType").value,
        company_id: companyID,
        CreatedBy: userLoginID
    };

    const { data: existing, error: checkError } = await supabaseClient
        .from("international_booking")
        .select("DocketNo")
        .eq("DocketNo", formData.DocketNo)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        console.error("Error checking existing DocketNo:", checkError.message);
        return;
    }

    let result;

    if (existing) {
        // Update existing
        const { data, error } = await supabaseClient
            .from("international_booking")
            .update(formData)
            .eq("DocketNo", formData.DocketNo);
        result = { data, error };
    } else {
        // Insert new
        const { data, error } = await supabaseClient
            .from("international_booking")
            .insert([formData]);
        result = { data, error };
    }

    if (result.error) {
        console.error("Save/Update failed:", result.error.message);
        alert("Failed to save data: " + result.error.message);
    } else {
        alert("Data saved successfully!");
        console.log("Success:", result.data);
    }
}

document.getElementById('saveButton').addEventListener('click', function () {
    saveOrUpdateInternationalBooking();
    disableForm();
    saveButton.disabled = true;
    modifyButton.disabled = false;
    reportButton.disabled = false;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
});