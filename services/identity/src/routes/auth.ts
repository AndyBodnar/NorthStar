import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitAuth } from '../middleware/rateLimit';

const router = Router();

// Validation middleware
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be less than 255 characters'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Display name must be less than 255 characters'),
  body('type')
    .optional()
    .isIn(['human', 'persona', 'agent', 'group', 'system'])
    .withMessage('Invalid actor type')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const refreshValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Public routes (no authentication required)
router.post('/register', rateLimitAuth, registerValidation, AuthController.register);
router.post('/login', rateLimitAuth, loginValidation, AuthController.login);
router.post('/refresh', rateLimitAuth, refreshValidation, AuthController.refresh);

// Protected routes (authentication required)
router.post('/logout', authenticateToken, AuthController.logout);
router.post('/logout-all', authenticateToken, AuthController.logoutAll);
router.get('/me', authenticateToken, AuthController.me);
router.get('/sessions', authenticateToken, AuthController.sessions);

export default router;