document.addEventListener('DOMContentLoaded', async () => {
    if (!await checkAccess(UserLoginID, 'ApplicationSettings')) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }

    const isEditableUser = UserType === 1 || UserType === 2;
    const getField = id => document.getElementById(id);

    const formFields = {
        country: getField('portCountryName'),
        code: getField('portCode'),
        name: getField('portName'),
        type: getField('portPort'),
    };

    const messageDiv = getField('formMessage');
    const addPortButton = getField('addPortDetails');
    const actionColumnHeader = document.getElementById('portActionColumn');

    if (!isEditableUser) {
        addPortButton.disabled = true;
        addPortButton.classList.add('disabled');
        if (actionColumnHeader) actionColumnHeader.style.display = 'none';
    }

    const showMessage = (text, isError = true) => {
        messageDiv.textContent = text;
        messageDiv.className = `mt-2 ${isError ? 'text-danger' : 'text-success'}`;
    };

    const clearForm = () => {
        Object.values(formFields).forEach(field => field.value = '');
    };

    const loadPortTable = async () => {
        const { data, error } = await supabaseClient.from('PortsDetails').select('*').order('PortCode');
        if (error) return console.error('Load error:', error);

        const tbody = getField('portTableBody');
        tbody.innerHTML = '';

        data.forEach((row, i) => {
            const actions = isEditableUser ? `
        <button class="btn btn-sm btn-primary edit-btn">Edit</button>
        <button class="btn btn-sm btn-danger delete-btn">Delete</button>
      ` : '';

            tbody.innerHTML += `
        <tr data-code="${row.PortCode}">
          <td>${i + 1}</td>
          <td>${row.PortCountry}</td>
          <td>${row.PortCode}</td>
          <td>${row.PortName}</td>
          <td>${row.PortType}</td>
          <td style="${!isEditableUser ? 'display: none;' : ''}">${actions}</td>
        </tr>`;
        });

        if (isEditableUser) {
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const code = btn.closest('tr').dataset.code;
                    const { data } = await supabaseClient.from('PortsDetails').select('*').eq('PortCode', code).maybeSingle();
                    if (data) {
                        formFields.country.value = data.PortCountry || '';
                        formFields.code.value = data.PortCode || '';
                        formFields.name.value = data.PortName || '';
                        formFields.type.value = data.PortType || '';
                        showMessage(`Editing port: ${code}`, false);
                    }
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const code = btn.closest('tr').dataset.code;
                    if (!confirm(`Delete ${code}?`)) return;
                    const { error } = await supabaseClient.from('PortsDetails').delete().eq('PortCode', code);
                    if (error) return showMessage('Delete failed.', true);
                    showMessage('Deleted successfully.', false);
                    await loadPortTable();
                    clearForm();
                });
            });
        }
    };

    addPortButton.addEventListener('click', async () => {
        const portCountryName = formFields.country.value.trim();
        const portCode = formFields.code.value.trim().toUpperCase();
        const portName = formFields.name.value.trim();
        const portType = formFields.type.value;

        if (!portCountryName || !portCode || !portName || !portType)
            return showMessage('All fields are required.', true);

        try {
            const { data: existing } = await supabaseClient.from('PortsDetails').select('PortCode').eq('PortCode', portCode).maybeSingle();
            const payload = {
                PortName: portName,
                PortType: portType,
                PortCountry: portCountryName,
                [`${existing ? 'updated' : 'created'}_by`]: userLoginID,
                [`${existing ? 'updated' : 'created'}_at`]: localtimeStamp,
            };

            const { error } = existing
                ? await supabaseClient.from('PortsDetails').update(payload).eq('PortCode', portCode)
                : await supabaseClient.from('PortsDetails').insert([{ PortCode: portCode, ...payload }]);

            if (error) throw error;
            showMessage(`${existing ? 'Updated' : 'Added'} successfully!`, false);
            clearForm();
            await loadPortTable();
        } catch (err) {
            showMessage('Error saving port details.', true);
            console.error(err);
        }
    });

    // Filter Feature
    ['portCountryName', 'portCode', 'portName', 'portPort'].forEach(id => {
        document.getElementById(id).addEventListener('input', filterPortTable);
    });

    function filterPortTable() {
        const country = formFields.country.value.toLowerCase();
        const code = formFields.code.value.toLowerCase();
        const name = formFields.name.value.toLowerCase();
        const type = formFields.type.value.toLowerCase();

        document.querySelectorAll('#portTableBody tr').forEach(row => {
            const [, c, pcode, pname, ptype] = [...row.cells].map(c => c.textContent.toLowerCase());
            const visible = (!country || c.includes(country)) && (!code || pcode.includes(code)) && (!name || pname.includes(name)) && (!type || ptype.includes(type));
            row.style.display = visible ? '' : 'none';
        });
    }

    loadPortTable();
});