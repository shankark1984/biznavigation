let selectedCompanyID = null;
let COMPANY_MAP = {};   // company_name → full record

// 🌐 Company Registration Initialization
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initCompanyRegistration();
        await loadCompaniesDropdown();
    } catch (err) {
        console.error("Initialization error:", err);
        alert("Error initializing the page.");
    }
});
document.getElementById('resetPasswordBtn')?.addEventListener('click', resetUserPassword);

async function initCompanyRegistration() {
    const companyID = localStorage.getItem('CompanyID');
    const userLoginID = localStorage.getItem('UserLoginID');
    const userType = parseInt(localStorage.getItem('UserType'), 10) || 0;
    selectedCompanyID = companyID;
    // Initial UI setup
    setFormState(false);
    setButtonState(['branchAddDetails', 'bankAddDetails'], false);
    handleUserTypePermissions(userType);

    handleAdminUserTabVisibility(); // 👈 ADD THIS

    // Fetch company data if exists
    if (companyID) await fetchCompanyData(companyID);
    else console.warn("⚠️ No CompanyID found in localStorage");
    document.getElementById('compID').textContent = companyID || 'New Company';

    // Update logo
    updateCompanyLogo(companyID);
    toggleCompanySelect(userType);

    // Bind Events
    bindEvents(userType);
    saveButton.disabled = true;
}

/* ---------------------- 🔧 Utility Functions ---------------------- */
function setFormState(enabled) {
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = !enabled);
}

function setButtonState(buttonIDs, enabled) {
    buttonIDs.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });
}

/* ---------------------- 🏢 Company Data Handling ---------------------- */
async function fetchCompanyData(companyID) {

    // Keep the global variable in sync
    selectedCompanyID = companyID;

    try {

        const { data, error } = await supabaseClient
            .from("company_profile")
            .select("*")
            .eq("company_id", companyID)
            .single();

        if (error) throw error;

        if (data) {
            populateCompanyForm(data);
        }

    } catch (err) {
        console.error("Error fetching company:", err);
        alert("Failed to load company data.");
    }
}

function populateCompanyForm(data) {
    const fieldMap = {
        compID: data.company_id,
        compName: data.company_name,
        companyCode: data.company_id,
        shortCode: data.short_code,
        companyName: data.company_name,
        address: data.address,
        city: data.city,
        pinCode: data.pin_code,
        state: data.state,
        country: data.country,
        phoneNumber: data.phone_no,
        email: data.e_mail,
        gstNumber: data.gst_number,
        panNumber: data.pan_number,
        cinNo: data.cin_no,
        uaNo: data.Udyog_aadhaar_no,
        website: data.web_site,
        LogoUrl: data.LogoUrl,
        tempFormID: data.id
    };
    Object.entries(fieldMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        // console.log(`Setting ${id} to ${value}`);
        if (el) el.value = value || '';
    });
    showLogo(data.LogoUrl);
    const logo = document.getElementById('companylogo');
    if (logo) logo.src = data.logo_path || '../../assets/img/logo/default.png';
}

/* ---------------------- 👤 User Permission ---------------------- */
function handleUserTypePermissions(userType) {
    const modifyBtn = document.getElementById('modifyButton');
    const newBtn = document.getElementById('newButton');
    if (modifyBtn) modifyBtn.disabled = !(userType === 1 || userType === 2);
    if (newBtn) newBtn.disabled = userType !== 1;
}

function userRoleType() {
    const editable = parseInt(localStorage.getItem('UserType'), 10) === 1;
    enableEditFields(['shortCode', 'companyName', 'panNumber', 'gstNumber'], editable);
}

function enableEditFields(fields, editable) {
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !editable;
    });
}

/* ---------------------- 🧼 Form Management ---------------------- */
function clearForm() {
    document.querySelectorAll('input, textarea,select').forEach(el => el.value = '');
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    const logo = document.getElementById('companylogo');
    if (logo) logo.src = '../../assets/img/logo/default.png';
    const compID = document.getElementById('CompID');
    if (compID) compID.textContent = '';

}

/* ---------------------- 🎛️ Event Handlers ---------------------- */
function bindEvents(userType) {
    const modifyBtn = document.getElementById("modifyButton");
    const newBtn = document.getElementById("newButton");
    const saveBtn = document.getElementById("saveButton");

    modifyBtn?.addEventListener("click", onModifyClick);
    newBtn?.addEventListener("click", onNewClick);
    saveBtn?.addEventListener("click", onSaveClick);

    document.getElementById("website")?.addEventListener("blur", enforceURLProtocol);

    // Validation bindings
    const validators = [
        ['gstNumber', 'gstFeedback', 'company_profile', 'gst_number', validateGSTInput],
        ['panNumber', 'panFeedback', 'company_profile', 'pan_number', validatePANInput],
        ['branchGSTNo', 'branchGSTFeedback', 'CompanyBranchDetails', 'GSTNo', validateGSTInput],
        ['branchPANNo', 'branchPANFeedback', 'CompanyBranchDetails', 'PANNo', validatePANInput]
    ];
    validators.forEach(([input, feedback, table, column, validator]) => bindValidation(input, feedback, table, column, validator));

    if (typeof loadBranches === "function") loadBranches();
}

function onModifyClick() {
    setFormState(true);

    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
        saveBtn.dataset.mode = 'update';
    }

    const modifyBtn = document.getElementById('modifyButton');
    if (modifyBtn) modifyBtn.disabled = true;

    userRoleType(); // this might re-enable fields based on role

    // 🔹 Now disable GST and PAN after all enabling logic
    const gstNumber = document.getElementById('gstNumber');
    const panNumber = document.getElementById('panNumber');
    if (gstNumber) gstNumber.disabled = true;
    if (panNumber) panNumber.disabled = true;
    document.getElementById('selectCompany').disabled = true;

    setButtonState(['branchAddDetails', 'bankAddDetails'], true);
    document.getElementById("chooseLogoBtn").disabled = false;
    document.getElementById("saveLogoBtn").disabled = false;
    document.getElementById("companyLogo").disabled = false;
}


function onNewClick() {
    setFormState(true);
    clearForm();
    document.getElementById('modifyButton').disabled = true;

    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
        saveBtn.dataset.mode = 'insert';
    }
    setEmptyTableMessage('branchTableBody', 'No branches created');
    setEmptyTableMessage('branchBankTableBody', 'No bank created');
    setButtonState(['branchAddDetails', 'bankAddDetails'], false);
    document.getElementById("termsAndConditionsTable")
        .innerHTML = "";
    document.getElementById("subscriptionTable")
        .innerHTML = "";
    clearLogo();


}

/* ---------------------- 💾 Save / Update ---------------------- */
/* ---------------------- 💾 Save / Update ---------------------- */
async function onSaveClick(e) {
    e.preventDefault();

    const saveBtn = e.currentTarget;
    const isInsert = saveBtn.dataset.mode !== "update";

    try {

        const companyName = document.getElementById("companyName")?.value.trim() || "";
        const adminUserName = document.getElementById("userName")?.value.trim() || "";
        const adminUserId = document.getElementById("userLogID")?.value.trim() || "";

        if (!companyName) {
            alert("Please enter a company name.");
            return;
        }

        // Generate Company ID only for new company
        const companyID = isInsert
            ? await generateNewCompanyID(companyName)
            : selectedCompanyID;

        if (!companyID) {
            alert("Company ID not found.");
            return;
        }

        selectedCompanyID = companyID;

        if (isInsert) {
            document.getElementById("companyCode").value = companyID;
        }

        // Build form data
        const formData = gatherFormData(companyID, isInsert);

        let error;

        if (isInsert) {

            ({ error } = await supabaseClient
                .from("company_profile")
                .insert([formData]));

        } else {

            const tempID = Number(document.getElementById("tempFormID").value);

            ({ error } = await supabaseClient
                .from("company_profile")
                .update(formData)
                .eq("id", tempID));

        }

        if (error) throw error;

        // ---------------------------
        // Create Admin User
        // ---------------------------
        if (isInsert) {

            const adminData = {
                emp_code: companyID,
                user_name: adminUserName,
                user_login_id: adminUserId,
                user_password: sha256(reSetPass),
                user_type: 2,
                company_id: companyID,
                working_branch: companyID,
                created_by: UserLoginID,
                created_at: localtimeStamp
            };

            const { error: adminError } = await supabaseClient
                .from("user_login")
                .insert([adminData]);

            if (adminError) throw adminError;
        }

        // Save Terms & Conditions
        await saveCompanyTandCs();

        // Upload Logo
        await uploadCompanyLogo();

        alert(`Company ${isInsert ? "saved" : "updated"} successfully!`);

        saveBtn.innerHTML = '<i class="bi bi-pencil-square"></i> Update';
        saveBtn.dataset.mode = "update";
        saveBtn.disabled = true;

        document.getElementById("modifyButton").disabled = false;

        setFormState(false);
        setButtonState(["branchAddDetails", "bankAddDetails"], false);

        document.getElementById("chooseLogoBtn").disabled = true;
        document.getElementById("saveLogoBtn").disabled = true;
        document.getElementById("companyLogo").disabled = true;

        await loadCompaniesDropdown();

    } catch (err) {

        console.error("Error saving company:", err);

        if (err.code === "23505") {

            if (err.message.includes("company_profile_company_id_key")) {
                alert("Company ID already exists.");
            } else if (err.message.includes("company_profile_gst_number_key")) {
                alert("GST Number already exists.");
            } else if (err.message.includes("company_profile_pan_number_key")) {
                alert("PAN Number already exists.");
            } else {
                alert(err.message);
            }

        } else {
            alert(err.message || "Unexpected error occurred. Please try again.");
        }
    }
}
/* ---------------------- 🧩 Form Data Builder ---------------------- */
function gatherFormData(companyID, isInsert) {

    const getVal = id => document.getElementById(id)?.value.trim() || "";

    const data = {

        short_code: getVal("shortCode").toUpperCase(),
        company_name: getVal("companyName"),
        address: formatAddress(getVal("address")),
        city: getVal("city"),
        pin_code: getVal("pinCode"),
        state: getVal("state"),
        country: getVal("country"),
        phone_no: getVal("phoneNumber"),
        e_mail: getVal("email"),
        gst_number: getVal("gstNumber").toUpperCase(),
        pan_number: getVal("panNumber").toUpperCase(),
        cin_no: getVal("cinNo").toUpperCase(),
        Udyog_aadhaar_no: getVal("uaNo").toUpperCase(),
        web_site: getVal("website"),
        logo_path: document.getElementById("companylogo")?.src || "",
        created_by: localStorage.getItem("UserLoginID") || "unknown"

    };

    if (isInsert) {
        data.company_id = companyID;
    }

    return data;
}

function formatAddress(address) {
    return address ? address.charAt(0).toUpperCase() + address.slice(1).toLowerCase() : '';
}

/* ---------------------- 🆔 Company ID Generation ---------------------- */
async function generateNewCompanyID(companyName) {
    const prefix = `C${companyName.charAt(0).toUpperCase()}`;
    try {
        const { data, error } = await supabaseClient.from('company_profile').select('company_id');
        if (error || !data?.length) return `${prefix}0001`;

        const maxNum = data
            .filter(r => r.company_id?.startsWith(prefix))
            .map(r => parseInt(r.company_id.slice(2), 10) || 0)
            .reduce((max, n) => Math.max(max, n), 0);

        return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
    } catch {
        return `${prefix}0001`;
    }
}

/* ---------------------- 🌐 Misc Utilities ---------------------- */
function enforceURLProtocol() {
    if (!this.value.trim()) return;
    if (!/^https?:\/\//i.test(this.value.trim())) {
        this.value = 'https://' + this.value.trim();
    }
}

function bindValidation(inputID, feedbackID, table, column, validator) {
    const input = document.getElementById(inputID);
    if (input) input.addEventListener('blur', () => validator(inputID, feedbackID, table, column));
}

/* ---------------------- 🖼️ Logo Update ---------------------- */
function updateCompanyLogo(companyID) {
    const logo = document.getElementById('companylogo');
    if (!logo) return;
    const fallback = '../../assets/img/logo/default.png';
    const path = `../../assets/img/logo/${companyID}.png`;
    logo.onerror = () => { logo.src = fallback; logo.alt = 'Default Logo'; };
    logo.onload = () => { logo.alt = `Logo for ${companyID}`; };
    logo.src = companyID ? path : fallback;
}

function handleAdminUserTabVisibility() {
    const userType = parseInt(localStorage.getItem('UserType'), 10);
    const adminTab = document.getElementById('adminUserSetting');
    const adminTabBtn = document.getElementById('adminUserSetting-tab');

    if (!adminTab) return;

    if (userType === 1) {
        // Super Admin → show
        adminTab.classList.remove('d-none');
        adminTabBtn?.classList.remove('d-none');
    } else {
        // Others → hide
        adminTab.classList.add('d-none');
        adminTabBtn?.classList.add('d-none');
    }
}

async function resetUserPassword() {
    try {

        const userLogID = document.getElementById('userLogID').value;
        const compID = document.getElementById('companyCode').value;

        if (!userLogID) {
            showToast("Login ID cannot be empty");
            return;
        }
        if (!compID) {
            showToast("Company ID cannot be empty");
            return;
        }

        const tempPassword = sha256(reSetPass); // Default password

        const { error } = await supabaseClient
            .from('user_login')
            .update({
                user_password: tempPassword
            })
            .eq('company_id', compID)
            .eq('user_login_id', userLogID);
        if (error) throw error;

        showToast("Password reset successfully to default, password is: " + reSetPass);
    } catch (err) {
        console.error("Failed to reset user password:", err);
        showToast(err.message || "Error resetting user password");
    }
}

async function getAdminUser(companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('user_login')
            .select('*')
            .eq('company_id', companyID)
            .eq('user_type', 2)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // ✅ Admin exists
            const userName = data.user_name || '';
            const userLoginID = data.user_login_id || '';
            // console.log("Populating admin user fields:", { userName, userLoginID });

            document.getElementById('userName').value = userName;
            document.getElementById('userLogID').value = userLoginID;

            return data;
        } else {
            // ✅ No admin yet → clear fields
            document.getElementById('userName').value = '';
            document.getElementById('userLogID').value = '';
            // console.warn("No admin user found for company:", companyID);
            return null;
        }

    } catch (err) {
        console.error("Failed to fetch admin user:", err);
        // Clear fields in case of error
        document.getElementById('userName').value = '';
        document.getElementById('userLogID').value = '';
        return null;
    }
}

document.getElementById('adminUserSetting-tab')?.addEventListener(
    'shown.bs.tab',
    () => {
        const companyCode = document.getElementById('companyCode').value;
        if (companyCode) getAdminUser(companyCode);

    }
);
branchStatus.addEventListener("change", e => {
    branchInactiveDate.disabled = e.target.value !== "Inactive";
});

async function loadCompaniesDropdown() {
    const { data, error } = await supabaseClient
        .from("company_profile")
        .select("company_id, company_name");

    if (error) return console.error(error);

    const select = document.getElementById("selectCompany");

    data.forEach(c => {
        const opt = new Option(c.company_name, c.company_id);
        select.add(opt);
    });

    // Activate searchable dropdown
    // $("#selectCompany").select2({
    //     placeholder: "Select company",
    //     width: "100%"
    // });
}

// Get selected companyId
$("#selectCompany").on("change", async function () {

    selectedCompanyID = this.value;

    if (!selectedCompanyID) return;

    saveButton.disabled = true;

    if (typeof disableForm === "function") {
        disableForm();
    }

    await fetchCompanyData(selectedCompanyID);
    await loadSubscriptions(selectedCompanyID);

    if (typeof loadBranches === "function") {
        await loadBranches();
    }

    await loadCompanyTandCs(selectedCompanyID);

    document.getElementById("modifyButton").disabled = false;

});

function toggleCompanySelect(userType) {
    const wrapper = document.getElementById("companySelectWrapper");

    if (Number(userType) === 1) {
        wrapper.style.display = "block";
    } else {
        wrapper.style.display = "none";
        document.getElementById("selectCompany").value = "";
    }
}

