// Global error-handling middleware.
//
// Express identifies error-handling middleware by the four-argument signature
// (err, req, res, next). It must be registered AFTER all routes in app.js.
//
// Any route or middleware that calls next(err) or throws in an async handler
// will land here, giving us one consistent place to format error responses.
const errorMiddleware = (err, req, res, next) => {
  // Log the full error server-side for debugging.
  console.error(`[Error] ${err.message}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    // Only expose the stack trace outside of production builds.
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

export default errorMiddleware;
