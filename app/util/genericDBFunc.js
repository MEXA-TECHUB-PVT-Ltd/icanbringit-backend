const { pool } = require("../config/db.config");

exports.userExists = async (email) => {
  const checkUserExists = await pool.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email]
  );
  return checkUserExists.rowCount > 0;
};

exports.checkUserDoesNotExist = async (email) => {
  const checkUserExists = await pool.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email]
  );
  return checkUserExists.rowCount === 0;
};


exports.sendSuccessResponse = (res, message, data, status = 200) => {
  res.status(status).json({
    status: true,
    message,
    ...data,
  });
};


exports.getPaginatedResults = async (req, tableName) => {
  // Parse page and limit, but don't set defaults immediately
  const page = parseInt(req.query.page, 10);
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : "ALL";

  // Set offset based on page and limit
  let offset;
  if (!isNaN(page) && limit !== "ALL") {
    offset = (page - 1) * limit;
  } else {
    offset = 0;
  }

  const countQuery = `SELECT COUNT(*) FROM ${tableName} WHERE role = 'user' AND deleted_at IS NULL`;
  const countResult = await pool.query(countQuery);
  const total = parseInt(countResult.rows[0].count, 10);

  let totalPages;
  if (limit !== "ALL") {
    totalPages = Math.ceil(total / limit);
  } else {
    totalPages = 1; // Only one page if no limit is set
  }

  return {
    page: isNaN(page) ? 1 : page, // Default to 1 if page is not a number
    limit,
    offset,
    total,
    totalPages,
  };
};
