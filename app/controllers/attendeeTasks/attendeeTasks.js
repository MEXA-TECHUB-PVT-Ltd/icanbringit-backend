const { pool } = require("../../config/db.config");

exports.createTasks = async (req, res) => {
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
  if (!event_id || !user_id || !type) {
    return res.status(400).json({
      status: false,
      message: "event_id, user_id,  type are required.",
    });
  }

  if (type !== "task" && type !== "items") {
    return res
      .status(400)
      .json({ status: false, message: "type must be 'items' or 'task'" });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "User not found or deactivated" });
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
      if (!text || !start_timestamp || !end_timestamp) {
        return res.status(400).json({
          status: false,
          message:
            "text and start_timestamp, end_timestamp, required for type 'task'",
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
    return res.status(400).json({
      status: false,
      message: "attendee_task_id and status are required",
    });
  }

  const VALID_STATUS = ["Pending", "Done"];

  try {
    if (VALID_STATUS.includes(status)) {
      const updateQuery =
        "UPDATE attendee_tasks SET status = $1 WHERE id = $2 RETURNING *";
      const result = await pool.query(updateQuery, [status, attendee_task_id]);
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ status: false, message: "attendee_task not found" });
      }

      return res.status(200).json({
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

exports.getAssignedTasks = async (req, res) => {
  const { user_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // First, check if the user is deactivated
    const userCheckQuery = `
      SELECT deactivate FROM users WHERE id = $1;
    `;
    const userCheckResult = await pool.query(userCheckQuery, [user_id]);
    if (userCheckResult.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }
    if (userCheckResult.rows[0].deactivate) {
      return res
        .status(403)
        .json({
          status: false,
          message: "Your account is deactivated. Access to tasks is denied.",
        });
    }

    // Query to fetch tasks assigned to the specific user
    const taskQuery = `
      SELECT at.*
      FROM attendee_tasks at
      LEFT JOIN users u ON at.user_id = u.id
      WHERE at.user_id = $1 AND u.deleted_at IS NULL
      ORDER BY at.id DESC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM attendee_tasks at
      WHERE at.user_id = $1;
    `;

    // Execute queries
    const result = await pool.query(taskQuery, [user_id, limit, offset]);
    const countResult = await pool.query(countQuery, [user_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No tasks found for this user" });
    }

    return res.json({
      status: true,
      message: "Tasks retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      tasks: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.getAllEventAttendee = async (req, res) => {
  const { event_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Add more columns from the users table as needed
    const userColumns = [
      "u.full_name",
      "u.email",
      "u.gender",
      "u.age",
      "u.block_status",
      "u.payment_status",
    ];

    // Query to get attendees of a specific event who are not deactivated
    const query = `
      SELECT a.*, ${userColumns.join(", ")}, up.file_name
      FROM attendee a
      JOIN users u ON a.attendee_id = u.id
      LEFT JOIN uploads up ON u.uploads_id = up.id
      WHERE a.event_id = $1 AND a.accepted = 'Accepted' AND u.deactivate IS FALSE
      ORDER BY a.id DESC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM attendee a
      JOIN users u ON a.attendee_id = u.id
      WHERE a.event_id = $1 AND a.accepted = 'Accepted' AND u.deactivate IS FALSE;
    `;

    // Execute queries
    const result = await pool.query(query, [event_id, limit, offset]);
    const countResult = await pool.query(countQuery, [event_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No attendees found for this event" });
    }

    return res.json({
      status: true,
      message: "Attendees retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      attendees: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message,
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
      return `(u_filtered.full_name ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    const subQuery = `
      SELECT id, email, signup_type, role, verify_email, full_name, 
             gender, age, city, country, uploads_id, location, 
             block_status, payment_status, total_events, total_attendee, 
             deleted_at, google_access_token, facebook_access_token, 
             apple_access_token, created_at, updated_at, report_status, 
             is_deleted, deactivate, device_id
      FROM users
    `;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `
        SELECT u_filtered.*, a.event_id 
        FROM (${subQuery}) AS u_filtered
        JOIN attendee a ON u_filtered.id = a.attendee_id
        WHERE (${conditions.join(" OR ")})
        ORDER BY u_filtered.id DESC
        LIMIT $${conditions.length + 1} OFFSET $${conditions.length + 2}
      `;
      values.push(limit, offset);
    } else {
      query = `
        SELECT u_filtered.*, a.event_id 
        FROM (${subQuery}) AS u_filtered
        JOIN attendee a ON u_filtered.id = a.attendee_id
        WHERE (${conditions.join(" OR ")})
        ORDER BY u_filtered.id DESC
      `;
    }

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(200).json({
        status: true,
        message: "No result found",
        count: 0,
        result: [],
      });
    }

    res.json({
      status: true,
      message: "Attendees retrieved successfully!",
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
