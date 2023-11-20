const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { type, text, options } = req.body;

  // Check for required fields
  if (!type || !text || options.length === 0) {
    return res.status(400).json({
      status: false,
      message: "Type, Text and options are required.",
    });
  }
  if (type !== "event" && type !== "food") {
    return res.status(400).json({
      status: false,
      message: "Type must be event and food",
    });
  }

  try {
    const query = `
      INSERT INTO question_types (text, options, type)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const result = await pool.query(query, [text, options || [], type]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in adding questions type",
      });
    }

    return res.status(201).json({
      status: true,
      message: `${type} added successfully`,
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


exports.update = async (req, res) => {
  const { id, text, options, type } = req.body;

  // Check for required fields
  if (!id || !text || !options || !type) {
    return res.status(400).json({
      status: false,
      message: "ID, Type, Text, and Options are required.",
    });
  }

  if (type !== "event" && type !== "food") {
    return res.status(400).json({
      status: false,
      message: "Type must be 'event' or 'food'",
    });
  }

  try {
    const query = `
      UPDATE question_types
      SET text = $1, options = $2, type = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;

    const result = await pool.query(query, [text, options, type, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question type not found or no changes made",
      });
    }

    return res.status(200).json({
      status: true,
      message: `Question type updated successfully`,
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

exports.get= async (req, res) => {
  const { type, id } = req.params;

  try {
    const query = "SELECT * FROM question_types WHERE type = $1 AND id = $2";

    // Execute query
    const result = await pool.query(query, [type, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found",
      });
    }

    return res.json({
      status: true,
      message: "Question retrieved successfully",
      question: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};



exports.getAll = async (req, res) => {
  const { type } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query =
      "SELECT * FROM question_types WHERE type = $1 ORDER BY id LIMIT $2 OFFSET $3";
    const countQuery = "SELECT COUNT(*) FROM question_types WHERE type = $1";

    // Execute queries
    const result = await pool.query(query, [type, limit, offset]);
    const countResult = await pool.query(countQuery, [type]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    return res.json({
      status: true,
      message: "Event types retrieved successfully",
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
    const query = "DELETE FROM question_types WHERE id = $1 AND type = $2 RETURNING *";
    const result = await pool.query(query, [id, type]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question type not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "Question type deleted successfully",
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
  const { type } = req.params;
  try {
    const query = "DELETE FROM question_types WHERE type = $1 RETURNING *";
    const result = await pool.query(query, [type]);

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
