const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { block_creator_id, block_user_id, status } = req.body;
  // Check for required fields
  if (!block_creator_id || !block_user_id || status === null) {
    return res.status(400).json({
      status: false,
      message: "block_creator_id, block_user_id and status are required.",
    });
  }


  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [block_user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "You're blocking a user that does not exist",
      });
    }
    // Insert response
    const query = `
      INSERT INTO block_users (block_creator_id, block_user_id, status)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      block_creator_id,
      block_user_id,
      status,
    ]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in saving response",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Response saved successfully",
      response: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.update = async (req, res) => {
  const { id, status } = req.body;

  // Check for required fields
  if (!id || status === null) {
    return res.status(400).json({
      status: false,
      message: "id, status, are required.",
    });
  }

  try {
    // Check if response exists
    const responseExists = await pool.query(
      "SELECT id FROM block_users WHERE id = $1",
      [id]
    );
    if (responseExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Block User not found",
      });
    }

    // Update response
    const query = `
      UPDATE block_users
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(query, [
      status,
      id,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No changes made to the response",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Response updated successfully",
      response: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params;

  // Check if parameters are provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id is required.",
    });
  }

  try {
    const query = `
      SELECT * FROM report
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Report retrieved successfully",
      response: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Query to get responses
    const query = `
      SELECT * FROM report ORDER BY id LIMIT $1 OFFSET $2;
    `;

    const countQuery = `
      SELECT COUNT(*) FROM report;
    `;

    // Execute queries
    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "report events found" });
    }

    return res.json({
      status: true,
      message: "report retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.getAllByUser = async (req, res) => {
  const { block_creator_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query = `
      SELECT * FROM block_users WHERE block_creator_id = $1 AND status = true ORDER BY id LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) FROM block_users;
    `;

    const result = await pool.query(query, [block_creator_id, limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "block users not found" });
    }

    return res.json({
      status: true,
      message: "block users retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    const query = "DELETE FROM report WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "report not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "report deleted successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const query = "DELETE FROM report RETURNING *";
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No report found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All report deleted successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAllByUser = async (req, res) => {
  const { report_creator_id } = req.params;

  try {
    const query = "DELETE FROM report WHERE report_creator_id = $1 RETURNING *";
    const result = await pool.query(query, [report_creator_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No report found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All report deleted successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
