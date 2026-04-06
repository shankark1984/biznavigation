//Customer name list
document.getElementById('partyName').addEventListener('input', async function (e) {
    const inputValue = e.target.value.trim().toLowerCase();
    console.log('Vendor Name ' + inputValue);
    await loadPartyDetails(inputValue); // Pass the input value to the function
});
// Clear the suggestion box when input field loses focus
document.getElementById('partyName').addEventListener('blur', function () {
    setTimeout(() => {
        document.getElementById('partySuggestions').innerHTML = ''; // Clear suggestions on blur
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



async function fetchData(startDate, endDate, party = '') {
    let allData = [];
    let page = 0;
    const pageSize = 1000; // Fetch 1,000 rows per page

    try {
        while (true) {
            // Build the query
            let query = supabaseClient
                .from('fullloadmovementdetails_view')
                .select('*')
                .eq('company_id', companyID)
                .gte('Pickup Date', startDate) // Filter by start date
                .lte('Pickup Date', endDate)   // Filter by end date;

            // Apply the party name filter only if the party parameter is provided
            if (party) {
                query = query.ilike('Customer Name', `%${party}%`);
            }

            // Fetch rows for the current page
            query = query.range(page * pageSize, (page + 1) * pageSize - 1);
            
            const { data, error } = await query;

            if (error) {
                console.error('Error fetching data:', error);
                break;
            }

            if (data && data.length > 0) {
                allData = allData.concat(data); // Append data to the allData array
                if (data.length < pageSize) break; // If less than pageSize, we’re on the last page
                page++; // Increment page number for the next batch
            } else {
                break; // No more data to fetch
            }
        }

        if (allData.length > 0) {
            createTableHeaders(Object.keys(allData[0])); // Pass column names from the first object
            populateTable(allData);
        } else {
            console.log("No data found for the specified criteria.");
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}



// Dynamically create table headers
function createTableHeaders(columnNames) {
    const tableHead = document.querySelector("#data-table thead");
    tableHead.innerHTML = ""; // Clear existing headers

    const headerRow = document.createElement('tr');
    columnNames.forEach(column => {
        const th = document.createElement('th');
        th.textContent = formatColumnName(column);
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);
}

// Format column names (optional, to make them more readable)
function formatColumnName(columnName) {
    return columnName.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

// Populate table rows dynamically
function populateTable(data) {
    const tableBody = document.querySelector("#data-table tbody");
    tableBody.innerHTML = ""; // Clear existing data

    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(cellData => {
            const td = document.createElement('td');
            td.textContent = cellData || ''; // Handle null or undefined values
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

// Fetch and populate data when the page loads
// window.addEventListener('load', fetchData);

document.getElementById('getMovementDatas').addEventListener('click', async function (event) {
    event.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const customerName=document.getElementById('partyName').value;
    console.log('date '+ startDate + endDate + customerName);
    fetchData(startDate, endDate,customerName)

});



// XLSX download functionality using SheetJS
document.getElementById('downloadXLS').addEventListener('click', function () {
    const table = document.getElementById('data-table');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, 'full_load_movement_details.xlsx');
});