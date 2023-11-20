const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { name } = req.body;

  // Check for required fields
  if (!name) {
    return res.status(400).json({
      status: false,
      message: "name is required.",
    });
  }

  try {
    // Insert response
    const query = `
      INSERT INTO categories (name)
      VALUES ($1)
      RETURNING *;
    `;

    const result = await pool.query(query, [name]);

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
  const { category_id, name } = req.body;

  // Check for required fields
  if (!category_id || !name) {
    return res.status(400).json({
      status: false,
      message: "category_id, and name are required.",
    });
  }

  try {
    // Check if response exists
    const responseExists = await pool.query(
      "SELECT id FROM categories WHERE id = $1",
      [category_id]
    );
    if (responseExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // Update response
    const query = `
      UPDATE categories
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(query, [name, category_id]);

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
      SELECT * FROM categories
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Category retrieved successfully",
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
      SELECT * FROM categories ORDER BY id LIMIT $1 OFFSET $2;
    `;

    const countQuery = `
      SELECT COUNT(*) FROM categories;
    `;

    // Execute queries
    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Categories events found" });
    }

    return res.json({
      status: true,
      message: "Categories retrieved successfully",
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
    const query = "DELETE FROM categories WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "categories not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "categories deleted successfully",
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
    const query = "DELETE FROM categories RETURNING *";
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No categories found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All categories deleted successfully",
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
