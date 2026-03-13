
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

function addContainerRow(containerType, containerNumber) {
    const tableBody = document.querySelector('#containerDetailsTable tbody');
    const rowCount = tableBody.rows.length + 1;
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${rowCount}</td>
        <td>${containerType}</td>
        <td>${containerNumber}</td>
        <td>
            <button class="btn btn-danger btn-sm" onclick="removeContainerRow(this)">Remove</button>
        </td>
    `;
    tableBody.appendChild(newRow);
    document.getElementById('containerNumber').value = ''; // Clear input after adding
    document.getElementById('containerType').value = ''; // Clear container type after adding
    document.getElementById('containerFeedback').classList.add('d-none'); // Hide feedback
}
function removeContainerRow(button) {
    const row = button.closest('tr');
    row.parentNode.removeChild(row);
    // Reorder rows after removal
    const tableBody = document.querySelector('#containerDetailsTable tbody');
    Array.from(tableBody.rows).forEach((row, index) => {
        row.cells[0].textContent = index + 1; // Update S No.
    });
}
// Add event listener for the "Add Container" button
document.getElementById('addContainer').addEventListener('click', function () {
    const containerType = document.getElementById('containerType').value.trim();
    const containerNumber = document.getElementById('containerNumber').value.trim();

    if (!containerType || !containerNumber) {
        alert('Please enter both Container Type and Container Number.');
        return;
    }

    const validationResult = validateContainerNumber(containerNumber);
    if (!validationResult.valid) {
        alert(`Invalid Container Number: ${validationResult.error}`);
        return;
    }

    addContainerRow(containerType, validationResult.containerNumber);
});

// save container details as add "containerDetailsTable" to supabase table 
// ID_IB, EquipmentType, EquipmentNumber, created_by and created_at

async function saveContainerDetails() {
    const tableBody = document.querySelector(`#containerDetailsTable tbody`);
    const rows = Array.from(tableBody.rows);
    insertedID = document.getElementById('tempFormID').value; // Assuming you have an input field with ID 'insertedID'
    if (rows.length === 0) {
        // alert('No container details to save.');
        return;
    }

    const containerDetails = rows.map(row => {
        return {
            ID_IB: insertedID,
            EquipmentType: row.cells[1].textContent.trim(),
            EquipmentNumber: row.cells[2].textContent.trim(),
            created_by: userLoginID,
            created_at: localtimeStamp
        };
    });

    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingEquipment')
            .insert(containerDetails);

        if (error) {
            console.error('Error saving container details:', error);
            alert('Error saving container details. Please try again.');
        } else {
            // alert('Container details saved successfully!');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Unexpected error. Please try again.');
    }
}

//fetchContainerDetails from supabaseClient to containerDetailsTable
async function fetchContainerDetails(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('InternationalBookingEquipment')
            .select('*')
            .eq('ID_IB', bookingID);

        if (error) {
            console.error('Error fetching container details:', error);
            return;
        }

        const tableBody = document.querySelector('#containerDetailsTable tbody');
        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach((item, index) => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.EquipmentType}</td>
                <td>${item.EquipmentNumber}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="removeContainerRow(this)">Remove</button>
                </td>
            `;
            tableBody.appendChild(newRow);
        });
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}
