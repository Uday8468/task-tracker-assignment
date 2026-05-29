const { validationResult } = require('express-validator');
const usersService = require('./users.service');
const { successResponse } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

const getAllUsers = async (req, res, next) => {
  try {
    const data = await usersService.getAllUsers(req.user.organizationId, req.query);
    return successResponse(res, 200, 'Users fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id, req.user.organizationId);
    return successResponse(res, 200, 'User fetched successfully', user);
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const user = await usersService.createUser(req.user.organizationId, req.body);
    return successResponse(res, 201, 'User created successfully', user);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const user = await usersService.updateUser(
      req.params.id,
      req.user.organizationId,
      req.user.userId,
      req.body
    );
    return successResponse(res, 200, 'User updated successfully', user);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await usersService.deleteUser(req.params.id, req.user.organizationId, req.user.userId);
    return successResponse(res, 200, 'User deactivated successfully');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await usersService.getMe(req.user.userId);
    return successResponse(res, 200, 'Profile fetched successfully', user);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const user = await usersService.updateMe(req.user.userId, req.body);
    return successResponse(res, 200, 'Profile updated successfully', user);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, getMe, updateMe };
