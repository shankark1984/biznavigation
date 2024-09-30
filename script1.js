const APP_Script_URL = 'https://script.google.com/macros/s/AKfycbxxpY9MUcOWkQhgW5oF-xHcmLeMTFWrHHyLmu9EuBeQ-CW3wTlcpzsUVU-dM8cocHVN/exec';
let currentPartyCode = null; // Variable to store the party code

document.getElementById('partyForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => data[key] = value);

    // Convert date fields to IST format
    if (data.TDSEndDate) {
        data.TDSEndDate = convertToIST(data.TDSEndDate);
    }

    // Include partyCode if updating
    if (currentPartyCode) {
        data.partyCode = currentPartyCode;
    }

    fetch(APP_Script_URL, {
        method: 'POST',
        mode: 'no-cors', // Ensure proper CORS handling
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            alert('Record successfully submitted! Party Code: ' + result.partyCode);
            document.getElementById('partyForm').reset();
            currentPartyCode = null; // Reset partyCode after successful submission
            document.getElementById('submitButton').textContent = 'Submit'; // Change button text back
        } else {
            alert('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Request failed:', error);
        alert('Request failed: ' + error.message);
    });
});

// Autocomplete functionality
document.getElementById('partyName').addEventListener('input', function() {
    const partyName = this.value;
    if (partyName.length >= 3) {
        fetch(`${APP_Script_URL}?partyName=${encodeURIComponent(partyName)}`, {
            method: 'GET',
            mode: 'cors' // Ensure proper CORS handling
        })
        .then(response => response.json())
        .then(data => {
            const dataList = document.getElementById('partyNames');
            dataList.innerHTML = ''; // Clear existing options

            data.forEach(party => {
                const option = document.createElement('option');
                option.value = party.partyName;
                option.textContent = party.partyName;
                dataList.appendChild(option);
            });

            // If there is only one match, populate the form and change button text
            if (data.length === 1 && data[0].partyName.toLowerCase() === partyName.toLowerCase()) {
                populateForm(data[0]);
                currentPartyCode = data[0].partyCode; // Store the party code
                console.log(data[0].partyCode);
                
                document.getElementById('submitButton').textContent = 'Modify'; // Change button text
            }
        })
        .catch(error => console.error('Error fetching party data:', error));
    }
});

function populateForm(party) {
    document.getElementById('partyCode').value = party.partyCode || '';
    document.getElementById('type').value = party.type || '';
    document.getElementById('contactPerson').value = party.contactPerson || '';
    document.getElementById('contactNumber').value = party.contactNumber || '';
    document.getElementById('operationPerson').value = party.operationPerson || '';
    document.getElementById('OPSContactNo').value = party.OPSContactNo || '';
    document.getElementById('accountPerson').value = party.accountPerson || '';
    document.getElementById('accountContactNo').value = party.accountContactNo || '';
    document.getElementById('emailid').value = party.emailid || '';
    document.getElementById('address1').value = party.address1 || '';
    document.getElementById('address2').value = party.address2 || '';
    document.getElementById('city').value = party.city || '';
    document.getElementById('pincode').value = party.pincode || '';
    document.getElementById('pannumber').value = party.pannumber || '';
    document.getElementById('gstnumber').value = party.gstnumber || '';
    document.getElementById('TDSPercentage').value = party.TDSPercentage || '';
    document.getElementById('TDSEndDate').value = party.TDSEndDate ? convertToIST(party.TDSEndDate) : '';
    document.getElementById('TDSStatus').value = party.TDSStatus || '';
    document.getElementById('PaymentTandC').value = party.PaymentTandC || '';
    document.getElementById('AccountNo').value = party.AccountNo || '';
    document.getElementById('BankName').value = party.BankName || '';
    document.getElementById('Branch').value = party.Branch || '';
    document.getElementById('IFSCCode').value = party.IFSCCode || '';
    document.getElementById('AccountType').value = party.AccountType || '';
    document.getElementById('GSTTandC').value = party.GSTTandC || '';
}

function convertToIST(dateString) {
    const date = new Date(dateString);
    const offset = 5.5 * 60; // IST is UTC +5:30
    const localDate = new Date(date.getTime() + offset * 60 * 1000);
    
    // Return in yyyy-MM-dd format for input fields that require it
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}
document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");
  
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");
  
        tabContents.forEach(content => {
          content.classList.remove("active");
          if (content.id === target) {
            content.classList.add("active");
          }
        });
      });
    });
  
    // Handle form logic
    const form = document.getElementById('customerForm');
  
    form.addEventListener('input', (event) => {
      console.log(`Field ${event.target.name} updated with value ${event.target.value}`);
    });
  });
  