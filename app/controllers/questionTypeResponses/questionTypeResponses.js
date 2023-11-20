const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { question_type_id, user_id, text, type } = req.body;

  // Check for required fields
  if (!question_type_id || !user_id || !text || !type) {
    return res.status(400).json({
      status: false,
      message: "question_type_id, user_id, Text, and Type are required.",
    });
  }

  if (type !== "event" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be event or food or location",
    });
  }

  try {
    // Check if question exists
    const questionExists = await pool.query(
      "SELECT id FROM question_types WHERE id = $1",
      [question_type_id]
    );
    if (questionExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found",
      });
    }
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Insert response
    const query = `
      INSERT INTO question_type_responses (question_types_id, user_id, text, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      question_type_id,
      user_id,
      text,
      type,
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
  const { response_id, question_type_id, user_id, text, type } = req.body;

  // Check for required fields
  if (!response_id || !question_type_id || !user_id || !text || !type) {
    return res.status(400).json({
      status: false,
      message:
        "response_id, question_type_id, user_id, Text, and Type are required.",
    });
  }

  if (type !== "event" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be event or food or location",
    });
  }

  try {
    // Check if response exists
    const responseExists = await pool.query(
      "SELECT id FROM question_type_responses WHERE id = $1",
      [response_id]
    );
    if (responseExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Response not found",
      });
    }

    // Update response
    const query = `
      UPDATE question_type_responses
      SET question_types_id = $1, user_id = $2, text = $3, updated_at = NOW()
      WHERE id = $4 AND type = $5
      RETURNING *;
    `;

    const result = await pool.query(query, [
      question_type_id,
      user_id,
      text,
      response_id,
      type,
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
  const { id, type } = req.params;
  const { user_id } = req.query;

  // Check if parameters are provided
  if (!id || !type || !user_id) {
    return res.status(400).json({
      status: false,
      message: "ID, Type, and User ID are required.",
    });
  }

  try {
    const query = `
      SELECT * FROM question_type_responses
      WHERE id = $1 AND type = $2 AND user_id = $3;
    `;

    const result = await pool.query(query, [id, type, user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Response not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Response retrieved successfully",
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
  const { type } = req.params;
  const { user_id } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  if (!user_id) {
    return res
      .status(400)
      .json({ status: false, message: "user_id is required" });
  }

  try {
    // Check if user exists
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Query to get responses
    const query = `
      SELECT * FROM question_type_responses
      WHERE type = $1 AND user_id = $2
      ORDER BY id
      LIMIT $3 OFFSET $4;
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) FROM question_type_responses
      WHERE type = $1 AND user_id = $2;
    `;

    // Execute queries
    const result = await pool.query(query, [type, user_id, limit, offset]);
    const countResult = await pool.query(countQuery, [type, user_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    return res.json({
      status: true,
      message: "Responses retrieved successfully",
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
  const { type, id } = req.params;

  try {
    const query =
      "DELETE FROM question_type_responses WHERE id = $1 AND type = $2 RETURNING *";
    const result = await pool.query(query, [id, type]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question type Response not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "Question type response deleted successfully",
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
  const { type, user_id } = req.params;

  try {
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }
    const query =
      "DELETE FROM question_type_responses WHERE type = $1 AND user_id = $2 RETURNING *";
    const result = await pool.query(query, [type, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No question types found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All question types deleted successfully",
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
