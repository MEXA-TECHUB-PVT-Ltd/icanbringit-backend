const { pool } = require("../../config/db.config");
const moment = require("moment");

exports.create = async (req, res) => {
  const {
    user_id,
    title,
    event_category_id,
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
    const userExists = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }
    if (userExists.rows[0].deactivate) {
      return res.status(404).json({
        status: false,
        message: "Can't create event. Your account has been deactivated",
      });
    }
    const categoryExits = await pool.query(
      "SELECT id FROM question_types WHERE id = $1",
      [event_category_id]
    );
    if (categoryExits.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
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

    const insertQuery = `INSERT INTO events (user_id, title, category_id, cover_photo_id, 
                       start_timestamp, end_timestamp, event_type, 
                       virtual_link, location, event_details, no_guests, privacy, 
                       suggested_items) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                       RETURNING id`;
    const eventResult = await pool.query(insertQuery, [
      user_id,
      title,
      event_category_id,
      cover_photo_id,
      start_timestamp,
      end_timestamp,
      event_type,
      virtual_link,
      location,
      event_details,
      no_guests,
      privacy,
      [],
    ]);

    if (eventResult.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Event creation failed" });
    }

    const eventId = eventResult.rows[0].id;

    // Insert suggested items
    for (const itemId of suggested_items) {
      const insertSuggestedItemQuery = `
        INSERT INTO event_suggested_items (event_id, suggested_item_id)
        VALUES ($1, $2)`;
      await pool.query(insertSuggestedItemQuery, [eventId, itemId]);
    }

    // Fetch the event with cover image details using JOIN
    const fetchEventQuery = `
SELECT 
  events.*, 
  json_build_object(
    'id', uploads.id,
    'file_name', uploads.file_name,
    'file_type', uploads.file_type,
    'file_url', uploads.file_url
  ) AS cover_image_details,
  array_agg(json_build_object(
    'id', si.id,
    'name', si.name,
    'created_by', si.created_by,
    'created_at', si.created_at,
    'updated_at', si.updated_at
  )) AS suggested_items
FROM events
LEFT JOIN uploads ON events.cover_photo_id = uploads.id
LEFT JOIN event_suggested_items esi ON events.id = esi.event_id
LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
WHERE events.id = $1
GROUP BY events.id, uploads.id;
`;

    const fetchEventResult = await pool.query(fetchEventQuery, [eventId]);

    res.status(201).json({
      status: true,
      message: "Event created successfully",
      result: fetchEventResult.rows[0],
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
    category_id,
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
    const userExists = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );
    if (userExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "User not found or deactivated" });
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
    if (category_id) {
      fieldsToUpdate.push(`category_id = $${valueCount++}`);
      values.push(category_id);
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
    if (no_guests !== undefined) {
      fieldsToUpdate.push(`no_guests = $${valueCount++}`);
      values.push(no_guests);
    }
    if (privacy) {
      fieldsToUpdate.push(`privacy = $${valueCount++}`);
      values.push(privacy);
    }
    if (Array.isArray(suggested_items)) {
      // Delete existing suggested items for this event
      await pool.query(
        "DELETE FROM event_suggested_items WHERE event_id = $1",
        [event_id]
      );

      // Insert new suggested items
      for (const itemId of suggested_items) {
        await pool.query(
          "INSERT INTO event_suggested_items (event_id, suggested_item_id) VALUES ($1, $2)",
          [event_id, itemId]
        );
      }
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

    const fetchEventQuery = `
    SELECT 
  events.*, 
  json_build_object(
    'id', uploads.id,
    'file_name', uploads.file_name,
    'file_type', uploads.file_type,
    'file_url', uploads.file_url
  ) AS cover_image_details,
  array_agg(json_build_object(
    'id', si.id,
    'name', si.name,
    'created_by', si.created_by,
    'created_at', si.created_at,
    'updated_at', si.updated_at
  )) AS suggested_items
FROM events
LEFT JOIN uploads ON events.cover_photo_id = uploads.id
LEFT JOIN event_suggested_items esi ON events.id = esi.event_id
LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
WHERE events.id = $1
GROUP BY events.id, uploads.id;
`;

    const fetchEventResult = await pool.query(fetchEventQuery, [event_id]);

    res.status(200).json({
      status: true,
      message: "Event updated successfully",
      result: fetchEventResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.get = async (req, res) => {
  const { id, user_id } = req.params;

  if (!id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "id and user_id are required.",
    });
  }

  try {
    const userExists = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );
    if (userExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "User not found or deactivated" });
    }

    const query = `
      SELECT 
        e.*, 
        qt.text AS category_text, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
        COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
      FROM events e
      LEFT JOIN question_types qt ON e.category_id = qt.id
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
      WHERE e.id = $1 AND e.user_id = $2
      GROUP BY e.id, qt.id, u.id;
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
exports.getEvent = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id and user_id are required.",
    });
  }

  try {
    const userExists = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );
    if (userExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "User not found or deactivated" });
    }

    const query = `
      SELECT 
        e.*, 
        qt.text AS category_text, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
        COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
      FROM events e
      LEFT JOIN question_types qt ON e.category_id = qt.id
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
      WHERE e.id = $1
      GROUP BY e.id, qt.id, u.id;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event retrieved successfully",
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
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const offset = page && limit ? (page - 1) * limit : 0;

  try {
    let query, countQuery;

    let exclusionCondition = `
      WHERE e.user_id NOT IN (
        SELECT reported_user_id 
        FROM report 
      ) AND e.user_id NOT IN (
        SELECT block_user_id 
        FROM block_users 
        WHERE status = TRUE
      ) AND e.user_id NOT IN (
        SELECT block_creator_id 
        FROM block_users 
        WHERE status = TRUE
      )
    `;

    // Modified query to include suggested items
    query = `
      SELECT 
        e.*, 
        qt.text AS category_text, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
        COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
      FROM events e
      LEFT JOIN question_types qt ON e.category_id = qt.id
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
      ${exclusionCondition}
      GROUP BY e.id, qt.id, u.id
      ORDER BY e.id DESC
    `;

    countQuery = `SELECT COUNT(*) FROM events e ${exclusionCondition}`;

    if (page && limit) {
      query += ` LIMIT $1 OFFSET $2`;
    }

    const result = await pool.query(
      query,
      page && limit ? [limit, offset] : []
    );
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No events found" });
    }

    return res.json({
      status: true,
      message: "Events retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page || 1,
      itemsPerPage: limit || totalItems,
      events: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllByUser = async (req, res) => {
  const { user_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const checkUserExist = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [user_id]
    );
    if (checkUserExist.rowCount === 0) {
      return res.status(400).json({ status: false, message: "User not found" });
    }
    if (checkUserExist.rows[0].deactivate) {
      return res.status(400).json({
        status: false,
        message: "Your account is currently deactivated",
      });
    }

    // Modified query to include suggested items
    const query = `
      SELECT 
        e.*, 
        qt.text AS category_text, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
        COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
      FROM events e
      LEFT JOIN question_types qt ON e.category_id = qt.id
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id AND (si.created_by = 'admin' OR si.user_id = e.user_id)
      WHERE e.user_id = $1
      GROUP BY e.id, qt.id, u.id
      ORDER BY e.id DESC
      LIMIT $2 OFFSET $3;
    `;

    // Execute the query
    const result = await pool.query(query, [user_id, limit, offset]);

    const totalItems = parseInt(result.rowCount);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No events found",
      });
    }

    return res.json({
      status: true,
      message: "Events retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      events: result.rows,
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
  const { category_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query = `
      SELECT 
        e.*, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
        COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
      FROM events e
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
      LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
      WHERE e.category_id = $1
      GROUP BY e.id, u.id
      ORDER BY e.id DESC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM events e
      INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
      WHERE e.category_id = $1;
    `;

    // Execute queries
    const result = await pool.query(query, [category_id, limit, offset]);
    const countResult = await pool.query(countQuery, [category_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No events found" });
    }

    return res.json({
      status: true,
      message: "Events retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      events: result.rows,
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

    const conditions = searchWords.map(
      (word, index) => `(e.title ILIKE $${index + 1})`
    );
    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `
        SELECT 
          e.*, 
          json_build_object(
            'id', u.id,
            'file_name', u.file_name,
            'file_type', u.file_type,
            'file_url', u.file_url
          ) AS cover_image_details
        FROM events e
        LEFT JOIN uploads u ON e.cover_photo_id = u.id
        INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
        WHERE (${conditions.join(" OR ")})
        ORDER BY e.id DESC
        LIMIT $${conditions.length + 1} OFFSET $${conditions.length + 2}
      `;
      values.push(limit, offset);
    } else {
      query = `
        SELECT 
          e.*, 
          json_build_object(
            'id', u.id,
            'file_name', u.file_name,
            'file_type', u.file_type,
            'file_url', u.file_url
          ) AS cover_image_details
        FROM events e
        LEFT JOIN uploads u ON e.cover_photo_id = u.id
        INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
        WHERE (${conditions.join(" OR ")})
        ORDER BY e.id DESC
      `;
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
    category_id,
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
    page = 1,
    limit = 10,
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    let baseQuery = `
      FROM events e
      LEFT JOIN question_types qt ON e.category_id = qt.id
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
            LEFT JOIN event_suggested_items esi ON e.id = esi.event_id
      LEFT JOIN suggested_items si ON esi.suggested_item_id = si.id
      INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
      WHERE 1 = 1
    `;
    const values = [];
    let valueCount = 1;

    // Add filters based on provided query parameters
    if (user_id) {
      baseQuery += ` AND e.user_id = $${valueCount++}`;
      values.push(user_id);
    }
    if (title) {
      baseQuery += ` AND e.title ILIKE $${valueCount++}`;
      values.push(`%${title}%`);
    }
    if (category_id) {
      baseQuery += ` AND e.category_id = $${valueCount++}`;
      values.push(category_id);
    }
    if (cover_photo_id) {
      baseQuery += ` AND e.cover_photo_id = $${valueCount++}`;
      values.push(cover_photo_id);
    }
    if (start_timestamp) {
      const formattedStartTimestamp = moment
        .utc(start_timestamp)
        .format("YYYY-MM-DD");
      baseQuery += ` AND DATE(e.start_timestamp) = $${valueCount++}`;
      values.push(formattedStartTimestamp);
    }
    if (end_timestamp) {
      const formattedEndTimestamp = moment
        .utc(end_timestamp)
        .format("YYYY-MM-DD");
      baseQuery += ` AND DATE(e.end_timestamp) = $${valueCount++}`;
      values.push(formattedEndTimestamp);
    }
    if (event_type) {
      baseQuery += ` AND e.event_type = $${valueCount++}`;
      values.push(event_type);
    }
    if (virtual_link) {
      baseQuery += ` AND e.virtual_link = $${valueCount++}`;
      values.push(virtual_link);
    }
    if (location) {
      baseQuery += ` AND e.location::text ILIKE $${valueCount++}`;
      values.push(`%${location}%`);
    }
    if (event_details) {
      baseQuery += ` AND e.event_details ILIKE $${valueCount++}`;
      values.push(`%${event_details}%`);
    }
    if (no_guests) {
      baseQuery += ` AND e.no_guests = $${valueCount++}`;
      values.push(no_guests);
    }
    if (privacy) {
      baseQuery += ` AND e.privacy = $${valueCount++}`;
      values.push(privacy);
    }
    if (suggested_items) {
      baseQuery += ` AND $${valueCount++} = ANY(e.suggested_items)`;
      values.push(suggested_items);
    }

    // Count query for pagination
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Main query for fetching data
    let query = `     SELECT 
        e.*, 
        qt.text AS category_text, 
        json_build_object(
          'id', u.id,
          'file_name', u.file_name,
          'file_type', u.file_type,
          'file_url', u.file_url
        ) AS cover_image_details,
                COALESCE(array_agg(json_build_object(
          'id', si.id,
          'name', si.name,
          'created_by', si.created_by,
          'created_at', si.created_at,
          'updated_at', si.updated_at
        )) FILTER (WHERE si.id IS NOT NULL), '{}') AS suggested_items
        ${baseQuery} 
        ORDER BY e.id 
        LIMIT $${valueCount++} OFFSET $${valueCount}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Check if no results found
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No events found",
      });
    }

    // Return the response
    res.status(200).json({
      status: true,
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page, 10),
      itemsPerPage: limit,
      result: result.rows,
    });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.getAllEventsWithDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`  SELECT COUNT(*)
      FROM events e
      INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
    `);
    const total = parseInt(countResult.rows[0].count, 10);

    const paginatedEventsQuery = `
      SELECT 
        e.*,
        question_types.text AS category,
        json_agg(
          json_build_object(
            'task', attendee_tasks.text, 
            'items', attendee_tasks.items,
            'type', attendee_tasks.type,
            'start_timestamp', attendee_tasks.start_timestamp,
            'end_timestamp', attendee_tasks.end_timestamp,
            'user', (SELECT row_to_json(u) FROM (SELECT id, email, full_name, block_status, payment_status, gender, age, location, city, country FROM users u WHERE u.id = attendee_tasks.user_id) u)
          )
        ) as attendee_details,
        json_build_object(
          'id', uploads.id,
          'file_name', uploads.file_name,
          'file_type', uploads.file_type,
          'file_url', uploads.file_url
        ) AS cover_image_details
      FROM events e
      LEFT JOIN attendee_tasks ON e.id = attendee_tasks.event_id
      LEFT JOIN question_types ON e.category_id = question_types.id
      LEFT JOIN uploads ON e.cover_photo_id = uploads.id
            INNER JOIN users usr ON e.user_id = usr.id AND usr.deleted_at IS NULL
      GROUP BY e.id, question_types.text, uploads.id
      ORDER BY e.created_at DESC
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

  const ALL_TYPES = [
    "JOIN_PUBLIC_EVENT",
    "ACCEPT_INVITATION",
    "ADD_MEMBER",
    "REJECT_INVITATION",
  ];

  if (!ALL_TYPES.includes(type)) {
    return res.status(400).json({ status: false, message: "Invalid type" });
  }

  const TYPES_TO_UPDATE_COUNT = ["JOIN_PUBLIC_EVENT", "ACCEPT_INVITATION"];

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
    if (userExists.rows[0].deactivate) {
      return res.status(401).json({
        status: false,
        message: "Your account is deactivated. Access denied",
      });
    }

    // Insert into attendee table
    const insertAttendeeQuery = `
      INSERT INTO attendee (event_id, attendee_id, type, status, accepted)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const status = type === "JOIN_PUBLIC_EVENT" || type === "ACCEPT_INVITATION";
    const accepted =
      type === "JOIN_PUBLIC_EVENT"
        ? "Accepted"
        : type === "ACCEPT_INVITATION"
        ? "Accepted"
        : type === "REJECT_INVITATION"
        ? "Rejected"
        : "Pending";

    const newAttendee = await pool.query(insertAttendeeQuery, [
      event_id,
      user_id,
      type,
      status,
      accepted,
    ]);

    // Update total attendees count for specific types
    if (TYPES_TO_UPDATE_COUNT.includes(type)) {
      const updateTotalAttendeeQuery = `
        UPDATE events
        SET total_attendee = total_attendee + 1
        WHERE id = $1;
      `;
      await pool.query(updateTotalAttendeeQuery, [event_id]);
      const insertEventStatusQuery = `
      INSERT INTO events_status (event_id, user_id)
      VALUES ($1, $2)
      RETURNING *;
      `;
      await pool.query(insertEventStatusQuery, [event_id, user_id]);
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

exports.updateJoinEventAttendeeTypeAndStatus = async (req, res) => {
  const { id, new_type } = req.body;

  if (!id || !new_type) {
    return res.status(400).json({
      status: false,
      message: "id and new_type are required",
    });
  }

  const ALL_TYPES = [
    "JOIN_PUBLIC_EVENT",
    "ACCEPT_INVITATION",
    "ADD_MEMBER",
    "REJECT_INVITATION",
  ];

  if (!ALL_TYPES.includes(new_type)) {
    return res.status(400).json({ status: false, message: "Invalid new_type" });
  }

  const TYPES_TO_INCREMENT_COUNT = ["JOIN_PUBLIC_EVENT", "ACCEPT_INVITATION"];

  try {
    const attendeeExists = await pool.query(
      "SELECT * FROM attendee WHERE id = $1",
      [id]
    );
    if (attendeeExists.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Attendee not found" });
    }

    const event_id = attendeeExists.rows[0].event_id;

    const status =
      new_type === "JOIN_PUBLIC_EVENT" || new_type === "ACCEPT_INVITATION";
    const accepted =
      new_type === "JOIN_PUBLIC_EVENT"
        ? "Accepted"
        : new_type === "ACCEPT_INVITATION"
        ? "Accepted"
        : new_type === "REJECT_INVITATION"
        ? "Rejected"
        : "Pending";

    const updateAttendeeQuery = `
      UPDATE attendee
      SET type = $1, status = $2, accepted = $3
      WHERE id = $4
      RETURNING *;
    `;
    const result = await pool.query(updateAttendeeQuery, [
      new_type,
      status,
      accepted,
      id,
    ]);

    const user_id = result.rows[0].attendee_id;

    // handle the incremented or decremented count users rejecting or accepting multiple time

    // Increment total attendees count only for specific types
    if (TYPES_TO_INCREMENT_COUNT.includes(new_type)) {
      const updateTotalAttendeeQuery = `
        UPDATE events
        SET total_attendee = total_attendee + 1
        WHERE id = $1;
      `;
      await pool.query(updateTotalAttendeeQuery, [event_id]);
      const insertEventStatusQuery = `
      INSERT INTO events_status (event_id, user_id)
      VALUES ($1, $2)
      RETURNING *;
      `;
      await pool.query(insertEventStatusQuery, [event_id, user_id]);
    }

    res.json({
      status: true,
      message: "Attendee updated successfully",
      attendee: result.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.getAllUpComingByUser = async (req, res) => {
  const { user_id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const checkUserExist = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [user_id]
    );
    if (checkUserExist.rowCount === 0) {
      return res.status(400).json({ status: false, message: "User not found" });
    }
    if (checkUserExist.rows[0].deactivate) {
      return res.status(400).json({
        status: false,
        message: "Your account is currently deactivated",
      });
    }
    const userColumns = ["id", "email", "full_name", "city", "country"];

    const query = `
SELECT 
  es.*,
  e.*,
  qt.text AS category,
  ${userColumns.map((col) => "u." + col).join(", ")},
  json_build_object(
    'id', up.id,
    'file_name', up.file_name,
    'file_type', up.file_type,
    'file_url', up.file_url
  ) AS cover_image_details
FROM events_status es
JOIN events e ON es.event_id = e.id
JOIN users u ON e.user_id = u.id AND u.deactivate IS FALSE
LEFT JOIN question_types qt ON e.category_id = qt.id
LEFT JOIN uploads up ON e.cover_photo_id = up.id
WHERE es.user_id = $1 AND es.status = 'UpComing'
ORDER BY es.id DESC
LIMIT $2 OFFSET $3;
`;

    const countQuery = `
  SELECT COUNT(*) 
  FROM events_status es
  JOIN events e ON es.event_id = e.id
  JOIN users u ON e.user_id = u.id AND u.deactivate IS FALSE
  WHERE es.user_id = $1 
    AND es.status = 'UpComing';
`;

    // Execute queries
    const result = await pool.query(query, [user_id, limit, offset]);
    const countResult = await pool.query(countQuery, [user_id]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No upcoming events found for this user",
      });
    }

    return res.json({
      status: true,
      message: "All upcoming events retrieved successfully",
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

exports.getAllEventByQuestionTypes = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 4;
    const offset = (page - 1) * pageSize;

    const query = `
      SELECT
        json_build_object(
          'event_cat', json_build_object(
            'id', qt.id,
            'text', qt.text,
            'type', qt.type
          ),
          'events', json_agg(
            json_build_object(
              'id', e.id,
              'title', e.title,
              'category_id', e.category_id,
              'cover_photo', json_build_object(
                'id', u.id,
                'file_name', u.file_name,
                'file_type', u.file_type,
                'file_url', u.file_url
              ),
              'start_timestamp', e.start_timestamp,
              'end_timestamp', e.end_timestamp,
              'event_type', e.event_type,
              'virtual_link', e.virtual_link,
              'location', e.location,
              'event_details', e.event_details,
              'no_guests', e.no_guests,
              'privacy', e.privacy,
              'total_attendee', e.total_attendee,
              'created_at', e.created_at,
              'updated_at', e.updated_at
            )
          )
        ) AS result
      FROM question_types qt
      LEFT JOIN LATERAL (
        SELECT e.*
        FROM events e
        WHERE e.category_id = qt.id
        ORDER BY e.created_at DESC
        LIMIT 5
      ) e ON true
      LEFT JOIN uploads u ON e.cover_photo_id = u.id
      GROUP BY qt.id
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(query, [pageSize, offset]);

    // Optional: Total count of question types for pagination
    const countQuery = "SELECT COUNT(*) FROM question_types";
    const totalResult = await pool.query(countQuery);
    const totalCount = parseInt(totalResult.rows[0].count);

    res.json({
      status: true,
      result: rows.map((row) => row.result),
      pagination: {
        page: page,
        pageSize: pageSize,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

