const db = require('../../config/db');
const redis = require('../../config/redis');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../utils/errors');

// Valid status transitions map
// Key = current status, Value = allowed next statuses
const VALID_TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW:   ['DONE', 'BLOCKED'],
  DONE:        [],
  BLOCKED:     ['IN_PROGRESS'],
};

// Cache TTL — 5 minutes
const CACHE_TTL = 300;

// Build a consistent cache key from request params
const buildCacheKey = (organizationId, filters) => {
  const { assigneeId = 'all', status = 'all', priority = 'all', page = 1, limit = 10 } = filters;
  return `tasks:${organizationId}:${assigneeId}:${status}:${priority}:${page}:${limit}`;
};

// Invalidate all task cache for an organization
// Called whenever a task is created, updated, deleted, or status changed
const invalidateCache = async (organizationId) => {
  await redis.delByPattern(`tasks:${organizationId}:*`);
};

const createTask = async (organizationId, userId, { title, description, priority, assigneeId, projectId, dueDate }) => {
  // Validate project belongs to same org
  const projectResult = await db.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );
  if (projectResult.rows.length === 0) {
    throw new NotFoundError('Project not found');
  }

  // Validate assignee belongs to same org (if provided)
  if (assigneeId) {
    const assigneeResult = await db.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [assigneeId, organizationId]
    );
    if (assigneeResult.rows.length === 0) {
      throw new NotFoundError('Assignee not found in organization');
    }
  }

  // Validate due_date is in the future
  if (dueDate && new Date(dueDate) <= new Date()) {
    throw new ValidationError('due_date must be a future date');
  }

  const result = await db.query(
    `INSERT INTO tasks (project_id, organization_id, title, description, priority, assignee_id, created_by, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [projectId, organizationId, title, description || null, priority || 'MEDIUM', assigneeId || null, userId, dueDate || null]
  );

  await invalidateCache(organizationId);

  return result.rows[0];
};

const getAllTasks = async (organizationId, userId, role, filters) => {
  const { status, priority, assigneeId, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  // MEMBER can only see their own tasks
  const effectiveAssigneeId = role === 'MEMBER' ? userId : assigneeId;

  // Try cache first
  const cacheKey = buildCacheKey(organizationId, { ...filters, assigneeId: effectiveAssigneeId });
  const cached = await redis.get(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // Build dynamic query
  let baseQuery = `
    SELECT t.id, t.title, t.description, t.priority, t.status, t.due_date, t.created_at, t.updated_at,
           p.id as project_id, p.name as project_name,
           a.id as assignee_id, a.name as assignee_name,
           c.id as creator_id, c.name as creator_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users a ON t.assignee_id = a.id
    JOIN users c ON t.created_by = c.id
    WHERE t.organization_id = $1
  `;

  const params = [organizationId];
  let paramIndex = 2;

  if (effectiveAssigneeId) {
    baseQuery += ` AND t.assignee_id = $${paramIndex}`;
    params.push(effectiveAssigneeId);
    paramIndex++;
  }

  if (status) {
    baseQuery += ` AND t.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (priority) {
    baseQuery += ` AND t.priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }

  // Count total for pagination
  const countQuery = baseQuery.replace(
    /SELECT .* FROM tasks/s,
    'SELECT COUNT(*) FROM tasks'
  );
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);

  // Add ordering and pagination
  baseQuery += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(parseInt(limit), offset);

  const result = await db.query(baseQuery, params);

  const data = {
    tasks: result.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  };

  // Store in cache
  await redis.set(cacheKey, data, CACHE_TTL);

  return data;
};

const getTaskById = async (taskId, organizationId, userId, role) => {
  const result = await db.query(
    `SELECT t.*,
            p.name as project_name,
            a.name as assignee_name,
            c.name as creator_name
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     LEFT JOIN users a ON t.assignee_id = a.id
     JOIN users c ON t.created_by = c.id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [taskId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Task not found');
  }

  const task = result.rows[0];

  // MEMBER can only view tasks assigned to them
  if (role === 'MEMBER' && task.assignee_id !== userId) {
    throw new ForbiddenError('You can only view tasks assigned to you');
  }

  return task;
};

const updateTask = async (taskId, organizationId, { title, description, priority, assigneeId, dueDate }) => {
  const existing = await db.query(
    'SELECT id FROM tasks WHERE id = $1 AND organization_id = $2',
    [taskId, organizationId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Task not found');
  }

  // Validate assignee if provided
  if (assigneeId) {
    const assigneeResult = await db.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [assigneeId, organizationId]
    );
    if (assigneeResult.rows.length === 0) {
      throw new NotFoundError('Assignee not found in organization');
    }
  }

  // Validate due_date
  if (dueDate && new Date(dueDate) <= new Date()) {
    throw new ValidationError('due_date must be a future date');
  }

  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (title) {
    fields.push(`title = $${paramIndex}`);
    params.push(title);
    paramIndex++;
  }
  if (description !== undefined) {
    fields.push(`description = $${paramIndex}`);
    params.push(description);
    paramIndex++;
  }
  if (priority) {
    fields.push(`priority = $${paramIndex}`);
    params.push(priority);
    paramIndex++;
  }
  if (assigneeId !== undefined) {
    fields.push(`assignee_id = $${paramIndex}`);
    params.push(assigneeId);
    paramIndex++;
  }
  if (dueDate !== undefined) {
    fields.push(`due_date = $${paramIndex}`);
    params.push(dueDate);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new ValidationError('Nothing to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(taskId, organizationId);

  const result = await db.query(
    `UPDATE tasks SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );

  await invalidateCache(organizationId);

  return result.rows[0];
};

const updateTaskStatus = async (taskId, organizationId, userId, role, newStatus) => {
  const result = await db.query(
    'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
    [taskId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Task not found');
  }

  const task = result.rows[0];

  // Only assignee, MANAGER, or ADMIN can change status
  if (role === 'MEMBER' && task.assignee_id !== userId) {
    throw new ForbiddenError('Only the assignee can change this task status');
  }

  // Validate status transition
  const allowedTransitions = VALID_TRANSITIONS[task.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new ValidationError(
      `Invalid status transition. '${task.status}' can only move to: ${allowedTransitions.join(', ') || 'none (final state)'}`
    );
  }

  const updated = await db.query(
    `UPDATE tasks SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [newStatus, taskId]
  );

  await invalidateCache(organizationId);

  return updated.rows[0];
};

const deleteTask = async (taskId, organizationId) => {
  const existing = await db.query(
    'SELECT id FROM tasks WHERE id = $1 AND organization_id = $2',
    [taskId, organizationId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Task not found');
  }

  await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
  await invalidateCache(organizationId);
};

module.exports = { createTask, getAllTasks, getTaskById, updateTask, updateTaskStatus, deleteTask };
