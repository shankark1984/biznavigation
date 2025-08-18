// footer.js

document.addEventListener("DOMContentLoaded", function () {
  const footer = document.createElement("footer");
  footer.className = "bg-dark text-white py-0";

  footer.innerHTML = `
      <div class="container py-3">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-center text-center">
          <p class="mb-3 mb-md-0 fs-6 fs-md-5">&copy; 2024 BizNavigation - All Rights Reserved.</p>
  
          <ul class="list-inline mb-3 mb-md-0 fs-6 fs-md-5">
            <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Privacy Policy</a></li>
            <li class="list-inline-item">|</li>
            <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Terms of Service</a></li>
            <li class="list-inline-item">|</li>
            <li class="list-inline-item"><a href="#" class="text-white text-decoration-none">Contact Us</a></li>
          </ul>
  
          <div class="fs-6 fs-md-5">
            <a href="#" class="mx-2" aria-label="Facebook"><img src="../../assets/img/icons/facebook.svg" alt="Facebook" width="24"></a>
            <a href="#" class="mx-2" aria-label="Twitter"><img src="../../assets/img/icons/twitter.svg" alt="Twitter" width="24"></a>
            <a href="#" class="mx-2" aria-label="LinkedIn"><img src="../../assets/img/icons/linkedin.svg" alt="LinkedIn" width="24"></a>
          </div>
        </div>
      </div>
    `;

  document.body.appendChild(footer);
});


