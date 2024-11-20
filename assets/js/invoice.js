document.getElementById('partyName').addEventListener('input', function (event) {
    const inputValue = event.target.value;
    const selectedOption = $("#partySuggestions option").filter(function () {
        return $(this).val() === inputValue;
    }).first();
    
    // Get the data-party-code from the matching option
    const partyCode = selectedOption.data("party-code");

    console.log("Selected party code:", partyCode);

});

