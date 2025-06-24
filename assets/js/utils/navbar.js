document.addEventListener("DOMContentLoaded", () => {
  // Redirect to login if not logged in and clear history
  const userLoginID = localStorage.getItem('UserLoginID');
  if (!userLoginID) {
    location.replace('index.html'); // Clears history and redirects
    return;
  }

  const menuSection = (title, items) => `
  <li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">${title}</a>
    <ul class="dropdown-menu">
      ${items.map(item =>
    item === 'divider'
      ? '<li><hr class="dropdown-divider" /></li>'
      : `<li><a class="dropdown-item menu-item" href="pages/${item.href}" data-form-id="${item.href.replace('.html', '').replace(/[^a-zA-Z0-9]/g, '')}">${item.label}</a></li>`
  ).join('')}
    </ul>
  </li>`;

  const header = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="pages/home.html">
                <img src="assets/img/applogo.png" alt="Logo" width="40" class="me-2" />
                <div>
                    <h2 class="mb-0 fs-6">BizNavigation</h2>
                    <span class="d-block text-center" style="font-size: 0.6rem;">TAKE YOUR BUSINESS TO THE NEXT LEVEL</span>
                </div>
            </a>

            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto">
                    ${menuSection("Master", [
    { label: "Company", href: "companyProfile.html" },
    { label: "Party Registration", href: "PartyRegistration.html" },
    'divider',
    { label: "Employee", href: "#" },
    { label: "User Rules", href: "UserAccessRules.html" }
  ])}

                    ${menuSection("Functions", [
    { label: "Enquiry", href: "#" },
    { label: "Quotation", href: "#" },
    'divider',
    { label: "International Booking", href: "InternationalBooking.html" },
    { label: "Domestic", href: "#" },
    { label: "Customs Clearance", href: "#" },
    { label: "FTL or FCL", href: "fulltruckload.html" },
    'divider',
    { label: "Upload Data", href: "#" }
  ])}

                    ${menuSection("Accounting", [
    { label: "Customer Invoicing", href: "invoice_form.html" },
    { label: "Vendor Billing", href: "#" },
    'divider',
    { label: "Payment Credit", href: "#" },
    { label: "Payment Debit", href: "#" },
    'divider',
    { label: "Tax Details", href: "#" }
  ])}

                    ${menuSection("Reports", [
    { label: "International Report", href: "#" },
    { label: "Domestic Report", href: "#" },
    { label: "Customs Clearance Report", href: "#" },
    { label: "FTL or FCL Report", href: "fulltruck_Report.html" },
    'divider',
    { label: "Customer Invoice Report", href: "#" },
    { label: "Vendor Billing Report", href: "#" },
    'divider',
    { label: "Payment Received", href: "#" },
    { label: "Payment Receivable", href: "#" },
    { label: "Payment Paid", href: "#" },
    { label: "Payment Payable", href: "#" },
    'divider',
    { label: "Accounting Ledger", href: "#" }
  ])}

                    ${menuSection("Tools", [
    { label: "Settings", href: "setting.html" },
    { label: "Error Log", href: "#" },
    { label: "Docket Master", href: "#" },
    { label: "Reset Database", href: "#" },
    { label: "Route Master", href: "routemaster.html" },
    { label: "Application Settings", href: "ApplicationSettings.html" }
  ])}
                </ul>

                <div class="d-flex align-items-center">
                    <span class="text-white me-3">User ID: <span id="userLoginID">UserLoginID</span></span>
                    <button class="btn btn-outline-light logout-btn">Logout</button>
                </div>
            </div>
        </div>
    </nav>`;

  document.body.insertAdjacentHTML('afterbegin', header);

  // Show logged-in user ID
  const userLoginIDSpan = document.getElementById('userLoginID');
  if (userLoginIDSpan) {
    userLoginIDSpan.textContent = userLoginID;
  }

  // Logout functionality
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      location.replace('index.html'); // Also clears history on logout
    });
  }

  // Permission check on menu clicks
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', async e => {
      e.preventDefault();
      const formID = item.getAttribute('data-form-id');
      const href = item.getAttribute('href');

      if (!formID || !href) {
        alert('Missing form data.');
        return;
      }

      const accessGranted = await checkAccess(userLoginID, formID);
      if (accessGranted) {
        window.location.href = href;
      }
    });
  });
});

async function checkAccess(userLoginID, formID) {
  try {
    const { data, error } = await supabaseClient
      .from('UserAccessRules')
      .select('CanRead, CanWrite, CanDelete, CanUpdate')
      .eq('UserLoginID', userLoginID)
      .eq('FormID', formID)
      .maybeSingle();  // Allows zero rows without error

    if (error) {
      console.error('Database error:', error);
      alert('Error checking permissions. Please try again.');
      return false;
    }

    if (!data) {
      alert('Permission denied. Kindly contact your administrator.');
      return false;
    }

    // Assign to global permission variables
    perRead = data.CanRead ?? false;
    perWrite = data.CanWrite ?? false;
    perDelete = data.CanDelete ?? false;
    perUpdate = data.CanUpdate ?? false;

    return !!perRead; // true if Read permission is granted
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('An unexpected error occurred while checking permissions.');
    return false;
  }
}
