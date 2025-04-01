// Enable all form inputs
function enableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = false);
}
// Disable all form inputs, selects, textareas, and options
function disableForm() {
    document.querySelectorAll('input, select, textarea, option').forEach(el => el.disabled = true);
}

// Clear all input fields and select elements
function clearForm() {
    const inputs = document.querySelectorAll("input, select, textarea");

    inputs.forEach(input => {
        if (input.type === "checkbox" || input.type === "radio") {
            input.checked = false; // Uncheck checkboxes and radio buttons
        } else {
            input.value = ""; // Clear text inputs and textareas
        }

        if (input.tagName === "SELECT") {
            input.selectedIndex = 0; // Reset <select> dropdowns to first option
        }
    });
}
