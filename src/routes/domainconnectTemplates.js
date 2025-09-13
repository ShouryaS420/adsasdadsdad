// routes/domainconnectTemplates.js
import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();

// IMPORTANT: this host must resolve publicly over HTTPS
router.get("/.well-known/domainconnect/v2/email-auth.json", (req, res) => {
    const redirectHost = new URL(env.DC_REDIRECT_URI).host; // must be HTTPS and public
    res.json({
        "$schema": "https://domainconnect.org/schemas/v2/Template.schema.json",
        "providerId": env.DC_PROVIDER_ID,            // "magneticbyteinternettechnologiesopcpvtltd.in"
        "serviceId": env.DC_SERVICE_ID,             // "email-auth"
        "title": "Business Suite Email Authentication",
        "description": "Sets up DKIM and DMARC for sending from your domain.",
        "syncPubKeyDomain": `keys.${env.DC_PROVIDER_ID}`,
        // If you set this, redirect_uri must use this host and you technically don't need signatures.
        // GoDaddy strongly prefers HTTPS here.
        "syncRedirectDomain": redirectHost,
        "variables": [
            { "name": "selector1", "description": "DKIM selector 1" },
            { "name": "selector2", "description": "DKIM selector 2" },
            { "name": "rua", "description": "DMARC aggregate report address" }
        ],
        "records": [
            {
                "type": "CNAME",
                "host": "%selector1%._domainkey",
                "pointsTo": `%selector1%.domainkey.${env.SVC_DOMAIN}.`   // NOTE trailing dot
            },
            {
                "type": "CNAME",
                "host": "%selector2%._domainkey",
                "pointsTo": `%selector2%.domainkey.${env.SVC_DOMAIN}.`
            },
            {
                "type": "TXT",
                "host": "_dmarc",
                "value": "v=DMARC1; p=none; rua=%rua%"
            }
        ]
    });
});

export default router;
