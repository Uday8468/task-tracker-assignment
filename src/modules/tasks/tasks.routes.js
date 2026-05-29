const express = require('express');
const { body } = require('express-validator');
const tasksController = require('./tasks.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

const createTaskValidation = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('projectId').notEmpty().withMessage('projectId is required'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('priority must be LOW, MEDIUM, or HIGH'),
  body('assigneeId').optional().isUUID().withMessage('assigneeId must be a valid UUID'),
  body('dueDate').optional().isISO8601().withMessage('dueDate must be a valid date'),
];

const updateTaskValidation = [
  body('title').optional().trim().notEmpty().withMessage('title cannot be empty'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('priority must be LOW, MEDIUM, or HIGH'),
  body('assigneeId').optional().isUUID().withMessage('assigneeId must be a valid UUID'),
  body('dueDate').optional().isISO8601().withMessage('dueDate must be a valid date'),
];

const updateStatusValidation = [
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .withMessage('status must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or BLOCKED'),
];

// ALL roles can list and view tasks (MEMBER restriction handled in service)
router.get('/', authenticate, tasksController.getAllTasks);
router.get('/:id', authenticate, tasksController.getTaskById);

// ADMIN and MANAGER can create and update task details
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), createTaskValidation, tasksController.createTask);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), updateTaskValidation, tasksController.updateTask);

// Status change — all roles allowed (assignee check handled in service)
router.patch('/:id/status', authenticate, updateStatusValidation, tasksController.updateTaskStatus);

// Only ADMIN can delete
router.delete('/:id', authenticate, authorize('ADMIN'), tasksController.deleteTask);

module.exports = router;
