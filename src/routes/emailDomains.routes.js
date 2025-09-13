import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
    listDomains, createAndSendOtp, resendOtp, verifyOtp,
    startAuth,
    recheckDns,
    disconnectDomain,
    setProvider,
    listDomainEmailsApi
} from "../controllers/emailDomains.controller.js";

const r = Router();

r.use(requireAuth);

// domains
r.get("/", listDomains);
r.post("/", createAndSendOtp);
r.post("/:id/otp/resend", resendOtp);
r.post("/:id/otp/verify", verifyOtp);
r.post("/:id/start-auth", startAuth);

r.post("/:id/provider", setProvider);     // <-- NEW
r.post("/:id/start-auth", rewrap(startAuth));
r.post("/:id/recheck-dns", rewrap(recheckDns));
r.post("/:id/disconnect", rewrap(disconnectDomain));

// NEW: domain emails (senders) listing
r.get("/domain-emails", listDomainEmailsApi);

export default r;

// optional tiny wrapper so thrown errors hit your error middleware
function rewrap(fn){ return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }