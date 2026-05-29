const express = require('express');
const { body } = require('express-validator');
const authController = require('./auth.controller');

const router = express.Router();

// Validation rules for register
const registerValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
  body('role').isIn(['ADMIN', 'MANAGER', 'MEMBER']).withMessage('role must be ADMIN, MANAGER, or MEMBER'),
];

// Validation rules for login
const loginValidation = [
  body('email').isEmail().withMessage('valid email is required'),
  body('password').notEmpty().withMessage('password is required'),
];

// Routes
// /refresh and /logout read refreshToken from httpOnly cookie automatically
// No body needed for refresh and logout
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
