const express = require('express');
const { body } = require('express-validator');
const projectsController = require('./projects.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

const createProjectValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('description').optional().isString().withMessage('description must be a string'),
];

const updateProjectValidation = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('description').optional().isString().withMessage('description must be a string'),
];

router.get('/', authenticate, projectsController.getAllProjects);
router.get('/:id', authenticate, projectsController.getProjectById);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), createProjectValidation, projectsController.createProject);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), updateProjectValidation, projectsController.updateProject);
router.delete('/:id', authenticate, authorize('ADMIN'), projectsController.deleteProject);

module.exports = router;
