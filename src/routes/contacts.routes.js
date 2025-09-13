import { Router } from "express";
import { listContacts, createContact, importContacts } from "../controllers/contacts.controller.js";

const router = Router();

router.get("/", listContacts);
router.post("/", createContact);
router.post("/import", importContacts);

export default router;
