// settings.js  ⚡️
/* ------------------------------------------------
   Assumes: supabaseClient, companyID, userLoginID,
            localtimeStamp are globally available
--------------------------------------------------*/

document.addEventListener('DOMContentLoaded', initSettings);

async function initSettings() {
    try {

        const settings = await loadSettings();
        applySettings(settings);
    } catch (err) {
        handleError('Failed to load settings', err);
    }

    const saveBtn = document.getElementById('saveSettingsBtn');

    const inputs = document.querySelectorAll('#SettingParameters input[id]');
    const canEdit = [1, 2].includes(userType);          // ← 🔑 permission check

    if (!canEdit) {                                      // lock the UI
        inputs.forEach(i => (i.disabled = true));
        saveBtn.disabled = true;
        return;                                          // nothing else to wire-up
    }

    // editable → wire the save handler
    saveBtn.addEventListener('click', () => saveSettings(saveBtn));
}

/**
 * Read all SettingParameters records for this company.
 * @returns {Promise<Array<{InputFieldID, FieldValue, InputFieldType, id?}>>}
 */
async function loadSettings() {
    const { data, error } = await supabaseClient
        .from('SettingParameters')
        .select('id, InputFieldID, FieldValue, InputFieldType')
        .eq('company_id', companyID);

    if (error) throw error;
    return data;
}

/**
 * Write only changed / new values back to the DB.
 * @param {HTMLButtonElement} saveBtn — button that triggered the save.
 */
async function saveSettings(saveBtn) {
    toggleSpinner(saveBtn, true);

    try {
        const existingRows = await loadSettings(); // ← already small for one company
        // O(1) lookup table on InputFieldID ➜ row
        const byId = Object.fromEntries(
            existingRows.map(r => [r.InputFieldID, r])
        );

        const rowsToUpsert = Array
            .from(document.querySelectorAll('#SettingParameters input[id]'))
            .reduce((acc, input) => {
                const id = input.id.trim();
                const value = input.value.trim();
                const type = (input.type === 'number') ? 'number' : 'text';

                const prev = byId[id];
                const changed = !prev || String(prev.FieldValue) !== value;

                if (changed) {
                    acc.push({
                        /* id present only for update paths */
                        ...(prev && { id: prev.id }),
                        InputFieldID: id,
                        FieldValue: value,
                        InputFieldType: type,
                        company_id: companyID,
                        /* audit columns */
                        ...(prev
                            ? { updated_at: localtimeStamp, updated_by: userLoginID }
                            : { created_at: localtimeStamp, created_by: userLoginID }
                        )
                    });
                }
                return acc;
            }, []);

        if (rowsToUpsert.length) {
            const { error: upsertError } = await supabaseClient
                .from('SettingParameters')
                .upsert(rowsToUpsert, { onConflict: ['InputFieldID', 'company_id'] });

            if (upsertError) throw upsertError;
            toast('✅ Settings saved');
        } else {
            toast('ℹ️ Nothing was changed');
        }
    } catch (err) {
        handleError('Save failed', err);
        toast('❌ Could not save settings');
    } finally {
        toggleSpinner(saveBtn, false);
    }
}

/* ---------- helpers ---------- */

/** Sets form <input>s from DB data. */
function applySettings(rows) {
    rows.forEach(({ InputFieldID, FieldValue, InputFieldType }) => {
        const el = document.getElementById(InputFieldID);
        if (!el) return;

        el.value = (InputFieldType === 'number')
            ? parseFloat(FieldValue)
            : FieldValue;
    });
}

/** Simple console wrapper – extend with Sentry / LogRocket etc. */
function handleError(label, err) {
    console.error(`${label}:`, err?.message ?? err);
}

/** Starts / stops a tiny in-button spinner and disables click. */
function toggleSpinner(btn, busy = true) {
    btn.disabled = busy;
    btn.querySelector('.spinner')?.classList.toggle('d-none', !busy);
}

/** Replace with your preferred toast/snackbar component. */
function toast(msg) {
    console.info(msg);              // dev fallback
    // e.g. window.Toastify?.({ text: msg, duration: 3000 }).showToast();
}
