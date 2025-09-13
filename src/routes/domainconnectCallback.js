// routes/domainconnect.js
import express from "express";
const router = express.Router();

// The DNS provider will redirect here after the user completes the flow.
// You won't always get a "success" flag — best practice is to re-check DNS on return.
router.get("/callback", async (req, res) => {
    // optional: read state you put in the apply URL
    const { state, domain, providerId, serviceId } = req.query;

    // Respond with a tiny page that tells the opener to refresh DNS status
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
<!doctype html><meta charset="utf-8">
<title>Connected</title>
<style>body{font:14px system-ui;margin:24px;color:#111}</style>
<h2>Domain Connect complete</h2>
<p>You can return to the app. We’ll re-check your DNS records now.</p>
<script>
  try {
    if (window.opener && window.opener.postMessage) {
      window.opener.postMessage({type:"dc-complete", state:${JSON.stringify(state || "")}}, "*");
    }
  } catch(e){}
  setTimeout(() => window.close(), 1200);
</script>`);
});

export default router;
