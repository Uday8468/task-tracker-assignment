const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Team Task Tracker API',
      version: '1.0.0',
      description: 'A REST API for managing tasks within a team with role-based access control',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'integer', example: 400 },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'email is required' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@gmail.com' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] },
            is_active: { type: 'boolean', example: true },
            organizationId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Website Redesign' },
            description: { type: 'string', example: 'Redesign the company website' },
            creator_name: { type: 'string', example: 'John Doe' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Design Homepage' },
            description: { type: 'string', example: 'Create wireframes' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] },
            project_name: { type: 'string', example: 'Website Redesign' },
            assignee_name: { type: 'string', example: 'Jane Doe' },
            due_date: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 50 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
