const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { report_creator_id, reported_user_id, reason, description } = req.body;

  // Check for required fields
  if (!report_creator_id || !reported_user_id || !reason) {
    return res.status(400).json({
      status: false,
      message: "report_creator_id, reported_user_id and reason are required.",
    });
  }

  const REPORT_STATUS = true;

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [reported_user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "You're reporting a user that does not exist",
      });
    }
    // Insert response
    const query = `
      INSERT INTO report (report_creator_id, reported_user_id, reason, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      report_creator_id,
      reported_user_id,
      reason,
      description,
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
  const { id, report_creator_id, reported_user_id, reason, description } =
    req.body;

  // Check for required fields
  if (!id || !report_creator_id || !reported_user_id || !reason) {
    return res.status(400).json({
      status: false,
      message: "id, report_creator_id, reported_user_id, reason, are required.",
    });
  }

  try {
    // Check if response exists
    const responseExists = await pool.query(
      "SELECT id FROM report WHERE id = $1",
      [id]
    );
    if (responseExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Report not found",
      });
    }

    // Update response
    const query = `
      UPDATE report
      SET report_creator_id = $1, reported_user_id = $2, reason = $3, description = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *;
    `;

    const result = await pool.query(query, [
      report_creator_id,
      reported_user_id,
      reason,
      description,
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
                 'id', reported.id, 
                 'name', reported.full_name, 
                 'email', reported.email
               ) as reported_user
        FROM report r
        INNER JOIN users creator ON r.report_creator_id = creator.id
        INNER JOIN users reported ON r.reported_user_id = reported.id
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
                 'id', reported.id, 
                 'name', reported.full_name, 
                 'email', reported.email
               ) as reported_user
        FROM report r
        INNER JOIN users creator ON r.report_creator_id = creator.id
        INNER JOIN users reported ON r.reported_user_id = reported.id
        ORDER BY r.id;
      `;
    }

    const result = await pool.query(
      query,
      isPaginationProvided ? [limit, offset] : []
    );

    const countQuery = `SELECT COUNT(*) FROM report;`;
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = isPaginationProvided ? Math.ceil(totalItems / limit) : 1;

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No report events found" });
    }

    return res.json({
      status: true,
      message: "Report retrieved successfully",
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
  const { report_creator_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Main query with JSON functions to structure the output
    const query = `
      SELECT json_build_object(
               'reportDetails', json_build_object(
                 'id', r.id, 'reason', r.reason, 
                 'description', r.description, 'created_at', r.created_at, 
                 'updated_at', r.updated_at
               ),
               'reportedUser', json_build_object(
                 'id', reported.id, 'name', reported.full_name, 'email', reported.email
               )
             ) as report_data
      FROM report r
      INNER JOIN users creator ON r.report_creator_id = creator.id
      INNER JOIN users reported ON r.reported_user_id = reported.id
      WHERE r.report_creator_id = $1
      ORDER BY r.id LIMIT $2 OFFSET $3;
    `;

    // Count query specific to report_creator_id
    const countQuery = `
      SELECT COUNT(*) FROM report WHERE report_creator_id = $1;
    `;

    // Execute queries
    const result = await pool.query(query, [report_creator_id, limit, offset]);
    const countResult = await pool.query(countQuery, [report_creator_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Reports not found" });
    }

    // Extracting the JSON object from each row
    const formattedResult = result.rows.map((row) => row.report_data);

    return res.json({
      status: true,
      message: "Report retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      result: formattedResult,
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
