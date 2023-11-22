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

    const result = await pool.query(query, [status, id]);

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
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const isPaginationProvided = !isNaN(page) && !isNaN(limit);
  const offset = isPaginationProvided ? (page - 1) * limit : 0;

  try {
    let query;
    if (isPaginationProvided) {
      query = `
        SELECT r.*, 
               json_build_object(
                 'id', creator.id, 
                 'name', creator.full_name, 
                 'email', creator.email
               ) as report_creator,
               json_build_object(
                 'id', block_user.id, 
                 'name', block_user.full_name, 
                 'email', block_user.email
               ) as block_user_user
        FROM block_users r
        INNER JOIN users creator ON r.block_creator_id = creator.id
        INNER JOIN users block_user ON r.block_user_id = block_user.id
        ORDER BY r.id LIMIT $1 OFFSET $2;
      `;
    } else {
      query = `
        SELECT r.*, 
               json_build_object(
                 'id', creator.id, 
                 'name', creator.full_name, 
                 'email', creator.email
               ) as report_creator,
               json_build_object(
                 'id', block_user.id, 
                 'name', block_user.full_name, 
                 'email', block_user.email
               ) as block_user_user
        FROM block_users r
        INNER JOIN users creator ON r.block_creator_id = creator.id
        INNER JOIN users block_user ON r.block_user_id = block_user.id
        ORDER BY r.id;
      `;
    }

    const result = await pool.query(
      query,
      isPaginationProvided ? [limit, offset] : []
    );

    const countQuery = `SELECT COUNT(*) FROM block_users;`;
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = isPaginationProvided ? Math.ceil(totalItems / limit) : 1;

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No block_users found" });
    }

    return res.json({
      status: true,
      message: "Block retrieved successfully",
      totalItems,
      totalPages,
      currentPage: isPaginationProvided ? page : 1,
      itemsPerPage: isPaginationProvided ? limit : totalItems,
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
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const isPaginationProvided = !isNaN(page) && !isNaN(limit);
  const offset = isPaginationProvided ? (page - 1) * limit : 0;

  try {
    let query;
    if (isPaginationProvided) {
      query = `
        SELECT bu.*, 
               json_build_object(
                 'id', u.id, 
                 'name', u.full_name, 
                 'email', u.email
               ) as blocked_user_details
        FROM block_users bu
        INNER JOIN users u ON bu.blocked_user_id = u.id
        WHERE bu.block_creator_id = $1 AND bu.status = true
        ORDER BY bu.id LIMIT $2 OFFSET $3;
      `;
    } else {
      query = `
        SELECT bu.*, 
               json_build_object(
                 'id', u.id, 
                 'name', u.full_name, 
                 'email', u.email
               ) as blocked_user_details
        FROM block_users bu
        INNER JOIN users u ON bu.block_user_id = u.id
        WHERE bu.block_creator_id = $1 AND bu.status = true
        ORDER BY bu.id;
      `;
    }

    const result = await pool.query(
      query,
      isPaginationProvided
        ? [block_creator_id, limit, offset]
        : [block_creator_id]
    );

    const countQuery = `SELECT COUNT(*) FROM block_users WHERE block_creator_id = $1;`;
    const countResult = await pool.query(countQuery, [block_creator_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = isPaginationProvided ? Math.ceil(totalItems / limit) : 1;

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Block users not found" });
    }

    return res.json({
      status: true,
      message: "Block users retrieved successfully",
      totalItems,
      totalPages,
      currentPage: isPaginationProvided ? page : 1,
      itemsPerPage: isPaginationProvided ? limit : totalItems,
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
