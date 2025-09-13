import express from "express";
const router = express.Router();

/** GET verify (Meta calls this once when you set the webhook) */
router.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
        // you could also mark the latest session for this wsId as verified
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

/** POST receive events */
router.post("/webhook", async (req, res) => {
    // WhatsApp Cloud API will POST message statuses & messages here
    // { object: 'whatsapp_business_account', entry: [ ... ] }
    const body = req.body;
    console.log("WA EVENT >", JSON.stringify(body, null, 2));
    res.sendStatus(200);
});

export default router;
