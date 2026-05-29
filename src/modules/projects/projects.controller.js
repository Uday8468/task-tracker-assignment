const { validationResult } = require('express-validator');
const projectsService = require('./projects.service');
const { successResponse } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

const createProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const project = await projectsService.createProject(
      req.user.organizationId,
      req.user.userId,
      req.body
    );
    return successResponse(res, 201, 'Project created successfully', project);
  } catch (err) {
    next(err);
  }
};

const getAllProjects = async (req, res, next) => {
  try {
    const data = await projectsService.getAllProjects(req.user.organizationId, req.query);
    return successResponse(res, 200, 'Projects fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await projectsService.getProjectById(req.params.id, req.user.organizationId);
    return successResponse(res, 200, 'Project fetched successfully', project);
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const project = await projectsService.updateProject(
      req.params.id,
      req.user.organizationId,
      req.body
    );
    return successResponse(res, 200, 'Project updated successfully', project);
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    await projectsService.deleteProject(req.params.id, req.user.organizationId);
    return successResponse(res, 200, 'Project deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { createProject, getAllProjects, getProjectById, updateProject, deleteProject };
