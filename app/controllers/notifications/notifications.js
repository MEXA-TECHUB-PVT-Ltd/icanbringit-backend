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

exports.createNotification = async (req, res) => {
  try {
    const { sender_id, receiver_id, event_id, type, title, content } = req.body;
    const condition = {
      column: "id",
      value: type,
    };
    const oldType = await getSingleRow("notification_type", condition);
    if (oldType[0].name === "event" && !event_id) {
      res.status(500).json({
        statusCode: 400,
        message: "event_id is required for event type",
      });
    }
    const insertEventId = oldType[0].name === "event" ? event_id : null;
    const createQuery = `
        INSERT INTO public.notification (sender_id, receiver_id, type, title, content, event_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`;
    const result = await pool.query(createQuery, [
      sender_id,
      receiver_id,
      type,
      title,
      content,
      insertEventId,
    ]);

    if (result.rowCount === 1) {
      const query = `
SELECT
  n.id AS notification_id,
  n.title,
  n.content,
  n.is_read,
  n.event_id,
  n.created_at AS notification_created_at,
  t.name AS notification_type_name,
  u.id AS sender_id,
  u.full_name AS sender_full_name,
  su.file_name AS sender_upload_file_name,
  r.id AS receiver_id,
  r.full_name AS receiver_full_name,
  ru.file_name AS receiver_upload_file_name
FROM notification n
JOIN users u ON n.sender_id = u.id
LEFT JOIN uploads su ON u.uploads_id = su.id
JOIN users r ON n.receiver_id = r.id
LEFT JOIN uploads ru ON r.uploads_id = ru.id
JOIN notification_type t ON n.type = t.id
WHERE n.id = $1
  AND u.deleted_at IS NULL  -- Exclude notifications from deleted sender
  AND r.deleted_at IS NULL; -- Exclude notifications to deleted receiver
`;

      const notifications = await pool.query(query, [result.rows[0].id]);
      if (notifications.rowCount === 0) {
        return res.status(400).json({
          statusCode: 400,
          message:
            "Notification not created, make sure sender and receiver users are exists",
        });
      }
      return res.status(201).json({
        statusCode: 201,
        message: "Notification created successfully",
        result: notifications.rows[0],
      });
    }
    return res
      .status(400)
      .json({ statusCode: 400, message: "Notification not created" });
  } catch (error) {
    console.error(error);
    if (error.constraint === "notification_sender_id_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "Sender user does not exist" });
    } else if (error.constraint === "notification_receiver_id_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "Receiver user does not exist" });
    } else if (error.constraint === "notification_type_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "notification type does not exist" });
    } else if (error.constraint === "notification_event_id_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "event does not exist" });
    } else {
      res
        .status(500)
        .json({ statusCode: 500, message: "Internal server error" });
    }
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { notification_id, sender_id, receiver_id, type, title, content } =
      req.body;

    // Update the notification
    const updateQuery = `
        UPDATE public.notification
        SET sender_id = $1, receiver_id = $2, type = $3, title = $4, content = $5
        WHERE id = $6
        RETURNING *`;

    const result = await pool.query(updateQuery, [
      sender_id,
      receiver_id,
      type,
      title,
      content,
      notification_id,
    ]);

    if (result.rowCount === 1) {
      const query = `
        SELECT
          n.id AS notification_id,
          n.title,
          n.content,
          n.is_read,
          n.event_id,
          n.created_at AS notification_created_at,
          t.name AS notification_type_name,
          u.id AS sender_id,
          u.full_name AS sender_full_name,
          r.id AS receiver_id,
          r.full_name AS receiver_full_name 
         
        FROM notification n
        JOIN users u ON n.sender_id = u.id
        JOIN users r ON n.receiver_id = r.id
        JOIN notification_type t ON n.type = t.id
        WHERE n.id=$1
        AND u.deleted_at IS NULL  -- Exclude notifications from deleted sender
        AND r.deleted_at IS NULL; -- Exclude notifications to deleted receiver;
        `;

      const notifications = await pool.query(query, [notification_id]);
      if (notifications.rowCount === 0) {
        return res.status(400).json({
          statusCode: 400,
          message:
            "Notification not created, make sure sender and receiver users are exists",
        });
      }
      return res.status(200).json({
        statusCode: 200,
        message: "Notification updated successfully",
        result: notifications.rows[0],
      });
    }
    return res
      .status(400)
      .json({ statusCode: 400, message: "Notification not updated" });
  } catch (error) {
    console.error(error);
    if (error.constraint === "notification_sender_id_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "Sender user does not exist" });
    } else if (error.constraint === "notification_receiver_id_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "Receiver user does not exist" });
    } else if (error.constraint === "notification_type_fkey") {
      res
        .status(400)
        .json({ statusCode: 400, message: "Notification type does not exist" });
    } else {
      res
        .status(500)
        .json({ statusCode: 500, message: "Internal server error" });
    }
  }
};

exports.getAllNotificationsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    let page = parseInt(req.query.page || 1); // Get the page number from the query parameters
    const perPage = parseInt(req.query.limit || 5);
    const offset = (page - 1) * perPage;
    let query = `
SELECT
  n.id AS notification_id,
  n.title,
  n.content,
  n.is_read,
  n.event_id,
  n.created_at AS notification_created_at,
  t.name AS notification_type_name,
  json_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'upload', json_build_object(
      'file_name', su.file_name,
      'file_type', su.file_type,
      'file_url', su.file_url
    )
  ) AS sender,
  json_build_object(
    'id', r.id,
    'full_name', r.full_name,
    'upload', json_build_object(
      'file_name', ru.file_name,
      'file_type', ru.file_type,
      'file_url', ru.file_url
    )
  ) AS receiver
FROM notification n
JOIN users u ON n.sender_id = u.id
LEFT JOIN uploads su ON u.uploads_id = su.id
JOIN users r ON n.receiver_id = r.id
LEFT JOIN uploads ru ON r.uploads_id = ru.id
JOIN notification_type t ON n.type = t.id
WHERE n.receiver_id = $1 AND r.is_deleted = FALSE
ORDER BY n.created_at DESC
 `;

    if (req.query.page !== undefined && req.query.limit !== undefined) {
      query += ` LIMIT $2 OFFSET $3;`;
    }
    let queryParameters = [user_id];

    if (req.query.page !== undefined || req.query.limit !== undefined) {
      queryParameters = [user_id, perPage, offset];
    }

    const { rows } = await pool.query(query, queryParameters);

    if (req.query.page === undefined && req.query.limit === undefined) {
      // If no pagination is applied, don't calculate totalCategories and totalPages
      res.status(200).json({
        statusCode: 200,
        totalNotifications: rows.length,
        result: rows,
      });
    } else {
      // Calculate the total number of categories (without pagination)
      const totalTypesQuery = `SELECT COUNT(*) AS total FROM public.notification n
        JOIN users r ON n.receiver_id = r.user_id
        WHERE n.receiver_id=$1 AND r.is_deleted=FALSE`;
      const totalTypeResult = await pool.query(totalTypesQuery, [user_id]);

      const totalNotifications = totalTypeResult.rows[0].total;
      const totalPages = Math.ceil(totalNotifications / perPage);
      res.status(200).json({
        statusCode: 200,
        totalNotifications,
        totalPages,
        AllNotifications: rows,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ statusCode: 500, message: "Internal server error", error });
  }
};

exports.getAllReadNotificationsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    let page = parseInt(req.query.page || 1); // Get the page number from the query parameters
    const perPage = parseInt(req.query.limit || 5);
    const offset = (page - 1) * perPage;
    let query = `
      SELECT
        n.id AS notification_id,
        n.title,
        n.content,
        n.is_read,
        n.event_id,
        n.created_at AS notification_created_at,
        t.name AS notification_type_name,
        u.id AS sender_id,
        u.full_name AS sender_full_name,
        r.id AS receiver_id,
        r.full_name AS receiver_full_name
       
      FROM notification n
      JOIN users u ON n.sender_id = u.id
      JOIN users r ON n.receiver_id = r.id
      JOIN notification_type t ON n.type = t.id
      WHERE n.receiver_id=$1 AND n.is_read=TRUE AND r.is_deleted=FALSE
      ORDER BY n.created_at DESC `;

    if (req.query.page !== undefined && req.query.limit !== undefined) {
      query += ` LIMIT $2 OFFSET $3;`;
    }
    let queryParameters = [user_id];

    if (req.query.page !== undefined || req.query.limit !== undefined) {
      queryParameters = [user_id, perPage, offset];
    }
    const { rows } = await pool.query(query, queryParameters);

    if (req.query.page === undefined && req.query.limit === undefined) {
      // If no pagination is applied, don't calculate totalCategories and totalPages
      res.status(200).json({
        statusCode: 200,
        totalNotifications: rows.length,
        result: rows,
      });
    } else {
      // Calculate the total number of categories (without pagination)
      const totalTypesQuery = `SELECT COUNT(*) AS total FROM public.notification n
        JOIN users r ON n.receiver_id = r.user_id
        WHERE n.receiver_id=$1 AND n.is_read=TRUE AND r.is_deleted=FALSE`;
      const totalTypeResult = await pool.query(totalTypesQuery, [user_id]);

      const totalNotifications = totalTypeResult.rows[0].total;
      const totalPages = Math.ceil(totalNotifications / perPage);
      res.status(200).json({
        statusCode: 200,
        totalNotifications,
        totalPages,
        AllNotifications: rows,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ statusCode: 500, message: "Internal server error", error });
  }
};

exports.getAllUnReadNotificationsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    let page = parseInt(req.query.page || 1); // Get the page number from the query parameters
    const perPage = parseInt(req.query.limit || 5);
    const offset = (page - 1) * perPage;
    let query = `
      SELECT
        n.id AS notification_id,
        n.title,
        n.content,
        n.is_read,
        n.event_id,
        n.created_at AS notification_created_at,
        t.name AS notification_type_name,
        u.id AS sender_id,
        u.full_name AS sender_full_name,
        r.id AS receiver_id,
        r.full_name AS receiver_full_name
       
      FROM notification n
      JOIN users u ON n.sender_id = u.id
      JOIN users r ON n.receiver_id = r.id
      JOIN notification_type t ON n.type = t.id
      WHERE n.receiver_id=$1 AND n.is_read=FALSE AND r.is_deleted=FALSE
      ORDER BY n.created_at DESC `;

    if (req.query.page !== undefined && req.query.limit !== undefined) {
      query += ` LIMIT $2 OFFSET $3;`;
    }
    let queryParameters = [user_id];

    if (req.query.page !== undefined || req.query.limit !== undefined) {
      queryParameters = [user_id, perPage, offset];
    }
    const { rows } = await pool.query(query, queryParameters);

    if (req.query.page === undefined && req.query.limit === undefined) {
      // If no pagination is applied, don't calculate totalCategories and totalPages
      res.status(200).json({
        statusCode: 200,
        totalNotifications: rows.length,
        result: rows,
      });
    } else {
      // Calculate the total number of categories (without pagination)
      const totalTypesQuery = `SELECT COUNT(*) AS total FROM public.notification n
        JOIN users r ON n.receiver_id = r.user_id
        WHERE n.receiver_id=$1 AND n.is_read=FALSE AND r.is_deleted=FALSE`;
      const totalTypeResult = await pool.query(totalTypesQuery, [user_id]);

      const totalNotifications = totalTypeResult.rows[0].total;
      const totalPages = Math.ceil(totalNotifications / perPage);
      res.status(200).json({
        statusCode: 200,
        totalNotifications,
        totalPages,
        AllNotifications: rows,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ statusCode: 500, message: "Internal server error", error });
  }
};
exports.deleteNotification = async (req, res) => {
  const { notification_id } = req.params;
  try {
    const condition = {
      column: "id",
      value: notification_id,
    };
    const oldType = await getSingleRow("notification", condition);
    if (oldType.length === 0) {
      return res
        .status(404)
        .json({ statusCode: 404, message: "notification  not found " });
    }
    const delQuery = "DELETE FROM notification WHERE id=$1";
    await pool.query(delQuery, [notification_id]);
    res.status(200).json({
      statusCode: 200,
      message: "Notification  deleted successfully",
      result: oldType[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
};
exports.deleteAllNotificationsByUser = async (req, res) => {
  const { id } = req.params;
  try {
    const condition = {
      column: "receiver_id",
      value: id,
    };

    // Check if the user has any notifications
    const userNotifications = await getSingleRow("notification", condition);
    if (userNotifications.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No notifications found for this user",
      });
    }

    // Delete all notifications for the user
    const delQuery =
      "DELETE FROM notification WHERE receiver_id=$1 RETURNING *";
    const result = await pool.query(delQuery, [id]);

    res.status(200).json({
      statusCode: 200,
      message: "All notifications for the user deleted successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
};
exports.readNotification = async (req, res) => {
  try {
    const { notification_id } = req.body;
    const query = "SELECT * FROM notification WHERE id  =$1";
    const oldType = await pool.query(query, [notification_id]);
    if (oldType.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const updateType = `UPDATE notification SET is_read=TRUE, "updated_at"=NOW() WHERE id=$1`;
    const result = await pool.query(updateType, [notification_id]);
    if (result.rowCount === 1) {
      let query = `
        SELECT
          n.id AS notification_id,
          n.title,
          n.content,
          n.is_read,
        n.event_id,
          n.created_at AS notification_created_at,
          t.name AS notification_type_name,
          u.id AS sender_id,
          u.full_name AS sender_full_name,
          r.id AS receiver_id,
          r.full_name AS receiver_full_name
         
        FROM notification n
        JOIN users u ON n.sender_id = u.id
        JOIN users r ON n.receiver_id = r.id
        JOIN notification_type t ON n.type = t.id
        WHERE n.id=$1 AND r.is_deleted=FALSE
        ORDER BY n.created_at DESC `;
      const { rows } = await pool.query(query, [notification_id]);
      return res.status(200).json({
        statusCode: 200,
        message: "Notification read successfully",
        result: rows[0],
      });
    } else {
      res
        .status(404)
        .json({ statusCode: 404, message: "Operation not successfully" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
