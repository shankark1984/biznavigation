let movementDetails = [];
const addShipmentBtn = document.getElementById('addShipmentRow');
const shipmentTableBody = document.querySelector('#shipmentDetailsTable tbody');

// Variables for Tracking Shipment State
let deletedShipmentIds = [];
let currentEditShipmentId = null;

document.addEventListener("DOMContentLoaded", async () => {

    enableForm();

    try {

        // Parallel loading tasks
        const suggestionTasks = [
            loadSuggestions('partySuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName'),
            loadSuggestions('vendorSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName'),
        ];

        const dropdownConfigs = [
            ['departmentList', 'Department'],
            ['MovementType', 'movementType'],
            ['ModeType', 'modeType'],
            ['PaymentType', 'paymentType'],
            ['ChargesType', 'chargesTypeList'],
            ['ChargesType', 'vendorChargesTypeList'],
            ['VehicleType', 'vehicleType']
        ];

        const dropdownTasks = dropdownConfigs.map(([id, table]) =>
            loadDropdownOptions(id, table)
        );

        const otherTasks = [
            loadRouteSuggestions(),
            loadTaxData()
        ];

        // Run everything together
        await Promise.all([
            ...suggestionTasks,
            ...dropdownTasks,
            ...otherTasks
        ]);

        // Setup listeners (after dropdowns loaded)
        await Promise.all([
            setupPincodeListener('originPinCode', 'originCity'),
            setupPincodeListener('destinationPinCode', 'destinationCity'),
            setupPincodeListener('shipmentPinCode', 'shipmentCity')
        ]);

        // Set default LR Date
        document.getElementById('lrDate').valueAsDate = new Date();

    } catch (error) {
        console.error("Initialization error:", error);
    }

});

// Container number validation
document.getElementById('containerNumber').addEventListener('input', function () {
    const input = this;
    input.value = input.value.toUpperCase(); // Auto-uppercase as user types

    const feedback = document.getElementById('containerFeedback');
    const result = validateContainerNumber(input.value);

    if (!result.valid) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        feedback.textContent = result.error;
        feedback.classList.remove('d-none');
    } else {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        feedback.classList.add('d-none');
    }
});

document.getElementById("lrNumber").addEventListener("input", function () {
    const query = this.value.trim();
    loadMovementDetails(query);
});

async function loadMovementDetails(query = '') {
    const { data, error } = await supabaseClient
        .from('FullLoadBookingDetails')
        .select('*')
        .eq('company_id', CompanyID)
        .ilike('lr_number', `%${query}%`) // Use ilike for case-insensitive partial matching
        .order('lr_number', { ascending: false }); // Order by party_name A to Z (ascending)

    if (data) {
        // console.log(data); // Check this to ensure all data is retrieved
    }
    if (error) {
        // console.error('Error fetching movement details:', error);
        return;
    }

    movementDetails = data.map(row => ({
        lrNumber: row.lr_number,
        lrDate: row.pickup_date,
        quotationID: row.quotation_id,
        movementType: row.movement_type,
        transitType: row.transit_type,
        partyCode: row.customer_code,
        partyName: row.customer_name,
        originPinCode: row.origin_pincode,
        originCity: row.origin_city,
        originAddress: row.origin_address,
        destinationPinCode: row.destination_pincode,
        destinationCity: row.destination_city,
        destinationAddress: row.destination_address,
        requestedDate: row.requested_date,
        vehicleType: row.vehicle_type,
        referenceNumber: row.reference_number,
        invoiceValue: row.invoice_value,
        vendorCode: row.vendor_code,
        vendorName: row.vendor_name,
        vehicleNumber: row.vehicle_number,
        containerNumber: row.container_number,
        modeType: row.mode_type,
        quantity: row.quantity,
        actualWT: row.actual_weight,
        chargeWT: row.charge_weight,
        paymentType: row.payment_type,
        routeDetails: row.routedetails,
        descriptionOfGoods: row.description_of_goods,
        status: row.status,
        information: row.information,
        completionDate: row.completion_date,
        waybillno: row.waybillno,
    }));

    populateLRNumberSuggestions();
}

function populateLRNumberSuggestions() {
    let suggestions = "";
    movementDetails.forEach(movement => {
        suggestions += `<option data-lr-numbber="${movement.lrNumber}" value="${movement.lrNumber}"></option>`;
    });
    document.getElementById("lrNumberSuggestions").innerHTML = suggestions;
}

// When a LR Number is selected from the dropdown, populate the form with relevant details
$("#lrNumber").on("change", async function () {

    const lrNumber = $(this).val().trim();
    if (!lrNumber) return;

    let movementData = movementDetails.find(
        movement => movement.lrNumber === lrNumber
    );

    // If not found locally → fetch from DB
    if (!movementData) {

        const { data, error } = await supabaseClient
            .from("FullLoadBookingDetails")
            .select("*")
            .eq("lr_number", lrNumber)
            .maybeSingle();

        if (error) {
            console.error("Error fetching LR:", error);
            return;
        }

        if (!data) {
            showToast("No data found for LR:", lrNumber);
            return;
        }

        movementData = {
            lrNumber: data.lr_number,
            lrDate: data.pickup_date,
            quotationID: data.quotation_id,
            movementType: data.movement_type,
            transitType: data.transit_type,
            partyCode: data.customer_code,
            partyName: data.customer_name,
            originPinCode: data.origin_pincode,
            originCity: data.origin_city,
            originAddress: data.origin_address,
            destinationPinCode: data.destination_pincode,
            destinationCity: data.destination_city,
            destinationAddress: data.destination_address,
            requestedDate: data.requested_date,
            vehicleType: data.vehicle_type,
            referenceNumber: data.reference_number,
            invoiceValue: data.invoice_value,
            vendorCode: data.vendor_code,
            vendorName: data.vendor_name,
            vehicleNumber: data.vehicle_number,
            containerNumber: data.container_number,
            modeType: data.mode_type,
            quantity: data.quantity,
            actualWT: data.actual_weight,
            chargeWT: data.charge_weight,
            paymentType: data.payment_type,
            routeDetails: data.routedetails,
            descriptionOfGoods: data.description_of_goods,
            status: data.status,
            information: data.information,
            waybillno: data.waybillno
        };
    }

    if (!movementData) {
        console.log("No record found");
        return;
    }

    // Fill form fields
    $("#lrDate").val(movementData.lrDate);
    $("#quotationID").val(movementData.quotationID);
    $("#modeType").val(movementData.modeType);
    $("#movementType").val(movementData.movementType);
    $("#partyCode").val(movementData.partyCode);
    $("#partyName").val(movementData.partyName);
    $("#originPinCode").val(movementData.originPinCode);
    $("#originCity").val(movementData.originCity);
    $("#originAddress").val(movementData.originAddress);
    $("#destinationPinCode").val(movementData.destinationPinCode);
    $("#destinationCity").val(movementData.destinationCity);
    $("#destinationAddress").val(movementData.destinationAddress);
    $("#requestedDate").val(movementData.requestedDate);
    $("#referenceNumber").val(movementData.referenceNumber);
    $("#invoiceValue").val(movementData.invoiceValue);
    $("#vendorCode").val(movementData.vendorCode);
    $("#vendorName").val(movementData.vendorName);
    $("#vehicleType").val(movementData.vehicleType);
    $("#vehicleNumber").val(movementData.vehicleNumber);
    $("#containerNumber").val(movementData.containerNumber);
    $("#routeDetails").val(movementData.routeDetails);
    $("#quantity").val(movementData.quantity);
    $("#actualWt").val(movementData.actualWT);
    $("#chargeWt").val(movementData.chargeWT);
    $("#paymentType").val(movementData.paymentType);
    $("#information").val(movementData.information);
    $("#descriptionofGoods").val(movementData.descriptionOfGoods);
    $("#wayBillNo").val(movementData.waybillno);

    // Load tables
    await loadBillingCharges(lrNumber, "Sale", "chargesDetailsTable");
    await loadBillingCharges(lrNumber, "Buy", "vendorChargesDetailsTable");
    await loadShipmentDetails(lrNumber); // ✅ Added shipment loading

    // UI state
    document.getElementById("addFreightRow").disabled = true;
    document.getElementById("addVendorFreightRow").disabled = true;

    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';

    disableForm();

    document.getElementById("modifyButton").disabled = false;
    document.getElementById("newButton").disabled = false;
    document.getElementById("saveButton").disabled = true;
    document.getElementById("reportButton").disabled = false;
});

document.getElementById('newButton').addEventListener('click', async function () {

    enableForm();
    clearForm(); // clear all inputs

    saveButton.disabled = false;
    modifyButton.disabled = true;
    reportButton.disabled = true;
    deleteButton.disabled = true;

    document.getElementById('saveButton').innerHTML = '<i class="bi bi-save"></i> Save';
    document.getElementById('lrDate').valueAsDate = new Date();
    document.getElementById('quantity').value = "1.00";

    document.getElementById('addFreightRow').disabled = false;
    document.getElementById('addVendorFreightRow').disabled = false;

    // Clear tracking arrays for new form
    deletedShipmentIds = [];
    currentEditShipmentId = null;

    ["chargesDetailsTable", "vendorChargesDetailsTable", "shipmentDetailsTable"].forEach(id => {
        const table = document.getElementById(id);
        if (table) {
            const tbody = table.querySelector("tbody");
            const tfoot = table.querySelector("tfoot");

            if (tbody) tbody.innerHTML = "";
            if (tfoot) tfoot.innerHTML = "";
        }
    });
});

document.getElementById('modifyButton').addEventListener('click', function () {
    enableForm();
    document.getElementById('saveButton').disabled = false;
    document.getElementById('modifyButton').disabled = true;
    document.getElementById('reportButton').disabled = true;
    saveButton.innerHTML = '<i class="bi bi-save"></i> Update';
    document.getElementById('addFreightRow').disabled = false;
    document.getElementById('addVendorFreightRow').disabled = false;

    // Enable delete buttons in all tables
    document.querySelectorAll('.deleteRow, .delete-shipment-btn').forEach(btn => {
        btn.disabled = false;
    });
    document.getElementById("lrNumber").disabled = true;
});

function areRequiredFieldsFilled() {
    const requiredFields = [
        'lrDate', 'movementType', 'partyName',
        'originPinCode', 'originCity', 'originAddress',
        'requestedDate', 'vehicleType', 'destinationPinCode', 'destinationCity', 'destinationAddress',
        'vehicleNumber', 'quantity', 'chargeWt', 'modeType'
    ];

    for (let fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field.focus();
            alert('Please fill in all required fields. Missing: ' + fieldId);
            return false;
        }
    }

    return true;
}

document.getElementById("saveButton").addEventListener("click", async function (event) {

    event.preventDefault();

    const saveBtn = document.getElementById("saveButton");
    const addBtn = document.getElementById("addFreightRow");
    const vendorAddBtn = document.getElementById("addVendorFreightRow");
    let lrNumber = document.getElementById("lrNumber").value.trim();

    saveBtn.disabled = true;
    addBtn.disabled = true;
    vendorAddBtn.disabled = true;

    if (!areRequiredFieldsFilled()) {
        saveBtn.disabled = false;
        return;
    }

    const isSaveAction = saveBtn.innerText.trim().toLowerCase() === "save";

    if (!lrNumber) {
        lrNumber = await generateLRNumber();
        document.getElementById("lrNumber").value = lrNumber;
    }

    const val = id => document.getElementById(id)?.value || "";

    const modeType = val("modeType");
    const transitType = modeType === "FTL" ? "By Road" : "By Sea Freight";

    let formData = {
        lr_number: lrNumber,
        pickup_date: val("lrDate"),
        customer_code: val("partyCode"),
        customer_name: val("partyName"),
        requested_date: val("requestedDate"),
        quotation_id: val("quotationID"),
        mode_type: modeType,
        movement_type: val("movementType"),
        transit_type: transitType,
        origin_pincode: val("originPinCode"),
        origin_city: val("originCity"),
        origin_address: val("originAddress"),
        destination_pincode: val("destinationPinCode"),
        destination_city: val("destinationCity"),
        destination_address: val("destinationAddress"),
        reference_number: val("referenceNumber"),
        invoice_value: parseFloat(val("invoiceValue")) || 0,
        vendor_code: val("vendorCode"),
        vendor_name: val("vendorName"),
        vehicle_type: val("vehicleType"),
        vehicle_number: val("vehicleNumber"),
        container_number: val("containerNumber"),
        quantity: val("quantity"),
        actual_weight: val("actualWt"),
        charge_weight: val("chargeWt"),
        payment_type: val("paymentType"),
        routedetails: val("routeDetails") || null,
        information: val("information"),
        description_of_goods: val("descriptionofGoods"),
        waybillno: val("wayBillNo"),
        company_id: CompanyID
    };

    try {

        let query;

        if (isSaveAction) {
            formData.created_by = UserLoginID;
            formData.created_at = localtimeStamp;

            query = supabaseClient
                .from("FullLoadBookingDetails")
                .insert([formData])
                .select()
                .single();

        } else {
            formData.updated_by = UserLoginID;
            formData.updated_at = localtimeStamp;

            query = supabaseClient
                .from("FullLoadBookingDetails")
                .update(formData)
                .eq("lr_number", lrNumber)
                .select()
                .single();
        }

        const { data, error } = await query;

        if (error) throw error;

        const bookingId = data.id;

        /// 🔥 Save Charges using ID
        await saveCharges(bookingId, "chargesDetailsTable", "Sale");
        await saveCharges(bookingId, "vendorChargesDetailsTable", "Buy");

        // 🔥 Save Shipments
        await saveShipments(bookingId, lrNumber);

        // 👇 ADD THIS LINE: Reload the shipments from the DB to get their newly generated IDs!
        await loadShipmentDetails(lrNumber);

        disableForm();

        saveBtn.innerHTML = `<i class="bi bi-save"></i> Update`;

        document.getElementById("modifyButton").disabled = false;
        document.getElementById("reportButton").disabled = false;

        alert(`Movement details ${isSaveAction ? "saved" : "updated"} successfully!\nLR Number: ${lrNumber}`);

    } catch (err) {
        console.error("Error saving data:", err);
        alert("Error saving movement details");
        saveBtn.disabled = false;
    }
});

// =========================================================================
// SHIPMENT DETAILS TABS - UI & DB LOGIC
// =========================================================================

// 1. Add / Update Row in UI
addShipmentBtn.addEventListener('click', function () {
    const shipmentIdInput = document.getElementById('shipmentId');
    const type = document.getElementById('shipmentType').value;
    const name = document.getElementById('consigneeorConsignorName').value.trim();
    const address = document.getElementById('consigneeorConsignorAddress').value.trim();
    const pincode = document.getElementById('shipmentPinCode').value.trim();
    const city = document.getElementById('shipmentCity').value.trim();
    const refNo = document.getElementById('shipmentReferenceNumber').value.trim();

    const invValue = parseFloat(document.getElementById('shipmentInvoiceValue').value || 0).toFixed(2);
    const qty = parseFloat(document.getElementById('shipmentQuantity').value || 0).toFixed(2);
    const actWt = parseFloat(document.getElementById('shipmentActualWt').value || 0).toFixed(2);
    const chgWt = parseFloat(document.getElementById('shipmentChargeWt').value || 0).toFixed(2);

    if (!name || !address || !pincode || !city) {
        alert('Please fill in Name, Address, Pincode, and City before adding.');
        return;
    }

    const tr = document.createElement('tr');

    // If editing existing row, attach its ID
    if (currentEditShipmentId) {
        tr.dataset.id = currentEditShipmentId;
    }

    tr.dataset.type = type;
    tr.dataset.name = name;
    tr.dataset.address = address;
    tr.dataset.pincode = pincode;
    tr.dataset.city = city;
    tr.dataset.refNo = refNo;
    tr.dataset.invValue = invValue;
    tr.dataset.qty = qty;
    tr.dataset.actWt = actWt;
    tr.dataset.chgWt = chgWt;

    tr.innerHTML = `
        <td>${type}</td>
        <td class="text-cap">${name}</td>
        <td class="text-cap text-truncate" style="max-width: 150px;" title="${address}">${address}</td>
        <td>${pincode}</td>
        <td class="text-cap">${city}</td>
        <td class="text-upper">${refNo}</td>
        <td class="text-end">${invValue}</td>
        <td class="text-end">${qty}</td>
        <td class="text-end">${actWt}</td>
        <td class="text-end">${chgWt}</td>
        <td class="text-center text-nowrap">
            <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1 edit-shipment-btn" title="Edit Row">
                <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 delete-shipment-btn" title="Remove Row">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;

    shipmentTableBody.appendChild(tr);

    // =========================================================
    // UPDATE HEADER FORM FIELDS (Unique & Aggregated Values)
    // =========================================================

    // 1. Gather all rows from the table body
    const allRows = shipmentTableBody.querySelectorAll('tr');

    let uniqueCities = new Set();
    let uniqueRefs = new Set();
    let totalInvoiceValue = 0;

    // 2. Loop through all rows to calculate uniqueness and totals
    allRows.forEach(row => {
        if (row.dataset.city) uniqueCities.add(row.dataset.city);
        if (row.dataset.refNo) uniqueRefs.add(row.dataset.refNo);
        totalInvoiceValue += parseFloat(row.dataset.invValue) || 0;
    });

    // 3. Get values from the FIRST row for Address and Pincode
    const firstRow = allRows[0];
    const firstPinCode = firstRow ? firstRow.dataset.pincode : '';
    const firstAddress = firstRow ? firstRow.dataset.address : '';

    // Convert Sets to comma-separated strings
    const citiesString = Array.from(uniqueCities).join(', ');
    const refsString = Array.from(uniqueRefs).join(', ');

    // 4. Update the specific UI fields based on Shipment Type
    if (type === 'Delivery') {
        const destPin = document.getElementById('destinationPinCode');
        const destCity = document.getElementById('destinationCity');
        const destAddress = document.getElementById('destinationAddress');

        if (destPin) destPin.value = firstPinCode;
        if (destCity) destCity.value = citiesString;
        if (destAddress) destAddress.value = firstAddress;

    } else if (type === 'Pickup') {
        const originPin = document.getElementById('originPinCode');
        const originCity = document.getElementById('originCity');
        const originAddress = document.getElementById('originAddress');

        if (originPin) originPin.value = firstPinCode;
        if (originCity) originCity.value = citiesString;
        if (originAddress) originAddress.value = firstAddress;
    }

    // Common fields for both types
    const refInput = document.getElementById('referenceNumber');
    const invInput = document.getElementById('invoiceValue');

    if (refInput) refInput.value = refsString;
    if (invInput) invInput.value = totalInvoiceValue.toFixed(2);

    // =========================================================

    // Reset Inputs & State
    currentEditShipmentId = null;
    shipmentIdInput.value = '';
    document.getElementById('addShipmentRow').innerHTML = '<i class="bi bi-plus-lg"></i> Add';

    document.getElementById('consigneeorConsignorName').value = '';
    document.getElementById('consigneeorConsignorAddress').value = '';
    document.getElementById('shipmentPinCode').value = '';
    document.getElementById('shipmentCity').value = '';
    document.getElementById('shipmentReferenceNumber').value = '';
    document.getElementById('shipmentInvoiceValue').value = '';
    document.getElementById('shipmentQuantity').value = '';
    document.getElementById('shipmentActualWt').value = '';
    document.getElementById('shipmentChargeWt').value = '';
    document.getElementById('consigneeorConsignorName').focus();

    if (typeof updateShipmentTotals === 'function') {
        updateShipmentTotals();
    }
});

// 2. Edit & Delete Row Logic
shipmentTableBody.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('.delete-shipment-btn');
    const editBtn = e.target.closest('.edit-shipment-btn');

    if (deleteBtn) {
        const tr = deleteBtn.closest('tr');
        // Push ID to deletion array if it exists in DB
        if (tr.dataset.id) {
            deletedShipmentIds.push(tr.dataset.id);
        }
        tr.remove();
        updateShipmentTotals();
    }
    else if (editBtn) {
        const tr = editBtn.closest('tr');

        currentEditShipmentId = tr.dataset.id || null;
        document.getElementById('shipmentId').value = currentEditShipmentId;

        document.getElementById('shipmentType').value = tr.dataset.type;
        document.getElementById('consigneeorConsignorName').value = tr.dataset.name;
        document.getElementById('consigneeorConsignorAddress').value = tr.dataset.address;
        document.getElementById('shipmentPinCode').value = tr.dataset.pincode;
        document.getElementById('shipmentCity').value = tr.dataset.city;
        document.getElementById('shipmentReferenceNumber').value = tr.dataset.refNo;
        document.getElementById('shipmentInvoiceValue').value = tr.dataset.invValue;
        document.getElementById('shipmentQuantity').value = tr.dataset.qty;
        document.getElementById('shipmentActualWt').value = tr.dataset.actWt;
        document.getElementById('shipmentChargeWt').value = tr.dataset.chgWt;

        document.getElementById('addShipmentRow').innerHTML = '<i class="bi bi-pencil"></i> Update';
        tr.remove();
        document.getElementById('consigneeorConsignorName').focus();
        updateShipmentTotals();
    }
});


// 3. Save Shipments to Database (Called by main Save function)
async function saveShipments(bookingId, lrNumber) {
    const rows = document.querySelectorAll('#shipmentDetailsTable tbody tr');

    // Split into two arrays to prevent Supabase from injecting "id: null" into new rows
    const shipmentsToInsert = [];
    const shipmentsToUpdate = [];

    rows.forEach(tr => {
        const shipment = {
            booking_id: bookingId,
            lr_number: lrNumber,
            shipment_type: tr.dataset.type,
            consignee_or_consignor_name: tr.dataset.name,
            consignee_or_consignor_address: tr.dataset.address,
            pincode: tr.dataset.pincode,
            city: tr.dataset.city,
            reference_number: tr.dataset.refNo,
            invoice_value: parseFloat(tr.dataset.invValue) || 0,
            quantity: parseFloat(tr.dataset.qty) || 0,
            actual_weight: parseFloat(tr.dataset.actWt) || 0,
            charge_weight: parseFloat(tr.dataset.chgWt) || 0
        };

        const rowId = tr.dataset.id;

        // If the row has a valid ID, it's an UPDATE
        if (rowId && rowId !== "null" && rowId !== "undefined" && rowId.trim() !== "") {
            shipment.id = rowId;
            shipment.updated_at = new Date().toISOString();
            shipmentsToUpdate.push(shipment);
        }
        // If no ID exists, it's a completely NEW row
        else {
            shipmentsToInsert.push(shipment);
        }
    });

    // 1. Delete removed rows
    if (deletedShipmentIds.length > 0) {
        const { error: deleteError } = await supabaseClient
            .from('FullLoadShipmentDetails')
            .delete()
            .in('id', deletedShipmentIds);

        if (deleteError) console.error("Error deleting shipments:", deleteError.message);
    }

    // 2. Update existing rows (Upsert)
    if (shipmentsToUpdate.length > 0) {
        const { error: updateError } = await supabaseClient
            .from('FullLoadShipmentDetails')
            .upsert(shipmentsToUpdate);

        if (updateError) console.error("Error updating shipments:", updateError.message);
    }

    // 3. Insert new rows (without passing any 'id' key so the DB auto-generates it)
    if (shipmentsToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
            .from('FullLoadShipmentDetails')
            .insert(shipmentsToInsert);

        if (insertError) console.error("Error inserting shipments:", insertError.message);
    }

    // Reset tracking array
    deletedShipmentIds = [];
}

// 4. Load Shipments from Database (Called when selecting an LR)
async function loadShipmentDetails(lrNumber) {
    const { data, error } = await supabaseClient
        .from('FullLoadShipmentDetails')
        .select('*')
        .eq('lr_number', lrNumber);

    if (error) {
        console.error("Error loading shipments", error);
        return;
    }

    shipmentTableBody.innerHTML = '';
    deletedShipmentIds = [];
    currentEditShipmentId = null;

    data.forEach(row => {
        const tr = document.createElement('tr');

        tr.dataset.id = row.id;
        tr.dataset.type = row.shipment_type;
        tr.dataset.name = row.consignee_or_consignor_name;
        tr.dataset.address = row.consignee_or_consignor_address;
        tr.dataset.pincode = row.pincode;
        tr.dataset.city = row.city;
        tr.dataset.refNo = row.reference_number;
        tr.dataset.invValue = row.invoice_value;
        tr.dataset.qty = row.quantity;
        tr.dataset.actWt = row.actual_weight;
        tr.dataset.chgWt = row.charge_weight;

        tr.innerHTML = `
            <td>${row.shipment_type}</td>
            <td class="text-cap">${row.consignee_or_consignor_name}</td>
            <td class="text-cap text-truncate" style="max-width: 150px;" title="${row.consignee_or_consignor_address}">${row.consignee_or_consignor_address}</td>
            <td>${row.pincode}</td>
            <td class="text-cap">${row.city}</td>
            <td class="text-upper">${row.reference_number}</td>
            <td class="text-end">${parseFloat(row.invoice_value).toFixed(2)}</td>
            <td class="text-end">${parseFloat(row.quantity).toFixed(2)}</td>
            <td class="text-end">${parseFloat(row.actual_weight).toFixed(2)}</td>
            <td class="text-end">${parseFloat(row.charge_weight).toFixed(2)}</td>
            <td class="text-center text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1 edit-shipment-btn" title="Edit Row" disabled>
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 delete-shipment-btn" title="Remove Row" disabled>
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        shipmentTableBody.appendChild(tr);
    });
    updateShipmentTotals();
}

// =========================================================================
// EXISTING BILLING & TARIFF LOGIC
// =========================================================================

async function loadBillingCharges(lrNumber, accountType, tableId) {
    const { data, error } = await supabaseClient
        .from("FullLoadBookingCharges")
        .select("*")
        .eq("LRNumber", lrNumber)
        .eq("AccountType", accountType);

    if (error) {
        console.error(error);
        return;
    }

    const tableBody = document
        .getElementById(tableId)
        .querySelector("tbody");

    tableBody.innerHTML = "";

    data.forEach(row => {
        const tr = document.createElement("tr");

        tr.dataset.status = "old";
        tr.dataset.id = row.id;

        tr.innerHTML = `
            <td class="align-middle">${row.ChargesType}</td>
            <td class="align-middle">${row.TaxRate}%</td>
            <td class="text-end align-middle">${parseFloat(row.TotalAmount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.CGSTAmt).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.SGSTAmt).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.IGSTAmt).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.TotalGSTAmt).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.GrandTotalAmt).toFixed(2)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-danger deleteRow" disabled>Delete</button>
            </td>
            <td class="align-middle d-none">${row.HSNCode || ""}</td>
            <td class="align-middle d-none">${row.TaxID || ""}</td>
        `;

        tableBody.appendChild(tr);

        tr.querySelector(".deleteRow").onclick = () => {
            tr.dataset.status = "deleted";
            tr.style.display = "none";
            updateChargesTotals(tableId);
        };

    });

    updateChargesTotals(tableId);
}

async function fetchSupabaseData(lrNumber, accountType) {
    const { data, error } = await supabaseClient
        .from('FullLoadBookingCharges')
        .select('*')
        .eq('AccountType', accountType)
        .eq('LRNumber', lrNumber);

    if (error) {
        console.error("Fetch error:", error);
        return [];
    }
    return data || [];
}

document.getElementById("addFreightRow").addEventListener("click", async function () {
    addFreightRow(
        "chargesDetailsTable",
        "chargesType",
        "customerFreightAmt",
        "partyDefaultTax"
    );
    await getFixedCharges("Sell");
});

document.getElementById("addVendorFreightRow").addEventListener("click", async function () {
    addFreightRow(
        "vendorChargesDetailsTable",
        "vendorChargesType",
        "vendorFreightAmt",
        "vendorDefaultTax"
    );
    await getFixedCharges("Buy");
});

async function addFreightRow(tableId, chargesInput, amountInput, taxInput) {
    const chargesType = document.getElementById(chargesInput).value.trim();
    const amount = parseFloat(document.getElementById(amountInput).value) || 0;
    let taxID = document.getElementById(taxInput).value || 1;
    const HSNCode = await getDropdownDataValue(chargesType, "ChargesType");
    document.getElementById("addVendorFreightRow").disabled = true;
    document.getElementById("addFreightRow").disabled = true;

    if (!chargesType || amount <= 0) {
        alert("Enter Charges Type and Amount");
        return;
    }

    const tableBody = document
        .getElementById(tableId)
        .querySelector("tbody");

    const existingRows = tableBody.querySelectorAll("tr");

    for (let row of existingRows) {
        if (row.dataset.status === "deleted") continue;
        const existingCharge = row.children[0].textContent.trim();
        if (existingCharge === chargesType) {
            alert("This charge type is already added.");
            return;
        }
    }

    const taxes = await getTaxRatesById(taxID);
    const taxCalculations = calculateTaxes(amount, taxes);

    const tr = document.createElement("tr");

    tr.dataset.status = "new";

    tr.innerHTML = `
        <td>${chargesType}</td>
        <td>${taxCalculations.totalRate}%</td>
        <td class="text-end">${amount.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.sgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.cgstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.igstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.totalGstAmt.toFixed(2)}</td>
        <td class="text-end">${taxCalculations.grandTotal.toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger deleteRow">Delete</button>
        </td>
        <td class="d-none">${HSNCode ? HSNCode.hsn_code : "0"}</td>
        <td class="d-none">${taxID}</td>
    `;

    tableBody.appendChild(tr);

    tr.querySelector(".deleteRow").onclick = () => {
        if (tr.dataset.status === "new") {
            tr.remove();
        } else {
            tr.dataset.status = "deleted";
            tr.style.display = "none";
        }
        updateChargesTotals(tableId);
    };

    updateChargesTotals(tableId);

    document.getElementById(chargesInput).value = "";
    document.getElementById(amountInput).value = "";
    document.getElementById(taxInput).selectedIndex = 0;
    document.getElementById("addVendorFreightRow").disabled = false;
    document.getElementById("addFreightRow").disabled = false;
}

function updateChargesTotals(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll("tbody tr");
    const tfoot = table.querySelector("tfoot") || table.createTFoot();

    let totals = {
        amount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        gst: 0,
        grand: 0
    };

    rows.forEach(tr => {
        if (tr.dataset.status === "deleted") return;

        totals.amount += parseFloat(tr.children[2].textContent) || 0;
        totals.cgst += parseFloat(tr.children[3].textContent) || 0;
        totals.sgst += parseFloat(tr.children[4].textContent) || 0;
        totals.igst += parseFloat(tr.children[5].textContent) || 0;
        totals.gst += parseFloat(tr.children[6].textContent) || 0;
        totals.grand += parseFloat(tr.children[7].textContent) || 0;
    });

    tfoot.innerHTML = `
        <tr class="table-secondary fw-bold">
            <td colspan="2">Total</td>
            <td class="text-end">${totals.amount.toFixed(2)}</td>
            <td class="text-end">${totals.cgst.toFixed(2)}</td>
            <td class="text-end">${totals.sgst.toFixed(2)}</td>
            <td class="text-end">${totals.igst.toFixed(2)}</td>
            <td class="text-end">${totals.gst.toFixed(2)}</td>
            <td class="text-end">${totals.grand.toFixed(2)}</td>
            <td></td>
        </tr>
    `;
}

async function saveCharges(bookingId, tableId, accountType) {
    const rows = document.getElementById(tableId).querySelectorAll("tbody tr");

    const insertData = [];
    const deleteIds = [];

    const getNumber = (val) => {
        if (!val || val.toString().trim() === "" || val === "No GST") return 0;
        return parseFloat(val) || 0;
    };

    rows.forEach(row => {
        const status = row.dataset.status;
        const cells = row.querySelectorAll("td");

        if (status === "new") {
            insertData.push({
                ID_FT: bookingId,
                LRNumber: document.getElementById("lrNumber").value.trim(),
                ChargesType: cells[0].textContent.trim(),
                TaxRate: getNumber(cells[1].textContent),
                Quantity: 1,
                PerQtyAmt: getNumber(cells[2].textContent),
                TotalAmount: getNumber(cells[2].textContent),
                CGSTAmt: getNumber(cells[3].textContent),
                SGSTAmt: getNumber(cells[4].textContent),
                IGSTAmt: getNumber(cells[5].textContent),
                TotalGSTAmt: getNumber(cells[6].textContent),
                GrandTotalAmt: getNumber(cells[7].textContent),
                HSNCode: cells[9].textContent || "",
                TaxID: cells[10].textContent || "",
                AccountType: accountType,
                created_by: UserLoginID,
                created_at: localtimeStamp
            });
        }

        if (status === "deleted" && row.dataset.id) {
            deleteIds.push(row.dataset.id);
        }
    });

    if (insertData.length > 0) {
        const { error } = await supabaseClient
            .from("FullLoadBookingCharges")
            .insert(insertData);
        if (error) console.error("Insert error:", error);
    }

    if (deleteIds.length > 0) {
        const { error } = await supabaseClient
            .from("FullLoadBookingCharges")
            .delete()
            .in("id", deleteIds);
        if (error) console.error("Delete error:", error);
    }
}

async function getTariffRate(partyCode, tariffType) {
    const movementType = document.getElementById("movementType").value;
    const modeType = document.getElementById("modeType").value;
    const vehicleType = document.getElementById("vehicleType").value;
    const routeDetails = document.getElementById("routeDetails").value.toLowerCase().trim();
    const chargeWt = parseFloat(document.getElementById("chargeWt").value) || 0;
    const bookingDate = document.getElementById("lrDate").value;

    if (!partyCode || !movementType || !modeType || !vehicleType || !routeDetails) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("FTL_FCL_Tariff")
        .select("Rate")
        .eq("PartyCode", partyCode)
        .eq("MovementType", movementType)
        .eq("ModeType", modeType)
        .eq("VehicleType", vehicleType)
        .eq("RouteDetails", routeDetails)
        .eq("TariffType", tariffType)
        .lte("CargoWeight", chargeWt)
        .lte("EffectiveDate", bookingDate)
        .order("EffectiveDate", { ascending: false })
        .order("CargoWeight", { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        return null;
    }
    return data?.length ? data[0].Rate : null;
}

async function applyCustomerTariff() {
    const partyCode = document.getElementById("partyCode").value;
    const rate = await getTariffRate(partyCode, "Sell");

    if (!rate) {
        document.getElementById("chargesType").value = "";
        document.getElementById("customerFreightAmt").value = "0.00";
        return;
    }
    document.getElementById("chargesType").value = "Freight Amount";
    document.getElementById("customerFreightAmt").value = rate;
}

async function applyVendorTariff() {
    const vendorCode = document.getElementById("vendorCode").value;
    const rate = await getTariffRate(vendorCode, "Buy");

    if (!rate) {
        document.getElementById("vendorChargesType").value = "";
        document.getElementById("vendorFreightAmt").value = "0.00";
        return;
    }
    document.getElementById("vendorChargesType").value = "Freight Amount";
    document.getElementById("vendorFreightAmt").value = rate;
}

const tariffTriggers = [
    "lrDate", "partyCode", "modeType", "movementType",
    "routeDetails", "vehicleType", "chargeWt", "vendorCode"
];

tariffTriggers.forEach(id => {
    document.getElementById(id).addEventListener("change", async function () {
        await applyCustomerTariff();
        await applyVendorTariff();
    });
});

function clearAutoCharges() {
    const tbody = document.querySelector("#chargesDetailsTable tbody");
    tbody.querySelectorAll("tr").forEach(row => {
        if (row.dataset.auto === "true") {
            row.remove();
        }
    });
}

async function getFixedCharges(accountType = "Sell") {
    const partyCode = accountType === "Sell"
        ? document.getElementById("partyCode").value
        : document.getElementById("vendorCode").value;

    const movementType = document.getElementById("movementType").value;
    const transitType = "All";
    const modeType = document.getElementById("modeType").value;
    const shippingType = "All";
    const bookingDate = document.getElementById("lrDate").value;

    const freightAmt = accountType === "Sell"
        ? parseFloat(document.getElementById("customerFreightAmt").value) || 0
        : parseFloat(document.getElementById("vendorFreightAmt").value) || 0;

    if (!partyCode) return;

    const { data, error } = await supabaseClient
        .from("FixedCharges")
        .select("*")
        .eq("PartyCode", partyCode)
        .eq("FixedChargesType", accountType)
        .lte("EffectiveDate", bookingDate)
        .order("EffectiveDate", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) return;

    const applicableCharges = [];

    data.forEach(row => {
        const movementMatch = row.MovementType === movementType || row.MovementType === "All";
        const transitMatch = row.TransitType === transitType || row.TransitType === "All";
        const modeMatch = row.ModeType === modeType || row.ModeType === "All";
        const shippingMatch = row.ShippingType === shippingType || row.ShippingType === "All";

        if (movementMatch && transitMatch && modeMatch && shippingMatch) {
            let charge = 0;
            if (row.Percentage > 0) charge = (freightAmt * row.Percentage) / 100;
            if (row.Amount > charge) charge = row.Amount;

            applicableCharges.push({ type: row.ChargesType, amount: charge });
        }
    });
    applyFixedCharges(applicableCharges, accountType);
}

function applyFixedCharges(charges, accountType) {
    const tableId = accountType === "Sell" ? "chargesDetailsTable" : "vendorChargesDetailsTable";
    const chargesInput = accountType === "Sell" ? "chargesType" : "vendorChargesType";
    const amountInput = accountType === "Sell" ? "customerFreightAmt" : "vendorFreightAmt";
    const taxInput = accountType === "Sell" ? "partyDefaultTax" : "vendorDefaultTax";

    clearAutoCharges(tableId);

    charges.forEach(ch => {
        document.getElementById(chargesInput).value = ch.type;
        document.getElementById(amountInput).value = ch.amount.toFixed(2);
        addFreightRow(tableId, chargesInput, amountInput, taxInput);

        const rows = document.querySelectorAll(`#${tableId} tbody tr`);
        rows[rows.length - 1].dataset.auto = "true";
    });
}

async function generateLRNumber() {
    const companyId = localStorage.getItem("CompanyID");
    const companyProfile = await getCompanyProfile(companyId);
    const shortCode = companyProfile.short_code;

    const { data, error } = await supabaseClient.rpc("generate_lr_number", {
        p_company_id: companyId,
        p_short_code: shortCode
    });
    return data;
}

document.getElementById("reportButton").addEventListener("click", async function () {
    const lrNumber = document.getElementById("lrNumber").value.trim();
    await generateConsignmentNote(lrNumber);
});

document.getElementById("partyName").addEventListener("change", async function () {
    const selectedPartyName = this.value.trim();

    if (!selectedPartyName) {
        clearOriginFields();
        return;
    }

    try {
        const { data: partyData, error: partyError } = await supabaseClient
            .from('PartyDetails')
            .select('PartyCode, PinCode, City, Address')
            .eq('PartyName', selectedPartyName)
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (partyError) throw partyError;

        if (partyData) {
            const partyCode = partyData.PartyCode;
            document.getElementById("partyCode").value = partyCode;

            const { data: addressData, error: addressError } = await supabaseClient
                .from('PartyBillingAddress')
                .select('Address, City, PinCode, State')
                .eq('PartyCode', partyCode)
                .eq('company_id', CompanyID)
                .eq('Status', 'Active');

            if (addressError) throw addressError;

            if (addressData && addressData.length > 1) {
                showAddressSelectionModal(addressData);
            } else if (addressData && addressData.length === 1) {
                populateOriginFields(addressData[0].PinCode, addressData[0].City, addressData[0].Address);
            } else {
                populateOriginFields(partyData.PinCode, partyData.City, partyData.Address);
            }
        }
    } catch (error) {
        console.error("Error fetching party origin details:", error);
    }
});

function populateOriginFields(pincode, city, address) {
    document.getElementById("originPinCode").value = pincode || "";
    document.getElementById("originCity").value = city || "";
    document.getElementById("originAddress").value = address || "";
    document.getElementById("originPinCode").dispatchEvent(new Event('change'));
    applyCustomerTariff();
}

function clearOriginFields() {
    document.getElementById("partyCode").value = "";
    document.getElementById("originPinCode").value = "";
    document.getElementById("originCity").value = "";
    document.getElementById("originAddress").value = "";
}

function showAddressSelectionModal(addresses) {
    let modalEl = document.getElementById("addressSelectionModal");

    if (!modalEl) {
        const modalHtml = `
        <div class="modal fade" id="addressSelectionModal" tabindex="-1" aria-labelledby="addressSelectionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-md">
                <div class="modal-content shadow-lg border-0">
                    <div class="modal-header bg-light pb-2 pt-2">
                        <h6 class="modal-title mb-0" id="addressSelectionModalLabel">Select Pickup Address</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="list-group list-group-flush" id="addressModalList">
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalEl = document.getElementById("addressSelectionModal");
    }

    const listContainer = document.getElementById("addressModalList");
    listContainer.innerHTML = "";

    addresses.forEach((addr) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "list-group-item list-group-item-action p-3";
        btn.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-cap">${addr.City || 'Unknown City'} - ${addr.PinCode || ''}</h6>
            </div>
            <p class="mb-1 small text-muted text-cap">${addr.Address || 'No address provided'}</p>
        `;

        btn.onclick = () => {
            populateOriginFields(addr.PinCode, addr.City, addr.Address);
            bootstrap.Modal.getInstance(modalEl).hide();
        };

        listContainer.appendChild(btn);
    });

    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
}

// Helper function to calculate and update main totals
function updateShipmentTotals() {
    const rows = document.querySelectorAll('#shipmentDetailsTable tbody tr');
    let totalQty = 0;
    let totalActWt = 0;
    let totalChgWt = 0;

    rows.forEach(tr => {
        totalQty += parseFloat(tr.dataset.qty) || 0;
        totalActWt += parseFloat(tr.dataset.actWt) || 0;
        totalChgWt += parseFloat(tr.dataset.chgWt) || 0;
    });

    // Update the main form fields
    document.getElementById('quantity').value = totalQty.toFixed(2);
    document.getElementById('actualWt').value = totalActWt.toFixed(2);

    const chargeWtInput = document.getElementById('chargeWt');
    chargeWtInput.value = totalChgWt.toFixed(2);

    // 🔥 Important: Trigger a change event so your auto-tariff calculators know the weight changed!
    chargeWtInput.dispatchEvent(new Event('change'));
}