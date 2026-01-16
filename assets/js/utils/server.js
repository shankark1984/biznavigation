let supabaseClient; // Declare global variable

// Configuration Constants
const SUPABASE_CONFIG = Object.freeze({
    url: 'https://qfdrugniulwovfaijgkr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZHJ1Z25pdWx3b3ZmYWlqZ2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg1OTA4MjIsImV4cCI6MjA0NDE2NjgyMn0.Jnh7qgfwZlU-REZIML3cub8FHSfdkpZkDQUFgpIjo74',
    tables: {
        COMPANY_PROFILE: 'company_profile',
        USER_LOGIN: 'user_login'
    }
});

// Supabase Service
class SupabaseService {
    static #client = null;

    static get client() {
        if (!this.#client) {
            this.#client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        }
        supabaseClient = this.#client; // For backward compatibility
        // console.log("Supabase client initialized");
        return this.#client;
    }

    static async testConnection(maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { error } = await this.client
                    .from(SUPABASE_CONFIG.tables.COMPANY_PROFILE)
                    .select('*')
                    .limit(1)
                    .single();

                if (error) throw error;
                console.log("Supabase connection successful");
                return true;
            } catch (error) {
                console.error(`Connection attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    return false;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
}

// Network Service
class NetworkService {
    static #online = navigator.onLine;

    static init() {
        window.addEventListener('online', () => {
            this.#online = true;
            console.log("Back online");
        });

        window.addEventListener('offline', () => {
            this.#online = false;
            console.warn("No network connection");
        });

        return this.#online;
    }

    static get isOnline() {
        return this.#online;
    }
}

// Session Service
class SessionService {
    static _SESSION_KEYS = Object.freeze([
        'EmpCode', 'UserName', 'UserLoginID',
        'UserType', 'CompanyID', 'WorkingBranch'
    ]);

    static loadGlobals() {
        this._SESSION_KEYS.forEach(key => {
            window[key] = localStorage.getItem(key) || null;
        });
    }

    static saveGlobals() {
        this._SESSION_KEYS.forEach(key => {
            if (window[key] !== undefined && window[key] !== null) {
                localStorage.setItem(key, window[key]);
            }
        });
    }

    static setSession(user) {
        const {
            emp_code, user_name, user_login_id,
            user_type, company_id, working_branch
        } = user;

        const sessionMap = {
            EmpCode: emp_code,
            UserName: user_name,
            UserLoginID: user_login_id,
            UserType: user_type,
            CompanyID: company_id,
            WorkingBranch: working_branch || 'default'
        };

        this._SESSION_KEYS.forEach(key => {
            const value = sessionMap[key];
            localStorage.setItem(key, value);
            window[key] = value;
        });
    }

    static clearSession() {
        this._SESSION_KEYS.forEach(key => {
            localStorage.removeItem(key);
            window[key] = null;
        });
    }

    static getSession() {
        const session = this._SESSION_KEYS.reduce((acc, key) => {
            acc[key] = localStorage.getItem(key);
            return acc;
        }, {});

        session.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        session.localTime = new Date().toISOString();

        return session;
    }
}

// ✅ Global sync across tabs
window.addEventListener('storage', (e) => {
    if (SessionService._SESSION_KEYS.includes(e.key)) {
        window[e.key] = e.newValue;
    }
});

// ✅ Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    NetworkService.init();

    // Load global session variables
    SessionService.loadGlobals();

    SupabaseService.testConnection().then(isConnected => {
        if (!isConnected && !NetworkService.isOnline) {
            console.error("No network connection and Supabase unavailable");
        }
    });
    // console.log('Session Data:', SessionService.getSession());
});
function handleUserTypePermissions() {
    saveButton.disabled = !(UserType === 1 || UserType === 2);
    console.log("UserType:", UserType);
    newButton.disabled = UserType !== 1;
}

const now = new Date();
const localtimeStamp = now.toLocaleString(); // Local date and time
let rowIDEdit = null;
let bankRowIDEdit = null;
let branchCode = null;

// Global variables for permissions
let formName = '';
let formID = null;
let perRead = false;
let perWrite = false;
let perDelete = false;
let perUpdate = false;
const newButton = document.getElementById('newButton');
const modifyButton = document.getElementById('modifyButton');
const deleteButton = document.getElementById('deleteButton');
const reportButton = document.getElementById('reportButton');
const saveButton = document.getElementById('saveButton');
let lockedBookingIds = [];
let alertMessage = '';
let debounceTimer;
let partyCode = null;
let currentPageNumber = 1;
let totalPageCount = 1;
let invoiceNo = null;
let partyName = null;
let customerGSTRate = null;
// const USER_TYPE = Number(UserType);

const reSetPass = '12345'; // Default password for new users
