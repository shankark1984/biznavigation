let movementDetails = [];

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
            setupPincodeListener('destinationPinCode', 'destinationCity')
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
        console.log(data); // Check this to ensure all data is retrieved
    }
    if (error) {
        console.error('Error fetching movement details:', error);
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
            .single();

        if (error) {
            console.error("Error fetching LR:", error);
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

    // Load charges
    await loadBillingCharges(lrNumber, "Sale", "chargesDetailsTable");
    await loadBillingCharges(lrNumber, "Buy", "vendorChargesDetailsTable");

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


    ["chargesDetailsTable", "vendorChargesDetailsTable"].forEach(id => {

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

    // ✅ Enable delete buttons in both tables
    document.querySelectorAll('.deleteRow').forEach(btn => {
        btn.disabled = false;
    });
});

// Generate LR Number using Supabase RPC
async function generateLRNumber() {

    const companyData = await getCompanyProfile(CompanyID);
    const shortCode = companyData.short_code;

    const { data, error } = await supabaseClient.rpc("generate_lr_number", {
        p_company_id: CompanyID,
        p_short_code: shortCode
    });

    if (error) {
        console.error("LR generation failed:", error);
        return;
    }

    document.getElementById("lrNumber").value = data;
    console.log("Generated LR Number:", data);
    return data;
}

function areRequiredFieldsFilled() {
    const requiredFields = [
        'lrDate', 'movementType', 'partyName',
        'originPinCode', 'originCity', 'originAddress', 'destinationPinCode',
        'destinationCity', 'destinationAddress', 'requestedDate', 'vehicleType',
        'vehicleNumber', 'quantity', 'chargeWt', 'modeType', 'quantity', 'chargeWt'
    ];


    for (let fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            // Set focus on the first empty required field
            field.focus();
            alert('Please fill in all required fields. ' + fieldId);
            return false; // Return false if any required field is empty
        }
    }

    return true; // Return true if all required fields are filled
}

document.getElementById("saveButton").addEventListener("click", async function (event) {

    event.preventDefault();

    const saveBtn = document.getElementById("saveButton");
    const addBtn = document.getElementById("addFreightRow");
    const vendorAddBtn = document.getElementById("addVendorFreightRow");
    const lrNumberInput = document.getElementById("lrNumber");

    saveBtn.disabled = true;
    addBtn.disabled = true;
    vendorAddBtn.disabled = true;

    if (!areRequiredFieldsFilled()) {
        saveBtn.disabled = false;
        return;
    }

    const isSaveAction = saveBtn.textContent.trim().toLowerCase() === "save";
    let lrNumber;
    if (!lrNumberInput) {
        lrNumber = isSaveAction
            ? await generateLRNumber()
            : document.getElementById("lrNumber").value;
    } else {
        lrNumber = lrNumberInput.value;
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

            // INSERT
            formData.created_by = UserLoginID;
            formData.created_at = new Date().toISOString();

            query = supabaseClient
                .from("FullLoadBookingDetails")
                .insert([formData]);

        } else {

            // UPDATE
            formData.updated_by = UserLoginID;
            formData.updated_at = new Date().toISOString();

            query = supabaseClient
                .from("FullLoadBookingDetails")
                .update(formData)
                .eq("lr_number", lrNumber)
                .select()
                .single();
        }

        const { data, error } = await query;

        if (error) throw error;

        await saveCharges(lrNumber, "chargesDetailsTable", "Sale"); // Save customer charges
        await saveCharges(lrNumber, "vendorChargesDetailsTable", "Buy"); // Save vendor charges

        console.log("Updated record:", data);

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

async function loadBillingCharges(lrNumber, accountType, tableId) {

    const { data, error } = await supabaseClient
        .from("FullLoadBookingCharges")
        .select("*")
        .eq("lr_number", lrNumber)
        .eq("account_type", accountType);

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
            <td class="align-middle">${row.charges_type}</td>
            <td class="align-middle">${row.gst_type}</td>
            <td class="text-end align-middle">${parseFloat(row.amount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.cgst_amount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.sgst_amount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.igst_amount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.total_gst_amount).toFixed(2)}</td>
            <td class="text-end align-middle">${parseFloat(row.grand_total_billing).toFixed(2)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-danger deleteRow" disabled>Delete</button>
            </td>
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
        .eq('account_type', accountType)
        .eq('lr_number', lrNumber);

    if (error) {
        console.error("Fetch error:", error);
        return [];
    }

    return data || [];
}

document.getElementById("addFreightRow").addEventListener("click", function () {

    addFreightRow(
        "chargesDetailsTable",
        "chargesType",
        "customerFreightAmt",
        "partyDefaultTax"
    );

});

document.getElementById("addVendorFreightRow").addEventListener("click", function () {

    addFreightRow(
        "vendorChargesDetailsTable",
        "vendorChargesType",
        "vendorFreightAmt",
        "vendorDefaultTax"
    );

});

function addFreightRow(tableId, chargesInput, amountInput, taxInput) {

    const chargesType = document.getElementById(chargesInput).value.trim();
    const amount = parseFloat(document.getElementById(amountInput).value) || 0;
    const taxText = document.getElementById(taxInput).value || "";

    if (!chargesType || amount <= 0) {
        alert("Enter Charges Type and Amount");
        return;
    }

    const tableBody = document
        .getElementById(tableId)
        .querySelector("tbody");

    // ✅ DUPLICATE CHECK
    const existingRows = tableBody.querySelectorAll("tr");

    for (let row of existingRows) {

        if (row.dataset.status === "deleted") continue;

        const existingCharge = row.children[0].textContent.trim();

        if (existingCharge === chargesType) {
            alert("This charge type is already added.");
            return;
        }
    }

    const cgstRate = parseFloat((taxText.match(/CGST\s*(\d+(\.\d+)?)%/) || [])[1]) || 0;
    const sgstRate = parseFloat((taxText.match(/SGST\s*(\d+(\.\d+)?)%/) || [])[1]) || 0;
    const igstRate = parseFloat((taxText.match(/IGST\s*(\d+(\.\d+)?)%/) || [])[1]) || 0;

    let gstType = "";

    if (igstRate > 0) {
        gstType = `IGST ${igstRate}%`;
    } else if (cgstRate > 0 || sgstRate > 0) {
        gstType = `CGST ${cgstRate}% SGST ${sgstRate}%`;
    } else {
        gstType = "No GST";
    }

    const cgst = amount * cgstRate / 100;
    const sgst = amount * sgstRate / 100;
    const igst = amount * igstRate / 100;

    const totalGST = cgst + sgst + igst;
    const grandTotal = amount + totalGST;

    const tr = document.createElement("tr");

    tr.dataset.status = "new";

    tr.innerHTML = `
        <td>${chargesType}</td>
        <td>${gstType}</td>
        <td class="text-end">${amount.toFixed(2)}</td>
        <td class="text-end">${cgst.toFixed(2)}</td>
        <td class="text-end">${sgst.toFixed(2)}</td>
        <td class="text-end">${igst.toFixed(2)}</td>
        <td class="text-end">${totalGST.toFixed(2)}</td>
        <td class="text-end">${grandTotal.toFixed(2)}</td>
        <td>
            <button type="button" class="btn btn-sm btn-danger deleteRow">Delete</button>
        </td>
    `;

    tableBody.appendChild(tr);

    // Delete button
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

async function saveCharges(lrNumber, tableId, accountType) {

    const rows = document
        .getElementById(tableId)
        .querySelectorAll("tbody tr");

    const insertData = [];
    const deleteIds = [];

    rows.forEach(row => {

        const status = row.dataset.status;

        const cells = row.querySelectorAll("td");

        if (status === "new") {

            insertData.push({
                lr_number: lrNumber,
                charges_type: cells[0].textContent.trim(),
                gst_type: cells[1].textContent.trim(),
                amount: parseFloat(cells[2].textContent) || 0,
                cgst_amount: parseFloat(cells[3].textContent) || 0,
                sgst_amount: parseFloat(cells[4].textContent) || 0,
                igst_amount: parseFloat(cells[5].textContent) || 0,
                total_gst_amount: parseFloat(cells[6].textContent) || 0,
                grand_total_billing: parseFloat(cells[7].textContent) || 0,
                account_type: accountType,
                company_id: CompanyID,
                created_by: UserLoginID,
                created_at: new Date().toISOString()
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

