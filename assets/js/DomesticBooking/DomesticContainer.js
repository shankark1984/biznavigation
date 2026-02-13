let deletedEquipmentNumbers = [];

function validateContainerNumber(containerNumber) {
    // Ensure input is uppercase
    containerNumber = containerNumber.toUpperCase().trim();

    // Basic format check
    const regex = /^[A-Z]{3}[UJZ]\d{6}\d$/;
    if (!regex.test(containerNumber)) {
        return { valid: false, error: "Invalid Container Number" };
    }

    const charMap = {
        A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18,
        I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27,
        Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36,
        Y: 37, Z: 38
    };

    const base = 2;
    let sum = 0;

    for (let i = 0; i < 10; i++) {
        const char = containerNumber[i];
        let value;

        if (i < 4) {
            value = charMap[char];
            if (!value) return { valid: false, error: `Invalid character '${char}' in prefix` };
        } else {
            value = parseInt(char, 10);
        }

        sum += value * (1 << i);   // faster (2^i)
    }

    const expectedCheckDigit = sum % 11 % 10;
    const actualCheckDigit = parseInt(containerNumber[10], 10);

    return {
        valid: expectedCheckDigit === actualCheckDigit,
        containerNumber,
        parts: {
            ownerPrefix: containerNumber.slice(0, 3),
            category: containerNumber[3],
            serial: containerNumber.slice(4, 10),
            checkDigit: actualCheckDigit
        },
        calculatedCheckDigit: expectedCheckDigit
    };
}

document.getElementById('containerNumber').addEventListener('input', function () {

    const input = this;
    input.value = input.value.toUpperCase();

    const feedback = document.getElementById('containerFeedback');
    const modeValue = document.getElementById('modeTypeD').value;

    if (modeValue === 'FTL') {
        input.classList.remove('is-invalid', 'is-valid');
        feedback.classList.add('d-none');
        return;
    }

    if (input.value.length < 11) {
        input.classList.remove('is-invalid', 'is-valid');
        feedback.classList.add('d-none');
        return;
    }

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

    // Prevent duplicate equipment number
    const exists = Array.from(tableBody.rows)
        .some(r => r.cells[2].textContent.toUpperCase() === containerNumber.toUpperCase());

    if (exists) {
        alert('This equipment number already exists in the list.');
        return;
    }

    const rowCount = tableBody.rows.length + 1;

    const newRow = document.createElement('tr');
    newRow.classList.add('new-row');          // mark NEW row
    newRow.dataset.rowType = 'new';

    newRow.innerHTML = `
        <td>${rowCount}</td>
        <td>${containerType}</td>
        <td>${containerNumber}</td>
        <td>
            <button class="btn btn-danger btn-sm remove-row"
                onclick="removeContainerRow(this)">Remove</button>
        </td>
    `;

    tableBody.appendChild(newRow);

    document.getElementById('containerNumber').value = '';
    document.getElementById('containerType').value = '';
    document.getElementById('containerFeedback').classList.add('d-none');
}

document.getElementById('addContainer').addEventListener('click', function () {

    const containerType = document.getElementById('containerType').value.trim();
    const containerNumber = document.getElementById('containerNumber').value.trim().toUpperCase();
    const modeValue = document.getElementById('modeTypeD').value;

    if (!containerType || !containerNumber) {
        alert('Please enter both Equipment Type and Number.');
        return;
    }

    if (modeValue === 'FCL') {
        const validationResult = validateContainerNumber(containerNumber);
        if (!validationResult.valid) {
            alert(`Invalid Container Number: ${validationResult.error}`);
            return;
        }
    }

    addContainerRow(containerType, containerNumber);
});

async function saveEquipmentDetails() {

    const tableBody = document.querySelector('#containerDetailsTable tbody');
    const rows = Array.from(tableBody.rows);

    const insertedID = document.getElementById('tempFormID').value;

    if (!insertedID) {
        alert('Booking ID not available.');
        return;
    }

    // ---------- INSERT NEW ----------
    const newRows = rows.filter(row => row.dataset.rowType === 'new');

    if (newRows.length > 0) {

        const equipmentDetails = newRows.map(row => ({
            ID_DB: insertedID,
            EquipmentType: row.cells[1].textContent.trim(),
            EquipmentNumber: row.cells[2].textContent.trim(),
            created_by: UserLoginID,
            created_at: localtimeStamp
        }));

        const { error: insertError } = await supabaseClient
            .from('DomesticEquipmentDetails')
            .insert(equipmentDetails);

        if (insertError) {
            console.error(insertError);
            alert('Error saving new equipment.');
            return;
        }

        // mark saved rows as OLD
        newRows.forEach(row => {
            row.dataset.rowType = 'old';
            row.classList.remove('new-row');
        });
    }

    // ---------- DELETE REMOVED OLD ----------
    if (deletedEquipmentNumbers.length > 0) {

        const { error: deleteError } = await supabaseClient
            .from('DomesticEquipmentDetails')
            .delete()
            .eq('ID_DB', insertedID)
            .in('EquipmentNumber', deletedEquipmentNumbers);

        if (deleteError) {
            console.error(deleteError);
            alert('Error deleting removed equipment.');
            return;
        }

        deletedEquipmentNumbers = []; // clear tracker
    }
}

async function fetchEquipmentDetails(bookingID) {
    try {
        const { data, error } = await supabaseClient
            .from('DomesticEquipmentDetails')
            .select('*')
            .eq('ID_DB', bookingID);

        if (error) {
            console.error('Error fetching container details:', error);
            return;
        }

        const tableBody = document.querySelector('#containerDetailsTable tbody');
        tableBody.innerHTML = '';
        deletedEquipmentNumbers = [];

        data.forEach((item, index) => {

            const newRow = document.createElement('tr');
            newRow.classList.add('old-row');   // mark OLD line
            newRow.dataset.rowType = 'old';

            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.EquipmentType}</td>
                <td>${item.EquipmentNumber}</td>
                <td>
                    <button class="btn btn-danger btn-sm remove-row"
                        onclick="removeContainerRow(this)">
                        Remove
                    </button>
                </td>
            `;
            tableBody.appendChild(newRow);
        });

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

function toggleContainerTab(modeValue) {

    const containerTabContent = document.getElementById('container-details');
    const containerTabButton = document.getElementById('container-details-tab');
    const containerTypeLabel = document.getElementById('containerTypeLabel');
    const freightTabButton = document.getElementById('freight-tab');
    const containerNumberLabel = document.getElementById('containerNumberLabel');

    if (modeValue === 'FCL' || modeValue === 'FTL') {

        containerTabContent.classList.remove('d-none');
        containerTabButton.classList.remove('d-none');

        // Change tab name
        containerTabButton.textContent =
            modeValue === 'FTL' ? 'Vehicle Details' : 'Container Details';

        // Change label
        containerTypeLabel.textContent =
            modeValue === 'FTL' ? 'Vehicle Type' : 'Container Type';
        containerNumberLabel.textContent =
            modeValue === 'FTL' ? 'Vehicle Number' : 'Container Number';

        // Update datalist
        if (modeValue === 'FTL') {
            loadDatalist('containerTypeList', 'VehicleType');
        } else {
            loadDatalist('containerTypeList', 'ContainerType');
        }

    } else {

        containerTabContent.classList.add('d-none');
        containerTabButton.classList.add('d-none');

        // Switch back to freight tab
        const tab = new bootstrap.Tab(freightTabButton);
        tab.show();
    }
}

function removeContainerRow(button) {

    const row = button.closest('tr');

    // If OLD row → track for DB delete
    if (row.dataset.rowType === 'old') {
        const equipmentNumber = row.cells[2].textContent.trim();

        if (!deletedEquipmentNumbers.includes(equipmentNumber)) {
            deletedEquipmentNumbers.push(equipmentNumber);
        }
    }

    row.remove();

    // Reorder rows
    const tableBody = document.querySelector('#containerDetailsTable tbody');
    Array.from(tableBody.rows).forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });
}


