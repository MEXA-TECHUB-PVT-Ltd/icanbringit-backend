const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { question_type_id, user_id, type } = req.body;

  if (!question_type_id || !user_id || !type) {
    return res.status(400).json({
      status: false,
      message: "question_type_id, user_id, and type are required.",
    });
  }

  if (type !== "event_category" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be 'event_category', 'food', or 'location'",
    });
  }

  try {
    // Check if question exists
    const questionExists = await pool.query(
      "SELECT id FROM question_types WHERE id = $1 AND type = $2",
      [question_type_id, type]
    );
    if (questionExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found",
      });
    }

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

    // Insert the response
    const insertQuery = `
      INSERT INTO question_type_responses (question_types_id, user_id, type)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const insertResult = await pool.query(insertQuery, [
      question_type_id,
      user_id,
      type,
    ]);

    if (insertResult.rowCount === 0) {
      return res.status(400).json({ 
        status: false,
        message: "Error in saving response",
      });
    }

    // Retrieve the question and the response
    const responseId = insertResult.rows[0].id;
    const retrieveQuery = `
      SELECT qt.id as question_id, qt.text as question_text, qt.type as question_type,
             qtr.id as response_id, qtr.user_id, qtr.type as response_type
      FROM question_types qt
      JOIN question_type_responses qtr ON qt.id = qtr.question_types_id
      WHERE qtr.id = $1;
    `;
    const retrieveResult = await pool.query(retrieveQuery, [responseId]);

    if (retrieveResult.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in retrieving response",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Response saved and retrieved successfully",
      questionResponse: retrieveResult.rows[0],
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
  const { response_id, question_type_id, user_id, type } = req.body;

  // Check for required fields
  if (!response_id || !question_type_id || !user_id || !type) {
    return res.status(400).json({
      status: false,
      message: "response_id, question_type_id, user_id, and type are required.",
    });
  }

  if (type !== "event_category" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be 'event_category', 'food', or 'location'",
    });
  }

  try {
    // Check if response exists
    const questionsExists = await pool.query(
      "SELECT id FROM question_types WHERE id = $1 AND type = $2",
      [question_type_id, type]
    );
    if (questionsExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found",
      });
    }
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
    const updateQuery = `
      UPDATE question_type_responses
      SET question_types_id = $1, user_id = $2, type = $4, updated_at = NOW()
      WHERE id = $3
      RETURNING id;
    `;
    const updateResult = await pool.query(updateQuery, [
      question_type_id,
      user_id,
      response_id,
      type,
    ]);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No changes made to the response",
      });
    }

    // Retrieve the updated response and question
    const retrieveQuery = `
      SELECT qt.id as question_id, qt.text as question_text, qt.type as question_type,
             qtr.id as response_id, qtr.user_id, qtr.type as response_type
      FROM question_types qt
      JOIN question_type_responses qtr ON qt.id = qtr.question_types_id
      WHERE qtr.id = $1;
    `;
    const retrieveResult = await pool.query(retrieveQuery, [response_id]);

    if (retrieveResult.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in retrieving updated response",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Response updated successfully",
      questionResponse: retrieveResult.rows[0],
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

  // Check if parameters are provided
  if (!id || !type ) {
    return res.status(400).json({
      status: false,
      message: "ID, Type,  are required.",
    });
  }

  try {
    const query = `
      SELECT qtr.id as response_id, qtr.user_id, qtr.type as response_type,
             qt.id as question_id, qt.text as question_text, qt.options as question_options, qt.type as question_type
      FROM question_type_responses qtr
      JOIN question_types qt ON qtr.question_types_id = qt.id
      WHERE qtr.id = $1 AND qtr.type = $2;
    `;

    const result = await pool.query(query, [id, type]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Response not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Response and associated question retrieved successfully",
      result: result.rows[0],
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
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Query to get responses with join
    const query = `
      SELECT qtr.*, qt.text, qt.options
      FROM question_type_responses qtr
      JOIN question_types qt ON qtr.question_types_id = qt.id
      WHERE qtr.type = $1 AND qtr.user_id = $2
      ORDER BY qtr.id
      LIMIT $3 OFFSET $4;
    `;

    // Count query for pagination with join
    const countQuery = `
      SELECT COUNT(*) 
      FROM question_type_responses qtr
      JOIN question_types qt ON qtr.question_types_id = qt.id
      WHERE qtr.type = $1 AND qtr.user_id = $2;
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
    return res.status(500).json({ status: false, message: error.message });
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
