// ==========================
// NAVBAR MODULE - OPTIMIZED WITH FIXED MOBILE BUTTON
// ==========================
const Navbar = (() => {
    // ==========================
    // CONFIGURATION
    // ==========================
    const CONFIG = {
        MENU: [
            {
                title: "Master",
                icon: "bi-folder2-open",
                children: [
                    { label: "Company", icon: "bi-buildings", href: "/pages/master/companyProfile.html" },
                    { label: "Party", icon: "bi-people-fill", href: "/pages/master/PartyRegistration.html" },
                    { label: "Courier", icon: "bi-truck-flatbed", href: "/pages/master/CourierRegistration.html" },
                    { label: "Employee", icon: "bi-person-badge-fill", href: "/pages/master/EmployeeMaster.html" },
                    { label: "User Rules", icon: "bi-shield-lock", href: "/pages/master/UserAccessRules.html" }
                ]
            },
            {
                title: "Operations",
                icon: "bi-gear",
                children: [
                    { label: "Enquiry", icon: "bi-search", href: "/pages/Functions/Enquiry.html" },
                    { label: "Quotation", icon: "bi-file-earmark-text", href: "/pages/Functions/Quotation.html" },
                    { label: "International", icon: "bi-globe-central-south-asia", href: "/pages/Functions/InternationalBooking.html" },
                    { label: "Domestic", icon: "bi-truck", href: "/pages/Functions/DomesticBooking.html" },
                    { label: "Customs Clearance", icon: "bi-box-seam", href: "/pages/Functions/CustomsClearance.html" },
                    { label: "Full Truck Load", icon: "bi-truck-front", href: "/pages/Functions/fulltruckload.html" },
                    { label: "Upload Data", icon: "bi-cloud-upload", href: "#" }
                ]
            },
            {
                title: "Accounts",
                icon: "bi-cash-stack",
                children: [
                    { label: "Customer Invoice", icon: "bi-receipt", href: "/pages/Accounting/CustomerInvoice.html" },
                    { label: "Vendor Billing", icon: "bi-file-earmark-spreadsheet", href: "/pages/Accounting/VendorBilling.html" },
                    { label: "Payments Credit", icon: "bi-arrow-down-circle", href: "/pages/Accounting/PaymentDetails_Credit.html?type=Credit" },
                    { label: "Payment Debit", icon: "bi-arrow-up-circle", href: "/pages/Accounting/PaymentDetails_Debit.html?type=Debit" },
                    { label: "Credit or Debit Note", icon: "bi-journal-text", href: "/pages/Accounting/CreditDebitNote.html" }
                ]
            },
            {
                title: "Reports",
                icon: "bi-cash-stack",
                children: [
                    { label: "International Report", icon: "bi-globe", href: "/pages/Reports/reportInternationalShipmentDetails.html" },
                    { label: "Domestic Report", icon: "bi-truck", href: "/pages/Reports/reportDomesticDetails.html" },
                    { label: "Customs Clearance Report", icon: "bi-box-seam", href: "/pages/Reports/reportCustomsClearance.html" },
                    { label: "Full Truck Load Report", icon: "bi-truck-front", href: "/pages/Reports/reportFulltruckDetails.html" },
                    { label: "Customer Invoice Report", icon: "bi-receipt-cutoff", href: "/pages/Reports/reportCustomerInvoiceDetails.html" },
                    { label: "Payment Details", icon: "bi-wallet2", href: "/pages/Reports/PaymentDetails.html" },
                    { label: "Vendor Billing", icon: "bi-file-bar-graph", href: "/pages/Reports/reportVendorBillingDetails.html" },
                    { label: "Payment Receivable", icon: "bi-cash-coin", href: "#" },
                    { label: "Payment Payable", icon: "bi-currency-rupee", href: "#" },
                    { label: "Tax Details", icon: "bi-percent", href: "/pages/Reports/reportGSTDetails.html" },
                    { label: "Accounting Ledger", icon: "bi-journal-bookmark", href: "/pages/Reports/accountingLedger.html" }
                ]
            },
            {
                title: "Tools",
                icon: "bi-tools",
                children: [
                    { label: "Settings", icon: "bi-gear-fill", href: "/pages/Tools/setting.html" },
                    { label: "Error Log", icon: "bi-bug", href: "#" },
                    { label: "Docket Master", icon: "bi-file-earmark-richtext", href: "#" },
                    { label: "Reset Database", icon: "bi-database-x", href: "#" },
                    { label: "Route Master", icon: "bi-sign-turn-right", href: "/pages/Tools/routemaster.html" },
                    { label: "Application Settings", icon: "bi-sliders", href: "/pages/Tools/ApplicationSettings.html" },
                ]
            }
        ],
        TRANSITION_DURATION: 250,
        STORAGE_KEYS: {
            USER_ID: "UserLoginID",
            USER_NAME: "UserName",
            THEME: "theme"
        }
    };

    function getPermissionStorageKey(userLoginID) {
        return `permissions_${userLoginID}`;
    }
    // ==========================
    // STATE
    // ==========================
    let permissionsCache = null;
    let isSidebarOpen = false;

    // ==========================
    // DOM REFS
    // ==========================
    const getElement = (selector) => document.querySelector(selector);
    const getElements = (selector) => document.querySelectorAll(selector);

    // ==========================
    // INIT
    // ==========================
    async function init() {
        const userLoginID = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);

        if (!userLoginID) {
            location.replace("/index.html");
            return;
        }

        ensureMainContent();

        renderSidebar();
        createTopNavbar();

        await applyPermissions(userLoginID); // apply permissions first

        setupMobileSidebar();
        setupMenuToggle();
        setActiveMenu();
        setupPageTransitions();
        createCollapseButton();
        setupSidebarHoverExpand();
        createFooter();
        setupGlobalNavigation();
        applySavedTheme();
    }

    // ==========================
    // ENSURE MAIN CONTENT EXISTS
    // ==========================
    function ensureMainContent() {
        if (!document.querySelector(".main-content")) {
            const mainContent = document.createElement("div");
            mainContent.className = "main-content";
            document.body.prepend(mainContent);
        }
    }

    // ==========================
    // SIDEBAR RENDER
    // ==========================
    function renderSidebar() {
        const userName = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME) || "User";

        // Create sidebar container if it doesn't exist
        let sidebar = document.getElementById("sidebar");
        if (!sidebar) {
            sidebar = document.createElement("div");
            sidebar.id = "sidebar";
            document.body.prepend(sidebar);
        }

        sidebar.innerHTML = `
            <div class="sidebar" id="sidebarMenu">
                <div class="logo">
                    <a href="/pages/Tools/home.html" class="logo-box" onclick="event.preventDefault(); Navbar.navigate('/pages/Tools/home.html')">
                        <img src="../../assets/img/applogo.png" alt="Logo" class="logo-img" />
                        <span class="logo-text">BizNavigation</span>
                    </a>
                </div>
                <ul class="menu">
                    ${CONFIG.MENU.map(section => `
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
                    `).join("")}
                </ul>
                <div class="sidebar-user-panel d-md-none">
                    <div class="user-box">
                        <div class="avatar">${userName.charAt(0).toUpperCase()}</div>
                        <span class="username">${userName}</span>
                    </div>
                    <div class="sidebar-actions">
                        <button id="mobileThemeToggle" class="theme-btn" title="Theme">
                            <i class="bi bi-moon"></i>
                        </button>
                        <button id="mobileLogoutBtn" class="logout-btn" title="Logout">
                            <i class="bi bi-box-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================
    // TOP NAVBAR
    // ==========================
    function createTopNavbar() {
        const userName = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME) || "User";
        const pageTitle = document.title || "Dashboard";

        const mainContent = document.querySelector(".main-content");
        if (!mainContent) return;

        // Remove existing navbar if any
        const existingNavbar = mainContent.querySelector(".top-navbar");
        if (existingNavbar) existingNavbar.remove();

        const navbar = document.createElement("div");
        navbar.className = "top-navbar";
        navbar.id = "topNavbar";

        navbar.innerHTML = `
            <div class="navbar-left">
                <button id="toggleSidebar" class="btn btn-sm btn-primary d-md-none me-2">
                    <i class="bi bi-list"></i>
                </button>
                <h5 class="mb-0 page-title">${pageTitle}</h5>
            </div>
            <div class="navbar-right">
                <button id="themeToggle" class="theme-btn">
                    <i class="bi bi-moon"></i>
                </button>
                <div class="user-box">
                    <div class="avatar">${userName.charAt(0).toUpperCase()}</div>
                    <span class="username">${userName}</span>
                </div>
                <button id="logoutBtn" class="logout-btn">
                    <i class="bi bi-box-arrow-right"></i>
                </button>
            </div>
        `;

        mainContent.prepend(navbar);
        setupThemeToggle();
        setupLogout();
    }

    // ==========================
    // MOBILE SIDEBAR - FIXED
    // ==========================
    function setupMobileSidebar() {
        const toggleBtn = document.getElementById("toggleSidebar");
        const sidebar = document.getElementById("sidebarMenu");

        if (!toggleBtn || !sidebar) {
            console.warn("Mobile sidebar elements not found");
            return;
        }

        // Remove any existing event listeners by cloning
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

        // Toggle sidebar on button click
        newToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            isSidebarOpen = !isSidebarOpen;
            sidebar.classList.toggle("show");

            // Update button icon
            const icon = newToggleBtn.querySelector("i");
            if (icon) {
                icon.className = isSidebarOpen ? "bi bi-x-lg" : "bi bi-list";
            }
        });

        // Close sidebar when clicking outside
        document.addEventListener("click", (e) => {
            if (isSidebarOpen &&
                !sidebar.contains(e.target) &&
                !newToggleBtn.contains(e.target)) {
                sidebar.classList.remove("show");
                isSidebarOpen = false;
                const icon = newToggleBtn.querySelector("i");
                if (icon) {
                    icon.className = "bi bi-list";
                }
            }
        });

        // Mobile theme toggle
        const mobileThemeToggle = document.getElementById("mobileThemeToggle");
        if (mobileThemeToggle) {
            mobileThemeToggle.addEventListener("click", () => {
                document.getElementById("themeToggle")?.click();
            });
        }

        // Mobile logout
        const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener("click", () => {
                document.getElementById("logoutBtn")?.click();
            });
        }

        // Close sidebar on window resize (if switching to desktop)
        window.addEventListener("resize", () => {
            if (window.innerWidth >= 768 && isSidebarOpen) {
                sidebar.classList.remove("show");
                isSidebarOpen = false;
                const icon = newToggleBtn.querySelector("i");
                if (icon) {
                    icon.className = "bi bi-list";
                }
            }
        });
    }

    // ==========================
    // MENU TOGGLE
    // ==========================
    function setupMenuToggle() {
        const menuGroups = getElements(".menu-group");

        getElements(".menu-title").forEach(el => {
            el.onclick = () => {
                const parent = el.parentElement;
                const isOpen = parent.classList.contains("open");

                // Close all other menus
                menuGroups.forEach(group => {
                    if (group !== parent) {
                        group.classList.remove("open");
                    }
                });

                // Toggle current
                if (!isOpen) {
                    parent.classList.add("open");
                } else {
                    parent.classList.remove("open");
                }
            };
        });
    }

    // ==========================
    // ACTIVE MENU
    // ==========================
    function setActiveMenu() {
        const currentPath = window.location.pathname.toLowerCase();

        getElements(".menu-item").forEach(item => {
            const href = item.dataset.href.toLowerCase();

            if (currentPath === href) {
                item.classList.add("active");
                const group = item.closest(".menu-group");
                if (group) group.classList.add("open");

                // Update breadcrumb
                const breadcrumb = document.getElementById("breadcrumb");
                if (breadcrumb) {
                    breadcrumb.innerHTML = `<div class="breadcrumb-box">Home / ${item.innerText}</div>`;
                }
            }

            item.onclick = (e) => {
                e.preventDefault();
                navigateWithAnimation(item.dataset.href);
            };
        });
    }

    // ==========================
    // PERMISSIONS
    // ==========================
    async function applyPermissions(userLoginID) {
        const permissionKey = getPermissionStorageKey(userLoginID);
        let permissions = JSON.parse(localStorage.getItem(permissionKey));

        if (!permissions) {
            permissions = await fetchPermissions(userLoginID);
            localStorage.setItem(permissionKey, JSON.stringify(permissions));
        }

        getElements(".menu-item").forEach(item => {
            const id = generateFormID(item.dataset.href);

            if (!permissions[id]?.CanRead) {
                item.style.display = "none";
            } else {
                item.style.display = "";
            }
        });

        // Hide empty menu groups
        getElements(".menu-group").forEach(group => {
            const visibleItems = [...group.querySelectorAll(".menu-item")]
                .filter(item => item.style.display !== "none");

            group.style.display = visibleItems.length ? "" : "none";
        });
    }

    // ==========================
    // SIDEBAR HOVER EXPAND
    // ==========================
    function setupSidebarHoverExpand() {
        const sidebar = document.getElementById("sidebarMenu");
        if (!sidebar) return;

        sidebar.addEventListener("mouseenter", () => {
            if (sidebar.classList.contains("collapsed")) {
                sidebar.classList.add("hover-expanded");
            }
        });

        sidebar.addEventListener("mouseleave", () => {
            sidebar.classList.remove("hover-expanded");
        });
    }

    // ==========================
    // COLLAPSE BUTTON
    // ==========================
    function createCollapseButton() {
        const sidebar = document.getElementById("sidebarMenu");
        if (!sidebar) return;

        // Remove existing collapse button if any
        const existingBtn = sidebar.querySelector(".collapse-btn");
        if (existingBtn) existingBtn.remove();

        const btn = document.createElement("button");
        btn.className = "collapse-btn";
        btn.innerHTML = '<i class="bi bi-chevron-left"></i>';

        btn.onclick = () => {
            sidebar.classList.toggle("collapsed");
            document.body.classList.toggle("sidebar-collapsed");
            btn.innerHTML = sidebar.classList.contains("collapsed")
                ? '<i class="bi bi-chevron-right"></i>'
                : '<i class="bi bi-chevron-left"></i>';
        };

        sidebar.appendChild(btn);
    }

    // ==========================
    // PAGE TRANSITIONS
    // ==========================
    function setupPageTransitions() {
        document.body.style.opacity = 0;
        requestAnimationFrame(() => {
            document.body.style.opacity = 1;
        });
    }

    function navigateWithAnimation(href) {
        if (!href || href === "#") return;

        document.getElementById("sidebarMenu")?.classList.remove("show");
        document.body.classList.remove("page-enter");
        document.body.classList.add("page-exit");

        setTimeout(() => {
            window.location.href = href;
        }, CONFIG.TRANSITION_DURATION);
    }

    // ==========================
    // GLOBAL NAVIGATION
    // ==========================
    function setupGlobalNavigation() {
        document.addEventListener("click", (e) => {
            const link = e.target.closest("a[href]");
            const menuItem = e.target.closest(".menu-item");
            let href = null;

            if (link?.href && link.href.startsWith(window.location.origin)) {
                href = link.href;
            } else if (menuItem?.dataset.href) {
                href = menuItem.dataset.href;
            }

            if (href && href !== "#" && !e.target.closest("#toggleSidebar")) {
                e.preventDefault();
                navigateWithAnimation(href);
            }
        });
    }

    // ==========================
    // THEME
    // ==========================
    function setupThemeToggle() {
        const btn = document.getElementById("themeToggle");
        if (!btn) return;

        btn.onclick = () => {
            document.body.classList.toggle("dark-mode");
            const isDark = document.body.classList.contains("dark-mode");
            localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, isDark ? "dark" : "light");
        };
    }

    function applySavedTheme() {
        const theme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
        if (theme === "dark") {
            document.body.classList.add("dark-mode");
        }
    }

    // ==========================
    // LOGOUT
    // ==========================
    function setupLogout() {
        document.getElementById("logoutBtn")?.addEventListener("click", async () => {
            const user = JSON.parse(localStorage.getItem("user"));
            const userLoginID = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);

            if (user?.id) {
                await logoutOtherSessions(user.id);
            }

            if (userLoginID) {
                localStorage.removeItem(getPermissionStorageKey(userLoginID));
            }

            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_ID);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_NAME);
            localStorage.removeItem("user");

            logoutUser();
        });
    }

    // ==========================
    // FOOTER
    // ==========================
    function createFooter() {
        // Remove existing footer
        const existingFooter = document.querySelector("footer");
        if (existingFooter) existingFooter.remove();

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
                        <li class="list-inline-item">|</li>
                        <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Contact Us</a></li>
                    </ul>
                    <div>
                        ${["facebook", "twitter", "linkedin"].map(social =>
            `<a href="#" class="mx-2">
                                <img src="../../assets/img/icons/${social}.svg" width="24" alt="${social}">
                            </a>`
        ).join("")}
                    </div>
                </div>
            </div>
        `;

        document.querySelector(".main-content")?.appendChild(footer);
    }

    // ==========================
    // HELPERS
    // ==========================
    function generateFormID(href) {
        if (href.includes("PaymentDetails")) {
            const url = new URL(href, location.origin);
            const type = url.searchParams.get("type") || "";
            return `PaymentDetails${type}`;
        }
        return href.split("/").pop().replace(".html", "");
    }

    async function fetchPermissions(userLoginID) {
        try {
            const { data, error } = await supabaseClient
                .from("UserAccessRules")
                .select("*")
                .eq("UserLoginID", userLoginID);

            if (error) throw error;
            return Object.fromEntries(data.map(r => [r.FormID, r]));
        } catch (error) {
            console.error("Failed to fetch permissions:", error);
            return {};
        }
    }

    // ==========================
    // EXPOSE PUBLIC API
    // ==========================
    return {
        init,
        navigate: navigateWithAnimation
    };
})();

// ==========================
// BOOTSTRAP
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    Navbar.init();
});


async function handleLogout() {
    const user = JSON.parse(localStorage.getItem("user"));
    const userLoginID = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);

    if (user?.id) {
        await logoutOtherSessions(user.id);
    }

    if (userLoginID) {
        localStorage.removeItem(getPermissionStorageKey(userLoginID));
    }

    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_ID);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_NAME);
    localStorage.removeItem("user");

    logoutUser();
}