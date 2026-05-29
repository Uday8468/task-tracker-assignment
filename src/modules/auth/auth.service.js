const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { ValidationError, UnauthorizedError, ConflictError, NotFoundError } = require('../../utils/errors');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES }
  );
};

const register = async ({ name, email, password, role, organizationName, organizationId }) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email already registered');
    }

    let orgId;

    if (role === 'ADMIN') {
      if (!organizationName) {
        throw new ValidationError('organizationName is required for ADMIN role');
      }
      const orgResult = await client.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        [organizationName]
      );
      orgId = orgResult.rows[0].id;
    } else {
      if (!organizationId) {
        throw new ValidationError('organizationId is required for MANAGER and MEMBER roles');
      }
      const orgResult = await client.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
      if (orgResult.rows.length === 0) {
        throw new NotFoundError('Organization not found');
      }
      orgId = organizationId;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO users (organization_id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, organization_id, created_at`,
      [orgId, name, email, hashedPassword, role]
    );

    await client.query('COMMIT');

    const user = userResult.rows[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      createdAt: user.created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw new ConflictError('Email already registered');
    }
    throw err;
  } finally {
    client.release();
  }
};

const login = async ({ email, password }) => {
  const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    },
  };
};

const refresh = async (refreshToken) => {
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token not found. Please login again');
  }

  const tokenResult = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  );

  if (tokenResult.rows.length === 0) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (err) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    throw new UnauthorizedError('Invalid refresh token');
  }

  const userResult = await db.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
  if (userResult.rows.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  const user = userResult.rows[0];

  await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

  const newRefreshToken = generateRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, newRefreshToken, expiresAt]
  );

  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logout = async (refreshToken) => {
  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }
  await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
};

module.exports = { register, login, refresh, logout };
