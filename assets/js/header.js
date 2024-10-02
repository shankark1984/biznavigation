// header.js
document.addEventListener("DOMContentLoaded", function () {
    const header = `
        <header>
        <!-- Hamburger Menu for Mobile -->
        <div class="hamburger" onclick="toggleMenu()">
            &#9776;
        </div>

        <!-- Navigation Menu -->
        <ul class="nav-menu">
            <!-- Logo Section -->
            <li class="logo">
                <h1 style="color: aliceblue; text-align: center;">
                    <a href="home.html" style="color: aliceblue; text-decoration: none;">BizNavigation</a>
                </h1>
            </li>

            <!-- Dropdowns for different sections -->
            <li class="dropdown">
                <a href="javascript:void(0)" class="dropbtn">Master</a>
                <div class="dropdown-content">
                    <a href="company.html">Company</a>
                    <a href="party_registration.html">Party Registration</a>
                    <a href="#">Employee</a>
                    <a href="#">User Rules</a>
                    <a href="#">UOM</a>
                    <a href="#">Map</a>
                </div>
            </li>

            <li class="dropdown">
                <a href="javascript:void(0)" class="dropbtn">Functions</a>
                <div class="dropdown-content">
                    <a href="form1.html">Enquiry</a>
                    <a href="#">Quotation</a>
                    <a href="#">International</a>
                    <a href="#">Domestic</a>
                    <a href="#">Customs Clearance</a>
                    <a href="#">FTL or FCL</a>
                    <a href="#">Upload Data</a>
                </div>
            </li>

            <li class="dropdown">
                <a href="javascript:void(0)" class="dropbtn">Accounting</a>
                <div class="dropdown-content">
                    <a href="form1.html">Customer Invoicing</a>
                    <a href="#">Vendor Billing</a>
                    <a href="#">Payment Credit</a>
                    <a href="#">Payment Debit</a>
                    <a href="#">Tax Details</a>
                </div>
            </li>

            <li class="dropdown">
                <a href="javascript:void(0)" class="dropbtn">Reports</a>
                <div class="dropdown-content">
                    <a href="form1.html">International Report</a>
                    <a href="#">Domestic Report</a>
                    <a href="#">Customs Clearance Report</a>
                    <a href="#">FTL or FCL Report</a>
                    <a href="#">Customer Invoice Report</a>
                    <a href="#">Vendor Billing Report</a>
                    <a href="#">Payment Received</a>
                    <a href="#">Payment Receivable</a>
                    <a href="#">Payment Paid</a>
                    <a href="#">Payment Payable</a>
                    <a href="#">Accounting Ledger</a>
                </div>
            </li>

            <li class="dropdown">
                <a href="javascript:void(0)" class="dropbtn">Tools</a>
                <div class="dropdown-content">
                    <a href="form1.html">Settings</a>
                    <a href="#">Error Log</a>
                    <a href="#">Docket Master</a>
                    <a href="#">Reset Database</a>
                    <a href="#">Create Query</a>
                </div>
            </li>

            <!-- Right-aligned elements (User Info and Logout) -->
            <li class="right-menu" style="margin-left: auto;">
                <p style="color: white; padding-right: 5px;">User ID: <span id="userLoginID">UserLoginID</span></p>
            </li>
            <li class="right-menu">
                <button class="logout-btn" onclick="logout()">Logout</button>
            </li>
        </ul>
    </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', header);
});
