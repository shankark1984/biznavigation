//Customer name list
document.getElementById('partyName').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Vendor Name '+inputValue);
    await loadPartyDetails(inputValue); // Pass the input value to the function
});
// Clear the suggestion box when input field loses focus
document.getElementById('partyName').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('partySuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});

//Customer name list
document.getElementById('lrnumber').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Vendor Name '+inputValue);
    await loadMovementDetails(inputValue); // Pass the input value to the function
});
// Clear the suggestion box when input field loses focus
document.getElementById('lrnumber').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('lrNumberSuggestions').innerHTML = ''; // Clear suggestions on blur
    }, 200); // Timeout to allow suggestion click events to fire before clearing
});


//Fetch and Load Booking Details
async function loadMovementDetails(query = '') {
    const { data, error } = await supabaseClient
        .from('booking_details')
        .select('*')
        .eq('company_id', companyID)
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
        vendorCode: row.vendor_code,
        vendorName: row.vendor_name,
        vehicleNumber: row.vehicle_number,
        containerNumber: row.container_number,
        modeType: row.mode_type,
        quantity: row.quantity,
        actualWT: row.actual_weight,
        chargeWT: row.charge_weight,
        paymentType: row.payment_type,
        descriptionOfGoods: row.description_of_goods,
        status: row.status,
        completionDate: row.completion_date,
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