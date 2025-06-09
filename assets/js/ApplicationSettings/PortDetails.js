document.addEventListener('DOMContentLoaded', () => {
    const getField = id => document.getElementById(id);
    const formFields = {
        country: getField('portCountryName'),
        code: getField('portCode'),
        name: getField('portName'),
        type: getField('portPort'),
    };
    const messageDiv = getField('formMessage');
    const addPortButton = getField('addPortDetails');

    const showMessage = (text, isError = true) => {
        messageDiv.textContent = text;
        messageDiv.className = `mt-2 ${isError ? 'text-danger' : 'text-success'}`;
    };

    const clearForm = () => {
        formFields.country.value = '';
        formFields.code.value = '';
        formFields.name.value = '';
        formFields.type.value = '';
    };

    const loadPortTable = async () => {
        const { data, error } = await supabaseClient
            .from('PortsDetails')
            .select('*')
            .order('PortCode', { ascending: true });

        if (error) {
            console.error('Error loading port table:', error.message || error);
            return;
        }

        const tableBody = getField('portTableBody');
        tableBody.innerHTML = '';

        data.forEach((port, index) => {
            tableBody.innerHTML += `
                <tr data-code="${port.PortCode}">
                    <td>${index + 1}</td>
                    <td>${port.PortCountry}</td>
                    <td>${port.PortCode}</td>
                    <td>${port.PortName}</td>
                    <td>${port.PortType}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-primary edit-btn">Edit</button>
                        <button type="button" class="btn btn-sm btn-danger delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', async function () {
                const row = this.closest('tr');
                const portCode = row.dataset.code;
                await fillFormForEdit(portCode);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async function () {
                const portCode = this.closest('tr').dataset.code;
                if (!confirm(`Are you sure you want to delete port: ${portCode}?`)) return;

                const { error } = await supabaseClient
                    .from('PortsDetails')
                    .delete()
                    .eq('PortCode', portCode);

                if (error) {
                    console.error('Delete failed:', error.message || error);
                    showMessage('Failed to delete port.', true);
                } else {
                    showMessage('Port deleted successfully.', false);
                    await loadPortTable();
                    clearForm();
                }
            });
        });
    };

    const fillFormForEdit = async portCode => {
        const { data, error } = await supabaseClient
            .from('PortsDetails')
            .select('*')
            .eq('PortCode', portCode)
            .maybeSingle();

        if (error || !data) {
            showMessage('Failed to load port for editing.', true);
            return;
        }

        formFields.country.value = data.PortCountry || '';
        formFields.code.value = data.PortCode || '';
        formFields.name.value = data.PortName || '';
        formFields.type.value = data.PortType || '';

        showMessage(`Editing port: ${portCode}`, false);
    };

    addPortButton.addEventListener('click', async () => {
        const portCountryName = formFields.country.value.trim();
        const portCode = formFields.code.value.trim().toUpperCase();
        const portName = formFields.name.value.trim();
        const portType = formFields.type.value;

        if (!portCountryName || !portCode || !portName || !portType) {
            showMessage('Please fill in all fields.', true);
            return;
        }

        try {
            const { data: existing, error: fetchError } = await supabaseClient
                .from('PortsDetails')
                .select('PortCode')
                .eq('PortCode', portCode)
                .limit(1)
                .maybeSingle();

            if (fetchError) throw fetchError;

            const payload = {
                PortName: portName,
                PortType: portType,
                PortCountry: portCountryName,
                [`${existing ? 'updated' : 'created'}_by`]: userLoginID,
                [`${existing ? 'updated' : 'created'}_at`]: localtimeStamp,
            };

            const query = existing
                ? supabaseClient.from('PortsDetails').update(payload).eq('PortCode', portCode)
                : supabaseClient.from('PortsDetails').insert([{ PortCode: portCode, ...payload }]);

            const { error } = await query;
            if (error) throw error;

            showMessage(`Port details ${existing ? 'updated' : 'added'} successfully!`, false);
            clearForm();
            await loadPortTable();

        } catch (err) {
            console.error('Error saving port details:', err.message || err);
            showMessage('Failed to save port details. Please try again.', true);
        }
    });

    // Initial load
    loadPortTable();
});

document.addEventListener('DOMContentLoaded', () => {
    ['portCountryName', 'portCode', 'portName', 'portPort'].forEach(id => {
        document.getElementById(id).addEventListener('input', filterPortTable);
    });
});

function filterPortTable() {
    const country = document.getElementById('portCountryName').value.toLowerCase();
    const code = document.getElementById('portCode').value.toLowerCase();
    const name = document.getElementById('portName').value.toLowerCase();
    const type = document.getElementById('portPort').value.toLowerCase();

    const rows = document.querySelectorAll('#portTableBody tr');

    rows.forEach(row => {
        const [, cName, pCode, pName, pType] = [...row.cells].map(cell => cell.textContent.toLowerCase());

        const match =
            (!country || cName.includes(country)) &&
            (!code || pCode.includes(code)) &&
            (!name || pName.includes(name)) &&
            (!type || pType.includes(type));

        row.style.display = match ? '' : 'none';
    });
}
