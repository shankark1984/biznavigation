// Global variable to store missing pincode details
let missingPincodeDetails = [];

// Capitalize each word
function capitalize(str) {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Escape quotes to safely inject into HTML
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}

// Fetch missing pincodes and populate the table
async function fetchMissingPincodes() {
    const { data, error } = await supabaseClient
        .from('missing_pincodes')
        .select('*');

    if (error) {
        console.error('Error fetching missing pincodes:', error);
        alert('Failed to fetch missing pincode data.');
        return;
    }

    const tableBody = document.querySelector('#missingPincodeTable tbody');
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        console.log('No missing pincodes found');
        return;
    }

    // Sort by pincode A-Z
    data.sort((a, b) => a.pincode.localeCompare(b.pincode));

    data.forEach((item) => {
        const row = document.createElement('tr');
        const canEdit = (UserType === 1 || (UserType === 2 && item.created_by === UserLoginID));
        const canDelete = canEdit;

        let buttons = '';
        if (canEdit) {
            buttons += `<button type="button" class="btn btn-sm btn-warning me-1" 
                onclick="editMissingPincode(${item.id}, '${escapeQuotes(item.pincode)}', 
                '${escapeQuotes(item.city)}', '${escapeQuotes(item.state)}', '${escapeQuotes(item.country)}')" 
                title="Edit"><i class="bi bi-pencil-square"></i></button>`;
        }
        if (canDelete) {
            buttons += `<button type="button" class="btn btn-sm btn-danger me-1"
                onclick="deleteMissingPincode(${item.id}, event)" 
                title="Delete"><i class="bi bi-trash"></i></button>`;
        }
        if (!canEdit && !canDelete) {
            buttons += `<span class="text-muted small">Read Only</span>`;
        }

        row.innerHTML = `
            <td>${item.pincode}</td>
            <td>${item.city}</td>
            <td>${item.state}</td>
            <td>${item.country}</td>
            <td>${buttons}</td>
        `;
        tableBody.appendChild(row);
    });

    missingPincodeDetails = data;
    populatePincodeSuggestions();
}

// Add or update a missing pincode
async function addMissingPincode() {
    let pincode = document.getElementById('missingPincode').value.trim();
    let city = capitalize(document.getElementById('missingCity').value.trim());
    let state = capitalize(document.getElementById('missingState').value.trim());
    let country = capitalize(document.getElementById('missingCountry').value.trim());

    if (!pincode || !city || !state || !country) {
        alert('Please fill in all fields.');
        return;
    }

    // Only allow admins and users with appropriate permissions
    if (userType !== 1 && userType !== 2) {
        alert('You do not have permission to add or modify pincodes.');
        return;
    }

    const button = document.getElementById('addMissingPincode');
    const action = button.innerText;
    const id = document.getElementById('tempFormID').value;
    const localtimeStamp = new Date().toISOString();

    if (action === 'Add') {
        const exists = missingPincodeDetails.find(item => item.pincode === pincode);
        if (exists) {
            alert('Pincode already exists.');
            return;
        }

        const { error } = await supabaseClient
            .from('missing_pincodes')
            .insert([{ pincode, city, state, country, created_by: userLoginID, created_at: localtimeStamp }]);

        if (error) {
            console.error('Error adding pincode:', error);
            alert('An error occurred while adding the pincode.');
            return;
        }

        alert('Pincode added successfully.');
    } else if (action === 'Edit') {
        const { error } = await supabaseClient
            .from('missing_pincodes')
            .update({ pincode, city, state, country, created_by: userLoginID, created_at: localtimeStamp })
            .eq('id', id);

        if (error) {
            console.error('Error updating pincode:', error);
            alert('Failed to update the pincode.');
            return;
        }

        alert('Pincode updated successfully.');
    }

    // Reset form
    ['missingPincode', 'missingCity', 'missingState', 'missingCountry'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('tempFormID').value = '';
    button.innerText = 'Add';

    fetchMissingPincodes();
}

// Edit missing pincode (populate form fields)
function editMissingPincode(id, pincode, city, state, country) {
    document.getElementById('tempFormID').value = id;
    document.getElementById('missingPincode').value = pincode;
    document.getElementById('missingCity').value = city;
    document.getElementById('missingState').value = state;
    document.getElementById('missingCountry').value = country;
    document.getElementById('addMissingPincode').innerText = 'Edit';
}

// Delete a missing pincode
async function deleteMissingPincode(id, event) {
    if (event) event.preventDefault();
    if (!confirm('Are you sure you want to delete this pincode?')) return;

    const { error } = await supabaseClient
        .from('missing_pincodes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting pincode:', error);
        alert('An error occurred while deleting the pincode.');
        return;
    }

    fetchMissingPincodes();
}

// Populate datalist with pincode suggestions
function populatePincodeSuggestions() {
    const datalist = document.getElementById('pincodeSuggestions');
    datalist.innerHTML = '';
    missingPincodeDetails.forEach(item => {
        const option = document.createElement('option');
        option.value = item.pincode;
        datalist.appendChild(option);
    });
}

// Fill form when pincode is selected from suggestions
$("#missingPincode").on("input", function () {
    const code = $(this).val();
    const match = missingPincodeDetails.find(item => item.pincode === code);

    if (match) {
        $("#missingPincode").val(match.pincode);
        $("#missingCity").val(match.city);
        $("#missingState").val(match.state);
        $("#missingCountry").val(match.country);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchMissingPincodes();
    const addButton = document.getElementById('addMissingPincode');
    if (UserType === 1 || UserType === 2) {
        addButton.addEventListener('click', addMissingPincode);
    } else {
        addButton.disabled = true;
        document.querySelectorAll('#missingPincodeForm input').forEach(input => {
            input.disabled = true;
        });
    }
});
