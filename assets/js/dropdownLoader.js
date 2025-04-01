async function loadDropdownOptions(filterValue, dropdownId) {
    try {
        const { data, error } = await supabaseClient
            .from('dropdown_list')
            .select('description')
            .in('company_id', ['All', companyID])
            .ilike('type_of_value', `%${filterValue}%`);

        if (error) {
            console.error(`Error fetching data from dropdown_list:`, error);
            return;
        }

        const selectElement = document.getElementById(dropdownId);
        if (!selectElement) {
            console.error(`Dropdown with ID "${dropdownId}" not found.`);
            return;
        }

        selectElement.innerHTML = '<option value="">Select an option</option>'; // Default option

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.description;
            option.textContent = item.description;
            selectElement.appendChild(option);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Load Movement Types Example
document.addEventListener('DOMContentLoaded', () => {
    loadDropdownOptions('MovementType', 'movementType');
    loadDropdownOptions('TransitType', 'transitType');
    loadDropdownOptions('ModeType', 'modeType');
    loadDropdownOptions('Cargocarrier', 'carrierName');
    loadDropdownOptions('ShippingType', 'shippingType');
    loadDropdownOptions('UOMType', 'uomType');
});


