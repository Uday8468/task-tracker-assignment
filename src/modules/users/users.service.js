const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const { NotFoundError, ValidationError, ForbiddenError, ConflictError } = require('../../utils/errors');

const getAllUsers = async (organizationId, filters) => {
  const { role, is_active, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  let baseQuery = 'SELECT id, name, email, role, is_active, created_at FROM users WHERE organization_id = $1';
  const params = [organizationId];
  let paramIndex = 2;

  // Add optional filters
  if (role) {
    baseQuery += ` AND role = $${paramIndex}`;
    params.push(role);
    paramIndex++;
  }

  if (is_active !== undefined) {
    baseQuery += ` AND is_active = $${paramIndex}`;
    params.push(is_active === 'true');
    paramIndex++;
  }

  // Get total count for pagination
  const countResult = await db.query(
    `SELECT COUNT(*) FROM users WHERE organization_id = $1${role ? ` AND role = '${role}'` : ''}`,
    [organizationId]
  );
  const total = parseInt(countResult.rows[0].count);

  // Add pagination
  baseQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(baseQuery, params);

  return {
    users: result.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getUserById = async (userId, organizationId) => {
  const result = await db.query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1 AND organization_id = $2',
    [userId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  return result.rows[0];
};

const createUser = async (organizationId, { name, email, password, role }) => {
  // Check if email already exists
  const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await db.query(
      `INSERT INTO users (organization_id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, is_active, created_at`,
      [organizationId, name, email, hashedPassword, role]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Email already registered');
    }
    throw err;
  }
};

const updateUser = async (userId, organizationId, requestingUserId, { role, is_active }) => {
  // Check user exists in same organization
  const userResult = await db.query(
    'SELECT id, role FROM users WHERE id = $1 AND organization_id = $2',
    [userId, organizationId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  // ADMIN cannot change their own role
  if (userId === requestingUserId && role) {
    throw new ForbiddenError('You cannot change your own role');
  }

  // If changing role away from ADMIN, ensure at least one ADMIN remains in org
  if (role && role !== 'ADMIN' && userResult.rows[0].role === 'ADMIN') {
    const adminCountResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = $2 AND is_active = true',
      [organizationId, 'ADMIN']
    );
    const adminCount = parseInt(adminCountResult.rows[0].count);
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot change role — organization must have at least one ADMIN');
    }
  }

  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (role !== undefined) {
    fields.push(`role = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  if (is_active !== undefined) {
    fields.push(`is_active = $${paramIndex}`);
    params.push(is_active);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new ValidationError('Nothing to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(userId, organizationId);

  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING id, name, email, role, is_active, created_at`,
    params
  );

  return result.rows[0];
};

const deleteUser = async (userId, organizationId, requestingUserId) => {
  // ADMIN cannot deactivate themselves
  if (userId === requestingUserId) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  const result = await db.query(
    'SELECT id, role FROM users WHERE id = $1 AND organization_id = $2',
    [userId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  // If deactivating an ADMIN, ensure at least one ADMIN remains in org
  if (result.rows[0].role === 'ADMIN') {
    const adminCountResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = $2 AND is_active = true',
      [organizationId, 'ADMIN']
    );
    const adminCount = parseInt(adminCountResult.rows[0].count);
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot deactivate — organization must have at least one ADMIN');
    }
  }

  // Soft delete — just set is_active = false
  await db.query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
    [userId]
  );
};

const getMe = async (userId) => {
  const result = await db.query(
    'SELECT id, name, email, role, is_active, organization_id, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  return result.rows[0];
};

const updateMe = async (userId, { name, currentPassword, newPassword }) => {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (name) {
    fields.push(`name = $${paramIndex}`);
    params.push(name);
    paramIndex++;
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new ValidationError('currentPassword is required to set a new password');
    }

    // Verify current password
    const userResult = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);

    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    fields.push(`password = $${paramIndex}`);
    params.push(hashedPassword);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new ValidationError('Nothing to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(userId);

  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, email, role, is_active, organization_id, created_at`,
    params
  );

  return result.rows[0];
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, getMe, updateMe };
