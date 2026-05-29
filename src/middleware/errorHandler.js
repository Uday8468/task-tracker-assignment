const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.statusCode,
      code: err.code,
      message: err.message,
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong',
  });
};

module.exports = errorHandler;
