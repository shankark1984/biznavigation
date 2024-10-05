const COMPANY_PROFILE_RANGE = 'CompanyProfile!A2:R'; // Adjust the range as necessary
const PartyDetails_RANGE = "PartyDetails!A2:AF"; // Specify the range of the sheet
const TypesList_RANGE = "TypesList!A2:E"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)
const MovementDetails_RANGE = "MovementDetails!A2:AJ"; // Google Sheet Range (CompanyID, ShortCode)
const SETTINGS_RANGE = "Settings!A2:G"; // Google Sheet Range (ID, TaxCode, TaxDescription, TaxRate, CGST, SGST, IGST)


// Arrays to store the fetched data for different types
let partyDetails = [];
let vehicleTypeData = [];
let bankNameData = [];
let bloodGroupData = [];
let chargesTypeData = [];
let modeTypeData = [];
let movementTypeData = [];
let transitTypeData = [];
let movementDetails=[];
let tax_data = [];

let lrNumber = '';
let transitType = '';
let tempFormID = '';