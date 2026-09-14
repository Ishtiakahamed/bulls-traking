function errorHandler(err, req, res, next) {
  console.error('[API Error]', err.stack || err.message || err);
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}

module.exports = errorHandler;
