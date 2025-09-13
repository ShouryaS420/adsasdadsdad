// utils/mailer.js
import nodemailer from "nodemailer";
import dns from "node:dns";
import { env } from "../config/env.js";

// Prefer IPv4 (prevents "greeting never received" when AAAA is bad)
dns.setDefaultResultOrder?.("ipv4first");

const portNum = Number(env.SMTP_PORT);
const isPort465 = portNum === 465;

export const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,                   // e.g. smtp.hostinger.com
    port: portNum,                         // 465 or 587
    secure: isPort465,                     // IMPORTANT: true for 465, false for 587
    auth: {
        user: env.SMTP_USER,                 // full email address
        pass: env.SMTP_PASS,
    },
    // Helpful timeouts:
    connectionTimeout: 15000,              // time to establish TCP
    greetingTimeout: 10000,                // time waiting for 220 banner
    socketTimeout: 20000,                  // idle socket
    // Force IPv4 if IPv6 is unreliable on your network:
    family: 4,
    // SNI helps some providers
    tls: { servername: env.SMTP_HOST },
    // Optional for debugging:
    logger: true,
});

export async function sendOtpMail({ to, code, domain, subject, html }) {
    // Many providers require the "from" to be the authenticated mailbox or same domain
    const from = `"Business Suite" <${env.SMTP_USER}>`;

    const info = await transporter.sendMail({
        from,
        to,
        subject: subject,
        // text: `Your code is ${code}. It expires in 10 minutes.`,
        html: html,
    });

    return info;
}

// (Optional) call this once on server start to fail-fast if SMTP is unreachable
export async function verifySmtpOnce() {
    try {
        await transporter.verify();
        console.log("[SMTP] OK:", env.SMTP_HOST, env.SMTP_PORT);
    } catch (err) {
        console.error("[SMTP] VERIFY FAILED:", err);
    }
}
