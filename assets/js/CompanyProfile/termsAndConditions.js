const tcEffectiveDate = document.getElementById("tcEffectiveDate");
const tcDescription = document.getElementById("tcDescription");
const addTnCBtn = document.getElementById("addTnC");
const termsAndConditionsTable = document.getElementById("termsAndConditionsTable");

// Add Row
// ==========================================
// ADD TERMS & CONDITIONS ROW
// ==========================================
document.getElementById("addTnC").addEventListener("click", () => {

    const effectiveDate = document.getElementById("tcEffectiveDate").value;
    const description = document.getElementById("tcDescription").value.trim();

    if (!effectiveDate) {
        alert("Please select effective date");
        return;
    }

    if (!description) {
        alert("Please enter terms and conditions");
        return;
    }

    const tbody = document.getElementById("termsAndConditionsTable");

    const row = document.createElement("tr");

    // data-status = new
    row.setAttribute("data-status", "new");

    row.innerHTML = `
        <td>${formatDate(effectiveDate)}</td>
        <td>${description}</td>

        <!-- Status -->
        <td class="text-center d-none">
            <span class="badge bg-success status-badge">
                NEW
            </span>
        </td>

        <!-- Action -->
        <td class="text-center">
            <button type="button"
    class="btn btn-sm btn-outline-danger delete-row"
    disabled><i class="bi bi-trash-fill text-danger"></i></button>
            </td>
        </td>
    `;

    tbody.appendChild(row);

    // Clear Inputs
    document.getElementById("tcEffectiveDate").value = "";
    document.getElementById("tcDescription").value = "";

});

// ==========================================
// DELETE ROW
// ==========================================
document.getElementById("termsAndConditionsTable")
    .addEventListener("click", (e) => {

        if (!e.target.classList.contains("delete-row")) return;

        const row = e.target.closest("tr");
        const status = row.getAttribute("data-status");

        // If NEW row → remove directly
        if (status === "new") {

            row.remove();

        } else {

            // OLD row → mark as deleted
            row.setAttribute("data-status", "deleted");

            row.style.backgroundColor = "#ffe5e5";

            row.querySelector(".status-badge").className =
                "badge bg-danger status-badge";

            row.querySelector(".status-badge").textContent =
                "DELETED";

        }

    });

// ==========================================
// LOAD T&C WHEN TAB CLICKED
// ==========================================
document.getElementById("termsAndConditions-tab")
    .addEventListener("click", async () => {

        const companyID =
            document.getElementById("companyCode").value;

        if (!companyID) {
            return;
        }

        await loadCompanyTandCs(companyID);

    });
// ==========================================
// LOAD EXISTING TERMS & CONDITIONS
// ==========================================
async function loadCompanyTandCs(companyID) {

    const tbody = document.getElementById("termsAndConditionsTable");

    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("CompanyTandCs")
        .select("*")
        .eq("CompanyID", companyID)
        .order("EffectiveDate", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(item => {

        const row = document.createElement("tr");

        // Existing row = old
        row.setAttribute("data-status", "old");
        row.setAttribute("data-id", item.id);

        row.innerHTML = `
            <td>${formatDate(item.EffectiveDate)}</td>
            <td>${item.Description}</td>

            <!-- Status -->
            <td class="text-center d-none">
                <span class="badge bg-secondary status-badge">
                    OLD
                </span>
            </td>

            <!-- Action -->
            <td class="text-center">
                <button type="button"
    class="btn btn-sm btn-outline-danger delete-row"
    disabled><i class="bi bi-trash-fill text-danger"></i></button>
            </td>
        `;

        tbody.appendChild(row);
    });

}

// ==========================================
// SAVE TERMS & CONDITIONS
// ==========================================
async function saveCompanyTandCs() {

    try {

        const companyID = document.getElementById("companyCode").value;

        if (!companyID) {
            alert("Company ID missing");
            return;
        }

        const rows = document.querySelectorAll("#termsAndConditionsTable tr");

        // ==========================================
        // LOOP ROWS
        // ==========================================
        for (const row of rows) {

            const status = row.getAttribute("data-status");
            const rowID = row.getAttribute("data-id");

            const cells = row.querySelectorAll("td");

            let effectiveDate = cells[0]?.textContent.trim();
            const description = cells[1]?.textContent.trim();

            // Convert DD-MM-YYYY → YYYY-MM-DD
            if (effectiveDate.includes("-")) {

                const parts = effectiveDate.split("-");

                // If format is DD-MM-YYYY
                if (parts[0].length === 2) {

                    effectiveDate =
                        `${parts[2]}-${parts[1]}-${parts[0]}`;

                }

            }

            // ==========================================
            // INSERT NEW RECORD
            // ==========================================
            if (status === "new") {

                const { data, error } = await supabaseClient
                    .from("CompanyTandCs")
                    .insert([{
                        CompanyID: companyID,
                        EffectiveDate: effectiveDate,
                        Description: description,
                        created_by: UserLoginID,
                        created_at: localtimeStamp
                    }])
                    .select();

                if (error) {
                    console.error(error);
                    alert("Error inserting Terms & Conditions");
                    return;
                }

                // Mark row as OLD after save
                row.setAttribute("data-status", "old");

                // Save DB ID into row
                row.setAttribute("data-id", data[0].id);

                // Change Badge
                const badge = row.querySelector(".status-badge");

                if (badge) {
                    badge.className = "badge bg-secondary status-badge";
                    badge.textContent = "OLD";
                }

            }

            // ==========================================
            // DELETE RECORD
            // ==========================================
            if (status === "deleted" && rowID) {

                const { error } = await supabaseClient
                    .from("CompanyTandCs")
                    .delete()
                    .eq("id", rowID);

                if (error) {
                    console.error(error);
                    alert("Error deleting Terms & Conditions");
                    return;
                }

                // Remove Row from Table
                row.remove();

            }

        }

        // alert("Terms & Conditions saved successfully");

    } catch (err) {

        console.error(err);
        alert("Unexpected error while saving");

    }

}