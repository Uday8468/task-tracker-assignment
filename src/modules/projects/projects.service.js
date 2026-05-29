const db = require('../../config/db');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../utils/errors');

const createProject = async (organizationId, userId, { name, description }) => {
  const result = await db.query(
    `INSERT INTO projects (organization_id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, created_by, created_at`,
    [organizationId, name, description || null, userId]
  );

  return result.rows[0];
};

const getAllProjects = async (organizationId, { page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  const countResult = await db.query(
    'SELECT COUNT(*) FROM projects WHERE organization_id = $1',
    [organizationId]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await db.query(
    `SELECT p.id, p.name, p.description, p.created_at,
            u.id as creator_id, u.name as creator_name
     FROM projects p
     JOIN users u ON p.created_by = u.id
     WHERE p.organization_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [organizationId, limit, offset]
  );

  return {
    projects: result.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getProjectById = async (projectId, organizationId) => {
  const result = await db.query(
    `SELECT p.id, p.name, p.description, p.created_at,
            u.id as creator_id, u.name as creator_name
     FROM projects p
     JOIN users u ON p.created_by = u.id
     WHERE p.id = $1 AND p.organization_id = $2`,
    [projectId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Project not found');
  }

  return result.rows[0];
};

const updateProject = async (projectId, organizationId, { name, description }) => {
  // Check project exists in same org
  const existing = await db.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Project not found');
  }

  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (name) {
    fields.push(`name = $${paramIndex}`);
    params.push(name);
    paramIndex++;
  }

  if (description !== undefined) {
    fields.push(`description = $${paramIndex}`);
    params.push(description);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new ValidationError('Nothing to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(projectId, organizationId);

  const result = await db.query(
    `UPDATE projects SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING id, name, description, created_at, updated_at`,
    params
  );

  return result.rows[0];
};

const deleteProject = async (projectId, organizationId) => {
  const existing = await db.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Project not found');
  }

  // Tasks get deleted automatically via CASCADE in schema
  await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
};

module.exports = { createProject, getAllProjects, getProjectById, updateProject, deleteProject };
