// footer.js
document.addEventListener("DOMContentLoaded", function () {
    const footer = `
       <footer>
    <div class="footer-container">
        <p>&copy; 2024 BizNavigation - All Rights Reserved.</p>
        <ul class="footer-links">
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Us</a></li>
        </ul>
        <div class="social-icons">
            <a href="#"><img src="assets/img/icons/facebook.svg" alt="Facebook"></a>
            <a href="#"><img src="assets/img/icons/twitter.svg" alt="Twitter"></a>
            <a href="#"><img src="assets/img/icons/linkedin.svg" alt="LinkedIn"></a>
        </div>
    </div>
</footer>
    `;
    document.body.insertAdjacentHTML('beforeend', footer);
});
