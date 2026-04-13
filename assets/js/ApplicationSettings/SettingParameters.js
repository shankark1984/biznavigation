// settings.js ⚡️
// ------------------------------------------------
// Assumes: supabaseClient, CompanyID, UserLoginID,
//          UserType, localtimeStamp are globally available
// ------------------------------------------------

document.addEventListener('DOMContentLoaded', initSettings);

// 🔁 cache to avoid multiple DB calls
let cachedSettings = [];

/* ---------------- INIT ---------------- */

async function initSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    const inputs = document.querySelectorAll('#SettingParameters input[id]');
    const canEdit = [1, 2].includes(Number(UserType));

    try {
        cachedSettings = await loadSettings();
        applySettings(cachedSettings);
    } catch (err) {
        handleError('Failed to load settings', err);
        toast('❌ Failed to load settings');
    }

    // 🔒 Lock UI if no permission
    if (!canEdit) {
        inputs.forEach(i => (i.disabled = true));
        saveBtn.disabled = true;
        return;
    }

    // 💾 Save handler
    saveBtn.addEventListener('click', () => saveSettings(saveBtn));
}

/* ---------------- LOAD ---------------- */

async function loadSettings() {
    const { data, error } = await supabaseClient
        .from('SettingParameters')
        .select('id, InputFieldID, FieldValue, InputFieldType')
        .eq('company_id', CompanyID);

    if (error) throw error;
    return data || [];
}

/* ---------------- SAVE ---------------- */

async function saveSettings(saveBtn) {
    toggleSpinner(saveBtn, true);

    try {
        const byId = Object.fromEntries(
            cachedSettings.map(r => [r.InputFieldID, r])
        );

        const rowsToUpsert = Array
            .from(document.querySelectorAll('#SettingParameters input[id]'))
            .reduce((acc, input) => {

                const id = input.id.trim();
                if (!id) return acc;

                // 🧠 Handle different input types
                let value;
                let type = input.type;

                if (type === 'checkbox') {
                    value = input.checked ? 'true' : 'false';
                    type = 'boolean';
                } else {
                    value = input.value.trim();
                    type = (type === 'number') ? 'number' : 'text';
                }

                // 🚫 Skip empty values (optional — remove if needed)
                if (value === '') return acc;

                const prev = byId[id];

                // 🔍 Normalize for accurate comparison
                const normalize = v => (v ?? '').toString().trim();
                const changed = !prev || normalize(prev.FieldValue) !== normalize(value);

                if (changed) {
                    acc.push({
                        ...(prev && { id: prev.id }),
                        InputFieldID: id,
                        FieldValue: value,
                        InputFieldType: type,
                        company_id: CompanyID,

                        ...(prev
                            ? { updated_at: localtimeStamp, updated_by: UserLoginID }
                            : { created_at: localtimeStamp, created_by: UserLoginID }
                        )
                    });
                }

                return acc;
            }, []);

        if (rowsToUpsert.length) {
            const { error: upsertError } = await supabaseClient
                .from('SettingParameters')
                .upsert(rowsToUpsert, {
                    onConflict: ['InputFieldID', 'company_id']
                });

            if (upsertError) throw upsertError;

            // 🔁 Update cache locally (no extra DB call)
            rowsToUpsert.forEach(r => {
                const index = cachedSettings.findIndex(x => x.InputFieldID === r.InputFieldID);
                if (index > -1) {
                    cachedSettings[index] = { ...cachedSettings[index], ...r };
                } else {
                    cachedSettings.push(r);
                }
            });

            toast('✅ Settings saved');
        } else {
            toast('ℹ️ Nothing changed');
        }

    } catch (err) {
        handleError('Save failed', err);
        toast(`❌ Save failed: ${err.message}`);
    } finally {
        toggleSpinner(saveBtn, false);
    }
}

/* ---------------- APPLY ---------------- */

function applySettings(rows) {
    rows.forEach(({ InputFieldID, FieldValue, InputFieldType }) => {
        const el = document.getElementById(InputFieldID);
        if (!el) return;

        if (InputFieldType === 'number') {
            el.value = (FieldValue !== null && FieldValue !== '')
                ? parseFloat(FieldValue)
                : '';
        } else if (InputFieldType === 'boolean') {
            el.checked = FieldValue === 'true';
        } else {
            el.value = FieldValue ?? '';
        }
    });
}

/* ---------------- HELPERS ---------------- */

function handleError(label, err) {
    console.error(`${label}:`, err?.message ?? err);
}

function toggleSpinner(btn, busy = true) {
    btn.disabled = busy;
    btn.querySelector('.spinner')?.classList.toggle('d-none', !busy);
}

function toast(msg) {
    console.info(msg);
    // Example:
    // window.Toastify?.({ text: msg, duration: 3000 }).showToast();
}