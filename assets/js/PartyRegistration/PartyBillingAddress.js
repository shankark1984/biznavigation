// Function to load billing addresses for the selected party
async function loadBillingAddresses({ billingTableBody, partyCodeSelect }) {
    const partyCode = (partyCodeSelect.value || '').trim();

    if (!partyCode) {
        billingTableBody.innerHTML = `
            <tr><td colspan="10" class="text-center text-muted">
                Please select a party first
            </td></tr>`;
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .select(`id, ContactName, ContactNumber, Address, PinCode,
                     City, State, Country, DefaultActive, Status`)
            .eq('PartyCode', partyCode);

        if (error) throw error;

        billingTableBody.innerHTML = '';

        if (!data || data.length === 0) {
            billingTableBody.innerHTML = `
                <tr><td colspan="10" class="text-center text-muted">
                    No billing addresses created
                </td></tr>`;
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;

            tr.innerHTML = `
                <td>${row.ContactName ?? ''}</td>
                <td>${row.ContactNumber ?? ''}</td>
                <td>${row.Address ?? ''}</td>
                <td>${row.PinCode ?? ''}</td>
                <td>${row.City ?? ''}</td>
                <td>${row.State ?? ''}</td>
                <td>${row.Country ?? ''}</td>
                <td>${row.DefaultActive ? 'Yes' : 'No'}</td>
                <td>${row.Status ? 'Active' : 'Inactive'}</td>
                <td>
                    <button type="button"
                        class="btn btn-sm btn-outline-primary me-1 edit-row"
                        data-id="${row.id}">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button type="button"
                            class="btn btn-sm btn-outline-danger delete-row"
                            data-id="${row.id}">
                            <i class="bi bi-trash"></i> Delete
                    </button>
                </td>`;

            billingTableBody.appendChild(tr);
            toggleButtons(".edit-row, .delete-row", false); //Disable edit and delete buttons
        });
    } catch (err) {
        console.error(err);
        alert(`Failed to load billing addresses:\n${err.message}`);
    }
}
// Function to validate form fields
addbillingAddress.addEventListener('click', async function (event) {
    event.preventDefault();
    const validationRules = [
        {
            selector: '#partyCodes',
            test: v => v !== '',
            message: 'Party Code is required'
        },
        {
            selector: '#billingContactPerson',
            test: v => v !== '',
            message: 'Contact Name is required'
        },
        {
            selector: '#billingContactNumber',
            test: v => /^\d{10}$/.test(v),
            message: 'Enter a valid 10-digit phone number'
        },
        {
            selector: '#partyBillingAddress',
            test: v => v.length >= 5,
            message: 'Address must be at least 5 characters'
        },
        {
            selector: '#billingPinCode',
            test: v => /^\d{6}$/.test(v),
            message: 'Enter a valid 6-digit PIN'
        },
        {
            selector: '#billingCity',
            test: v => v !== '',
            message: 'City is required'
        },
        {
            selector: '#billingState',
            test: v => v !== '',
            message: 'State is required'
        },
        {
            selector: '#billingCountry',
            test: v => v !== '',
            message: 'Country is required'
        }
    ];
    if (!validateForm(validationRules)) {
        // addbillingAddress.disabled = false;
        return;
    }
    const billingAddressStatus = $('#billingAddressStatus').val();

    if (!billingAddressStatus) {
        billingAddressStatus == 'Active'
    } else {
        billingAddressStatus == 'Inactive'
    }
    // Gather form values
    const formData = {
        PartyCode: $("#partyCodes").val(),
        ContactName: $("#billingContactPerson").val(),
        ContactNumber: $("#billingContactNumber").val(),
        Address: $("#partyBillingAddress").val(),
        PinCode: $("#billingPinCode").val(),
        City: $("#billingCity").val(),
        State: $("#billingState").val(),
        Country: $("#billingCountry").val(),
        Status: billingAddressStatus,    // Boolean
        DefaultActive: $("#defaultBilling").is(":checked"),               // Boolean
        company_id: CompanyID,     // must exist
        created_by: UserLoginID,   // must exist
        created_at: localtimeStamp // must exist
    };

    // Convert empty strings → null
    Object.keys(formData).forEach(k => {
        if (formData[k] === "") formData[k] = null;
    });

    try {
        // Insert and get the new row back
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .insert([formData])
            .select()            // returns an array of inserted rows
            .single();           // convenience: unwraps to one object

        if (error) throw error;
        if (!data) throw new Error('No data returned from insert.');

        const insertedRow = data;          // the row Supabase just created
        // console.log('Saved:', insertedRow);

        // lock partyCode after first insert
        $("#partyCode").val(formData.PartyCode).prop('disabled', true);
        alert('Billing address saved successfully!');

        // Remove “no rows” placeholder if it exists
        $("#billingAddressTable tbody .text-muted").closest('tr').remove();

        // Append the new row
        const newRow = `
            <tr data-id="${insertedRow.id}">
                <td>${insertedRow.ContactName ?? ''}</td>
                <td>${insertedRow.ContactNumber ?? ''}</td>
                <td>${insertedRow.Address ?? ''}</td>
                <td>${insertedRow.PinCode ?? ''}</td>
                <td>${insertedRow.City ?? ''}</td>
                <td>${insertedRow.State ?? ''}</td>
                <td>${insertedRow.Country ?? ''}</td>
                <td>${insertedRow.DefaultActive ? 'Yes' : 'No'}</td>
                <td>${insertedRow.Status ? 'Active' : 'Inactive'}</td>
                <td>
                    <button type="button"
                            class="btn btn-sm btn-outline-primary me-1 edit-row"
                            data-id="${insertedRow.id}">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button type="button"
                            class="btn btn-sm btn-outline-danger delete-row"
                            data-id="${insertedRow.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </td>
            </tr>`;
        $("#billingAddressTable tbody").append(newRow);
        clearBillingForm();
        toggleButtons(".edit-row, .delete-row", true); //Disable edit and delete buttons
    } catch (err) {
        console.error(err);
        alert(`Failed to save party details:\n${err.message}`);
    } finally {
        addbillingAddress.disabled = false;   // re-enable button
    }
});

// Handle row deletion
$(document).on("click", ".delete-row", async function () {
    const row = $(this).closest("tr");
    const id = $(this).data("id");

    if (!id) {
        alert("Invalid ID for deletion.");
        return;
    }

    if (confirm("Are you sure you want to delete this billing address?")) {
        try {
            const { error } = await supabaseClient
                .from('PartyBillingAddress') // ✅ Corrected table name
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error(`Error deleting row: ${error.message}`);
            }

            // Remove the row from the table
            row.remove();
            alert("Billing address deleted successfully!");

            // Optional: Show placeholder if table is now empty
            const tbody = $("#billingAddressTable tbody");
            if (tbody.children("tr").length === 0) {
                tbody.html(`
                    <tr>
                        <td colspan="10" class="text-center text-muted">
                            No billing addresses created
                        </td>
                    </tr>
                `);
            }

        } catch (err) {
            console.error(err);
            alert(`Failed to delete billing address.\nError: ${err.message}`);
        }
    }
});

/* ---------- Globals ---------- */
let currentEditId = null;   // holds the row.id we’re editing

/* ---------- Edit-button handler ---------- */
$(document).on('click', '.edit-row', async function () {
    const id = $(this).data('id');
    if (!id) { alert('Invalid row ID'); return; }

    try {
        // fetch the single row for this id
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .select('*')
            .eq('id', id)
            .single();          // unwrap to an object

        if (error) throw error;
        if (!data) throw new Error('Row not found');

        /* ----------  Populate the form ---------- */
        $('#billingContactPerson').val(data.ContactName ?? '');
        $('#billingContactNumber').val(data.ContactNumber ?? '');
        $('#partyBillingAddress').val(data.Address ?? ''); // textarea
        $('#billingPinCode').val(data.PinCode ?? '');
        $('#billingCity').val(data.City ?? '');
        $('#billingState').val(data.State ?? '');
        $('#billingCountry').val(data.Country ?? '');

        // checkbox + select
        $('#defaultBilling').prop('checked', !!data.DefaultActive);
        $('#billingAddressStatus').val(data.Status ? 'Active' : 'Inactive');

        // remember we’re in “edit” mode
        currentEditId = id;

        /* ----------  UI tweaks ---------- */
        $('#addbillingAddress').addClass('d-none');      // hide “Add”
        $('#updateBillingAddress').removeClass('d-none'); // show “Update”
        $('#billingContactPerson').focus();              // place cursor
    } catch (err) {
        console.error(err);
        alert(`Failed to load address for editing:\n${err.message}`);
    }
});

/* ---------- Optional: Update-button handler ---------- */
$('#updateBillingAddress').on('click', async function () {
    if (!currentEditId) { alert('No record selected for update'); return; }

    const updated = {
        ContactName: $('#billingContactPerson').val(),
        ContactNumber: $('#billingContactNumber').val(),
        Address: $('#partyBillingAddress').val(),
        PinCode: $('#billingPinCode').val(),
        City: $('#billingCity').val(),
        State: $('#billingState').val(),
        Country: $('#billingCountry').val(),
        Status: $('#billingAddressStatus').val() === 'Active',
        DefaultActive: $('#defaultBilling').is(':checked'),
        updated_at: localtimeStamp,
        updated_by: userLoginID // must exist
    };

    // convert empty strings → null
    Object.keys(updated).forEach(k => {
        if (updated[k] === '') updated[k] = null;
    });

    try {
        const { error } = await supabaseClient
            .from('PartyBillingAddress')
            .update(updated)
            .eq('id', currentEditId);

        if (error) throw error;

        alert('Billing address updated!');
        // refresh the row or reload the table as you prefer
        loadBillingAddresses({                                       // reuse loader
            billingTableBody: document.querySelector('#billingAddressTable tbody'),
            partyCodeSelect: document.getElementById('partyCodes')
        });

        /* reset UI to “add” mode */
        currentEditId = null;
        $('#updateBillingAddress').addClass('d-none');
        $('#addbillingAddress').removeClass('d-none');
        clearBillingForm();

        // $('#billingAddressForm')[0].reset(); // assuming you wrap inputs in a form

    } catch (err) {
        console.error(err);
        alert(`Failed to update address:\n${err.message}`);
    }
});
// Function to clear the billing form fields
function clearBillingForm() {
    $('#billingContactPerson').val('');
    $('#billingContactNumber').val('');
    $('#partyBillingAddress').val('');
    $('#billingPinCode').val('');
    $('#billingCity').val('');
    $('#billingState').val('');
    $('#billingCountry').val('');
    $('#defaultBilling').prop('checked', false);
    $('#billingAddressStatus').val('');
}