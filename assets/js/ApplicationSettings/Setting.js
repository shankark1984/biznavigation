document.addEventListener("DOMContentLoaded", () => {
    const tabTriggers = document.querySelectorAll('#bookingTabs button[data-bs-toggle="tab"]');

    tabTriggers.forEach(tab => {
        tab.addEventListener('shown.bs.tab', async (event) => {
            const targetTab = event.target.getAttribute("data-bs-target");

            switch (targetTab) {
                case "#routeDetails":
                    await fetchRoutes();
                    break;

                case "#portDetails":
                    await fetchPorts();
                    break;

                case "#missingPinCode":
                    await fetchMissingPincodes();
                    break;

                case "#dropdownListdetails":
                    await fetchDropdownList();
                    setupFilterListeners();
                    attachTableEvents();
                    break;

                case "#countryDetails":
                    await fetchCountryData();
                    break;

                case "#cityDetails":
                    await loadCityDetails();
                    break;

                case "#SettingParameters":
                    await loadSettingParameters();
                    break;
            }
        });
    });

    // 🔥 Optional: load first tab initially
    fetchRoutes();
});