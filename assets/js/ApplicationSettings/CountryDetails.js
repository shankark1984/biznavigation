// Global variable to store country data
let countryData = [];

// Helper function to safely escape strings for HTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/'/g, "\\'");
}

// Helper function to safely capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Fetch country data from Supabase
async function fetchCountryData() {
    try {
        let query = supabaseClient
            .from('Country_Details')
            .select('*');

        // No filtering for userType here, fetch all records for now
        const { data, error } = await query;

        if (error) {
            console.error('Error fetching country data:', error);
            alert('Failed to fetch country data.');
            return;
        }

        const tableBody = document.querySelector('#countryMenuTable tbody');
        tableBody.innerHTML = ''; // Clear previous data

        if (!data || data.length === 0) {
            console.log('No country items found');
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');

            // Add userType-based permission for Edit/Delete
            const canEdit = UserType === 1 || UserType === 2;  // Admin or Manager can edit
            const canDelete = UserType === 1;  // Only Admin can delete

            row.innerHTML = `
                <td>${escapeHtml(item.CountryCode)}</td>
                <td>${escapeHtml(item.CountryName)}</td>
                <td>${escapeHtml(item.Region)}</td>
                <td>
                    ${canEdit ? `
                        <button type="button" class="btn btn-sm btn-warning me-1" 
                            onclick="editCountryItem(${item.id}, '${escapeHtml(item.CountryCode)}', 
                            '${escapeHtml(item.CountryName)}', '${escapeHtml(item.Region)}', event)" 
                            title="Edit"><i class="bi bi-pencil-square"></i></button>
                    ` : ''}
                    ${canDelete ? `
                        <button type="button" class="btn btn-sm btn-danger me-1"
                            onclick="deleteCountryItem(${item.id}, event)" 
                            title="Delete"><i class="bi bi-trash"></i></button>
                    ` : ''}
                    ${!canEdit && !canDelete ? `<span class="text-muted small">Read Only</span>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        countryData = data;

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Unexpected error loading country data.');
    }
}

// Add or update country item
async function addCountryItem() {
    const countryCode = capitalize(document.getElementById('countryCode').value.trim());
    const countryName = capitalize(document.getElementById('countryName').value.trim());
    const region = capitalize(document.getElementById('region').value.trim());

    if (!countryCode || !countryName || !region) {
        alert('Country Code, Country Name, and Region are required fields.');
        return;
    }

    const button = document.getElementById('addCountry');
    const action = button.innerText;
    const id = document.getElementById('tempFormID').value;

    const countryDataObj = {
        CountryCode: countryCode,
        CountryName: countryName,
        Region: region,
        created_at: localtimeStamp
    };

    if (action === 'Add') {
        const exists = countryData.some(item =>
            item.CountryCode.toLowerCase() === countryCode.toLowerCase() &&
            item.CountryName.toLowerCase() === countryName.toLowerCase()
        );

        if (exists) {
            alert('This country already exists.');
            return;
        }

        const { error } = await supabaseClient
            .from('Country_Details')
            .insert([countryDataObj]);

        if (error) {
            console.error('Error adding country item:', error);
            alert('Failed to add country item.');
            return;
        }

        alert('Country item added successfully.');
    } else if (action === 'Edit') {
        const originalItem = countryData.find(item => item.id == id);

        if (!originalItem) {
            alert('Original item not found.');
            return;
        }

        const { error } = await supabaseClient
            .from('Country_Details')
            .update(countryDataObj)
            .eq('id', id);

        if (error) {
            console.error('Error updating country item:', error);
            alert('Failed to update country item.');
            return;
        }

        alert('Country item updated successfully.');
    }

    document.getElementById('countryCode').value = '';
    document.getElementById('countryName').value = '';
    document.getElementById('region').value = '';
    document.getElementById('tempFormID').value = '';
    button.innerText = 'Add';

    fetchCountryData();
}

// Edit country item
function editCountryItem(id, countryCode, countryName, region, event) {
    event.preventDefault();
    document.getElementById('tempFormID').value = id;
    document.getElementById('countryCode').value = countryCode;
    document.getElementById('countryName').value = countryName;
    document.getElementById('region').value = region;
    document.getElementById('addCountry').innerText = 'Edit';
}

// Delete country item
async function deleteCountryItem(id, event) {
    event.preventDefault();
    const item = countryData.find(x => x.id === id);

    if (UserType !== 1) {
        alert('You do not have permission to delete this item.');
        return;
    }

    if (!confirm('Are you sure you want to delete this country item?')) return;

    const { error } = await supabaseClient
        .from('Country_Details')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting country item:', error);
        alert('Failed to delete country item.');
        return;
    }

    alert('Country item deleted successfully.');
    fetchCountryData();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {

    fetchCountryData();

    const addButton = document.getElementById('addCountry');
    if (UserType === 1 || UserType === 2) {
        addButton.addEventListener('click', addCountryItem);
    } else {
        addButton.disabled = true;
        document.querySelectorAll('#countryDetails input').forEach(input => {
            input.disabled = true;
        });
    }
});
