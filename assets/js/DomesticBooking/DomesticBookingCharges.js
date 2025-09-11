function createChargeRow(record = {}) {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" list="chargesTypeList" 
         class="form-control form-control-sm chargesTypeInput" 
         value="${record.ChargesType || ''}"></td>
    <datalist id="chargesTypeList"></datalist>

    <td><input type="text" class="form-control form-control-sm hsnNumber" 
         value="${record.HSNCode || ''}"></td>

    <td><input type="text" class="form-control form-control-sm description" 
         value="${record.Remarks || ''}"></td>

    <td>
      <div class="input-group input-group-sm">
        <input type="number" class="form-control text-end tax-rate" 
             value="${record.TaxRate || 0}" min="0" step="0.01" aria-label="Tax Rate">
        <span class="input-group-text">%</span>
      </div>
    </td>

    <td><input type="number" class="form-control form-control-sm text-end weight" 
         value="${record.Quantity || 1}" min="1"></td>

    <td><input type="number" class="form-control form-control-sm text-end unitPrice" 
         value="${record.PerQtyAmt || 0}" min="0"></td>

    <td><input type="number" class="form-control form-control-sm text-end basic" 
         value="${record.TotalAmount || 0}" min="0"></td>

    <td class="sgst text-end">${record.SGSTAmt?.toFixed(2) || '0.00'}</td>
    <td class="cgst text-end">${record.CGSTAmt?.toFixed(2) || '0.00'}</td>
    <td class="igst text-end">${record.IGSTAmt?.toFixed(2) || '0.00'}</td>
    <td class="totalgst text-end">${record.TotalGSTAmt?.toFixed(2) || '0.00'}</td>
    <td class="grandtotal text-end">${record.GrandTotalAmt?.toFixed(2) || '0.00'}</td>

    <td>
      <button class="btn btn-danger btn-sm" onclick="removeRow(this)">❌</button>
    </td>

    <td class="hide-col-13">
      <select class="form-select form-select-sm taxtype">
        <option value="GST" ${record.TaxID === 'GST' ? 'selected' : ''}>GST</option>
        <option value="IGST" ${record.TaxID === 'IGST' ? 'selected' : ''}>IGST</option>
      </select>
    </td>
  `;

    // 🔗 Attach same event listeners as addRow
    row.querySelectorAll("input, select").forEach(el => {
        el.addEventListener("input", () => calculateRow(row));
    });

    row.querySelector(".chargesTypeInput").addEventListener("change", async function () {
        let selectedCharge = this.value.trim();

        if (!selectedCharge) {
            row.querySelector(".hsnNumber").value = "";
            return;
        }

        // Fetch HSN from dropdown_list
        const { data, error } = await supabaseClient
            .from("dropdown_list")
            .select("hsn_code")
            .eq("description", selectedCharge)
            .single();

        if (error || !data) {
            console.warn("HSN not found for", selectedCharge);
            row.querySelector(".hsnNumber").value = "";
        } else {
            row.querySelector(".hsnNumber").value = data.hsn_code || "";
        }

        // Fetch customer GST
        const customerCode = document.getElementById("customerCode").value;
        if (!customerCode) {
            row.querySelector(".tax-rate").value = 0;
            return;
        }
        const customerDetails = await getPartyDetailsByCode(customerCode);
        if (customerDetails) {
            row.querySelector(".tax-rate").value =
                await parseAndSumGST(customerDetails.DefaultTax) || 0;
        }

        // Special handling for freight
        if (selectedCharge === 'Freight Amount' || selectedCharge === 'Transportation Charges') {
            const chargeableWeight = document.getElementById("chargeableWeight").value || 0;
            const unitPrice = 8;
            row.querySelector(".weight").value = chargeableWeight || 0;
            row.querySelector(".unitPrice").value = unitPrice;
            row.querySelector(".basic").value = chargeableWeight * unitPrice || 0;
            calculateRow(row);
        }
    });

    calculateRow(row); // initial calculation
    return row;
}

// ✅ Add new row manually
function addRow() {
    const tbody = document.getElementById("chargesBody");
    tbody.appendChild(createChargeRow()); // empty record = blank row
}

// ✅ Load rows from DB
async function loadDomesticBookingCharges(insertedID) {
    const { data, error } = await supabaseClient
        .from('DomesticBookingCharges')
        .select('*')
        .eq('ID_DB', insertedID);

    if (error) {
        console.error('Error fetching booking charges:', error);
        return;
    }

    const tbody = document.getElementById("chargesBody");
    tbody.innerHTML = "";

    if (data.length) {
        data.forEach(record => {
            tbody.appendChild(createChargeRow(record)); // reuse same logic
        });
    }
}


function parseAndSumGST(inputStr) {
    // Match all occurrences of percentage numbers in the string
    const matches = inputStr.match(/(\d+)%/g);
    if (!matches) return 0;

    // Sum extracted numeric percentages (removing the % sign)
    const total = matches.reduce((sum, val) => sum + parseFloat(val), 0);

    return total;
}


// Calculate values for a row and update the table
function calculateRow(row) {
    let weight = parseFloat(row.querySelector(".weight").value) || 0;
    let unitPrice = parseFloat(row.querySelector(".unitPrice").value) || 0;
    let basic = parseFloat(row.querySelector(".basic").value) || 0;

    let taxRate = parseFloat(row.querySelector(".tax-rate").value) || 0;
    let taxType = row.querySelector(".taxtype").value;

    if (!customerGSTRate) return;

    let baseAmt = weight * unitPrice;
    let cgst = getGSTValue("CGST", customerGSTRate);
    let sgst = getGSTValue("SGST", customerGSTRate);
    let igst = getGSTValue("IGST", customerGSTRate);


    if (taxRate !== (cgst + sgst + igst)) {
        console.log('CGST:', cgst, 'SGST:', sgst, 'IGST:', igst);
        if (cgst + sgst > 0) {
            cgst = taxRate / 2;
            sgst = taxRate / 2;
        } else {
            igst = taxRate;
        }
        // If user-modified tax rate doesn't match default, adjust proportions
        console.log('Adjusted CGST:', cgst, 'SGST:', sgst, 'IGST:', igst);
    }

    let sgstAmt = 0, cgstAmt = 0, igstAmt = 0;
    if (cgst + sgst > 0) {
        taxType = "GST";
    } else if (igst > 0) {
        taxType = "IGST";
    }

    if (taxType === "GST") {
        sgstAmt = (baseAmt * cgst) / 100;
        cgstAmt = (baseAmt * sgst) / 100;
    } else {
        igstAmt = (baseAmt * igst) / 100;
    }

    let totalGst = sgstAmt + cgstAmt + igstAmt;
    let grandTotal = baseAmt + totalGst;

    row.querySelector(".basic").value = baseAmt.toFixed(2);
    row.querySelector(".sgst").innerText = sgstAmt.toFixed(2);
    row.querySelector(".cgst").innerText = cgstAmt.toFixed(2);
    row.querySelector(".igst").innerText = igstAmt.toFixed(2);
    row.querySelector(".totalgst").innerText = totalGst.toFixed(2);
    row.querySelector(".grandtotal").innerText = grandTotal.toFixed(2);

    calculateTotals();
}

// Summarize all rows and update the table footer
function calculateTotals() {
    let totalFreight = 0, totalSGST = 0, totalCGST = 0, totalIGST = 0, totalGST = 0, totalGrand = 0;

    document.querySelectorAll("#chargesBody tr").forEach(row => {
        let weight = parseFloat(row.querySelector(".weight").value) || 0;
        let unitPrice = parseFloat(row.querySelector(".unitPrice").value) || 0;
        let basic = parseFloat(row.querySelector(".basic").value) || 0;
        let baseAmt = weight * unitPrice;

        totalFreight += basic;
        totalSGST += parseFloat(row.querySelector(".sgst").innerText) || 0;
        totalCGST += parseFloat(row.querySelector(".cgst").innerText) || 0;
        totalIGST += parseFloat(row.querySelector(".igst").innerText) || 0;
        totalGST += parseFloat(row.querySelector(".totalgst").innerText) || 0;
        totalGrand += parseFloat(row.querySelector(".grandtotal").innerText) || 0;
    });

    document.getElementById("totalFreight").innerText = totalFreight.toFixed(2);
    document.getElementById("totalSGST").innerText = totalSGST.toFixed(2);
    document.getElementById("totalCGST").innerText = totalCGST.toFixed(2);
    document.getElementById("totalIGST").innerText = totalIGST.toFixed(2);
    document.getElementById("totalGST").innerText = totalGST.toFixed(2);
    document.getElementById("totalGrand").innerText = totalGrand.toFixed(2);
}


// Remove a row and recalculate totals
function removeRow(btn) {
    btn.closest("tr").remove();
    calculateTotals();
}

for (let i = 0; i < 5; i++) addRow();

function getChargesTypeList() {
    const inputs = document.querySelectorAll("#chargesBody .chargesTypeInput");
    let chargesTypeList = [];
    inputs.forEach(input => chargesTypeList.push(input.value.trim()));
    return chargesTypeList;
}

//getChargesTypeList(); when user set focus or change on chargesTypeInput
document.querySelectorAll(".chargesTypeInput").forEach(input => {
    input.addEventListener("focus", () => setTimeout(() => getChargesTypeList(), 0));
    input.addEventListener("change", () => getChargesTypeList());
});

async function saveDomesticBookingCharges(insertedID) {
    const docketNo = document.getElementById("docketNo")?.value.trim() || "";
    const rows = [...document.querySelectorAll('#chargesTable tbody tr')];

    const records = rows.map(tr => {
        // Get values directly from inputs/selects
        const getVal = (selector, fallback = "") =>
            tr.querySelector(selector)?.value.trim() || fallback;

        const getNum = (selector) =>
            parseFloat(getVal(selector, "0")) || 0;

        return {
            ChargesType: getVal(".chargesTypeInput"),
            DocketNo: docketNo,
            ID_DB: insertedID,
            HSNCode: getVal(".hsnNumber"),
            Remarks: getVal(".description"),
            TaxRate: getVal(".tax-rate", "0"),
            Quantity: getVal(".weight", "0 Nos"),
            PerQtyAmt: getNum(".unitPrice"),
            TotalAmount: getNum(".basic"),     // ✅ from basic cell
            SGSTAmt: parseFloat(tr.querySelector(".sgst")?.textContent) || 0,
            CGSTAmt: parseFloat(tr.querySelector(".cgst")?.textContent) || 0,
            IGSTAmt: parseFloat(tr.querySelector(".igst")?.textContent) || 0,
            TotalGSTAmt: parseFloat(tr.querySelector(".totalgst")?.textContent) || 0,
            GrandTotalAmt: parseFloat(tr.querySelector(".grandtotal")?.textContent) || 0,
            TaxID: getVal(".taxtype"),
            created_by: UserLoginID,
            created_at: localtimeStamp
        };
    });

    console.log("Prepared Charges Records:", records);

    try {
        // 1. Delete old charges
        const { error: deleteError } = await supabaseClient
            .from('DomesticBookingCharges')
            .delete()
            .eq('ID_DB', insertedID);

        if (deleteError) throw deleteError;

        // 2. Insert new charges
        if (records.length) {
            const { error } = await supabaseClient
                .from('DomesticBookingCharges')
                .insert(records);
            if (error) throw error;
        }

        console.log("Charges saved successfully", records);

    } catch (err) {
        console.error('Error saving booking charges:', err);
        alert('An error occurred while saving charges.');
    }
}