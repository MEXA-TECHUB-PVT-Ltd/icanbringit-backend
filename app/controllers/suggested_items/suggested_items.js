const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { user_id, name, created_by } = req.body;

  if (!name) {
    return res.status(404).json({
      status: false,
      message: "Name is required",
    });
  }

  if (created_by === "user") {
    if (!user_id) {
      return res.status(404).json({
        status: false,
        message: "user_id is required for creating by a user",
      });
    }
  }

  // Check if the user exists
  const userExists = await pool.query("SELECT * FROM users WHERE id = $1", [
    user_id,
  ]);
  if (userExists.rowCount === 0) {
    return res.status(404).json({
      status: false,
      message: "User not found",
    });
  }

  try {
    const insertQuery = `
      INSERT INTO suggested_items (user_id, name, created_by) 
      VALUES ($1, $2, $3)
      RETURNING *;`;

    const result = await pool.query(insertQuery, [
      user_id,
      name,
      created_by || "user",
    ]);
    res.status(201).json({
      status: true,
      message: "Suggested item created successfully",
      suggestedItem: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.update = async (req, res) => {
  const { id, name, created_by } = req.body;

  // Ensure that the ID is provided
  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "Suggested item ID is required" });
  }

  try {
    // Create the base update query
    let updateQuery = `UPDATE suggested_items SET `;
    const updateValues = [];
    let counter = 1;

    // Add name to the query if it's provided
    if (name) {
      updateQuery += `name = $${counter}, `;
      updateValues.push(name);
      counter++;
    }

    // Add created_by to the query if it's provided
    if (created_by) {
      updateQuery += `created_by = $${counter}, `;
      updateValues.push(created_by);
      counter++;
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Add the WHERE clause to update the specific suggested_item
    updateQuery += ` WHERE id = $${counter} RETURNING *;`;
    updateValues.push(id);

    // Execute the update query
    const result = await pool.query(updateQuery, updateValues);

    // Check if the suggested_item was updated
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Suggested item not found or not updated",
      });
    }

    res.status(200).json({
      status: true,
      message: "Suggested item updated successfully",
      suggestedItem: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params; // ID of the suggested_item

  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "Suggested item ID is required" });
  }

  try {
    const query = `SELECT * FROM suggested_items WHERE id = $1;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Suggested item not found" });
    }

    res.status(200).json({
      status: true,
      message: "Suggested item retrieved successfully",
      suggestedItem: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query = `SELECT * FROM suggested_items ORDER BY id LIMIT $1 OFFSET $2;`;
    const countQuery = `SELECT COUNT(*) FROM suggested_items;`;

    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      status: true,
      message: "Suggested items retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      suggestedItems: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAllAdminWithUser = async (req, res) => {
  const { user_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Check if the user exists
  const userExists = await pool.query("SELECT * FROM users WHERE id = $1", [
    user_id,
  ]);
  if (userExists.rowCount === 0) {
    return res.status(404).json({
      status: false,
      message: "User not found",
    });
  }

  try {
    const query = `
            SELECT * FROM suggested_items 
            WHERE created_by = 'admin' OR user_id = $1 
            ORDER BY id 
            LIMIT $2 OFFSET $3;
        `;
    const countQuery = `
            SELECT COUNT(*) FROM suggested_items 
            WHERE created_by = 'admin' OR user_id = $1;
        `;

    const result = await pool.query(query, [user_id, limit, offset]);
    const countResult = await pool.query(countQuery, [user_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      status: true,
      message: "Suggested items retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      suggestedItems: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params; // ID of the suggested_item to be deleted

  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "Suggested item ID is required" });
  }

  try {
    const deleteQuery = `DELETE FROM suggested_items WHERE id = $1 RETURNING *;`;
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Suggested item not found" });
    }

    res.status(200).json({
      status: true,
      message: "Suggested item deleted successfully",
      deletedItem: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const deleteQuery = `DELETE FROM suggested_items RETURNING *;`;
    const result = await pool.query(deleteQuery);

    res.status(200).json({
      status: true,
      message: "All suggested items deleted successfully",
      deletedItems: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
