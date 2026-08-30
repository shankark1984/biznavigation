const Navbar = (() => {
    // ==========================
    // MENU CONFIG
    // ==========================
    const MENU = [
        {
            title: " Master", icon: "bi-folder2-open",
            children: [
                { label: "Company", icon: "bi-buildings", href: "/pages/master/companyProfile.html" },
                { label: "Party", icon: "bi-people-fill", href: "/pages/master/PartyRegistration.html" },
                { label: "Courier", icon: "bi-truck-flatbed", href: "/pages/master/CourierRegistration.html" },
                { label: "Employee", icon: "bi-person-badge-fill", href: "/pages/master/EmployeeMaster.html" },
                { label: "User Rules", icon: "bi-shield-lock", href: "/pages/master/UserAccessRules.html" }
            ]
        },
        {
            title: " Operations", icon: "bi-gear",
            children: [
                { label: "Enquiry", icon: "bi-search", href: "/pages/Functions/Enquiry.html" },
                { label: "Quotation", icon: "bi-file-earmark-text", href: "/pages/Functions/Quotation.html" },
                { label: "International", icon: "bi-globe-central-south-asia", href: "/pages/Functions/InternationalBooking.html" },
                { label: "Domestic", icon: "bi-truck", href: "/pages/Functions/DomesticBooking.html" },
                { label: "Customs Clearance", icon: "bi-box-seam", href: "/pages/Functions/CustomsClearance.html" },
                { label: "Full Truck Load", icon: "bi-truck-front", href: "/pages/Functions/fulltruckload.html" }
            ]
        },
        {
            title: " Accounts", icon: "bi-cash-stack",
            children: [
                { label: "Customer Invoice", icon: "bi-receipt", href: "/pages/Accounting/CustomerInvoice.html" },
                { label: "Vendor Billing", icon: "bi-file-earmark-spreadsheet", href: "/pages/Accounting/VendorBilling.html" },
                { label: "Payments Credit", icon: "bi-arrow-down-square", href: "/pages/Accounting/PaymentDetails_Credit.html?type=Credit" },
                { label: "Payment Debit", icon: "bi-arrow-up-square", href: "/pages/Accounting/PaymentDetails_Debit.html?type=Debit" },
                { label: "Credit Debit Note", icon: "bi-file-earmark-diff", href: "/pages/Accounting/CreditDebitNote.html" },
                { label: "Accounting Voucher", icon: "bi-cash-coin", href: "/pages/Accounting/AccountingVoucher.html" },
                { label: "Tax Details", icon: "bi-calculator", href: "/pages/Accounting/TaxDetails.html" }
            ]
        },
        {
            title: " Reports", icon: "bi-cash-stack",
            children: [
                { label: "International Report", icon: "bi-globe", href: "/pages/Reports/reportInternationalShipmentDetails.html" },
                { label: "Domestic Report", icon: "bi-truck", href: "/pages/Reports/reportDomesticDetails.html" },
                { label: "Customs Clearance Report", icon: "bi-box-seam", href: "/pages/Reports/reportCustomsClearance.html" },
                { label: "Full Truck Load Report", icon: "bi-truck-front", href: "/pages/Reports/reportFulltruckDetails.html" },
                { label: "Customer Invoice Report", icon: "bi-receipt-cutoff", href: "/pages/Reports/reportCustomerInvoiceDetails.html" },
                { label: "Payment Details", icon: "bi-wallet2", href: "/pages/Reports/PaymentDetails.html" },
                { label: "Vendor Billing Report", icon: "bi-file-bar-graph", href: "/pages/Reports/reportVendorBillingDetails.html" },
                { label: "Payment Receivable", icon: "bi-cash-coin", href: "#" },
                { label: "Outstanding Details", icon: "bi-currency-rupee", href: "/pages/Reports/outstandingDetails.html" },
                { label: "Tax Details", icon: "bi-percent", href: "/pages/Reports/reportGSTDetails.html" },
                { label: "Accounting Ledger", icon: "bi-journal-bookmark", href: "/pages/Reports/accountingLedger.html" },
                { label: "Bank Account Ledger", icon: "bi-wallet2", href: "/pages/Reports/bankAccountLedger.html" }
            ]
        },
        {
            title: " Tools", icon: "bi-tools",
            children: [
                { label: "Settings", icon: "bi-gear-fill", href: "/pages/Tools/setting.html" },
                { label: "Error Log", icon: "bi-bug", href: "#" },
                { label: "Docket Master", icon: "bi-file-earmark-richtext", href: "#" },
                { label: "Reset Database", icon: "bi-database-x", href: "#" },
                { label: "Route Master", icon: "bi-sign-turn-right", href: "/pages/Tools/routemaster.html" },
                { label: "Application Settings", icon: "bi-sliders", href: "/pages/Tools/ApplicationSettings.html" }
            ]
        }
    ];

    // Cache DOM elements that are queried multiple times
    const DOM = {};

    // ==========================
    // INIT
    // ==========================
    async function init() {
        const userLoginID = localStorage.getItem("UserLoginID");
        if (!userLoginID) return location.replace("/index.html");

        DOM.mainContent = document.querySelector(".main-content");
        DOM.sidebarContainer = document.getElementById("sidebar");

        setDynamicPageTitle();
        renderSidebar();

        // Cache newly rendered sidebar elements
        DOM.sidebarMenu = document.getElementById("sidebarMenu");

        buildTopNavbarAndFooter();
        setupMobileToggle();
        setupMenuInteractions();
        setActiveMenu();
        await applyPermissions(userLoginID);

        setupPageAnimation();
        setupGlobalClickDelegation();
        createCollapseButton();
    }

    function setDynamicPageTitle() {
        if (window.location.pathname.includes("PaymentDetails.html")) {
            const type = new URLSearchParams(window.location.search).get("type");
            if (type) document.title = `Payment Details - ${type}`;
        }
    }

    // ==========================
    // SIDEBAR RENDER
    // ==========================
    function renderSidebar() {
        const userName = localStorage.getItem("UserName") || "User";
        const avatarChar = userName.charAt(0).toUpperCase();

        const menuHTML = MENU.map(section => `
            <li class="menu-group">
                <div class="menu-title">
                    <i class="bi ${section.icon}"></i>
                    <span>${section.title}</span>
                    <i class="bi bi-chevron-down arrow"></i>
                </div>
                <ul class="submenu">
                    ${section.children.map(item => `
                        <li class="menu-item" data-href="${item.href}" data-label="${item.label}">
                            <i class="bi ${item.icon}"></i>
                            <span>${item.label}</span>
                        </li>
                    `).join("")}
                </ul>
            </li>
        `).join("");

        DOM.sidebarContainer.innerHTML = `
        <div class="sidebar" id="sidebarMenu">
            <div class="logo">
                <a href="/pages/Tools/home.html" class="logo-box" data-transition="true">
                    <img src="../../assets/img/applogo.png" alt="Logo" class="logo-img" />
                    <span class="logo-text">BizNavigation</span>
                </a>
            </div>
            <ul class="menu">${menuHTML}</ul>
            <div class="sidebar-user-panel d-md-none">
                <div class="user-box">
                    <div class="avatar">${avatarChar}</div>
                    <span class="username">${userName}</span>
                </div>
                <div class="sidebar-actions">
                    <button class="theme-btn" title="Theme"><i class="bi bi-moon"></i></button>
                    <button class="logout-btn" title="Logout"><i class="bi bi-power"></i></button>
                </div>
            </div>
        </div>`;
    }

    // ==========================
    // MENU INTERACTIONS
    // ==========================
    function setupMenuInteractions() {
        const menuGroups = document.querySelectorAll(".menu-group");

        // Accordion functionality
        document.querySelectorAll(".menu-title").forEach(el => {
            el.addEventListener("click", () => {
                const parent = el.parentElement;
                menuGroups.forEach(group => {
                    if (group !== parent) group.classList.remove("open");
                });
                parent.classList.toggle("open");
            });
        });

        // Hover expand functionality
        if (DOM.sidebarMenu) {
            DOM.sidebarMenu.addEventListener("mouseenter", () => {
                if (DOM.sidebarMenu.classList.contains("collapsed")) DOM.sidebarMenu.classList.add("hover-expanded");
            });
            DOM.sidebarMenu.addEventListener("mouseleave", () => {
                DOM.sidebarMenu.classList.remove("hover-expanded");
            });
        }
    }

    function setActiveMenu() {
        const currentPath = window.location.pathname.toLowerCase();
        const activeItem = Array.from(document.querySelectorAll(".menu-item")).find(
            item => item.dataset.href.toLowerCase() === currentPath
        );

        if (activeItem) {
            activeItem.classList.add("active");
            activeItem.closest(".menu-group").classList.add("open");

            const breadcrumb = document.getElementById("breadcrumb");
            if (breadcrumb) {
                breadcrumb.innerHTML = `<div class="breadcrumb-box">Home / ${activeItem.innerText}</div>`;
            }
        }
    }

    // ==========================
    // PERMISSIONS
    // ==========================
    async function applyPermissions(userLoginID) {
        const cacheKey = `permissions_${userLoginID}`;
        let permissions = JSON.parse(localStorage.getItem(cacheKey));

        if (!permissions) {
            const { data, error } = await supabaseClient
                .from("UserAccessRules")
                .select("FormID, CanRead")
                .eq("UserLoginID", userLoginID);

            if (error) return; // Exit gracefully if DB fails

            permissions = Object.fromEntries(data.map(r => [r.FormID, r]));
            localStorage.setItem(cacheKey, JSON.stringify(permissions));
        }

        document.querySelectorAll(".menu-item").forEach(item => {
            let id = item.dataset.href.split("/").pop().replace(".html", "");
            if (item.dataset.href.includes("PaymentDetails")) {
                const type = new URL(item.dataset.href, location.origin).searchParams.get("type") || "";
                id = `PaymentDetails${type}`;
            }

            if (permissions[id] && !permissions[id].CanRead) {
                item.style.display = "none";
            }
        });
    }

    // ==========================
    // UI BUILDERS & LAYOUT
    // ==========================
    function buildTopNavbarAndFooter() {
        if (!DOM.mainContent) return;
        const userName = localStorage.getItem("UserName") || "User";
        const pageTitle = document.title || "Dashboard";

        // Navbar
        const navbar = document.createElement("div");
        navbar.className = "top-navbar";
        navbar.innerHTML = `
            <div class="navbar-left">
                <h5 class="mb-0">${pageTitle}</h5>
            </div>
            <div class="navbar-right">
                <button class="theme-btn"><i class="bi bi-moon"></i></button>
                <div class="user-box">
                    <div class="avatar">${userName.charAt(0).toUpperCase()}</div>
                    <span class="username">${userName}</span>
                </div>
                <button class="logout-btn"><i class="bi bi-power"></i></button>
            </div>
        `;
        DOM.mainContent.prepend(navbar);

        // Footer
        const footer = document.createElement("footer");
        footer.className = "bg-dark text-white mt-4";
        footer.innerHTML = `
            <div class="container py-3">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-center text-center">
                    <p class="mb-3 mb-md-0 fs-6">&copy; 2024 BizNavigation - All Rights Reserved.</p>
                    <ul class="list-inline mb-3 mb-md-0 fs-6">
                        <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Privacy Policy</a></li>
                        <li class="list-inline-item">|</li>
                        <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Terms of Service</a></li>
                    </ul>
                </div>
            </div>
        `;
        DOM.mainContent.appendChild(footer);

        setupGlobalThemeAndLogout();
    }

    function setupGlobalThemeAndLogout() {
        const isDark = localStorage.getItem("theme") === "dark";
        const updateThemeUI = (dark) => {
            document.body.classList.toggle("dark-mode", dark);
            document.querySelectorAll(".theme-btn i").forEach(icon => {
                icon.className = dark ? "bi bi-sun" : "bi bi-moon";
            });
            localStorage.setItem("theme", dark ? "dark" : "light");
        };

        // Init theme
        if (isDark) updateThemeUI(true);

        // Bind all theme buttons (desktop + mobile)
        document.querySelectorAll(".theme-btn").forEach(btn => {
            btn.addEventListener("click", () => updateThemeUI(!document.body.classList.contains("dark-mode")));
        });

        // Bind all logout buttons (desktop + mobile)
        document.querySelectorAll(".logout-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const user = JSON.parse(localStorage.getItem("user"));
                if (user?.id && typeof logoutOtherSessions === "function") {
                    await logoutOtherSessions(user.id);
                }
                if (typeof logoutUser === "function") logoutUser();
                else window.location.replace("/index.html");
                localStorage.clear();
            });
        });
    }

    function setupMobileToggle() {
        const navbarLeft = document.querySelector(".navbar-left");
        if (!navbarLeft || !DOM.sidebarMenu) return;

        const btn = document.createElement("button");
        btn.className = "btn btn-sm btn-primary d-md-none me-2";

        let isOpen = false;
        const updateIcon = () => btn.innerHTML = isOpen ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            isOpen = !isOpen;
            DOM.sidebarMenu.classList.toggle("show", isOpen);
            updateIcon();
        });

        document.addEventListener("click", (e) => {
            if (isOpen && !DOM.sidebarMenu.contains(e.target) && !btn.contains(e.target)) {
                isOpen = false;
                DOM.sidebarMenu.classList.remove("show");
                updateIcon();
            }
        });

        updateIcon();
        navbarLeft.prepend(btn);
    }

    function createCollapseButton() {
        if (!DOM.sidebarMenu) return;
        const btn = document.createElement("button");
        btn.className = "collapse-btn";
        btn.innerHTML = '<i class="bi bi-chevron-left"></i>';
        DOM.sidebarMenu.appendChild(btn);

        btn.addEventListener("click", () => {
            DOM.sidebarMenu.classList.toggle("collapsed");
            document.body.classList.toggle("sidebar-collapsed");
            btn.innerHTML = DOM.sidebarMenu.classList.contains("collapsed") ? '<i class="bi bi-chevron-right"></i>' : '<i class="bi bi-chevron-left"></i>';
        });
    }

    // ==========================
    // PAGE ANIMATION & ROUTING
    // ==========================
    function setupPageAnimation() {
        document.body.style.opacity = "0";
        requestAnimationFrame(() => document.body.style.opacity = "1");
    }

    function setupGlobalClickDelegation() {
        document.addEventListener("click", (e) => {
            const linkTarget = e.target.closest(".menu-item") || e.target.closest("a[data-transition='true']");
            if (!linkTarget) return;

            const href = linkTarget.dataset.href || linkTarget.href;
            if (href && href !== "#") {
                e.preventDefault();
                if (DOM.sidebarMenu) DOM.sidebarMenu.classList.remove("show");

                document.body.classList.remove("page-enter");
                document.body.classList.add("page-exit");

                setTimeout(() => window.location.href = href, 250);
            }
        });
    }

    return { init };
})();

document.addEventListener("DOMContentLoaded", Navbar.init);