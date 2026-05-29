const express = require('express');
const { body } = require('express-validator');
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

const createUserValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
  body('role').isIn(['ADMIN', 'MANAGER', 'MEMBER']).withMessage('role must be ADMIN, MANAGER, or MEMBER'),
];

const updateUserValidation = [
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'MEMBER']).withMessage('role must be ADMIN, MANAGER, or MEMBER'),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false'),
];

const updateMeValidation = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
];

// IMPORTANT: /me routes must come BEFORE /:id routes
// Otherwise "me" gets treated as an ID

// My profile — accessible by ALL roles
router.get('/me', authenticate, usersController.getMe);
router.put('/me', authenticate, updateMeValidation, usersController.updateMe);

// Admin only routes
router.get('/', authenticate, authorize('ADMIN'), usersController.getAllUsers);
router.post('/', authenticate, authorize('ADMIN'), createUserValidation, usersController.createUser);
router.get('/:id', authenticate, authorize('ADMIN'), usersController.getUserById);
router.put('/:id', authenticate, authorize('ADMIN'), updateUserValidation, usersController.updateUser);
router.delete('/:id', authenticate, authorize('ADMIN'), usersController.deleteUser);

module.exports = router;
