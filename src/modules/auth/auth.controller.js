const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const { successResponse } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

// Cookie settings — same settings used in login, refresh, logout
const COOKIE_OPTIONS = {
  httpOnly: true,      // JavaScript cannot read this cookie
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',  // Cookie not sent on cross-site requests (CSRF protection)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
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

    // Set refresh token as httpOnly cookie
    // Client cannot read this via JavaScript — completely hidden
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);

    // Only send accessToken and user info in response body
    // refreshToken is NOT in the response body
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
    // Read refresh token from cookie (not from request body)
    // Browser sends this cookie automatically — user cannot see or control it
    const refreshToken = req.cookies.refreshToken;

    const data = await authService.refresh(refreshToken);

    // Set new refresh token cookie (true rotation — old one was deleted in service)
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);

    // Only send new access token in response body
    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: data.accessToken,
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // Read refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    // Delete from DB (even if cookie is missing, clear cookie anyway)
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Clear the cookie from browser
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return successResponse(res, 200, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
