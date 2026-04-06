async function loadSettingParameters() {
    const { data, error } = await supabaseClient
        .from('SettingParameters')
        .select('InputFieldID, InputFieldName, FieldValue, InputFieldType, GroupBy')
        .in('company_id', [companyID]);

    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }

    const container = document.getElementById('setting-parameters-container');
    container.innerHTML = '';

    // Make the container an accordion
    container.setAttribute('id', 'accordion-settings');

    let currentGroup = null;
    let groupFieldsContainer = null;
    let collapseIndex = 0;

    data.forEach(field => {
        const groupLabelText = field.GroupBy?.trim() || 'General Settings';

        if (groupLabelText !== currentGroup) {
            currentGroup = groupLabelText;
            collapseIndex++;
            const collapseId = `group-collapse-${collapseIndex}`;

            // Card wrapper
            const card = document.createElement('div');
            card.className = 'card mb-3 shadow-sm';

            // Header with toggle button
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

            // Body (collapsible)
            const collapseDiv = document.createElement('div');
            collapseDiv.className = 'collapse';
            collapseDiv.id = collapseId;

            // Accordion behavior: only one open at a time
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

            // Toggle icon behavior
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

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        colDiv.appendChild(formGroup);

        groupFieldsContainer.appendChild(colDiv);
    });
}

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

    if (!allValid) return;

    for (const input of inputs) {
        const { error } = await supabaseClient
            .from('SettingParameters')
            .update({ FieldValue: input.value }) // Note: typo in 'FieledValue' — should be 'FieldValue' if DB is correct
            .eq('InputFieldID', input.id);

        if (error) {
            alert(`Error updating ${input.id}: ${error.message}`);
            return;
        }
    }

    alert('Settings updated successfully!');
});

// Load on page load or tab switch
loadSettingParameters();
