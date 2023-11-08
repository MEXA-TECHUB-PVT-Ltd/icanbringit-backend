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
