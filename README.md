# Team Task Tracker API

A REST API for managing tasks within a team. Users belong to an organization, have roles, and can create/manage tasks based on their permissions.

---

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **Auth:** JWT (Access Token + Refresh Token Rotation)
- **Containerization:** Docker + Docker Compose

---

## Setup Instructions

### Prerequisites
- Docker Desktop installed and running

### Run the project

```bash
git clone https://github.com/Uday8468/task-tracker-assignment.git
cd task-tracker-assignment
docker compose up --build
```

That's it. Docker will:
- Start PostgreSQL and Redis containers
- Run database migrations automatically
- Start the API server on port 3000

### Verify it's running

```
GET http://localhost:3000/health
```

Expected response:
```json
{ "status": "ok", "message": "Server is running" }
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/auth/register | Register user | Public |
| POST | /api/auth/login | Login | Public |
| POST | /api/auth/refresh | Refresh access token | Public |
| POST | /api/auth/logout | Logout | Public |

### Users
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/users | List all users | ADMIN |
| POST | /api/users | Create user | ADMIN |
| GET | /api/users/:id | Get user by ID | ADMIN |
| PUT | /api/users/:id | Update user role/status | ADMIN |
| DELETE | /api/users/:id | Deactivate user | ADMIN |
| GET | /api/users/me | Get my profile | ALL |
| PUT | /api/users/me | Update my profile | ALL |

### Projects
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/projects | List all projects | ALL |
| POST | /api/projects | Create project | ADMIN, MANAGER |
| GET | /api/projects/:id | Get project by ID | ALL |
| PUT | /api/projects/:id | Update project | ADMIN, MANAGER |
| DELETE | /api/projects/:id | Delete project | ADMIN |

### Tasks
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/tasks | List tasks | ALL |
| POST | /api/tasks | Create task | ADMIN, MANAGER |
| GET | /api/tasks/:id | Get task by ID | ALL |
| PUT | /api/tasks/:id | Update task | ADMIN, MANAGER |
| PATCH | /api/tasks/:id/status | Update task status | Assignee, MANAGER, ADMIN |
| DELETE | /api/tasks/:id | Delete task | ADMIN |

### Task List Filters
```
GET /api/tasks?status=TODO&priority=HIGH&assigneeId=uuid&page=1&limit=10
```

---

## Role Permissions

| Action | ADMIN | MANAGER | MEMBER |
|--------|-------|---------|--------|
| Manage users | ✓ | ✗ | ✗ |
| Manage projects | ✓ | ✓ | ✗ |
| Create/update tasks | ✓ | ✓ | ✗ |
| View all tasks | ✓ | ✓ | ✗ |
| View assigned tasks | ✓ | ✓ | ✓ |
| Change task status | ✓ | ✓ | Own tasks only |

---

## Task Status Transitions

```
TODO → IN_PROGRESS → IN_REVIEW → DONE
  ↘         ↘             ↘
          BLOCKED (reachable from any active state)

BLOCKED → IN_PROGRESS (resume from blocked)
```

Transitions are enforced server-side. Invalid transitions return a 400 error.

---

## Caching Strategy

Redis caching is applied on the task list endpoint.

### Cache Key Format
```
tasks:{organizationId}:{assigneeId}:{status}:{priority}:{page}:{limit}
```

Each unique combination of filters gets its own cache key, so different filter combinations are cached independently.

### TTL
All cached entries expire after **5 minutes** automatically via Redis TTL.

### Cache Invalidation
Cache is invalidated immediately whenever:
- A task is **created**
- A task is **updated**
- A task **status** is changed
- A task is **deleted**

On invalidation, all keys matching `tasks:{organizationId}:*` are deleted at once. This clears all filter combinations for that organization ensuring no stale data is served.

### Why Invalidate All Keys Instead of One?
Any change to any task can affect multiple filter combinations (e.g., changing a status affects both the unfiltered list and the `status=TODO` filtered list). Clearing all org-level keys is safer and simpler than trying to guess which specific cached combinations are affected.

---

## Database Design Decision

### Why `organization_id` is stored on the `tasks` table directly

Tasks already belong to a project, and projects belong to an organization. So technically `organization_id` on tasks is denormalized (redundant).

However, every task query filters by organization for security (to prevent cross-org data access). If we didn't store `organization_id` on tasks, every query would need a JOIN through projects just to apply the org filter:

```sql
-- Without organization_id on tasks (requires JOIN)
SELECT t.* FROM tasks t
JOIN projects p ON t.project_id = p.id
WHERE p.organization_id = $1

-- With organization_id on tasks (direct filter)
SELECT * FROM tasks WHERE organization_id = $1
```

The direct filter is faster and combined with the `idx_tasks_organization_id` index, it scales much better as task volume grows. The slight denormalization is intentional and worth the performance gain.

### Indexes Added
```sql
-- Frequently filtered columns
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
```

---

## Security Decisions

### Refresh Token stored in httpOnly Cookie
The refresh token is never returned in the response body. It is set as an `httpOnly` cookie which cannot be accessed by JavaScript. This protects against XSS attacks stealing the refresh token.

### Refresh Token Rotation
Every time `/api/auth/refresh` is called, the old refresh token is deleted from the database and a brand new one is issued. This means each refresh token is single-use. If a token is stolen and used, the original user's next refresh will fail, alerting them to re-login.

### Organization Isolation
Every database query filters by `organization_id` taken from the JWT token. Users from one organization can never access data from another organization, even if they know the IDs.

---

## What I Would Improve Given More Time

1. **Rate limiting** — Add rate limiting on auth endpoints to prevent brute force attacks on login.

2. **Analytics endpoint** — Overdue task count per user and average completion time using SQL window functions.

3. **Real-time notifications** — WebSocket or SSE to notify assignees when their task status changes.

4. **Unit and integration tests** — Tests for auth flows and status transition logic using Jest and Supertest.

5. **Swagger/OpenAPI docs** — Auto-generated interactive API documentation.

6. **Pagination on all list responses** — Currently pagination is implemented but cursor-based pagination would be more efficient for large datasets.

7. **Soft delete for tasks** — Currently tasks are hard deleted. Soft delete would preserve history.

8. **Audit logs** — Track who changed what and when on tasks and users.
