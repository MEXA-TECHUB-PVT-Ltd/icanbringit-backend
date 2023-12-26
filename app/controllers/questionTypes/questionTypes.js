const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { type, text } = req.body;

  // Check for required fields
  if (!type || !text) {
    return res.status(400).json({
      status: false,
      message: "Type, and text are required.",
    });
  }
  if (type !== "event_category" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be event_category, location and food",
    });
  }

  try {
    const query = `
      INSERT INTO question_types ( text, type)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await pool.query(query, [ text, type]);

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
  const { id,  text, type } = req.body;

  // Check for required fields
  if (!id || !text || !type) {
    return res.status(400).json({
      status: false,
      message: "ID, Type, and text are required.",
    });
  }

  if (type !== "event_category" && type !== "food" && type !== "location") {
    return res.status(400).json({
      status: false,
      message: "Type must be 'event_category', 'location' and 'food'",
    });
  }

  try {
    const query = `
      UPDATE question_types
      SET  text = $1, type = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;

    const result = await pool.query(query, [ text, type, id]);

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
  let page = parseInt(req.query.page);
  let limit = parseInt(req.query.limit);
  const sortColumn = req.query.sortColumn || "id"; // Default to 'id' if not provided
  const sortOrder = req.query.order === "desc" ? "DESC" : "ASC"; // Default sort order

  try {
    let query, countQuery, result, totalItems, totalPages;

    if (page && limit) {
      const offset = (page - 1) * limit;
      query = `
        SELECT * FROM question_types 
        ORDER BY ${sortColumn} ${sortOrder} 
        LIMIT $1 OFFSET $2`;
      countQuery = "SELECT COUNT(*) FROM question_types";

      result = await pool.query(query, [limit, offset]);
      const countResult = await pool.query(countQuery);

      totalItems = parseInt(countResult.rows[0].count);
      totalPages = Math.ceil(totalItems / limit);
    } else {
      query = `SELECT * FROM question_types ORDER BY ${sortColumn} ${sortOrder}`;
      result = await pool.query(query);

      totalItems = result.rowCount;
      totalPages = 1;
      page = 1;
      limit = totalItems;
    }

    console.log("Query executed:", query); // Debugging

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

exports.getAllByType = async (req, res) => {
  const { type } = req.params;
  let page = parseInt(req.query.page);
  let limit = parseInt(req.query.limit);
  const sortColumn = req.query.sortColumn;
  const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC"; // Default sort order

  try {
    let query, countQuery, result, totalItems, totalPages;

    if (page && limit) {
      // Pagination is provided
      const offset = (page - 1) * limit;
      query = `
        SELECT * FROM question_types 
        WHERE type = $1 
        ${sortColumn ? `ORDER BY ${sortColumn} ${sortOrder}` : ""} 
        LIMIT $2 OFFSET $3`;
      countQuery = "SELECT COUNT(*) FROM question_types WHERE type = $1";

      // Execute queries
      result = await pool.query(query, [type, limit, offset]);
      const countResult = await pool.query(countQuery, [type]);

      totalItems = parseInt(countResult.rows[0].count);
      totalPages = Math.ceil(totalItems / limit);
    } else {
      // No pagination, fetch all
      query = `SELECT * FROM question_types WHERE type = $1 ${
        sortColumn ? `ORDER BY ${sortColumn} ${sortOrder}` : ""
      }`;
      result = await pool.query(query, [type]);

      totalItems = result.rowCount;
      totalPages = 1;
      page = 1;
      limit = totalItems;
    }

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
