document.addEventListener("DOMContentLoaded", () => {
  // Redirect to login if not logged in
  const userLoginID = localStorage.getItem('UserLoginID');
  if (!userLoginID) {
    location.replace('/index.html');
    return;
  }

  // Helper: create dropdown section
  const menuSection = (title, items) => `
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">${title}</a>
        <ul class="dropdown-menu">
            ${items.map(item =>
    item === 'divider'
      ? '<li><hr class="dropdown-divider" /></li>'
      : `<li><a class="dropdown-item menu-item" href="${item.href}" data-form-id="${generateFormID(item)}">${item.label}</a></li>`
  ).join('')}
        </ul>
    </li>`;

  // ✅ Generate FormID
  const generateFormID = (item) => {
    if (item.href.includes("PaymentDetails.html")) {
      const url = new URL(item.href, window.location.origin);
      const type = url.searchParams.get("type") || "";
      return `PaymentDetails${type}`; // Example: PaymentDetailsCredit
    }
    return item.href
      .replace("/pages/master/", "")
      .replace("/pages/Accounting/", "")
      .replace("/pages/Functions/", "")
      .replace("/pages/Reports/", "")
      .replace("/pages/Tools/", "")
      .replace("/reports/", "")
      .replace(".html", "")
      .replace(/[^a-zA-Z0-9]/g, "");
  };

  // ✅ Navbar HTML
  const header = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="/pages/Tools/home.html">
                <img src="../../assets/img/applogo.png" alt="Logo" width="40" class="me-2" />
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
    { label: "Company", href: "/pages/master/companyProfile.html" },
    { label: "Party Registration", href: "/pages/master/PartyRegistration.html" },
    'divider',
    { label: "Employee", href: "/pages/master/EmployeeMaster.html" },
    { label: "User Rules", href: "/pages/master/UserAccessRules.html" }
  ])}

                    ${menuSection("Functions", [
    { label: "Enquiry", href: "/pages/Functions/Enquiry.html" },
    { label: "Quotation", href: "/pages/Functions/Quotation.html" },
    'divider',
    { label: "International Booking", href: "/pages/Functions/InternationalBooking.html" },
    { label: "Domestic", href: "/pages/Functions/DomesticBooking.html" },
    { label: "Customs Clearance", href: "/pages/Functions/CustomsClearance.html" },
    { label: "FTL or FCL", href: "/pages/Functions/fulltruckload.html" },
    'divider',
    { label: "Upload Data", href: "#" }
  ])}

                    ${menuSection("Accounting", [
    { label: "Customer Invoicing", href: "/pages/Accounting/CustomerInvoice.html" },
    { label: "Vendor Billing", href: "/pages/Accounting/VendorBilling.html" },
    'divider',
    { label: "Payment Credit", href: "/pages/Accounting/PaymentDetails.html?type=Credit" },
    { label: "Payment Debit", href: "/pages/Accounting/PaymentDetails.html?type=Debit" },
    'divider',
    { label: "Tax Details", href: "/pages/Accounting/TaxDetails.html" }
  ])}

                    ${menuSection("Reports", [
    { label: "International Report", href: "/pages/Reports/reportInternationalShipmentDetails.html" },
    { label: "Domestic Report", href: "/pages/Reports/reportDomesticDetails.html" },
    { label: "Customs Clearance Report", href: "/pages/Reports/reportCustomsClearance.html" },
    { label: "FTL or FCL Report", href: "/pages/Reports/reportFulltruckDetails.html" },
    'divider',
    { label: "Customer Invoice Report", href: "/pages/Reports/reportCustomerInvoiceDetails.html" },
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
    { label: "Settings", href: "/pages/Tools/setting.html" },
    { label: "Error Log", href: "#" },
    { label: "Docket Master", href: "#" },
    { label: "Reset Database", href: "#" },
    { label: "Route Master", href: "/pages/Tools/routemaster.html" },
    { label: "Application Settings", href: "/pages/Tools/ApplicationSettings.html" },
    { label: "Pincode Master", href: "/pages/Tools/PincodeMaster.html" }
  ])}
                </ul>

                <div class="d-flex align-items-center">
                    <span class="text-white me-3">User ID: <span id="userLoginID">UserLoginID</span></span>
                    <button class="btn btn-outline-light logout-btn">Logout</button>
                </div>
            </div>
        </div>
    </nav>`;

  document.body.insertAdjacentHTML("afterbegin", header);

  // Show logged-in user ID
  const userLoginIDSpan = document.getElementById("userLoginID");
  if (userLoginIDSpan) {
    userLoginIDSpan.textContent = userLoginID;
  }

  // Logout functionality
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      location.replace("/index.html");
    });
  }

  // ✅ Permission check on menu clicks
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", async e => {
      e.preventDefault();
      const formID = item.getAttribute("data-form-id");
      const href = item.getAttribute("href");

      if (!formID || !href) {
        alert("Missing form data.");
        return;
      }

      const accessGranted = await checkAccess(userLoginID, formID);
      if (accessGranted) {
        window.location.href = href;
      }
    });
  });
});

// ✅ Check permission from Supabase
async function checkAccess(userLoginID, formID) {
  // console.log("Checking access for:", userLoginID, formID);
  try {
    const { data, error } = await supabaseClient
      .from("UserAccessRules")
      .select("CanRead, CanWrite, CanDelete, CanUpdate")
      .eq("UserLoginID", userLoginID)
      .eq("FormID", formID)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      alert("Error checking permissions. Please try again.");
      return false;
    }
    // console.log("Permission data retrieved:", data);

    if (!data) {
      alert("Permission denied. Kindly contact your administrator.");
      return false;
    }

    // Assign permissions
    perRead = data.CanRead ?? false;
    perWrite = data.CanWrite ?? false;
    perDelete = data.CanDelete ?? false;
    perUpdate = data.CanUpdate ?? false;

    return !!perRead;
  } catch (err) {
    console.error("Unexpected error:", err);
    alert("An unexpected error occurred while checking permissions.");
    return false;
  }
}
