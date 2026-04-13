document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const form = document.querySelector('.needs-validation');
    const saveBtn = document.getElementById('saveButton');
    const statusField = document.getElementById('serviceProviderStatus');
    const deActiveDate = document.getElementById('deActiveDate');

    if (!form) return;

    // ✅ Initial status check
    if (statusField) {
        deActiveDate.disabled = statusField.value !== 'DeActive';
    }

    // ✅ Save validation
    saveBtn?.addEventListener('click', function () {

        // Trim inputs
        form.querySelectorAll('input, textarea').forEach(el => {
            if (el.type === 'text' || el.type === 'email' || el.tagName === 'TEXTAREA') {
                el.value = el.value.trim();
            }
        });

        if (!form.checkValidity()) {
            if (!form.classList.contains('was-validated')) {
                form.classList.add('was-validated');
            }
            return;
        }

        console.log('Form is valid - proceed save');
    });

    // ✅ Status change logic
    statusField?.addEventListener('change', function () {
        deActiveDate.disabled = this.value !== 'DeActive';

        if (this.value !== 'DeActive') {
            deActiveDate.value = '';
        }
    });

    // ✅ Helper for table
    window.clearEmptyRow = function () {
        const tbody = document.getElementById('fuelSurchargeTableBody');

        if (tbody &&
            tbody.children.length === 1 &&
            tbody.firstElementChild?.querySelector('td')?.textContent.includes('No data')) {
            tbody.innerHTML = '';
        }
    };

});