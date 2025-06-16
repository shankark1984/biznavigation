async function loadBookingStatus(docketNo, companyID) {
    try {
        const { data, error } = await supabaseClient
            .from('BookingStatus')
            .select('DocketNo, StatusDate, ArrivedAt, Information')
            .eq('company_id', companyID)
            .eq('DocketNo', docketNo)
            .order('StatusDate', { ascending: false });

        if (error) {
            console.error("Error loading BookingStatus:", error);
            return;
        }

        const tbody = document.querySelector('#bookingStatusTable tbody');
        tbody.innerHTML = ''; // Clear previous data

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No status updates found.</td></tr>`;
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td>${row.StatusDate ? formatDate(row.StatusDate) : ''}</td>
                    <td>${row.ArrivedAt || ''}</td>
                    <td>${row.Information || ''}</td>
                    `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Unexpected error loading booking status:", err);
    }
}



async function insertBookingStatus({ ID_IB, docketNo, statusDate, arrivedAt, information }) {
    if (!docketNo || !statusDate || !arrivedAt || !information || !ID_IB) {
        alert("All Booking Status fields are required.");
        return false;
    }

    const { error } = await supabaseClient
        .from("BookingStatus")
        .insert([{
            ID_IB: ID_IB,
            DocketNo: docketNo,
            StatusDate: statusDate,
            ArrivedAt: arrivedAt,
            Information: information,
            company_id: companyID,
            created_by: createdBy,
            created_at: localtimeStamp
        }]);

    if (error) {
        console.error("Insert error:", error);
        alert("Error saving booking status.");
        return false;
    }

    return true;
}
