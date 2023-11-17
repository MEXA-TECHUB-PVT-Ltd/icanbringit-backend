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
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM ${tableName} WHERE deleted_at IS NULL`
  );
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    offset,
    total,
    totalPages,
  };
};
