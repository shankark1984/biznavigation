// Initialize Supabase
const { createClient } = supabase;
// Initialize Supabase
const SUPABASE_URL = 'https://qfdrugniulwovfaijgkr.supabase.co'; // Your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZHJ1Z25pdWx3b3ZmYWlqZ2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg1OTA4MjIsImV4cCI6MjA0NDE2NjgyMn0.Jnh7qgfwZlU-REZIML3cub8FHSfdkpZkDQUFgpIjo74'; // Your Supabase Anon Key

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(timeZone); // e.g., "America/New_York"

const now = new Date();
const localtimeStamp = now.toLocaleString(); // Local date and time
console.log(localtimeStamp);

const empCode = localStorage.getItem('EmpCode');
const userName = localStorage.getItem('UserName');
const userLoginID = localStorage.getItem('UserLoginID');
const userType = localStorage.getItem('UserType');
const companyID = localStorage.getItem('CompanyID');
const workingBranch = localStorage.getItem('WorkingBranch');



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






