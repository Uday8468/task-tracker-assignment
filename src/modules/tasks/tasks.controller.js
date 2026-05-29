const { validationResult } = require('express-validator');
const tasksService = require('./tasks.service');
const { successResponse } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

const createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const task = await tasksService.createTask(
      req.user.organizationId,
      req.user.userId,
      req.body
    );
    return successResponse(res, 201, 'Task created successfully', task);
  } catch (err) {
    next(err);
  }
};

const getAllTasks = async (req, res, next) => {
  try {
    const data = await tasksService.getAllTasks(
      req.user.organizationId,
      req.user.userId,
      req.user.role,
      req.query
    );
    return successResponse(res, 200, 'Tasks fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await tasksService.getTaskById(
      req.params.id,
      req.user.organizationId,
      req.user.userId,
      req.user.role
    );
    return successResponse(res, 200, 'Task fetched successfully', task);
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const task = await tasksService.updateTask(
      req.params.id,
      req.user.organizationId,
      req.body
    );
    return successResponse(res, 200, 'Task updated successfully', task);
  } catch (err) {
    next(err);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const task = await tasksService.updateTaskStatus(
      req.params.id,
      req.user.organizationId,
      req.user.userId,
      req.user.role,
      req.body.status
    );
    return successResponse(res, 200, 'Task status updated successfully', task);
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    await tasksService.deleteTask(req.params.id, req.user.organizationId);
    return successResponse(res, 200, 'Task deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { createTask, getAllTasks, getTaskById, updateTask, updateTaskStatus, deleteTask };
