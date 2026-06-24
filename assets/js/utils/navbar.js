const Navbar = (() => {

    // ==========================
    // MENU CONFIG
    // ==========================
    const MENU = [
        {
            title: " Master",
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
            title: " Operations",
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
            title: " Accounts",
            icon: "bi-cash-stack ",
            children: [
                { label: "Customer Invoice", icon: "bi-receipt", href: "/pages/Accounting/CustomerInvoice.html" },
                { label: "Vendor Billing", icon: "bi-file-earmark-spreadsheet", href: "/pages/Accounting/VendorBilling.html" },
                { label: "Payments Credit", icon: "bi-arrow-down-circle", href: "/pages/Accounting/PaymentDetails_Credit.html" },
                { label: "Payment Debit", icon: "bi-arrow-up-circle", href: "/pages/Accounting/PaymentDetails_Debit.html" },
                { label: "Tax Details", icon: "bi-percent", href: "/pages/Accounting/TaxDetails.html" }
            ]
        },
        {
            title: " Reports",
            icon: "bi-cash-stack",
            children: [
                { label: "International Report", icon: "bi-globe", href: "/pages/Reports/reportInternationalShipmentDetails.html" },
                { label: "Domestic Report", icon: "bi-truck", href: "/pages/Reports/reportDomesticDetails.html" },
                { label: "Customs Clearance Report", icon: "bi-box-seam", href: "/pages/Reports/reportCustomsClearance.html" },
                { label: "Full Truck Load Report", icon: "bi-truck-front", href: "/pages/Reports/reportFulltruckDetails.html" },
                { label: "Customer Invoice Report", icon: "bi-receipt-cutoff", href: "/pages/Reports/reportCustomerInvoiceDetails.html" },
                { label: "Payment Details", icon: "bi-wallet2", href: "/pages/Reports/PaymentDetails.html" },
                { label: "Vendor Billing Report", icon: "bi-file-bar-graph", href: "#" },
                { label: "Payment Receivable", icon: "bi-cash-coin", href: "#" },
                { label: "Payment Payable", icon: "bi-currency-rupee", href: "#" },
                { label: "Tax Details", icon: "bi-percent", href: "/pages/Reports/reportGSTDetails.html" },
                { label: "Accounting Ledger", icon: "bi-journal-bookmark", href: "/pages/Reports/accountingLedger.html" }
            ]
        },
        {
            title: " Tools",
            icon: "bi-tools",
            children: [
                { label: "Settings", icon: "bi-gear-fill", href: "/pages/Tools/setting.html" },
                { label: "Error Log", icon: "bi-bug", href: "#" },
                { label: "Docket Master", icon: "bi-file-earmark-richtext", href: "#" },
                { label: "Reset Database", icon: "bi-database-x", href: "#" },
                { label: "Route Master", icon: "bi-sign-turn-right", href: "/pages/Tools/routemaster.html" },
                { label: "Application Settings", icon: "bi-sliders", href: " /pages/Tools/ApplicationSettings.html" },
            ]
        }

    ];

    let permissionsCache = null;
    // ==========================
    // INIT
    // ==========================
    async function init() {
        const userLoginID = localStorage.getItem("UserLoginID");

        if (!userLoginID) {
            location.replace("/index.html");
            return;
        }

        renderSidebar();
        setupMobileSidebarActions();
        createTopNavbar();
        mobileToggle();
        setupMenuToggle();
        setActiveMenu();
        await applyPermissions(userLoginID);

        // Features
        setupPageAnimation();
        setupPageTransition();
        createCollapseButton();
        setupSidebarHoverExpand();
        createFooter(); // ✅ NEW
    }
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
    // SIDEBAR RENDER
    // ==========================
    function renderSidebar() {

        const userName = localStorage.getItem("UserName") || "User";

        document.getElementById("sidebar").innerHTML = `
    <div class="sidebar" id="sidebarMenu">

        <div class="logo">
            <a href="/pages/Tools/home.html"
               class="logo-box"
               onclick="event.preventDefault(); navigateWithAnimation('/pages/Tools/home.html')">

                <img src="../../assets/img/applogo.png"
                     alt="Logo"
                     class="logo-img" />

                <span class="logo-text">BizNavigation</span>
            </a>
        </div>

        <ul class="menu">
            ${MENU.map(section => `
                <li class="menu-group">

                    <div class="menu-title">
                        <i class="bi ${section.icon}"></i>
                        <span>${section.title}</span>
                        <i class="bi bi-chevron-down arrow"></i>
                    </div>

                    <ul class="submenu">
                        ${section.children.map(item => `
                            <li class="menu-item"
                                data-href="${item.href}"
                                data-label="${item.label}">
                                <i class="bi ${item.icon}"></i>
                                <span>${item.label}</span>
                            </li>
                        `).join("")}
                    </ul>

                </li>
            `).join("")}
        </ul>

        <!-- Mobile User Panel -->
        <div class="sidebar-user-panel d-md-none">

            <div class="user-box">
                <div class="avatar">
                    ${userName.charAt(0).toUpperCase()}
                </div>
                <span class="username">${userName}</span>
            </div>

            <div class="sidebar-actions">

                <button id="mobileThemeToggle"
                        class="theme-btn"
                        title="Theme">
                    <i class="bi bi-moon"></i>
                </button>

                <button id="mobileLogoutBtn"
                        class="logout-btn"
                        title="Logout">
                    <i class="bi bi-box-arrow-right"></i>
                </button>

            </div>

        </div>

    </div>`;
    }
    // ==========================
    // MENU TOGGLE
    // ==========================
    function setupMenuToggle() {
        const menuGroups = document.querySelectorAll(".menu-group");

        document.querySelectorAll(".menu-title").forEach(el => {
            el.onclick = () => {
                const parent = el.parentElement;

                // ✅ Close all other menus
                menuGroups.forEach(group => {
                    if (group !== parent) {
                        group.classList.remove("open");
                    }
                });

                // ✅ Toggle current menu
                parent.classList.toggle("open");
            };
        });
    }

    // ==========================
    // ACTIVE MENU
    // ==========================
    function setActiveMenu() {
        const current = window.location.pathname;

        document.querySelectorAll(".menu-item").forEach(item => {
            const href = item.dataset.href;

            // ✅ Normalize both paths
            const currentPath = current.toLowerCase();
            const menuPath = href.toLowerCase();

            if (currentPath === menuPath) {
                item.classList.add("active");
                item.closest(".menu-group").classList.add("open");

                const breadcrumb = document.getElementById("breadcrumb");
                if (breadcrumb) {
                    breadcrumb.innerHTML =
                        `<div class="breadcrumb-box">Home / ${item.innerText}</div>`;
                }
            }

            item.onclick = () => navigateWithAnimation(href);
        });
    }

    // ==========================
    // PERMISSIONS
    // ==========================
    async function applyPermissions(userLoginID) {
        let permissions = JSON.parse(localStorage.getItem("permissions"));

        if (!permissions) {
            permissions = await fetchPermissions(userLoginID);
            localStorage.setItem("permissions", JSON.stringify(permissions));
        }

        document.querySelectorAll(".menu-item").forEach(item => {
            const id = generateFormID(item.dataset.href);
            if (!permissions[id]?.CanRead) {
                item.style.display = "none";
            }
        });
    }

    // ==========================
    // MOBILE TOGGLE
    // ==========================
    function mobileToggle() {
        const navbarLeft = document.querySelector(".navbar-left");
        const sidebar = document.getElementById("sidebarMenu");

        if (!navbarLeft || !sidebar) return;

        const btn = document.createElement("button");
        btn.id = "toggleSidebar";
        btn.className = "btn btn-sm btn-primary d-md-none me-2";

        let isOpen = false;

        const updateIcon = () => {
            btn.innerHTML = isOpen
                ? '<i class="bi bi-x-lg"></i>'
                : '<i class="bi bi-list"></i>';
        };

        const openSidebar = () => {
            sidebar.classList.add("show");
            isOpen = true;
            updateIcon();
        };

        const closeSidebar = () => {
            sidebar.classList.remove("show");
            isOpen = false;
            updateIcon();
        };

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            isOpen ? closeSidebar() : openSidebar();
        });

        document.addEventListener("click", (e) => {
            if (
                isOpen &&
                !sidebar.contains(e.target) &&
                !btn.contains(e.target)
            ) {
                closeSidebar();
            }
        });

        updateIcon();

        // Insert menu button before page title
        navbarLeft.prepend(btn);
    }
    function setupMobileSidebarActions() {

        document
            .getElementById("mobileThemeToggle")
            ?.addEventListener("click", () => {
                document.getElementById("themeToggle")?.click();
            });

        document
            .getElementById("mobileLogoutBtn")
            ?.addEventListener("click", () => {
                document.getElementById("logoutBtn")?.click();
            });
    }
    // ==========================
    // 🔥 PAGE ANIMATION
    // ==========================
    function setupPageAnimation() {
        document.body.style.opacity = 0;

        requestAnimationFrame(() => {
            document.body.style.opacity = 1;
        });
    }

    // ==========================
    // 🔥 PAGE TRANSITION
    // ==========================
    function setupPageTransition() {
        document.addEventListener("click", function (event) {

            const link = event.target.closest("a");
            const menuItem = event.target.closest(".menu-item");

            let href = null;

            if (link && link.href.startsWith(window.location.origin)) {
                href = link.href;
            }

            if (menuItem && menuItem.dataset.href) {
                href = menuItem.dataset.href;
            }

            if (!href) return;

            event.preventDefault();
            navigateWithAnimation(href);
        });
    }

    function navigateWithAnimation(href) {
        document.body.classList.remove("page-enter");
        document.body.classList.add("page-exit");

        setTimeout(() => {
            window.location.href = href;
        }, 300);
    }

    // ==========================
    // 🔥 COLLAPSE BUTTON
    // ==========================
    function createCollapseButton() {
        const sidebar = document.getElementById("sidebarMenu");

        const btn = document.createElement("button");
        btn.innerHTML = '<i class="bi bi-chevron-left"></i>';
        btn.className = "collapse-btn";

        sidebar.appendChild(btn);

        btn.onclick = () => {
            sidebar.classList.toggle("collapsed");
            document.body.classList.toggle("sidebar-collapsed");

            btn.innerHTML = sidebar.classList.contains("collapsed")
                ? '<i class="bi bi-chevron-right"></i>'
                : '<i class="bi bi-chevron-left"></i>';
        };
    }

    // ==========================
    // HELPERS
    // ==========================
    function generateFormID(href) {
        if (href.includes("PaymentDetails")) {
            const type = new URL(href, location.origin).searchParams.get("type") || "";
            return `PaymentDetails${type}`;
        }
        return href.split("/").pop().replace(".html", "");
    }

    async function fetchPermissions(userLoginID) {
        const { data, error } = await supabaseClient
            .from("UserAccessRules")
            .select("*")
            .eq("UserLoginID", userLoginID);

        if (error) return {};
        return Object.fromEntries(data.map(r => [r.FormID, r]));
    }

    return { init };

})();

// footer is simpler, so we can directly append it without needing a separate function

function createFooter() {
    const footer = document.createElement("footer");
    footer.className = "bg-dark text-white mt-4";

    footer.innerHTML = `
        <div class="container py-3">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-center text-center">

                <p class="mb-3 mb-md-0 fs-6">
                    &copy; 2024 BizNavigation - All Rights Reserved.
                </p>

                <ul class="list-inline mb-3 mb-md-0 fs-6">
                    <li class="list-inline-item">
                        <a href="#" class="text-white text-decoration-none">Privacy Policy</a>
                    </li>
                    <li class="list-inline-item">|</li>
                    <li class="list-inline-item">
                        <a href="#" class="text-white text-decoration-none">Terms of Service</a>
                    </li>
                    <li class="list-inline-item">|</li>
                    <li class="list-inline-item">
                        <a href="#" class="text-white text-decoration-none">Contact Us</a>
                    </li>
                </ul>

                <div>
                    <a href="#" class="mx-2">
                        <img src="../../assets/img/icons/facebook.svg" width="24">
                    </a>
                    <a href="#" class="mx-2">
                        <img src="../../assets/img/icons/twitter.svg" width="24">
                    </a>
                    <a href="#" class="mx-2">
                        <img src="../../assets/img/icons/linkedin.svg" width="24">
                    </a>
                </div>

            </div>
        </div>
    `;

    const container = document.querySelector(".main-content");
    if (container) {
        container.appendChild(footer);
    }
}

function createTopNavbar() {

    const userName = localStorage.getItem("UserName") || "User";

    // ✅ Get page title dynamically
    const pageTitle = document.title || "Dashboard";

    const navbar = document.createElement("div");
    navbar.className = "top-navbar";

    navbar.innerHTML = `
        <div class="navbar-left">
            <h5 class="mb-0">${pageTitle}</h5>
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

    document.querySelector(".main-content")?.prepend(navbar);

    setupThemeToggle();

    navbar.querySelector("#logoutBtn").addEventListener("click", async () => {
        const user = JSON.parse(localStorage.getItem("user"));

        if (user?.id) {
            await logoutOtherSessions(user.id); // DB update
        }

        localStorage.clear(); // clear browser

        logoutUser(); // UI / redirect
    });
}
// PROFILE DROPDOWN
function setupProfileDropdown(header) {
    const trigger = header.querySelector(".profile-trigger");
    const dropdown = header.querySelector(".profile-dropdown");

    trigger.onclick = () => dropdown.classList.toggle("show");

    document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target)) {
            dropdown.classList.remove("show");
        }
    });

    // document.getElementById("logoutBtn").onclick = () => {
    //     localStorage.clear();
    //     window.location.href = "/index.html";
    // };
}

// 🔔 NOTIFICATIONS
function setupNotifications(header) {
    const icon = header.querySelector(".notification-icon");
    const dropdown = header.querySelector(".notification-dropdown");

    icon.onclick = () => dropdown.classList.toggle("show");

    document.addEventListener("click", (e) => {
        if (!icon.contains(e.target)) {
            dropdown.classList.remove("show");
        }
    });
}

// 🌙 DARK MODE
function setupThemeToggle() {
    const btn = document.getElementById("themeToggle");
    const currentTheme = localStorage.getItem("theme");

    if (currentTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    btn.onclick = () => {
        document.body.classList.toggle("dark-mode");

        const isDark = document.body.classList.contains("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");
    };
}

function navigateWithAnimation(href) {
    document.getElementById("sidebarMenu")?.classList.remove("show");

    document.body.classList.remove("page-enter");
    document.body.classList.add("page-exit");

    setTimeout(() => {
        window.location.href = href;
    }, 250);
}

document.addEventListener("click", function (e) {
    const link = e.target.closest("a");

    if (link && link.href.includes("PaymentDetails.html")) {
        setTimeout(() => {
            const type = new URLSearchParams(window.location.search).get("type");

            if (type) {
                document.title = `Payment Details - ${type}`;
            }
        }, 100);
    }
});

document.addEventListener("DOMContentLoaded", Navbar.init);