// This file contains the initial database schema as a string,
// removing the need for external .sql files which can complicate the build process.

export const INITIAL_SCHEMA = `
-- PRAGMA user_version is set to 7 by the database service for this schema.

-- =================================================================
--  CORE HIERARCHY & METADATA
-- =================================================================
CREATE TABLE nodes (
    node_id             TEXT PRIMARY KEY,
    parent_id           TEXT,
    node_type           TEXT NOT NULL CHECK(node_type IN ('folder', 'document')),
    title               TEXT NOT NULL,
    sort_order          INTEGER NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    is_locked           INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES nodes(node_id) ON DELETE CASCADE
);
CREATE INDEX idx_nodes_parent_id ON nodes (parent_id);

-- =================================================================
--  DOCUMENTS & CONTENT
-- =================================================================
CREATE TABLE documents (
  document_id         INTEGER PRIMARY KEY,
  node_id             TEXT NOT NULL UNIQUE REFERENCES nodes(node_id) ON DELETE CASCADE,
  doc_type            TEXT NOT NULL,
  language_hint       TEXT,
  language_source     TEXT DEFAULT 'unknown',
  doc_type_source     TEXT DEFAULT 'unknown',
  classification_updated_at TEXT,
  default_view_mode   TEXT,
  current_version_id  INTEGER REFERENCES doc_versions(version_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_document_node_id ON documents(node_id);

CREATE TABLE content_store (
  content_id    INTEGER PRIMARY KEY,
  sha256_hex    TEXT NOT NULL UNIQUE,
  text_content  TEXT,
  blob_content  BLOB
);
CREATE INDEX idx_content_sha ON content_store(sha256_hex);

CREATE TABLE doc_versions (
  version_id   INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  content_id   INTEGER NOT NULL REFERENCES content_store(content_id) ON DELETE RESTRICT
);
CREATE INDEX idx_doc_version_doc ON doc_versions(document_id);

CREATE VIRTUAL TABLE document_search USING fts5(
  document_id UNINDEXED,
  node_id UNINDEXED,
  title,
  body
);

CREATE TRIGGER document_search_after_document_insert
AFTER INSERT ON documents
BEGIN
  INSERT INTO document_search(rowid, document_id, node_id, title, body)
  VALUES (
    new.document_id,
    new.document_id,
    new.node_id,
    (SELECT title FROM nodes WHERE node_id = new.node_id),
    COALESCE((
      SELECT cs.text_content
      FROM doc_versions dv
      JOIN content_store cs ON dv.content_id = cs.content_id
      WHERE dv.version_id = new.current_version_id
    ), '')
  );
END;

CREATE TRIGGER document_search_after_document_update
AFTER UPDATE OF current_version_id ON documents
BEGIN
  DELETE FROM document_search WHERE rowid = new.document_id;
  INSERT INTO document_search(rowid, document_id, node_id, title, body)
  VALUES (
    new.document_id,
    new.document_id,
    new.node_id,
    (SELECT title FROM nodes WHERE node_id = new.node_id),
    COALESCE((
      SELECT cs.text_content
      FROM doc_versions dv
      JOIN content_store cs ON dv.content_id = cs.content_id
      WHERE dv.version_id = new.current_version_id
    ), '')
  );
END;

CREATE TRIGGER document_search_after_document_delete
AFTER DELETE ON documents
BEGIN
  DELETE FROM document_search WHERE rowid = old.document_id;
END;

CREATE TRIGGER document_search_after_node_title_update
AFTER UPDATE OF title ON nodes
WHEN new.node_type = 'document'
BEGIN
  DELETE FROM document_search
  WHERE rowid = (
    SELECT document_id FROM documents WHERE node_id = new.node_id
  );
  INSERT INTO document_search(rowid, document_id, node_id, title, body)
  SELECT
    d.document_id,
    d.document_id,
    d.node_id,
    new.title,
    COALESCE(cs.text_content, '')
  FROM documents d
  LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
  LEFT JOIN content_store cs ON dv.content_id = cs.content_id
  WHERE d.node_id = new.node_id;
END;

-- =================================================================
--  ANCILLARY TABLES
-- =================================================================
CREATE TABLE templates (
    template_id         TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    content             TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE settings (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL
);

-- =================================================================
--  PYTHON ENVIRONMENT MANAGEMENT
-- =================================================================
CREATE TABLE python_environments (
    env_id              TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    python_executable   TEXT NOT NULL,
    python_version      TEXT NOT NULL,
    managed             INTEGER NOT NULL DEFAULT 1,
    config_json         TEXT NOT NULL,
    working_directory   TEXT,
    description         TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE python_execution_runs (
    run_id              TEXT PRIMARY KEY,
    node_id             TEXT NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    env_id              TEXT REFERENCES python_environments(env_id) ON DELETE SET NULL,
    status              TEXT NOT NULL,
    started_at          TEXT NOT NULL,
    finished_at         TEXT,
    exit_code           INTEGER,
    error_message       TEXT,
    duration_ms         INTEGER
);

CREATE TABLE python_execution_logs (
    log_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id              TEXT NOT NULL REFERENCES python_execution_runs(run_id) ON DELETE CASCADE,
    timestamp           TEXT NOT NULL,
    level               TEXT NOT NULL,
    message             TEXT NOT NULL
);

CREATE TABLE node_python_settings (
    node_id             TEXT PRIMARY KEY REFERENCES nodes(node_id) ON DELETE CASCADE,
    env_id              TEXT REFERENCES python_environments(env_id) ON DELETE SET NULL,
    auto_detect_env     INTEGER NOT NULL DEFAULT 1,
    last_run_id         TEXT REFERENCES python_execution_runs(run_id) ON DELETE SET NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX idx_python_runs_node ON python_execution_runs(node_id);
CREATE INDEX idx_python_runs_env ON python_execution_runs(env_id);
CREATE INDEX idx_python_logs_run ON python_execution_logs(run_id);

CREATE TABLE script_execution_runs (
    run_id              TEXT PRIMARY KEY,
    node_id             TEXT NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    language            TEXT NOT NULL,
    mode                TEXT NOT NULL DEFAULT 'run',
    status              TEXT NOT NULL,
    started_at          TEXT NOT NULL,
    finished_at         TEXT,
    exit_code           INTEGER,
    error_message       TEXT,
    duration_ms         INTEGER
);

CREATE TABLE script_execution_logs (
    log_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id              TEXT NOT NULL REFERENCES script_execution_runs(run_id) ON DELETE CASCADE,
    timestamp           TEXT NOT NULL,
    level               TEXT NOT NULL,
    message             TEXT NOT NULL
);

CREATE TABLE node_script_settings (
    node_id             TEXT NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    language            TEXT NOT NULL,
    env_vars_json       TEXT NOT NULL,
    working_directory   TEXT,
    executable          TEXT,
    last_run_id         TEXT REFERENCES script_execution_runs(run_id) ON DELETE SET NULL,
    updated_at          TEXT NOT NULL,
    PRIMARY KEY (node_id, language)
);

CREATE INDEX idx_script_runs_node_lang ON script_execution_runs(node_id, language);
CREATE INDEX idx_script_logs_run ON script_execution_logs(run_id);
`;