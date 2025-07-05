// assets/js/utils/companyService.js

class CompanyService {
    static async fetchCompanyDetails(companyID) {
        if (!companyID) {
            console.error('Company ID is missing.');
            return null;
        }

        const { data, error } = await supabaseClient
            .from('company_profile')
            .select(`
                company_name, address, city, pin_code, state, country, phone_no, e_mail, gst_number, pan_number, cin_no, Udyog_aadhaar_no
            `)
            .eq('company_id', companyID)
            .single();

        if (error) {
            console.error('Error fetching company details:', error.message);
            return null;
        }

        return data;
    }

    static renderCompanyDetails(company, targetSelector) {
        if (!company) {
            console.error('No company data provided for rendering.');
            return;
        }

        const targetElement = document.querySelector(targetSelector);
        if (!targetElement) {
            console.error(`Target element "${targetSelector}" not found.`);
            return;
        }

        const lines = [];

        if (company.company_name) {
            lines.push(`<h1>${company.company_name}</h1>`);
        }

        // Address Line 1
        const addressLine1 = company.address ? toProperCase(company.address) : null;

        // Address Line 2
        const addressLine2Parts = [
            company.city,
            company.state,
            company.pin_code ? `- ${company.pin_code}` : null,
            company.country
        ].filter(Boolean).join(' ');

        if (addressLine1) {
            lines.push(`${addressLine1}<br>`);
        }

        if (addressLine2Parts.trim()) {
            lines.push(`${addressLine2Parts}<br>`);
        }

        // Contact Details
        const contactParts = [];
        if (company.phone_no) contactParts.push(`Phone: ${company.phone_no}`);
        if (company.e_mail) contactParts.push(`Email: ${company.e_mail}`);
        if (contactParts.length) lines.push(`${contactParts.join(' | ')}<br>`);

        // Tax Details
        const taxParts = [];
        if (company.pan_number) taxParts.push(`PAN No: ${company.pan_number}`);
        if (company.gst_number) taxParts.push(`GST No: ${company.gst_number}`);
        if (taxParts.length) lines.push(`${taxParts.join(' | ')}<br>`);

        // Registration Details
        const regParts = [];
        if (company.cin_no) regParts.push(`CIN No: ${company.cin_no}`);
        if (company.Udyog_aadhaar_no) regParts.push(`Udyog Aadhaar No: ${company.Udyog_aadhaar_no}`);
        if (regParts.length) lines.push(`${regParts.join(' | ')}<br>`);

        // Final Render
        targetElement.innerHTML = lines.join('').trim();
    }

    static async loadCompanyDetails(targetSelector) {
        if (!window.CompanyID) {
            alert('Session expired. Please login again.');
            return;
        }

        const company = await this.fetchCompanyDetails(window.CompanyID);
        if (company) {
            this.renderCompanyDetails(company, targetSelector);
        }
    }
}



function loadCompanyLogo() {
    const logoContainer = document.getElementById('logoContainer');
    const companyID = window.CompanyID;

    const logoPath = `assets/img/logo/${companyID}.png`;
    const img = new Image();
    img.src = logoPath;

    img.onload = () => {
        logoContainer.innerHTML = '';
        logoContainer.appendChild(img);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
    };

    img.onerror = () => {
        logoContainer.innerHTML = 'LOGO';
    };
}
