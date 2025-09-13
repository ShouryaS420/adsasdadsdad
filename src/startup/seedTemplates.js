// src/startup/seedTemplates.js
import Template from "../models/Template.js";

export async function seedTemplates(userId) {
    const exists = await Template.findOne({ userId, name: "Simple Newsletter" }).lean();
    if (exists) return;
    await Template.create({
        userId,
        name: "Simple Newsletter",
        subject: 'Hi {{ contact.firstName | default:"there" }} – {{ campaign.name }}',
        html: `
            <!doctype html><html><body style="margin:0;background:#f6f6f6;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
                <table role="presentation" width="620" style="width:620px;max-width:100%;background:#fff;border:1px solid #eee;border-radius:8px">
                <tr><td style="padding:22px 24px">
                    <h1 style="margin:0 0 10px">Hello {{ contact.firstName | default:"there" }} 👋</h1>
                    <p>You're receiving this because you signed up for updates from {{ company.name }}.</p>
                    {{#if contact.firstName}}
                    <p>Great to see you again, {{ contact.firstName }}!</p>
                    {{else}}
                    <p>Great to see you!</p>
                    {{/if}}
                    <p>Today is {{ now | date:"en-US" }}.</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:18px 0" />
                    <p style="font-size:12px;color:#6b7280">
                    Don't want these emails? <a href="{{ unsubscribe_url }}">Unsubscribe</a> ·
                    <a href="{{ manage_prefs_url }}">Manage preferences</a>
                    </p>
                </td></tr>
                </table>
            </td></tr></table>
            </body></html>
        `,
    });
}
