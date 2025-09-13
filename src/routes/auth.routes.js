import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { validateRegister, register, validateLogin, login, me, refresh, logout } from '../controllers/auth.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(cookieParser());

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', requireAuth, me);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
