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
                company_name, address, city, pin_code, state, country,
                phone_no, e_mail, gst_number, pan_number, cin_no, Udyog_aadhaar_no
            `)
            .eq('company_id', companyID)
            .single();

        if (error) {
            console.error('Error fetching company details:', error.message);
            return null;
        }

        return data;
    }

    static renderCompanyDetails(company, detailsSelector = '.company-details', nameSelector = '.company-name') {
        if (!company) {
            console.error('No company data provided for rendering.');
            return;
        }

        const detailsElement = document.querySelector(detailsSelector);
        const nameElement = document.querySelector(nameSelector);

        if (!detailsElement || !nameElement) {
            console.error(`Target elements not found: ${detailsSelector}, ${nameSelector}`);
            return;
        }

        // Render Company Name
        nameElement.innerHTML = company.company_name
            ? `<h2 class="mb-1">${company.company_name}</h2>`
            : '';

        const lines = [];

        // Address Line 1
        const addressLine1 = company.address ? toProperCase(company.address) : '';

        // Address Line 2
        const addressLine2Parts = [
            company.city,
            company.state,
            company.pin_code ? `- ${company.pin_code}` : null,
            company.country
        ].filter(Boolean).join(' ');

        if (addressLine1) lines.push(`${addressLine1}<br>`);
        if (addressLine2Parts) lines.push(`${addressLine2Parts} | `);

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

        // Final render
        detailsElement.innerHTML = lines.join('').trim();
    }

    static async loadCompanyDetails(detailsSelector = '.company-details', nameSelector = '.company-name') {
        if (!window.CompanyID) {
            alert('Session expired. Please login again.');
            return;
        }

        const company = await this.fetchCompanyDetails(window.CompanyID);
        if (company) {
            this.renderCompanyDetails(company, detailsSelector, nameSelector);
        }
    }
}

function loadCompanyLogo() {
    const logoContainer = document.getElementById('logoContainer');
    const companyID = window.CompanyID;
    const logoPath = `assets/img/logo/${companyID}.png`;

    const img = new Image();
    img.src = logoPath;
    img.alt = "Company Logo";
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';

    img.onload = () => {
        logoContainer.innerHTML = '';
        logoContainer.appendChild(img);
    };

    img.onerror = () => {
        logoContainer.innerHTML = 'LOGO';
    };
}


