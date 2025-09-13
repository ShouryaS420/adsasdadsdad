import { Router } from "express";
import { getOrCreateDefaultList } from "../controllers/lists.controller.js";

const router = Router();
router.get("/default", getOrCreateDefaultList);

export default router;
