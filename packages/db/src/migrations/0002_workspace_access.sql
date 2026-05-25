DO $$ BEGIN
  CREATE TYPE workspace_join_request_status AS ENUM ('pending', 'approved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS internal_number varchar(32);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_internal_number_uq ON workspaces (internal_number);

CREATE TABLE IF NOT EXISTS workspace_join_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL,
  requester_email varchar(320) NOT NULL,
  internal_number varchar(32) NOT NULL,
  status workspace_join_request_status NOT NULL,
  decided_by_user_id uuid,
  requested_at timestamptz NOT NULL,
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS workspace_join_requests_workspace_idx ON workspace_join_requests (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_join_requests_requester_idx ON workspace_join_requests (requester_user_id);
DROP INDEX IF EXISTS workspace_join_requests_pending_uq;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_join_requests_pending_uq
  ON workspace_join_requests (workspace_id, requester_user_id)
  WHERE status = 'pending';
