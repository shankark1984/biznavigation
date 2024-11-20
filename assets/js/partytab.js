// Function to delete a row from the table and database
async function deleteTableRow(row, rowId) {
    // First, delete from the database
    try {
        if (document.getElementById('modifyButton').disabled == true) {
            // If successful, remove the row from the table
            let { error } = await supabaseClient
                .from('billing_address') // Your table name
                .delete() // Perform the delete action
                .eq('id', rowId); // Specify which row to delete using the row ID

            if (error) {
                console.error("Error deleting from database:", error);
                return; // Stop further execution if there's an error
            }

            row.remove();
            alert('Charges deleted successfully.');
        }
    } catch (error) {
        console.error("Unexpected error deleting row:", error);
    }
}
// Function to fetch data from Supabase
async function billingAddressfetchSupabaseData(partyCode) {
    let partyCode=getPartyCodeFromInput('partyName', 'partySuggestions');
    try {
        // Fetch data from 'booking_charges' table
        let { data, error } = await supabaseClient
            .from('billing_address') // Table name
            .select('*')// Fetch all fields
            .eq('party_code', )
            .eq('company_id',companyID);// Fetch rows filtered by company ID

        if (error) {
            console.error("Error fetching data:", error);
            return [];
        }

        console.log("Fetched Data:", data); // Log the fetched data
        return data;
    } catch (error) {
        console.error("Unexpected error fetching data:", error);
        return [];
    }
}

async function vendorpopulateTable(lrNumber) {
    const data = await vendorfetchSupabaseData(lrNumber); // Fetch the data
    const tableBody = document.querySelector('#vendorchargesDetailsTable tbody');
    const tableFoot = document.querySelector('#vendorchargesDetailsTable tfoot');

    console.log('Vendor Fright Details '+lrNumber);

    // Clear existing table rows
    tableBody.innerHTML = '';

    // Variables to store total sums
    let totalAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    // Function to update the totals row
    function updateTotals() {
        // Clear any existing footer content
        if (tableFoot) {
            tableFoot.innerHTML = '';
        }

        const totalRow = document.createElement('tr');
        totalRow.innerHTML = `
            <td colspan="2"><strong>Total</strong></td>
            <td><strong>${totalAmount.toFixed(2)}</strong></td>
            <td><strong>${totalCGST.toFixed(2)}</strong></td>
            <td><strong>${totalSGST.toFixed(2)}</strong></td>
            <td><strong>${totalIGST.toFixed(2)}</strong></td>
            <td><strong>${totalGST.toFixed(2)}</strong></td>
            <td><strong>${grandTotal.toFixed(2)}</strong></td>
            <td></td>
        `;
        if (tableFoot) {
            tableFoot.appendChild(totalRow);
        } else {
            const newFooter = document.createElement('tfoot');
            newFooter.appendChild(totalRow);
            document.querySelector('#vendorchargesDetailsTable').appendChild(newFooter);
        }
    }

    // Loop through the fetched data
    data.forEach(row => {
        if (row.lr_number === lrNumber) { // Match the LR number
            const newRow = document.createElement('tr');

            // Log the matching row
            console.log("Matching Row:", row);

            // Populate the row with relevant fields
            const fields = [
                row.charges_type, row.gst_type, row.amount,
                row.cgst_amount, row.sgst_amount, row.igst_amount,
                row.total_gst_amount, row.grand_total_billing
            ];

            // Create and append cells to the new row
            fields.forEach(cellValue => {
                const cell = document.createElement('td');
                cell.innerText = cellValue;
                newRow.appendChild(cell);
            });

            // Add delete button
            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Delete';
            deleteButton.className = 'delete-btn'; // Optional: for styling
            deleteButton.onclick = (event) => {
                event.preventDefault(); // Prevent the default form submission behavior

                // Subtract the deleted row's values from the totals
                totalAmount -= parseFloat(row.amount || 0);
                totalCGST -= parseFloat(row.cgst_amount || 0);
                totalSGST -= parseFloat(row.sgst_amount || 0);
                totalIGST -= parseFloat(row.igst_amount || 0);
                totalGST -= parseFloat(row.total_gst_amount || 0);
                grandTotal -= parseFloat(row.grand_total_billing || 0);

                // Remove the row from the table
                tableBody.removeChild(newRow);

                // Update totals after row deletion
                updateTotals();

                vendordeleteTableRow(newRow, row.id); // Pass row ID to delete function
            };
            deleteCell.appendChild(deleteButton);
            newRow.appendChild(deleteCell);

            tableBody.appendChild(newRow);

            // Accumulate totals
            totalAmount += parseFloat(row.amount || 0);
            totalCGST += parseFloat(row.cgst_amount || 0);
            totalSGST += parseFloat(row.sgst_amount || 0);
            totalIGST += parseFloat(row.igst_amount || 0);
            totalGST += parseFloat(row.total_gst_amount || 0);
            grandTotal += parseFloat(row.grand_total_billing || 0);
        }
    });

    // Add or update totals row after the loop
    updateTotals();
}
