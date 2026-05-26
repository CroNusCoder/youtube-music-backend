'use strict';

/**
 * Standardized error response wrapper.
 * All API errors go through here to ensure a consistent JSON shape.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.expose ? err.message : (statusCode === 500 ? 'Internal server error' : err.message);

  res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
  });
}

/**
 * Wrap an async route handler to catch promise rejections.
 * @param {Function} fn — async (req, res, next) => { ... }
 * @returns {Function}
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create an HTTP error with a status code.
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
function createHttpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  err.expose = true;
  return err;
}

module.exports = { errorHandler, asyncHandler, createHttpError };
