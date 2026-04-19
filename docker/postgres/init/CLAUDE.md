# docker/postgres/init/

PostgreSQL initialization scripts executed on first container start.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `01-init.sql` | Primary database schema (tables, indexes) | Modifying database schema, adding tables |
| `02-auth-tables.sql` | Auth tables DDL (users, sessions, workspaces, drawings, price_markers) | Adding auth tables, modifying user/workspace schema |
