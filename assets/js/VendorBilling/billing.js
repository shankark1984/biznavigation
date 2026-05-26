// Validate datalist input
function validateDatalist(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);

    const validOptions = Array.from(datalist.options).map(
        option => option.value
    );

    if (!validOptions.includes(input.value.trim())) {
        input.value = '';
    }
}

// Expense Type Load
async function loadExpenseTypeDropdown() {
    const expenseTypeList = document.getElementById('expenseTypeList');

    expenseTypeList.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('description')
        .eq('type_of_value', 'expenseType')
        .order('description', { ascending: true });

    if (error) {
        console.error('Error loading expense types:', error);
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.description;
        expenseTypeList.appendChild(option);
    });
}

// Expense For Load
async function loadExpenseForDropdown() {
    const expenseType = document.getElementById('expenseType').value.trim();
    const expenseForList = document.getElementById('expenseForList');
    const expenseForInput = document.getElementById('expenseFor');

    expenseForList.innerHTML = '';
    expenseForInput.value = '';

    if (!expenseType) return;

    const expenseTypeMap = {
        "Administrative Expenses": "administrativeExpenses",
        "Employee Expense": "employeeExpense",
        "Fixed Assets": "fixedAssets",
        "Liabilities": "liabilities",
        "Marketing": "marketing",
        "Miscellaneous Expenses": "miscellaneousExpenses",
        "Purchase": "purchase"
    };

    const typeOfValue = expenseTypeMap[expenseType];

    if (!typeOfValue) return;

    const { data, error } = await supabaseClient
        .from('dropdown_list')
        .select('description')
        .eq('type_of_value', typeOfValue)
        .order('description', { ascending: true });

    if (error) {
        console.error('Error loading expense for list:', error);
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.description;
        expenseForList.appendChild(option);
    });
}

// Event Listeners
document.getElementById('expenseType').addEventListener('input', loadExpenseForDropdown);

// Validate only datalist values allowed
document.getElementById('expenseType').addEventListener('blur', () => {
    validateDatalist('expenseType', 'expenseTypeList');
    loadExpenseForDropdown();
});

document.getElementById('expenseFor').addEventListener('blur', () => {
    validateDatalist('expenseFor', 'expenseForList');
});


document.addEventListener('DOMContentLoaded', async () => {
    await loadExpenseTypeDropdown();
    await loadSuggestions('partySuggestions', 'PartyDetails', CompanyID);

})
