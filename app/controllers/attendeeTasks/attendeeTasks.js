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
      if (!items ||  items.length === 0) {
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
