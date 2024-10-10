

document.addEventListener('DOMContentLoaded', function () {
    const companyID = localStorage.getItem('CompanyID');
    if (companyID) {
        let lrNumber = localStorage.getItem('lrNumber');
        console.log('LR Number' + lrNumber);
        loadCompanyData(companyID);
        // let lrNumber = "ASL0000002"; // Sample LR Number
        loadMovementDetailsForLR(lrNumber, companyID); // Pass companyID explicitly
        loadMovementChargesDetailsForLR(lrNumber);
        // generatePDF() // Uncomment this to generate PDF if needed
    } else {
        console.error('No CompanyID found in localStorage');
    }
});

// Function to generate Barcode dynamically
function generateBarcode(lrNumber) {
    // Ensure lrNumber exists before generating the barcode
    if (lrNumber) {
        JsBarcode("#barcodeCanvas", lrNumber, {
            format: "CODE128",
            width: 1.3,
            height: 20,
            displayValue: true
        });
        console.log("Barcode generated for LR Number:", lrNumber);
    } else {
        console.error("LR Number is not defined");
    }
}

function generatePDF() {
    // Load jsPDF from UMD
    let lrNumber = localStorage.getItem('lrNumber');
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF(); // Create a new jsPDF instance

    // Set margin values
    const marginLeft = 5;
    const marginTop = 10;
    const marginRight = 5;
    const imgWidth = 210 - marginLeft - marginRight; // Adjust width for margins
    const pageHeight = 295; // A4 size height in mm

    // Wait for content to be fully loaded
    if (document.querySelector("#reportContent")) {
        // Use html2canvas to capture the content
        html2canvas(document.querySelector("#reportContent"), {
            scale: 2
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = marginTop; // Start the content below the top margin

            // Add the first image to the PDF with margin
            doc.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Handle multi-page PDF if the content is larger than one page
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the generated PDF
            doc.save(lrNumber + ".pdf");
        });
    } else {
        console.error("Content not found. Please ensure the #reportContent is fully loaded.");
    }
}



// Function to load Company data from Google Sheets
function loadCompanyData(companyID) {

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CompanyProfile_SHEETID}/values/${COMPANY_PROFILE_RANGE}?key=${APIKEY}`;
    console.log("Fetching company data from:", url);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const rows = data.values;
            const companyData = rows.find(row => row[0] === companyID); // Match CompanyID

            if (companyData) {
                document.getElementById('companyName').innerText = companyData[2] || '';
                let companyAddress = `${companyData[3]} ${companyData[4]} - ${companyData[5]} ${companyData[6]} ${companyData[7]}`;
                companyAddress = toProperCase(companyAddress);
                companyAddress = `${companyAddress}\nPAN No: ${companyData[11]} | GST No: ${companyData[10]}\nContact No: ${companyData[8]}`;
                companyAddress += ` | ${companyData[9]} | ${companyData[14]}`;
                document.getElementById('address').innerText = companyAddress;
                document.getElementById('companylogo').src = companyData[15];
                document.getElementById('companyCity').innerText = 'All Disputes Subject to ' + companyData[4] + ' Jurisdiction only';

            } else {
                console.error('Company data not found');
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

// Function to load Movement details from Google Sheets
function loadMovementDetailsForLR(lrNumber, companyID) {
    let invoiceValue = '';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementDetails_SHEETID}/values/${MovementDetails_RANGE}?key=${APIKEY}`;
    console.log("Fetching movement details from:", url);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const rows = data.values;
            const movementDetails = rows.find(row => row[34] === companyID && row[0] === lrNumber); // Match CompanyID and LR Number

            if (movementDetails) {
                generateBarcode(lrNumber); // Call the function to generate barcode
                document.getElementById('reportDate').innerText = formatDate(movementDetails[1]); // Assuming [1] is the date
                document.getElementById('pickupAddress').innerText = toProperCase(movementDetails[9] + ' ' + movementDetails[8] + '--' + movementDetails[7]);
                document.getElementById('deliveryAddress').innerText = toProperCase(movementDetails[12] + ' ' + movementDetails[11] + '--' + movementDetails[10]);
                document.getElementById('originCity').innerText = movementDetails[8];
                document.getElementById('destinationCity').innerText = movementDetails[11];
                document.getElementById('vehicleNumber').innerText = movementDetails[17];
                document.getElementById('vehicleType').innerText = movementDetails[14];
                document.getElementById('modeType').innerText = movementDetails[19];
                document.getElementById('transitType').innerText = movementDetails[4];
                document.getElementById('invoiceNumber').innerText = movementDetails[15] || 'As per Invoice';
                if (movementDetails[16] == 0 || movementDetails[16] == null) {
                    invoiceValue = 'As per Invoice'
                } else {
                    invoiceValue = movementDetails[16]
                }
                document.getElementById('invoiceValue').innerText = invoiceValue;
                document.getElementById('paymentType').innerText = 'TBB';//movementDetails[4] ;
                document.getElementById('quantity').innerText = movementDetails[20];
                document.getElementById('chargeableWeight').innerText = movementDetails[21] + 'Kgs';
                if (movementDetails[18]) {
                    let containerNumber = 'Container Number: ' + movementDetails[18]
                    document.getElementById('descriptionofGoods').innerText = movementDetails[22] + containerNumber;
                } else {
                    document.getElementById('descriptionofGoods').innerText = movementDetails[22];
                }
            } else {
                console.error('Movement data not found');
            }
        })
        .catch(error => {
            console.error('Error fetching movement data:', error);
        });
}


function loadMovementChargesDetailsForLR(lrNumber) {
    let totalFreight = 0;
    let cGSTAmt = 0;
    let iGSTAmt = 0;
    let sGSTAmt = 0;
    let totalGSTAmt = 0;
    let grandTotalAmt = 0;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MovementChargesDetails_SHEETID}/values/${MovementChargesDetails_Range}?key=${APIKEY}`;
    console.log("Fetching movement charges details from:", url);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.values) {
                const rows = data.values;

                let tableContent = `
                    <style>
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            font-size: 9px; /* Smaller font size to fit in the div */
                        }
                        th, td {
                            border: 1px solid black;
                            padding: 4px; /* Reduced padding to save space */
                            text-align: center;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                        td.right-align {
                            text-align: right; /* Align numeric values to the right */
                        }
                        td.total-charges {
                            font-weight: bold; /* Bold style for Total Charges column */
                        }
                        tr.grand-total td {
                            font-weight: bold; /* Bold style for Grand Total row */
                        }
                    </style>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Freight</th>
                                <th>CGST</th>
                                <th>SGST</th>
                                <th>IGST</th>
                                <th>Total Charges</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                // Loop through all rows and sum freight for matching lrNumber
                rows.forEach(row => {
                    if (row[0] === lrNumber) {
                        const description = row[1]; // Assuming charge type is in the second column
                        const freight = parseFloat(row[2]); // Assuming freight is in the third column
                        const cGSt = parseFloat(row[4]); // Assuming cGST is in the fifth column
                        const sGSt = parseFloat(row[5]); // Assuming sGST is in the sixth column
                        const iGSt = parseFloat(row[6]); // Assuming iGST is in the seventh column

                        console.log('Charges Type: ' + description);
                        if (!isNaN(freight)) {
                            totalFreight += freight;
                        }
                        if (!isNaN(cGSt)) {
                            cGSTAmt += cGSt;
                        }
                        if (!isNaN(sGSt)) {
                            sGSTAmt += sGSt;
                        }
                        if (!isNaN(iGSt)) {
                            iGSTAmt += iGSt;
                        }

                        const totalCharges = freight + cGSt + sGSt + iGSt;

                        // Add the row for each charge type, right-aligning the numeric values
                        tableContent += `
                            <tr>
                                <td>${description}</td>
                                <td class="right-align">${freight.toFixed(2)}</td>
                                <td class="right-align">${cGSt.toFixed(2)}</td>
                                <td class="right-align">${sGSt.toFixed(2)}</td>
                                <td class="right-align">${iGSt.toFixed(2)}</td>
                                <td class="right-align total-charges">${totalCharges.toFixed(2)}</td> <!-- Bold Total Charges column -->
                            </tr>
                        `;
                    }
                });

                if (totalFreight > 0) {
                    totalGSTAmt = cGSTAmt + sGSTAmt + iGSTAmt;
                    grandTotalAmt = totalFreight + totalGSTAmt;

                    // Add table rows for total amounts with bold styling for Grand Total row
                    tableContent += `
                        <tr class="grand-total">
                            <td><strong>Grand Total</strong></td>
                            <td class="right-align">${totalFreight.toFixed(2)}</td>
                            <td class="right-align">${cGSTAmt.toFixed(2)}</td>
                            <td class="right-align">${sGSTAmt.toFixed(2)}</td>
                            <td class="right-align">${iGSTAmt.toFixed(2)}</td>
                            <td class="right-align">${grandTotalAmt.toFixed(2)}</td>
                        </tr>
                    `;

                    // Close the table
                    tableContent += `
                        </tbody>
                    </table>
                    `;

                    // Insert the table into the HTML
                    document.getElementById('totalFreight').innerHTML = tableContent;
                } else {
                    console.error('No matching movement data found or freight is zero.');
                }
            } else {
                console.error('Invalid response data or no data found.');
            }
        })
        .catch(error => {
            console.error('Error fetching movement data:', error);
        });
}






// $.getJSON(url, function (data) {
//     const rows = data.values;
//     // Filter rows by companyID, assuming LR Number is in column 35 (index 34)
//     const filteredRows = rows.filter(row => row[34] === companyID && row[0] === lrNumber);


// partyDetails = rows.map(row => ({
// movementDetails = filteredRows.map(row => ({
//     lrNumber: row[0],
//     lrDate: row[1],
//     quotationID: row[2],
//     movementType: row[3],
//     transitType: row[4],
//     partyCode: row[5],
//     partyName: row[6],
//     originPinCode: row[7],
//     originCity: row[8],
//     originAddress: row[9],
//     destinationPinCode: row[10],
//     destinationCity: row[11],
//     destinationAddress: row[12],
//     requestedDate: row[13],
//     vehicleType: row[14],
//     referenceNumber: row[15],
//     invoiceValue: row[16],
//     vehicleNumber: row[17],
//     containerNumber: row[18],
//     modeType: row[19],
//     quantity: row[20],
//     cargoWT: row[21],
//     descriptionOfGoods: row[22],
//     status: row[23],
//     completionDate: row[24],
//     frightCharges: row[25],
//     otherCharges: row[26],
//     subTotal: row[27],
//     cGSTAmount: row[28],
//     sGSTAmount: row[29],
//     iGSTAmount: row[30],
//     totalGSTAmount: row[31],
//     grandTotalBilling: row[32],
//     invoiceNumber: row[33],
//     // Add other fields as necessary
// }));

// });
// }