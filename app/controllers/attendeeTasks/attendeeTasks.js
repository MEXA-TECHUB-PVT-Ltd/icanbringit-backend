const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const {
    event_id,
    user_id,
    text,
    items,
    start_timestamp,
    end_timestamp,
    type,
  } = req.body;

  // Check for required fields
  if (!event_id || !user_id || !start_timestamp || !end_timestamp || !type) {
    return res.status(400).json({
      status: false,
      message:
        "event_id, user_id, start_timestamp, end_timestamp, type are required.",
    });
  }

  if (type !== "task" && type !== "items") {
    return res
      .status(400)
      .json({ status: false, message: "type must be 'items' or 'task'" });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const checkEvent = await pool.query("SELECT 1 FROM events WHERE id = $1", [
      event_id,
    ]);
    if (checkEvent.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found" });
    }

    let queryText;
    let queryValues;

    if (type === "task") {
      if (!text) {
        return res.status(400).json({
          status: false,
          message: "text required for type 'task'",
        });
      }
      queryText = `
        INSERT INTO attendee_tasks (event_id, user_id, text, start_timestamp, end_timestamp, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      queryValues = [
        event_id,
        user_id,
        text,
        start_timestamp,
        end_timestamp,
        type,
      ];
    } else {
      if (!items || items.length === 0) {
        return res.status(400).json({
          status: false,
          message: "items array required for type 'items'",
        });
      }

      queryText = `
        INSERT INTO attendee_tasks (event_id, user_id, items, start_timestamp, end_timestamp, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      queryValues = [
        event_id,
        user_id,
        items,
        start_timestamp,
        end_timestamp,
        type,
      ];
    }

    const result = await pool.query(queryText, queryValues);

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

exports.updateStatus = async (req, res) => {
  const { attendee_task_id, status } = req.body;
  if (!attendee_task_id || !status) {
    return res
      .status(400)
      .json({
        status: false,
        message: "attendee_task_id and status are required",
      });
  }

  const VALID_STATUS = ["Pending", "Done"];

  try {
    if (VALID_STATUS.includes(status)) {
      const updateQuery = "UPDATE attendee_tasks SET status = $1 WHERE id = $2 RETURNING *";
      const result = await pool.query(updateQuery, [status, attendee_task_id]);
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ status: false, message: "attendee_task not found" });
      }

      return res
        .status(200)
        .json({
          status: true,
          message: "attendee_task status updated successfully!",
          result: result.rows[0],
        });
    } else {
      return res.status(400).json({ status: false, message: "Invalid status" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};



exports.search = async (req, res) => {
  const { name } = req.params;
  let { page, limit } = req.query;

  if (!name) {
    return res.status(400).json({
      status: false,
      message: "name is required",
    });
  }

  try {
    const searchWords = name.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) {
      return res
        .status(200)
        .json({ status: false, message: "No search words provided" });
    }

    const conditions = searchWords.map((word, index) => {
      return `(full_name ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `SELECT * FROM users WHERE role = 'user' AND (${conditions.join(
        " OR "
      )}) ORDER BY id DESC LIMIT $${conditions.length + 1} OFFSET $${
        conditions.length + 2
      }`;
      values.push(limit, offset);
    } else {
      query = `SELECT * FROM users WHERE role = 'user' AND (${conditions.join(
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
      message: "User retrieved successfully!",
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
