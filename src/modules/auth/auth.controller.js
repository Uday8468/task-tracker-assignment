const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const { successResponse } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    const user = await authService.register(req.body);
    return successResponse(res, 201, 'User registered successfully', user);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    const data = await authService.login(req.body);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return successResponse(res, 200, 'Login successful', {
      accessToken: data.accessToken,
      user: data.user,
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const data = await authService.refresh(refreshToken);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: data.accessToken,
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return successResponse(res, 200, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
