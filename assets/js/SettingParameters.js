let loadedFromAllFields = {}; // Track which fields are from 'All'

async function loadSettingParameters() {
    // Fetch both current company and 'All'
    const { data, error } = await supabaseClient
        .from('SettingParameters')
        .select('InputFieldID, InputFieldName, FieldValue, InputFieldType, GroupBy, company_id')
        .in('company_id', [companyID, 'All']);

    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }

    const container = document.getElementById('setting-parameters-container');
    container.innerHTML = '';
    container.setAttribute('id', 'accordion-settings');

    // Ensure unique fields, preferring current companyID over 'All'
    const uniqueFieldsMap = {};
    data.forEach(item => {
        if (!uniqueFieldsMap[item.InputFieldID] || item.company_id === companyID) {
            uniqueFieldsMap[item.InputFieldID] = item;
        }
    });

    const uniqueFields = Object.values(uniqueFieldsMap);

    // Sort by GroupBy to group visually
    uniqueFields.sort((a, b) => (a.GroupBy || '').localeCompare(b.GroupBy || ''));

    let currentGroup = null;
    let groupFieldsContainer = null;
    let collapseIndex = 0;

    uniqueFields.forEach(field => {
        const groupLabelText = field.GroupBy?.trim() || 'General Settings';

        if (groupLabelText !== currentGroup) {
            currentGroup = groupLabelText;
            collapseIndex++;
            const collapseId = `group-collapse-${collapseIndex}`;

            const card = document.createElement('div');
            card.className = 'card mb-3 shadow-sm';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header d-flex justify-content-between align-items-center bg-primary text-white fw-bold py-2';
            cardHeader.style.cursor = 'pointer';
            cardHeader.setAttribute('data-bs-toggle', 'collapse');
            cardHeader.setAttribute('data-bs-target', `#${collapseId}`);
            cardHeader.setAttribute('aria-expanded', 'false');
            cardHeader.setAttribute('aria-controls', collapseId);

            const titleSpan = document.createElement('span');
            titleSpan.textContent = groupLabelText;

            const toggleIcon = document.createElement('span');
            toggleIcon.innerHTML = '&#43;';
            toggleIcon.classList.add('toggle-icon');

            cardHeader.appendChild(titleSpan);
            cardHeader.appendChild(toggleIcon);

            const collapseDiv = document.createElement('div');
            collapseDiv.className = 'collapse';
            collapseDiv.id = collapseId;
            collapseDiv.setAttribute('data-bs-parent', '#accordion-settings');

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            groupFieldsContainer = document.createElement('div');
            groupFieldsContainer.className = 'row g-2';
            cardBody.appendChild(groupFieldsContainer);

            collapseDiv.appendChild(cardBody);
            card.appendChild(cardHeader);
            card.appendChild(collapseDiv);
            container.appendChild(card);

            collapseDiv.addEventListener('shown.bs.collapse', () => {
                toggleIcon.innerHTML = '&#8722;';
            });
            collapseDiv.addEventListener('hidden.bs.collapse', () => {
                toggleIcon.innerHTML = '&#43;';
            });
        }

        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-3';

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.setAttribute('for', field.InputFieldID);
        label.textContent = field.InputFieldName;
        label.className = 'form-label';

        const input = document.createElement('input');
        input.id = field.InputFieldID;
        input.name = field.InputFieldID;
        input.type = field.InputFieldType || 'text';
        input.value = field.FieldValue || '';
        input.required = true;
        input.className = 'form-control';
        input.title = field.FieldValue || '';

        // Track and style if from 'All'
        if (field.company_id === 'All') {
            loadedFromAllFields[field.InputFieldID] = true;
            input.style.border = '2px solid red';
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        colDiv.appendChild(formGroup);
        groupFieldsContainer.appendChild(colDiv);
    });
}
loadSettingParameters();// Load settings on page load


document.getElementById('saveSettingsBtn').addEventListener('click', async (e) => {
    e.preventDefault();

    const inputs = document.querySelectorAll('#setting-parameters-container input');
    let allValid = true;

    for (const input of inputs) {
        if (!input.checkValidity()) {
            input.reportValidity();
            allValid = false;
            break;
        }
    }
    console.log('All valid:', allValid);
    if (!allValid) return;

    for (const input of inputs) {
        const fieldID = input.id;
        const fieldValue = input.value;
        const fieldName = input.previousElementSibling.textContent;
        const fieldType = input.type;
        const group = input.closest('.card').querySelector('.card-header span').textContent;

        // First, check for an entry under current company
        const { data: existingCompany, error: companyError } = await supabaseClient
            .from('SettingParameters')
            .select('id')
            .eq('InputFieldID', fieldID)
            .eq('company_id', companyID)
            .maybeSingle();

        if (companyError) {
            alert(`Error checking company setting for ${fieldID}: ${companyError.message}`);
            return;
        }

        if (existingCompany) {
            // Update existing for company
            const { error: updateError } = await supabaseClient
                .from('SettingParameters')
                .update({
                    FieldValue: fieldValue,
                    created_at: localtimeStamp
                })
                .eq('InputFieldID', fieldID)
                .eq('company_id', companyID);

            if (updateError) {
                alert(`Error updating ${fieldID}: ${updateError.message}`);
                return;
            }
        } else {
            // If not found, check if the field exists under 'All'
            const { data: fromAll, error: allError } = await supabaseClient
                .from('SettingParameters')
                .select('*')
                .eq('InputFieldID', fieldID)
                .eq('company_id', 'All')
                .maybeSingle();

            if (allError) {
                alert(`Error checking default setting for ${fieldID}: ${allError.message}`);
                return;
            }

            if (fromAll) {
                // Insert new setting for this company, copying from 'All'
                const { error: insertError } = await supabaseClient
                    .from('SettingParameters')
                    .insert([{
                        InputFieldID: fieldID,
                        InputFieldName: fieldName,
                        FieldValue: fieldValue,
                        InputFieldType: fieldType,
                        GroupBy: group,
                        company_id: companyID,
                        created_by: userLoginID, // <- Make sure this variable exists
                        created_at: localtimeStamp
                    }]);

                if (insertError) {
                    alert(`Error inserting ${fieldID}: ${insertError.message}`);
                    return;
                }
            } else {
                alert(`No default setting found for ${fieldID} under 'All'. Skipping...`);
            }
        }
    }

    alert('Settings updated successfully!');
});
