// This file contains the initial database schema as a string,
// removing the need for external .sql files which can complicate the build process.

export const INITIAL_SCHEMA = `
-- PRAGMA user_version is set to 1 by the database service for this schema.

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
`;