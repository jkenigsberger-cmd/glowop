import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        const { data } = body;

        // Fetch the group linked to the submission
        let group = null;
        if (data?.group_id) {
            const groups = await base44.asServiceRole.entities.Group.filter({ id: data.group_id });
            group = groups?.[0] || null;
        }

        const groupName = group?.group_name || data?.contact_name || "קבוצה לא ידועה";
        const groupType = group?.group_type === "DAY_USE" ? "פעילות יום" : "לינה";

        // Format dates
        const arrivalDate = group?.arrival_date || data?.submitted_at?.split("T")[0] || "";
        const departureDate = group?.departure_date || "";
        let datesStr = "";
        if (arrivalDate && departureDate) {
            datesStr = `${arrivalDate} – ${departureDate}`;
        } else if (arrivalDate) {
            datesStr = arrivalDate;
        } else {
            datesStr = "תאריכים לא זמינים";
        }

        const subject = `חדש! טופס אורחים התקבל - ${groupName}`;

        const body_html = `
<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.7;">
    <p>שלום רב,</p>
    <p>שמחים לבשר שקבוצת <strong>"${groupName}"</strong> מילאה בהצלחה את טופס האורחים.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
    <p><strong>פרטי ההזמנה:</strong></p>
    <p>📅 <strong>תאריכים:</strong> ${datesStr}</p>
    <p>🏕️ <strong>סוג הקבוצה:</strong> ${groupType}</p>
    <p>👥 <strong>שם הקבוצה:</strong> ${groupName}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
    <p>הנתונים כבר מחכים לך במערכת, וניתן לגשת אליהם כדי לבצע סנכרון ועדכון של הפרטים.</p>
    <br/>
    <p>בברכה,<br/>צוות הניהול של קרן הדר וגלאו גלמפינג</p>
</div>
        `.trim();

        const recipients = ["vered@keren-hador.com", "hospitality@glow-glamping.com"];
        for (const email of recipients) {
            await base44.asServiceRole.integrations.Core.SendEmail({
                to: email,
                subject: subject,
                body: body_html,
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});