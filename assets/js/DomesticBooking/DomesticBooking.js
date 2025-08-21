document.addEventListener("DOMContentLoaded", async () => {
    if (!await checkAccess(UserLoginID, 'DomesticBooking')) {
        disableForm();
        alert("You do not have permission to view this form.");
        return;
    }
    handleUserTypePermissions();

    enableForm();

    await loadSuggestions('customerNameSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
    await loadSuggestions('consignorNameSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
    await loadSuggestions('serviceProviderSuggestions', 'PartyDetails', CompanyID, 'PartyCode', 'PartyName');
});