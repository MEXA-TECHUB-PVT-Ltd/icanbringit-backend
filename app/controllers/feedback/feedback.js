const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { user_id, comment } = req.body;

  if (!user_id || !comment) {
    return res.status(400).json({
      status: false,
      message: "User ID and comment are required.",
    });
  }

  try {
    const userIdExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );

    if (userIdExists.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid user_id provided.",
      });
    }
    const query = `
      INSERT INTO feedback (user_id, comment)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await pool.query(query, [user_id, comment]);

    if (result.rowCount < 1) {
      return res.status(500).json({
        status: false,
        message: "Error while inserting feedback.",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Feedback added successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.update = async (req, res) => {
  const { id, user_id, comment } = req.body;

  if (!id || !comment || !user_id) {
    return res.status(400).json({
      status: false,
      message: "id, user_id, and comment are required.",
    });
  }

  try {
    // Check if the user exists
    const userExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );
    if (userExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    // Check if the feedback with the specified id exists and belongs to the user
    const feedbackExists = await pool.query(
      "SELECT id FROM feedback WHERE id = $1 AND user_id = $2",
      [id, user_id]
    );
    if (feedbackExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Feedback not found or not owned by the user.",
      });
    }

    const query = `
      UPDATE feedback
      SET comment = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, user_id, comment]);

    return res.status(200).json({
      status: true,
      message: "Feedback updated successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
exports.getAll = async (req, res) => {
  let { limit = 10, page = 1 } = req.query;

  limit = parseInt(limit);
  page = parseInt(page);
  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      status: false,
      message: "Invalid limit or page. Please provide positive integer values.",
    });
  }

  try {
    const offset = (page - 1) * limit;

    // Updated query with JOIN and JSON function
    const query = `
      SELECT f.id, f.comment, f.created_at, f.updated_at,
             json_build_object(
               'id', u.id,
               'name', u.full_name,
               'email', u.email
             ) as user
      FROM feedback f
      INNER JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    // Calculate total number of feedback
    const totalFeedbackCount = parseInt(
      (await pool.query("SELECT COUNT(*) FROM feedback")).rows[0].count
    );
    const totalPages = Math.ceil(totalFeedbackCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No feedback found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback retrieved successfully.",
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalFeedbackCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required.",
    });
  }

  try {
    const query = `SELECT * FROM feedback WHERE id = $1 ORDER BY created_at DESC;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No feedback found for the provided user.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback retrieved successfully.",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id are required.",
    });
  }

  try {
    const query = `DELETE FROM feedback WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No feedback found for the provided user and feature ID.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback deleted successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const query = `DELETE FROM feedback RETURNING *`;
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "There are no feedbacks available to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All feedback entries deleted successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.search = async (req, res) => {
  const { query: search } = req.params;
  let { page, limit } = req.query;

  if (!search) {
    return res.status(400).json({
      status: false,
      message: "search is required",
    });
  }

  try {
    const searchWords = search.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) {
      return res
        .status(200)
        .json({ status: false, message: "No search words provided" });
    }

    const conditions = searchWords.map((word, index) => {
      return `(comment ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `SELECT * FROM feedback WHERE (${conditions.join(
        " OR "
      )}) ORDER BY id DESC LIMIT $${conditions.length + 1} OFFSET $${
        conditions.length + 2
      }`;
      values.push(limit, offset);
    } else {
      query = `SELECT * FROM feedback WHERE (${conditions.join(
        " OR "
      )}) ORDER BY id DESC`;
    }

    const result = await pool.query(query, values);

    if (result.rowCount < 1) {
      return res.status(200).json({
        status: true,
        message: "No result found",
        count: 0,
        result: [],
      });
    }

    res.json({
      status: true,
      message: "Event retrieved successfully!",
      count: result.rowCount,
      result: result.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
