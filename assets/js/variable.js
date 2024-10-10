const COMPANY_PROFILE_RANGE = 'CompanyProfile!A2:R'; // Adjust the range as necessary
const PartyDetails_RANGE = "PartyDetails!A2:AF"; // Specify the range of the sheet
const TypesList_RANGE = "TypesList!A2:E"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)
const MovementDetails_RANGE = "MovementDetails!A2:AJ"; // Google Sheet Range (CompanyID, ShortCode)
const SETTINGS_RANGE = "Settings!A2:G"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)
const MovementChargesDetails_RANGE = 'ChargesDetails!A2:L';
const MovementChargesDetails_Range = 'ChargesDetails!A2:I';


// Arrays to store the fetched data for different types
let partyDetails = [];
let vehicleTypeData = [];
let bankNameData = [];
let bloodGroupData = [];
let chargesTypeData = [];
let modeTypeData = [];
let movementTypeData = [];
let transitTypeData = [];
let movementDetails = [];
let tax_data = [];

let lrNumber = '';
let transitType = '';
let tempFormID = '';

let frightCharges = 0;
let otherCharges = 0;
let subTotal = 0;
let cGSTAmount = 0;
let sGSTAmount = 0;
let iGSTAmount = 0;
let totalGSTAmount = 0;
let grandTotal = 0;


function toProperCase(str) {
    return str
        .toLowerCase() // Convert the entire string to lowercase
        .split(' ') // Split the string into an array of words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
        .join(' '); // Join the words back into a single string
}
// Function to format date as dd-mm-yyyy
function formatDate(dateString) {
    let dateObj = new Date(dateString);  // Convert to Date object

    // Ensure the date is valid
    if (!isNaN(dateObj.getTime())) {
        let day = ("0" + dateObj.getDate()).slice(-2);  // Ensure two digits for the day
        let month = ("0" + (dateObj.getMonth() + 1)).slice(-2);  // Get month (0-indexed, add 1)
        let year = dateObj.getFullYear();  // Get the year

        return `${day}-${month}-${year}`;  // Return formatted date
    } else {
        return '';  // Return empty string if date is invalid
    }
}