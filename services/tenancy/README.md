# services/tenancy

Organizations, memberships and the audit log, read as the signed-in user (RLS filters).

**Public interface** (`services.tenancy.api`, every function takes a user-scoped connection from `services.gateway.db.Database.as_user`):
- `memberships(conn, user_id)`, `is_member(conn, org_id)`, `is_admin(conn, org_id)`
- `audit_log(conn, org_id, limit)`, `audit_chain_intact(conn, org_id)`

**Writes:** audit entries only via `private.append_audit()` (actor = `auth.uid()`). The table is append-only and hash-chained.
