const successResponse = (res, statusCode, message, data = null) => {
  const response = { status: statusCode, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

const errorResponse = (res, statusCode, code, message) => {
  return res.status(statusCode).json({ status: statusCode, code, message });
};

module.exports = { successResponse, errorResponse };
