class AuthService {
    static #ERROR_MAP = {
        'invalid_credentials': 'Invalid username or password',
        'network_error': 'Network error. Please check your connection',
        'rate_limit': 'Too many attempts. Please try again later',
        'default': 'An unexpected error occurred'
    };

    static async login(username, password) {
        try {
            const { data, error } = await SupabaseService.client
                .from(SUPABASE_CONFIG.tables.USER_LOGIN)
                .select('*')
                .eq('user_login_id', username)
                .eq('user_password', password)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('invalid_credentials');

            SessionService.setSession(data);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: this.#ERROR_MAP[error.message] || this.#ERROR_MAP.default
            };
        }
    }

    static async requestPasswordReset(email) {
        // Implementation for password reset
    }
}

class LoginUI {
    static #elements = {
        form: document.getElementById('loginForm'),
        username: document.getElementById('userName'),
        password: document.getElementById('password'),
        button: document.getElementById('loginButton'),
        buttonText: document.getElementById('loginButtonText'),
        spinner: document.getElementById('loginSpinner'),
        error: document.getElementById('errorMessage')
    };

    static init() {
        if (!this.#elements.form) return;

        this.#elements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.#handleLogin();
        });

        this.#elements.password.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.#handleLogin();
            }
        });
    }

    static #setLoading(isLoading) {
        this.#elements.button.disabled = isLoading;
        this.#elements.buttonText.textContent = isLoading ? 'Logging in...' : 'Login';
        this.#elements.spinner.classList.toggle('d-none', !isLoading);
    }

    static #showError(message) {
        this.#elements.error.textContent = message;
        this.#elements.error.classList.remove('d-none');
    }

    static #hideError() {
        this.#elements.error.classList.add('d-none');
    }

    static #validate() {
        if (!this.#elements.username.value.trim()) {
            this.#showError('Please enter your username');
            return false;
        }
        if (!this.#elements.password.value.trim()) {
            this.#showError('Please enter your password');
            return false;
        }
        return true;
    }

    static async #handleLogin() {
        if (!this.#validate()) return;

        this.#hideError();
        this.#setLoading(true);

        const { success, error } = await AuthService.login(
            this.#elements.username.value.trim(),
            this.#elements.password.value.trim()
        );

        this.#setLoading(false);

        if (success) {
            window.location.href = 'home.html';
        } else {
            this.#showError(error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => LoginUI.init());