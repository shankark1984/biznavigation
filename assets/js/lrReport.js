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


async function loadCompanyData(companyID) {
    console.log("Fetching company data from Supabase...");

    try {
        // Fetch company data from the "CompanyProfile" table
        let { data, error } = await supabaseClient
            .from('company_profile') // Replace with your actual table name in Supabase
            .select('*')
            .eq('company_id', companyID); // Filter by companyID

        if (error) {
            throw error;
        }

        // Check if data was found
        if (data && data.length > 0) {
            const companyData = data[0]; // Assuming companyID is unique, use the first result

            // Fill in company details
            document.getElementById('companyName').innerText = companyData.company_name || '';
            let companyAddress = `${companyData.address} ${companyData.city} - ${companyData.pin_code} ${companyData.state} ${companyData.country}`;
            companyAddress = toProperCase(companyAddress);
            companyAddress = `${companyAddress}\nPAN No: ${companyData.pan_number} | GST No: ${companyData.gst_number}\nContact No: ${companyData.phone_no}`;
            companyAddress += ` | ${companyData.e_mail} | ${companyData.web_site}`;
            document.getElementById('address').innerText = companyAddress;
            document.getElementById('companylogo').src = companyData.logo_path;
            document.getElementById('companyCity').innerText = 'All Disputes Subject to ' + companyData.city + ' Jurisdiction only';

        } else {
            console.error('Company data not found');
        }

    } catch (error) {
        console.error('Error fetching data from Supabase:', error);
    }
}

// Function to load Movement details from Google Sheets
async function loadMovementDetailsForLR(lrNumber, companyID) {
    let invoiceValue = '';
    console.log("Fetching movement details from Supabase...");

    try {
        // Fetch movement details from the "MovementDetails" table
        let { data, error } = await supabaseClient
            .from('booking_details') // Replace with your actual table name in Supabase
            .select('*')
            .eq('company_id', companyID) // Filter by companyID
            .eq('lr_number', lrNumber); // Filter by lrNumber (assuming lrNumber is in column 0)

        if (error) {
            throw error;
        }

        // Check if movement details were found
        if (data && data.length > 0) {
            const movementDetails = data[0]; // Assuming lrNumber is unique, use the first result

            // Call the function to generate barcode
            generateBarcode(lrNumber);

            // Assuming the structure of the columns in Supabase matches your previous Google Sheets structure
            document.getElementById('reportDate').innerText = formatDate(movementDetails.pickup_date); // Replace with your actual field
            document.getElementById('pickupAddress').innerText = toProperCase(movementDetails.origin_address + ' ' + movementDetails.origin_city + '--' + movementDetails.origin_pincode);
            document.getElementById('deliveryAddress').innerText = toProperCase(movementDetails.destination_address + ' ' + movementDetails.destination_city + '--' + movementDetails.destination_pincode);
            document.getElementById('originCity').innerText = movementDetails.origin_city;
            document.getElementById('destinationCity').innerText = movementDetails.destination_city;
            document.getElementById('vehicleNumber').innerText = movementDetails.vehicle_number;
            document.getElementById('vehicleType').innerText = movementDetails.vehicle_type;
            document.getElementById('modeType').innerText = movementDetails.mode_type;
            document.getElementById('transitType').innerText = movementDetails.transit_type;
            document.getElementById('invoiceNumber').innerText = movementDetails.reference_number || 'As per Invoice';
            invoiceValue = movementDetails.invoice_value == 0 || movementDetails.invoice_value == null ? 'As per Invoice' : movementDetails.invoice_value;
            document.getElementById('invoiceValue').innerText = invoiceValue;
            document.getElementById('paymentType').innerText = 'TBB'; // Adjust this based on actual data
            document.getElementById('quantity').innerText = movementDetails.quantity;
            document.getElementById('chargeableWeight').innerText = movementDetails.cargo_weight + 'Kgs';

            if (movementDetails.container_number) {
                let containerNumber = 'Container Number: ' + movementDetails.container_number;
                document.getElementById('descriptionofGoods').innerText = movementDetails.description_of_goods + containerNumber;
            } else {
                document.getElementById('descriptionofGoods').innerText = movementDetails.description_of_goods;
            }

        } else {
            console.error('Movement data not found');
        }

    } catch (error) {
        console.error('Error fetching movement data from Supabase:', error);
    }
}

async function loadMovementChargesDetailsForLR(lrNumber) {
    let totalFreight = 0;
    let cGSTAmt = 0;
    let iGSTAmt = 0;
    let sGSTAmt = 0;
    let totalGSTAmt = 0;
    let grandTotalAmt = 0;

    console.log("Fetching movement charges details from Supabase...");

    try {
        // Fetch movement charges details from the "MovementChargesDetails" table
        let { data, error } = await supabaseClient
            .from('booking_charges') // Replace with your actual table name in Supabase
            .select('*')
            .eq('lr_number', lrNumber); // Filter by lrNumber

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
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
            data.forEach(row => {
                const description = row.charges_type; // Assuming description is in your table
                const freight = parseFloat(row.amount); // Assuming freight is in your table
                const cGSt = parseFloat(row.cgst_amount); // Assuming cGST is in your table
                const sGSt = parseFloat(row.sgst_amount); // Assuming sGST is in your table
                const iGSt = parseFloat(row.igst_amount); // Assuming iGST is in your table

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
                        <td class="right-align total-charges">${totalCharges.toFixed(2)}</td>
                    </tr>
                `;
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
            console.error('No data found.');
        }
    } catch (error) {
        console.error('Error fetching movement charges data from Supabase:', error);
    }
}