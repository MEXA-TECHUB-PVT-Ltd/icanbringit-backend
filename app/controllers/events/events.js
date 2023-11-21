const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const {
    user_id,
    title,
    category,
    cover_photo_id,
    start_timestamp,
    end_timestamp,
    event_type,
    virtual_link,
    location,
    event_details,
    no_guests,
    privacy,
    suggested_items,
  } = req.body;

  try {
    // Check if the user exists
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }
    const uploadCover = await pool.query(
      "SELECT 1 FROM uploads WHERE id = $1",
      [cover_photo_id]
    );
    if (uploadCover.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Image not found",
      });
    }

    const query = {
      text: `INSERT INTO events (user_id, title, category, cover_photo_id, 
                     start_timestamp, end_timestamp, event_type, 
                     virtual_link, location, event_details, no_guests, privacy, 
                     suggested_items) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                     RETURNING *`,
      values: [
        user_id,
        title,
        category,
        cover_photo_id,
        start_timestamp, // UTC format
        end_timestamp, // UTC format
        event_type,
        virtual_link,
        location,
        event_details,
        no_guests,
        privacy,
        suggested_items,
      ],
    };

    const result = await pool.query(query);

    res.status(201).json({
      status: true,
      message: "Event created successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.update = async (req, res) => {
  const {
    event_id,
    user_id,
    title,
    category,
    cover_photo_id,
    start_timestamp,
    end_timestamp,
    event_type,
    virtual_link,
    location,
    event_details,
    no_guests,
    privacy,
    suggested_items,
  } = req.body;

  if (!event_id || !user_id) {
    return res
      .status(400)
      .json({ status: false, message: "event_id and user_id are required" });
  }

  try {
    // Check if the user exists
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Check if the event exists
    const eventExists = await pool.query(
      "SELECT 1 FROM events WHERE id = $1 AND user_id = $2",
      [event_id, user_id]
    );
    if (eventExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found with this user" });
    }

    // Building the query dynamically based on provided fields
    let query = "UPDATE events SET ";
    const fieldsToUpdate = [];
    let valueCount = 1;
    const values = [];

    if (title) {
      fieldsToUpdate.push(`title = $${valueCount++}`);
      values.push(title);
    }
    if (category) {
      fieldsToUpdate.push(`category = $${valueCount++}`);
      values.push(category);
    }
    if (cover_photo_id) {
      fieldsToUpdate.push(`cover_photo_id = $${valueCount++}`);
      values.push(cover_photo_id);
    }
    if (start_timestamp) {
      fieldsToUpdate.push(`start_timestamp = $${valueCount++}`);
      values.push(start_timestamp);
    }
    if (end_timestamp) {
      fieldsToUpdate.push(`end_timestamp = $${valueCount++}`);
      values.push(end_timestamp);
    }
    if (event_type) {
      fieldsToUpdate.push(`event_type = $${valueCount++}`);
      values.push(event_type);
    }
    if (virtual_link) {
      fieldsToUpdate.push(`virtual_link = $${valueCount++}`);
      values.push(virtual_link);
    }
    if (location) {
      fieldsToUpdate.push(`location = $${valueCount++}`);
      values.push(location);
    }
    if (event_details) {
      fieldsToUpdate.push(`event_details = $${valueCount++}`);
      values.push(event_details);
    }
    if (no_guests) {
      fieldsToUpdate.push(`no_guests = $${valueCount++}`);
      values.push(no_guests);
    }
    if (privacy) {
      fieldsToUpdate.push(`privacy = $${valueCount++}`);
      values.push(privacy);
    }
    if (suggested_items) {
      fieldsToUpdate.push(`suggested_items = $${valueCount++}`);
      values.push(suggested_items);
    }

    // If no fields to update, return an error
    if (fieldsToUpdate.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No fields to update" });
    }

    query += fieldsToUpdate.join(", ") + ` WHERE id = $${valueCount}`;
    values.push(event_id);

    // Execute the query
    await pool.query(query, values);
    const result = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);

    res.status(200).json({
      status: true,
      message: "Event updated successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.get = async (req, res) => {
  const { id, user_id } = req.params;

  // Check if parameters are provided
  if (!id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "id and user_id is required.",
    });
  }

  try {
    const query = `
      SELECT * FROM events
      WHERE id = $1 AND user_id = $2;
    `;

    const result = await pool.query(query, [id, user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event retrieved successfully",
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
  const { user_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Query to get responses
    const query = `
      SELECT * FROM events WHERE user_id = $1 ORDER BY id LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) FROM events;
    `;

    // Execute queries
    const result = await pool.query(query, [user_id, limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No events found" });
    }
    return res.json({
      status: true,
      message: "Event retrieved successfully",
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

exports.getAllByCategory = async (req, res) => {
  const { category } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Query to get responses
    const query = `
      SELECT * FROM events WHERE category = $1 ORDER BY id LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) FROM events WHERE category = $1;
    `;

    // Execute queries
    const result = await pool.query(query, [category, limit, offset]);
    const countResult = await pool.query(countQuery, [category]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No events found" });
    }
    return res.json({
      status: true,
      message: "Event retrieved successfully",
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
  const { id, user_id } = req.params;

  // Check if parameters are provided
  if (!id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "id and user_id is required.",
    });
  }

  try {
    const query = `
      DELETE FROM events
      WHERE id = $1 AND user_id = $2 RETURNING *;
    `;

    const result = await pool.query(query, [id, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event deleted successfully",
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

exports.deleteAll = async (req, res) => {
  const { user_id } = req.params;
  try {
    const query = "DELETE FROM events WHERE user_id = $1 RETURNING *";
    const result = await pool.query(query, [user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No events found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All events deleted successfully",
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

exports.search = async (req, res) => {
  const { title } = req.params;
  let { page, limit } = req.query;

  if (!title) {
    return res.status(400).json({
      status: false,
      message: "title is required",
    });
  }

  try {
    const searchWords = title.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) {
      return res
        .status(200)
        .json({ status: false, message: "No search words provided" });
    }

    const conditions = searchWords.map((word, index) => {
      return `(title ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `SELECT * FROM events WHERE (${conditions.join(
        " OR "
      )}) ORDER BY id DESC LIMIT $${conditions.length + 1} OFFSET $${
        conditions.length + 2
      }`;
      values.push(limit, offset);
    } else {
      query = `SELECT * FROM events WHERE (${conditions.join(
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
      message: "Event retrieved successfully!",
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

exports.filterEvents = async (req, res) => {
  const {
    user_id,
    title,
    category,
    cover_photo_id,
    start_timestamp,
    end_timestamp,
    event_type,
    virtual_link,
    location, // Handling as a text search for simplicity
    event_details,
    no_guests,
    privacy,
    suggested_items, // Handling as a single string for simplicity
    page = 1,
    limit = 10,
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    let baseQuery = "FROM events WHERE 1 = 1";
    const values = [];
    let valueCount = 1;

    if (user_id) {
      baseQuery += ` AND user_id = $${valueCount++}`;
      values.push(user_id);
    }
    if (title) {
      baseQuery += ` AND title ILIKE $${valueCount++}`;
      values.push(`%${title}%`);
    }
    if (category) {
      baseQuery += ` AND category = $${valueCount++}`;
      values.push(category);
    }
    if (cover_photo_id) {
      baseQuery += ` AND cover_photo_id = $${valueCount++}`;
      values.push(cover_photo_id);
    }
    if (start_timestamp) {
      baseQuery += ` AND start_timestamp >= $${valueCount++}`;
      values.push(new Date(start_timestamp).toISOString());
    }
    if (end_timestamp) {
      baseQuery += ` AND end_timestamp <= $${valueCount++}`;
      values.push(new Date(end_timestamp).toISOString());
    }
    if (event_type) {
      baseQuery += ` AND event_type = $${valueCount++}`;
      values.push(event_type);
    }
    if (virtual_link) {
      baseQuery += ` AND virtual_link = $${valueCount++}`;
      values.push(virtual_link);
    }
    if (location) {
      baseQuery += ` AND location::text ILIKE $${valueCount++}`; // example for text-based filtering
      values.push(`%${location}%`);
    }
    if (event_details) {
      baseQuery += ` AND event_details ILIKE $${valueCount++}`;
      values.push(`%${event_details}%`);
    }
    if (no_guests) {
      baseQuery += ` AND no_guests = $${valueCount++}`;
      values.push(no_guests);
    }
    if (privacy) {
      baseQuery += ` AND privacy = $${valueCount++}`;
      values.push(privacy);
    }
    if (suggested_items) {
      baseQuery += ` AND $${valueCount++} = ANY(suggested_items)`;
      values.push(suggested_items);
    }

    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Add LIMIT and OFFSET to the main query
    let query = `SELECT * ${baseQuery} LIMIT $${valueCount++} OFFSET $${valueCount}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    res.status(200).json({
      status: true,
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page, 10),
      result: result.rows,
    });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAllEventsWithDetails = async (req, res) => {
  try {
    // Validation for page and limit
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Query to get the total count of events
    const countResult = await pool.query("SELECT COUNT(*) FROM events");
    const total = parseInt(countResult.rows[0].count, 10);

    // Query to get paginated events
    const paginatedEventsQuery = `
      SELECT 
        events.*, 
        json_agg(
          json_build_object(
            'task', attendee_tasks.text, 
            'items', attendee_tasks.items,
            'type', attendee_tasks.type,
            'start_timestamp', attendee_tasks.start_timestamp,
            'end_timestamp', attendee_tasks.end_timestamp,
            'user', (SELECT row_to_json(u) FROM (SELECT id, email, full_name, block_status, payment_status, gender, age, location, city, country FROM users u WHERE u.id = attendee_tasks.user_id) u)
          )
        ) as attendee_details
      FROM events
      LEFT JOIN attendee_tasks ON events.id = attendee_tasks.event_id
      GROUP BY events.id
      ORDER BY events.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await pool.query(paginatedEventsQuery, [limit, offset]);

    res.status(200).json({
      status: true,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page, 10),
      result: result.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};



exports.joinEventsWithTypes = async (req, res) => {
  const { event_id, user_id, type } = req.body;

  if (!event_id || !user_id || !type) {
    return res.status(400).json({
      status: false,
      message: "event_id, user_id and type are required",
    });
  }

  try {
    // Check if the event exists
    const eventExists = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);
    if (eventExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found" });
    }

    // Check if the user exists
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Prepare query based on type
    let insertAttendeeQuery, queryParams, status, accepted;
    switch (type) {
      case "JOIN_EVENT":
        status = true;
        accepted = "Pending";
        break;
      case "ADD_MEMBER":
        status = false;
        accepted = "Pending";
        break;
      case "INVITATION":
        status = true;
        accepted = "Accepted";
        break;
      default:
        return res.status(400).json({ status: false, message: "Invalid type" });
    }

    insertAttendeeQuery = `
      INSERT INTO attendee (event_id, attendee_id, type, status, accepted)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    queryParams = [event_id, user_id, type, status, accepted];

    const newAttendee = await pool.query(insertAttendeeQuery, queryParams);

    // Update total_attendee count for the user if the type is not ADD_MEMBER
    if (type !== "ADD_MEMBER") {
      const updateTotalAttendeeQuery = `
        UPDATE events
        SET total_attendee = total_attendee + 1
        WHERE id = $1;
      `;
      await pool.query(updateTotalAttendeeQuery, [event_id]);
    }

    res.json({
      status: true,
      message: "Operation successful",
      attendee: newAttendee.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
