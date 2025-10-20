-- Adds metadata columns so DocForge can record how document classifications were determined.
ALTER TABLE documents ADD COLUMN language_source TEXT;
ALTER TABLE documents ADD COLUMN doc_type_source TEXT;
ALTER TABLE documents ADD COLUMN classification_updated_at TEXT;
UPDATE documents SET language_source = COALESCE(language_source, 'unknown');
UPDATE documents SET doc_type_source = COALESCE(doc_type_source, 'unknown');
