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

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List tasks (MEMBER sees only assigned tasks)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Tasks fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     fromCache:
 *                       type: boolean
 *                       example: true
 */
router.get('/', authenticate, tasksController.getAllTasks);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task fetched successfully
 *       403:
 *         description: MEMBER trying to view unassigned task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authenticate, tasksController.getTaskById);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, projectId]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Design Homepage
 *               description:
 *                 type: string
 *                 example: Create wireframes for homepage
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 example: HIGH
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               assigneeId:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-30T00:00:00.000Z"
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), createTaskValidation, tasksController.createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update task details
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               assigneeId:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), updateTaskValidation, tasksController.updateTask);

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Update task status with transition validation
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Valid transitions:
 *       - TODO → IN_PROGRESS, BLOCKED
 *       - IN_PROGRESS → IN_REVIEW, BLOCKED
 *       - IN_REVIEW → DONE, BLOCKED
 *       - DONE → (no transitions, final state)
 *       - BLOCKED → IN_PROGRESS
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED]
 *                 example: IN_PROGRESS
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       400:
 *         description: Invalid status transition
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: MEMBER trying to update unassigned task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/status', authenticate, updateStatusValidation, tasksController.updateTaskStatus);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       403:
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authenticate, authorize('ADMIN'), tasksController.deleteTask);

module.exports = router;
