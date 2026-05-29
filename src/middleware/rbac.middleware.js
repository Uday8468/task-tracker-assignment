const { ForbiddenError } = require('../utils/errors');

// Usage: authorize('ADMIN', 'MANAGER')
// Means: only ADMIN and MANAGER can access this route
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`));
    }
    next();
  };
};

module.exports = { authorize };
