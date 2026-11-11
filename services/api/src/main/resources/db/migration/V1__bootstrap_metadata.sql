CREATE TABLE app_metadata (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_metadata (id, schema_version) VALUES (1, 1);
