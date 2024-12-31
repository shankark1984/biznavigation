let customerCode = '';
let companyId = companyID; // Replace with your company ID logic

document.getElementById('partyName').addEventListener('input', function (event) {
    const inputValue = event.target.value;
    const selectedOption = $("#partySuggestions option").filter(function () {
        return $(this).val() === inputValue;
    }).first();

    // Get the data-party-code from the matching option
    partyCode = selectedOption.data("party-code");

    console.log("Selected party code:", partyCode);
    customerCode = partyCode;

});



document.getElementById('getData').addEventListener('click', async function () {
    const partyName = document.getElementById('partyName').value.trim();
    const movementType = document.getElementById('movementType').value.trim();
    const modeType = document.getElementById('modeType').value.trim();
    const paymentType = document.getElementById('paymentType').value.trim();
    const department = document.getElementById('department').value.trim();
    const transitType = document.getElementById('transitType').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    try {
        let allData = [];
        let fetchMore = true;
        let start = 0;
        const chunkSize = 1000; // Supabase fetch limit

        while (fetchMore) {
            // Start building the query
            let query = supabaseClient
                .from('booking_details')
                .select('*')
                .is('invoice_number', null) // Filter rows where invoice_number is null
                .eq('customer_code', customerCode) // Match customer_code
                .eq('movement_type', movementType) // Match movement_type
                .eq('company_id', companyId) // Match company_id
                .order('pickup_date', { ascending: true })   // Then by pickup_date ascending
                .range(start, start + chunkSize - 1); // Fetch a chunk of data

            // Apply additional filters if input values are provided
            if (modeType) query = query.eq('mode_type', modeType);
            if (paymentType) query = query.eq('payment_type', paymentType);
            if (department) query = query.eq('department', department);
            if (transitType) query = query.eq('transit_type', transitType);

            // Add date range filtering if both startDate and endDate are provided
            if (startDate && endDate) {
                query = query.gte('pickup_date', startDate).lte('pickup_date', endDate);
            }

            // Fetch data
            const { data, error } = await query;

            if (error) {
                console.error('Error fetching data:', error);
                alert('Failed to fetch data. Check console for details.');
                return;
            }

            // Append the data to the allData array
            allData = allData.concat(data);

            // Check if more data needs to be fetched
            if (data.length < chunkSize) {
                fetchMore = false; // Exit the loop when the current chunk is less than chunkSize
            } else {
                start += chunkSize; // Move to the next chunk
            }
        }

        // Pass allData to renderTable
        renderTable(allData);
    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An unexpected error occurred. Check console for details.');
    }
});


// Function to render table (unchanged)
function renderTable(data) {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    if (!data || data.length === 0) {
        alert('No data found!');
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');

        // Add each cell dynamically
        const columns = [
            row.lr_number,
            row.pickup_date,
            row.movement_type,
            row.transit_type,
            // row.customer_code,
            // row.customer_name,
            row.origin_city,
            row.destination_city,
            row.vehicle_type,
            row.reference_number,
            row.vehicle_number,
            row.container_number,
            row.mode_type,
            row.quantity,
            // row.payment_type,
            row.charge_weight,
            row.invoice_number
        ];

        columns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = col || '-';
            tr.appendChild(td);
        });

        // Add delete button
        const actionTd = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.cssText =
            'background-color: red; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';
        deleteButton.addEventListener('click', async function () {
            // Call API to delete from database
            const { error } = await supabaseClient
                .from('booking_details')
                .delete()
                .eq('id', row.id); // Replace with the actual primary key column

            if (!error) {
                tr.remove(); // Remove row from table
                alert('Row deleted successfully');
            } else {
                console.error('Failed to delete row:', error);
                alert('Failed to delete row. Check console for details.');
            }
        });
        actionTd.appendChild(deleteButton);
        tr.appendChild(actionTd);

        tableBody.appendChild(tr);
    });

    document.getElementById('dataTableContainer').style.display = 'block';
}
