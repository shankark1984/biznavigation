// ============================================
// LOGO PREVIEW
// ============================================

const logoInput = document.getElementById('companyLogo');

if (logoInput) {

    logoInput.addEventListener('change', function (event) {

        const file = event.target.files[0];

        if (!file) return;

        document.getElementById('selectedLogoName').textContent =
            file.name;

        const reader = new FileReader();

        reader.onload = function (e) {

            document.getElementById('logoPreview').src =
                e.target.result;

            document.getElementById('logoPreview')
                .classList.remove('d-none');

            document.getElementById('logoPlaceholder')
                .classList.add('d-none');
        };

        reader.readAsDataURL(file);
    });

}

// ============================================
// SAVE LOGO
// ============================================

document.getElementById('saveLogoBtn')
    .addEventListener('click', async () => {

        const companyId =
            document.getElementById('companyCode').value;

        if (!companyId) {
            alert('Please select/save company first.');
            return;
        }

        await uploadCompanyLogo(companyId);
    });

// ============================================
// UPLOAD TO SUPABASE
// ============================================

async function uploadCompanyLogo() {
    const companyId = document.getElementById("companyCode").value;
    const fileInput =
        document.getElementById('companyLogo');

    const file = fileInput.files[0];

    if (!file) {
        // alert('Please choose a logo.');
        return;
    }

    const extension =
        file.name.split('.').pop();

    const fileName =
        `${companyId}.${extension}`;

    const { error: uploadError } =
        await supabaseClient.storage
            .from('company-logos')
            .upload(fileName, file, {
                upsert: true
            });

    if (uploadError) {
        console.error(uploadError);
        alert(uploadError.message);
        return;
    }

    const { data: publicData } =
        supabaseClient.storage
            .from('company-logos')
            .getPublicUrl(fileName);

    const logoUrl =
        publicData.publicUrl;

    const { error: dbError } =
        await supabaseClient
            .from('company_profile')
            .update({
                LogoUrl: logoUrl,
                logo_path: logoUrl
            })
            .eq('company_id', companyId);

    if (dbError) {
        console.error(dbError);
        alert(dbError.message);
        return;
    }

    // alert('Logo uploaded successfully.');
}

// ============================================
// LOAD EXISTING LOGO
// ============================================

function showLogo(url) {

    if (!url) return;

    document.getElementById('logoPreview').src = url;

    document.getElementById('logoPreview')
        .classList.remove('d-none');

    document.getElementById('logoPlaceholder')
        .classList.add('d-none');
}

function openLogoBrowser() {
    console.log('openLogoBrowser called');
    document.getElementById('companyLogo').click();
}

document.getElementById('logoPreview')
    .addEventListener('click', openLogoBrowser);



document.getElementById('chooseLogoBtn')
    .addEventListener('click', () => {

        const input = document.getElementById('companyLogo');

        input.disabled = false;

        if (input.showPicker) {
            input.showPicker();
        } else {
            input.click();
        }

    });

function clearLogo() {

    // Clear file input
    document.getElementById('companyLogo').value = '';

    // Clear preview image
    document.getElementById('logoPreview').src = '';

    // Hide preview
    document.getElementById('logoPreview')
        .classList.add('d-none');

    // Show placeholder
    document.getElementById('logoPlaceholder')
        .classList.remove('d-none');

    // Reset file name text
    document.getElementById('selectedLogoName').textContent =
        'No file selected';

    document.getElementById("chooseLogoBtn").disabled = false;
    document.getElementById("saveLogoBtn").disabled = false;
    document.getElementById("companyLogo").disabled = false;
}