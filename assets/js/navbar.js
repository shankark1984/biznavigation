// navbar.js
document.addEventListener("DOMContentLoaded", function () {
    const header = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top" style="background-color:#333;">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="home.html">
                <img src="assets/img/applogo.png" alt="Logo" width="40" class="me-2" />
                <div>
                    <h2 class="mb-0" style="font-size: 1.2em;">BizNavigation</h2>
                    <span style="font-size: 0.4em; display: block; text-align: center;">TAKE YOUR BUSINESS TO THE NEXT
                        LEVEL</span>
                </div>
            </a>

            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto">
                    <!-- Master Menu -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Master</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="companyProfile.html">Company</a></li>
                            <li><a class="dropdown-item" href="PartyRegistration.html">Party Registration</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Employee</a></li>
                            <li><a class="dropdown-item" href="UserAccessRules.html">User Rules</a></li>
                        </ul>
                    </li>

                    <!-- Functions Menu -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button"
                            data-bs-toggle="dropdown">Functions</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#">Enquiry</a></li>
                            <li><a class="dropdown-item" href="#">Quotation</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="InternationalBooking.html">International Booking</a></li>
                            <li><a class="dropdown-item" href="#">Domestic</a></li>
                            <li><a class="dropdown-item" href="#">Customs Clearance</a></li>
                            <li><a class="dropdown-item" href="fulltruckload.html">FTL or FCL</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Upload Data</a></li>
                        </ul>
                    </li>

                    <!-- Accounting Menu -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button"
                            data-bs-toggle="dropdown">Accounting</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="invoice_form.html">Customer Invoicing</a></li>
                            <li><a class="dropdown-item" href="#">Vendor Billing</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Payment Credit</a></li>
                            <li><a class="dropdown-item" href="#">Payment Debit</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Tax Details</a></li>
                        </ul>
                    </li>

                    <!-- Reports Menu -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Reports</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#">International Report</a></li>
                            <li><a class="dropdown-item" href="#">Domestic Report</a></li>
                            <li><a class="dropdown-item" href="#">Customs Clearance Report</a></li>
                            <li><a class="dropdown-item" href="fulltruck_Report.html">FTL or FCL Report</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Customer Invoice Report</a></li>
                            <li><a class="dropdown-item" href="#">Vendor Billing Report</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Payment Received</a></li>
                            <li><a class="dropdown-item" href="#">Payment Receivable</a></li>
                            <li><a class="dropdown-item" href="#">Payment Paid</a></li>
                            <li><a class="dropdown-item" href="#">Payment Payable</a></li>
                            <li>
                                <hr class="dropdown-divider" />
                            </li>
                            <li><a class="dropdown-item" href="#">Accounting Ledger</a></li>
                        </ul>
                    </li>

                    <!-- Tools Menu -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Tools</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="setting.html">Settings</a></li>
                            <li><a class="dropdown-item" href="#">Error Log</a></li>
                            <li><a class="dropdown-item" href="#">Docket Master</a></li>
                            <li><a class="dropdown-item" href="#">Reset Database</a></li>
                            <li><a class="dropdown-item" href="routemaster.html">Route Master</a></li>
                            <li><a class="dropdown-item" href="ApplicationSettings.html">Application Settings</a></li>
                        </ul>
                    </li>
                </ul>

                <!-- User Info -->
                <div class="d-flex align-items-center">
                    <span class="text-white me-3">User ID: <span id="userLoginID">UserLoginID</span></span>
                    <button class="btn btn-outline-light logout-btn">Logout</button>
                </div>
            </div>
        </div>
    </nav>
    `;
    document.body.insertAdjacentHTML('afterbegin', header);
});

