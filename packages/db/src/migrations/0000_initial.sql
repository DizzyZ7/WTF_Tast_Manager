DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sprint_status AS ENUM ('planned', 'active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_relation_type AS ENUM ('blocks', 'blocked_by', 'duplicates', 'relates_to');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_verb AS ENUM ('created', 'status_changed', 'assigned', 'commented', 'subtask_added', 'relation_added');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  slug varchar(63) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_uq ON workspaces (slug);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL,
  joined_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key varchar(10) NOT NULL,
  name varchar(160) NOT NULL,
  status project_status NOT NULL,
  lead_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_workspace_key_uq ON projects (workspace_id, key);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects (workspace_id);

CREATE TABLE IF NOT EXISTS sprints (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  goal varchar(500) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status sprint_status NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sprints_project_name_uq ON sprints (project_id, name);

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key varchar(24) NOT NULL,
  title varchar(240) NOT NULL,
  description text NOT NULL,
  status issue_status NOT NULL,
  priority issue_priority NOT NULL,
  reporter_id uuid NOT NULL,
  assignee_id uuid,
  sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS issues_workspace_key_uq ON issues (workspace_id, key);
CREATE INDEX IF NOT EXISTS issues_project_idx ON issues (project_id);
CREATE INDEX IF NOT EXISTS issues_assignee_idx ON issues (assignee_id);

CREATE TABLE IF NOT EXISTS issue_comments (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS issue_comments_issue_idx ON issue_comments (issue_id);

CREATE TABLE IF NOT EXISTS issue_subtasks (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  title varchar(240) NOT NULL,
  done boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS issue_subtasks_issue_idx ON issue_subtasks (issue_id);

CREATE TABLE IF NOT EXISTS issue_relations (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  type issue_relation_type NOT NULL,
  target_issue_id uuid NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS issue_relations_unique_uq ON issue_relations (issue_id, type, target_issue_id);
CREATE INDEX IF NOT EXISTS issue_relations_target_idx ON issue_relations (target_issue_id);

CREATE TABLE IF NOT EXISTS issue_activities (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  verb activity_verb NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS issue_activities_issue_idx ON issue_activities (issue_id);

