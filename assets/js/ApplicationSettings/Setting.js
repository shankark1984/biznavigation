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
                    await loadPortDetails();
                    break;

                case "#missingPinCode":
                    await loadMissingPincode();
                    break;

                case "#dropdownListdetails":
                    await loadDropdownListDetails();
                    break;

                case "#countryDetails":
                    await loadCountryDetails();
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