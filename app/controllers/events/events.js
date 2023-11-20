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
          return res.status(404).json({ status: false, message: 'No events found'})
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
  const { user_id } = req.params
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
