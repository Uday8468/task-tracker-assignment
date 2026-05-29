const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  try {
    // Token comes in header as: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    // Verify signature and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request — available in all controllers
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid access token'));
    }
    next(err);
  }
};

module.exports = { authenticate };
