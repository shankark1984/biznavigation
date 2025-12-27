/* =========================================================
   CONSTANTS
========================================================= */
const FORWARDING_TYPES = ['Forwarding', 'Import', 'Export'];

/* =========================================================
   DOM READY
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    if (!await checkAccess(UserLoginID, 'ApplicationSettings')) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }

    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);
    await loadBankNameSuggestions();
    await loadDefaultBank();
    await loadInvoiceNoSuggestions();
    loadDepartments();
});

/* =========================================================
   CUSTOMER SELECTION
========================================================= */
document.getElementById('partyName').addEventListener('change', async function () {
    const selectedPartyName = this.value.trim();
    const options = Array.from(document.getElementById('partySuggestions').options);
    const option = options.find(opt => opt.value === selectedPartyName);

    if (!option) {
        alert('Invalid customer selection.');
        return;
    }

    const partyCode = document.getElementById('partyCode').value;

    try {
        const { data, error } = await supabaseClient
            .from('PartyBillingAddress')
            .select('*')
            .eq('PartyCode', partyCode)
            .eq('Status', 'True');

        if (error) throw error;

        if (!data.length) {
            alert('No active billing address found.');
            return;
        }

        data.length === 1
            ? (fillInvoiceAddress(data[0]), document.getElementById('invoiceDate').focus())
            : showAddressSelectionModal(data);

    } catch (err) {
        console.error(err);
    }
});

function fillInvoiceAddress(addr) {
    document.getElementById('invoiceAddress').value = formatAddress(addr);
}

function formatAddress(a) {
    return `${a.Address}, ${a.City}, ${a.PinCode}, ${a.State}, ${a.Country}`;
}

/* =========================================================
   INVOICE NUMBER GENERATION
========================================================= */
async function generateInvoiceNumber(invoiceDateValue) {
    if (!invoiceDateValue) return '';

    try {
        const { data: company } = await supabaseClient
            .from('company_profile')
            .select('short_code')
            .eq('company_id', CompanyID)
            .maybeSingle();

        if (!company) return '';

        const d = new Date(invoiceDateValue);
        const fyStart = d.getMonth() >= 3 ? d.getFullYear() % 100 : (d.getFullYear() - 1) % 100;
        const fyEnd = (fyStart + 1) % 100;
        const fy = `${fyStart.toString().padStart(2, '0')}-${fyEnd.toString().padStart(2, '0')}`;

        const { data: last } = await supabaseClient
            .from('InvoiceDetails')
            .select('InvoiceNo')
            .like('InvoiceNo', `${company.short_code}/${fy}/%`)
            .eq('company_id', CompanyID)
            .order('InvoiceNo', { ascending: false })
            .limit(1)
            .maybeSingle();

        const next = last ? parseInt(last.InvoiceNo.split('/').pop()) + 1 : 1;
        return `${company.short_code}/${fy}/${next.toString().padStart(4, '0')}`;
    } catch {
        return '';
    }
}

/* =========================================================
   GLOBAL DATA
========================================================= */
let invoiceData = {};
let invoiceChargesData = {};
// let bankID = null;

/* =========================================================
   FETCH PENDING INVOICES
========================================================= */
document.getElementById('fetchPendingInvoices').addEventListener('click', async () => {
    const type = document.getElementById('movementType').value;

    try {
        if (FORWARDING_TYPES.includes(type)) {
            await getPendingInvoiceDetails();
        } else if (type === 'Customs Clearance') {
            await CustomsClearanceInvoiceDetails();
        } else {
            alert('Select valid Movement Type');
        }
    } catch (e) {
        alert('Failed to fetch invoices');
    }
});

/* =========================================================
   SAVE INVOICE
========================================================= */
document.getElementById('saveButton').addEventListener('click', async () => {
    const saveBtn = document.getElementById('saveButton');
    const spinner = document.getElementById('saveSpinnerBtn');

    const partyCode = document.getElementById('partyCode').value.trim();
    const invoiceDate = document.getElementById('invoiceDate').value;
    const invoiceType = document.getElementById('movementType').value;
    const invoiceAddress = document.getElementById('invoiceAddress').value.trim();
    const isInsert = saveBtn.dataset.mode === 'insert';

    if (!partyCode || !invoiceDate || !invoiceType || !invoiceAddress) {
        alert('Fill all required fields');
        return;
    }

    if (!bankID) {
        alert('Select valid Bank Name');
        return;
    }

    let invoiceNo = document.getElementById('invoiceNo').value.trim();
    if (isInsert) {
        invoiceNo = await generateInvoiceNumber(invoiceDate);
        if (!invoiceNo) return alert('Invoice number generation failed');
        document.getElementById('invoiceNo').value = invoiceNo;
    }

    invoiceData = {
        InvoiceNo: invoiceNo,
        InvoiceDate: invoiceDate,
        InvoiceType: invoiceType,
        PartyCode: partyCode,
        InvoiceAddress: invoiceAddress,
        BankID: bankID,
        company_id: CompanyID,

        BasicAmount: parseFloat(totalFreight.textContent) || 0,
        OtherAmount:
            (parseFloat(totalFSCAmt.textContent) || 0) +
            (parseFloat(totalOtherAmt.textContent) || 0),

        SGSTAmount: parseFloat(totalSGST.textContent) || 0,
        CGSTAmount: parseFloat(totalCGST.textContent) || 0,
        IGSTAmount: parseFloat(totalIGST.textContent) || 0,
        TotalGSTAmount: parseFloat(totalGST.textContent) || 0,
        GrandTotalAmount: parseFloat(totalGrand.textContent) || 0,
    };

    spinner.classList.remove('d-none');
    saveBtn.disabled = true;

    try {
        if (isInsert) {
            invoiceData.created_by = UserLoginID;
            invoiceData.created_at = localtimeStamp;
            await supabaseClient.from('InvoiceDetails').insert([invoiceData]);
        } else {
            invoiceData.updated_by = UserLoginID;
            invoiceData.updated_at = localtimeStamp;
            await supabaseClient.from('InvoiceDetails')
                .update(invoiceData)
                .eq('InvoiceNo', invoiceNo)
                .eq('company_id', CompanyID);
        }

        alert(`Invoice ${isInsert ? 'Saved' : 'Updated'} Successfully`);

        FORWARDING_TYPES.includes(invoiceType)
            ? await updateInvoiceNumbers(invoiceNo)
            : await updateInvoiceNumbers_cc(invoiceNo);

        disableForm();
    } catch (e) {
        alert(e.message || 'Save failed');
    } finally {
        spinner.classList.add('d-none');
    }
});

/* =========================================================
   BANK SELECTION
========================================================= */
document.getElementById('inputBankName').addEventListener('input', function () {
    bankID = bankMap[this.value] || null;
});

/* =========================================================
   SAFE UNLOCK ON EXIT
========================================================= */
window.addEventListener('beforeunload', () => {
    try {
        autoUnlockRecords();
        unlockBooking_ib(UserLoginID);
        unlockBooking_cc(UserLoginID);
    } catch { }
});

document.getElementById('newButton').addEventListener('click', newInvoice);

function newInvoice() {
    // 1️⃣ Unlock any previously locked records
    try {
        autoUnlockRecords();
        unlockBooking_ib(UserLoginID);
        unlockBooking_cc(UserLoginID);
    } catch (e) {
        console.warn('Unlock skipped:', e);
    }

    // 2️⃣ Reset form
    // document.getElementById('container').reset();

    // 3️⃣ Clear invoice number & set INSERT mode
    const saveBtn = document.getElementById('saveButton');
    saveBtn.dataset.mode = 'insert';

    document.getElementById('invoiceNo').value = '';
    document.getElementById('partyName').value = '';
    document.getElementById('partyCode').value = '';
    document.getElementById('invoiceAddress').value = '';
    // 7️⃣ Set defaults
    document.getElementById('invoiceDate').value =
        new Date().toISOString().split('T')[0];

    document.getElementById('movementType').value = '';
    document.getElementById('transitType').value = '';
    document.getElementById('department').value = '';
    document.getElementById('modeType').value = '';
    document.getElementById('paymentType').value = '';

    // 4️⃣ Clear global data
    invoiceData = {};
    invoiceChargesData = {};
    bankID = null;

    // 5️⃣ Clear totals
    clearInvoiceTotals();

    // 6️⃣ Enable form
    enableForm();

    // 8️⃣ Focus first field
    document.getElementById('partyName').focus();
}

function clearInvoiceTotals() {
    totalFreight.textContent = '0.00';
    totalFSCAmt.textContent = '0.00';
    totalOtherAmt.textContent = '0.00';
    totalSGST.textContent = '0.00';
    totalCGST.textContent = '0.00';
    totalIGST.textContent = '0.00';
    totalGST.textContent = '0.00';
    totalGrand.textContent = '0.00';
}

function enableForm() {
    document.querySelectorAll('#invoiceForm input, #invoiceForm select, #invoiceForm textarea')
        .forEach(el => el.disabled = false);
}

async function loadDepartments() {
    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('description')
        .eq('type_of_value', 'Department')
        .eq('company_id', CompanyID)
        .order('description', { ascending: true });

    if (error) {
        console.error('Load Department Error:', error);
        return;
    }

    const list = document.getElementById('departmentList');
    list.innerHTML = '';

    data.forEach(row => {
        const option = document.createElement('option');
        option.value = row.description;
        list.appendChild(option);
    });
}

const departmentInput = document.getElementById('department');

departmentInput.addEventListener('change', async () => {
    const value = departmentInput.value.trim();
    if (!value) return;

    // Check existing in datalist (case-insensitive)
    const exists = Array.from(
        document.getElementById('departmentList').options
    ).some(opt => opt.value.toLowerCase() === value.toLowerCase());

    if (exists) return;

    // Insert into DB
    const { error } = await supabaseClient
        .from('dropdown_list')
        .insert([{
            description: value,
            type_of_value: 'Department',
            company_id: CompanyID,
            created_by: UserLoginID,
            created_at: new Date().toISOString()
        }]);

    if (error) {
        console.error('Insert Department Error:', error);
        alert('Failed to save department');
        return;
    }

    // Add to datalist instantly
    const option = document.createElement('option');
    option.value = value;
    document.getElementById('departmentList').appendChild(option);
});
