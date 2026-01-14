let FEATURES = {};
// declare once (global)

document.addEventListener('DOMContentLoaded', async () => {

    if (!selectedCompanyID) {
        console.warn("⚠️ No CompanyID found in localStorage");
        return;
    }

    await loadPlans(); // Load plans

    await loadSubscriptions(selectedCompanyID);
    await loadFeatureFlags(selectedCompanyID);
    applyFeatureLocks();

    if (selectedCompanyID) await checkSubscription(selectedCompanyID);  // Check for existing subscription
});

async function loadPlans() {
    try {
        const { data, error } = await supabaseClient
            .from('subscriptionplans')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error(error);
            return;
        }

        planId.innerHTML =
            `<option value="">Select Plan</option>` +
            data.map(p => `
                <option value="${p.id}" data-months="${p.duration_months}">
                    ${p.plan_name} - ₹${p.price}
                </option>
            `).join('');
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

function calculateEndDate() {
    const opt = planId.selectedOptions[0];
    if (!opt || !subStartDate.value) return;

    const months = parseInt(opt.dataset.months);
    if (!months) return;

    const d = new Date(subStartDate.value);
    d.setMonth(d.getMonth() + months);
    subEndDate.value = d.toISOString().split('T')[0];
}

planId.addEventListener('change', calculateEndDate);
subStartDate.addEventListener('change', calculateEndDate);
saveSubscription.addEventListener('click', async () => {

    if (!planId.value || !subStartDate.value || !subEndDate.value) {
        alert('Please fill all required fields');
        return;
    }

    // Expire existing active subscription
    await supabaseClient
        .from('companysubscriptions')
        .update({ status: 'Expired' })
        .eq('company_id', companyCode.value)
        .eq('status', 'Active');

    const payload = {
        company_id: companyCode.value,
        plan_id: planId.value,
        start_date: subStartDate.value,
        end_date: subEndDate.value,
        amount_paid: amountPaid.value || 0,
        payment_status: paymentStatus.value,
        status: 'Active',
        created_by: UserLoginID
    };

    const { error } = await supabaseClient
        .from('companysubscriptions')
        .insert([payload]);

    if (error) {
        alert(error.message);
        return;
    }

    alert('Subscription saved');
    await loadSubscriptions(selectedCompanyID);
    await loadFeatureFlags(selectedCompanyID);
    applyFeatureLocks();
});


async function loadSubscriptions(selectedCompanyID) {

    const { data, error } = await supabaseClient
        .from('companysubscriptions')
        .select(`
            start_date,
            end_date,
            amount_paid,
            status,
            subscriptionplans(plan_name)
        `)
        .eq('company_id', selectedCompanyID)
        .order('start_date', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    subscriptionTable.innerHTML = data.map(s => `
        <tr>
            <td>${s.subscriptionplans?.plan_name || '-'}</td>
            <td>${s.start_date}</td>
            <td>${s.end_date}</td>
            <td>₹${s.amount_paid}</td>
            <td>${s.status}</td>
        </tr>
    `).join('');
}

async function getCompanyFeatures(selectedCompanyID) {

    const { data, error } = await supabaseClient
        .from('companysubscriptions')
        .select(`
            subscriptionplans (
                subscriptionplanfeatures (
                    feature_code,
                    allowed_value,
                    is_enabled
                )
            )
        `)
        .eq('company_id', selectedCompanyID)
        .eq('status', 'Active')
        .limit(1)
        .single();   // 👈 IMPORTANT

    if (error || !data?.subscriptionplans?.subscriptionplanfeatures) {
        console.warn('No active subscription or features found');
        return {};
    }

    const map = {};

    data.subscriptionplans.subscriptionplanfeatures.forEach(f => {
        map[f.feature_code] = {
            is_enabled: f.is_enabled,
            allowed_value: f.allowed_value
        };
    });

    return map;
}

async function loadFeatureFlags(selectedCompanyID) {
    FEATURES = await getCompanyFeatures(selectedCompanyID);
}

function applyFeatureLocks() {

    // Reports
    if (!FEATURES.REPORTS?.is_enabled) {
        document.getElementById('reportButton')
            ?.setAttribute('disabled', true);
    }

    // // Admin User
    // if (!FEATURES.ADMIN_USER?.is_enabled) {
    //     document.getElementById('adminUserSetting-tab')
    //         ?.classList.add('disabled', false);
    // }
}

function requireFeature(featureCode) {
    if (!FEATURES[featureCode]?.is_enabled) {
        alert('Upgrade your plan to access this feature');
        window.location.href = '/upgrade.html';
    }
}

async function canCreateBranch(selectedCompanyID) {
    const features = await getCompanyFeatures(selectedCompanyID);

    if (!features.BRANCH_LIMIT?.is_enabled) return false;

    const { count } = await supabaseClient
        .from('CompanyBranches')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompanyID);

    return count < features.BRANCH_LIMIT.allowed_value;
}

async function saveBranch(branchData) {

    const allowed = await canCreateBranch(branchData.company_id);
    if (!allowed) {
        alert('Branch limit exceeded. Upgrade plan.');
        return;
    }

    await supabaseClient
        .from('CompanyBranches')
        .insert([branchData]);
}

async function checkSubscription(selectedCompanyID) {
    const { data } = await supabaseClient
        .from('companysubscriptions')
        .select('id')
        .eq('company_id', selectedCompanyID)
        .eq('status', 'Active')
        .limit(1);

    if (!data.length) {
        document.querySelectorAll('button,input,select')
            .forEach(e => e.disabled = true);
        alert('Subscription expired');
    }
}