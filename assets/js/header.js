// header.js
document.addEventListener("DOMContentLoaded", function () {
    const header = `
        <nav class="menu-bar">
        <div class="logo-container">
        <a href="home.html" style="display: flex; align-items: center; text-decoration: none;">
             <img src="assets/img/applogo.png" alt="Logo" class="logo">
            <div>
                <h2>BizNavigation</h2>
                <span style="font-size: 0.5em;">TAKE YOUR BUSINESS TO THE NEXT LEVEL</span>
            </div>
            </a>
        </div>
        <ul class="menu-items">
            <li>
                <a href="#">Master</a>
                <div class="dropdown">
                    <a href="company.html">Company</a>
                    <a href="party_registration.html">Party Registration</a>
                    <a href="#">Employee</a>
                    <a href="#">User Rules</a>
                </div>
            </li>
            <li>
                <a href="#">Functions</a>
                <div class="dropdown">
                    <a href="#">Enquiry</a>
                    <a href="#">Quotation</a>
                    <a href="#">International</a>
                    <a href="#">Domestic</a>
                    <a href="#">Customs Clearance</a>
                    <a href="fulltruckload.html ">FTL or FCL</a>
                    <a href="#">Upload Data</a>
                </div>
            </li>
            <li>
                <a href="#">Accounting</a>
                <div class="dropdown">
                    <a href="#">Customer Invoicing</a>
                    <a href="#">Vendor Billing</a>
                    <a href="#">Payment Credit</a>
                    <a href="#">Payment Debit</a>
                    <a href="#">Tax Details</a>
                </div>
            </li>
            <li>
                <a href="#">Reports</a>
                <div class="dropdown">
                    <a href="#">International Report</a>
                    <a href="#">Domestic Report</a>
                    <a href="#">Customs Clearance Report</a>
                    <a href="fulltruck_Report.html">FTL or FCL Report</a>
                    <a href="#">Customer Invoice Report</a>
                    <a href="#">Vendor Billing Report</a>
                    <a href="#">Payment Received</a>
                    <a href="#">Payment Receivable</a>
                    <a href="#">Payment Paid</a>
                    <a href="#">Payment Payable</a>
                    <a href="#">Accounting Ledger</a>
                </div>
            </li>
            <li>
                <a href="#">Tools</a>
                <div class="dropdown">
                    <a href="setting.html">Settings</a>
                    <a href="#">Error Log</a>
                    <a href="#">Docket Master</a>
                    <a href="#">Reset Database</a>
                    <a href="routemaster.html">Route Master</a>
                </div>
            </li>
        </ul>
        <div class="user-info">
            <p class="user-id">User ID: <span id="userLoginID">UserLoginID</span></p>
            <button class="logout-btn">Logout</button>
        </div>
        <div class="hamburger">
            <span></span>
            <span></span>
            <span></span>
        </div>
    </nav>
    `;
    document.body.insertAdjacentHTML('afterbegin', header);
});
