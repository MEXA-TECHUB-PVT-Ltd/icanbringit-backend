const { pool } = require("../../config/db.config");

const getSingleRow = async (tableName, condition) => {
  const query = `SELECT * FROM ${tableName} WHERE ${condition.column} = $1`;
  const result = await pool.query(query, [condition.value]);
  return result.rows;
};
exports.getAllRows = async (tableName) => {
  const query = `SELECT * FROM ${tableName} ORDER BY ${tableName}.id`;
  const result = await pool.query(query);
  return result.rows;
};

exports.insertRow = async (tableName, data) => {
  const columns = Object.keys(data).join(", ");
  const values = Object.values(data);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

  const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows;
};
exports.updateRow = async (tableName, id, data) => {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns
    .map((col, index) => `${col} = $${index + 2}`)
    .join(", ");

  const query = `UPDATE ${tableName} SET ${placeholders} WHERE id = $1 RETURNING *`;
  const result = await pool.query(query, [id, ...values]);
  return result.rows;
};
exports.deleteRow = async (tableName, column) => {
  const query = `DELETE FROM ${tableName} WHERE ${column} = $1 RETURNING *`;
  const result = await pool.query(query, [id]);
  return result.rows;
};

exports.createType = async (req, res) => {
  try {
    const { name } = req.body;
    const createQuery =
      "INSERT INTO notification_type (name) VALUES ($1) RETURNING *";
    const result = await pool.query(createQuery, [name]);
    if (result.rowCount === 1) {
      return res.status(201).json({
        statusCode: 201,
        message: "Notification type created successfully",
        result: result.rows[0],
      });
    }
    res.status(400).json({ statusCode: 400, message: "Not created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
};

exports.updateType = async (req, res) => {
  try {
    const { name, notification_type_id } = req.body;
    const query = "SELECT * FROM notification_type WHERE id=$1";
    const oldType = await pool.query(query, [notification_type_id]);
    if (oldType.rows.length === 0) {
      return res.status(404).json({ message: "Notification type not found" });
    }
    const updateType = `UPDATE notification_type SET name=$1, "updated_at"=NOW() WHERE id=$2 RETURNING *`;
    const result = await pool.query(updateType, [name, notification_type_id]);
    if (result.rowCount === 1) {
      return res.status(200).json({
        statusCode: 200,
        message: "Notification type  updated successfully",
        result: result.rows[0],
      });
    } else {
      res
        .status(404)
        .json({ statusCode: 404, message: "Operation not successful" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getSpecificType = async (req, res) => {
  try {
    const { notification_type_id } = req.params;
    const condition = {
      column: "id",
      value: notification_type_id,
    };
    const result = await getSingleRow("notification_type", condition);
    if (result.length === 0) {
      return res
        .status(404)
        .json({ statusCode: 404, message: "Notification type not found" });
    }
    return res.status(200).json({ statusCode: 200, result: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getAllTypes = async (req, res) => {
  try {
    let page = parseInt(req.query.page || 1); // Get the page number from the query parameters
    const perPage = parseInt(req.query.limit || 5);
    const offset = (page - 1) * perPage;
    let typeQuery = `SELECT * FROM notification_type ORDER BY created_at DESC`;
    if (req.query.page === undefined && req.query.limit === undefined) {
      typeQuery = `SELECT * FROM notification_type ORDER BY created_at DESC`;
    } else {
      typeQuery += ` LIMIT $1 OFFSET $2;`;
    }
    let queryParameters = [];
    if (req.query.page !== undefined || req.query.limit !== undefined) {
      queryParameters = [perPage, offset];
    }
    const { rows } = await pool.query(typeQuery, queryParameters);
    if (req.query.page === undefined && req.query.limit === undefined) {
      // If no pagination is applied, don't calculate totalCategories and totalPages
      res.status(200).json({
        statusCode: 200,
        totalTypes: rows.length,
        result: rows,
      });
    } else {
      // Calculate the total number of categories (without pagination)
      const totalTypesQuery = `SELECT COUNT(*) AS total FROM public.notification_type`;
      const totalTypeResult = await pool.query(totalTypesQuery);
      const totalTypes = totalTypeResult.rows[0].total;
      const totalPages = Math.ceil(totalTypes / perPage);
      res.status(200).json({
        statusCode: 200,
        totalTypes,
        totalPages,
        result: rows,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ statusCode: 500, message: "Internal server error", error });
  }
};


exports.deleteType = async (req, res) => {
  const { notification_type_id } = req.params;
  try {
    const condition = {
      column: "id",
      value: notification_type_id,
    };
    const oldType = await getSingleRow("notification_type", condition);
    if (oldType.length === 0) {
      return res
        .status(404)
        .json({ statusCode: 404, message: "notification type not found " });
    }
    const delQuery =
      "DELETE FROM notification_type WHERE id=$1";
    await pool.query(delQuery, [notification_type_id]);
    res.status(200).json({
      statusCode: 200,
      message: "Notification type deleted successfully",
      result: oldType[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
};
exports.deleteAllType = async (req, res) => {
  try {
    // Perform a query to delete all users from the database
    const query = "DELETE FROM notification_type RETURNING *";
    const { rows } = await pool.query(query);
    if (rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No notification type found to delete",
      });
    }
    res.status(200).json({
      statusCode: 200,
      message: "All notification type deleted successfully",
      result: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
};
