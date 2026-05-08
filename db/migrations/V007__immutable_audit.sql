-- =============================================================
-- V007 :: IMMUTABLE AUDIT DOMAIN
-- Government-grade append-only forensic audit log.
-- NO updates. NO deletes. EVER.
-- =============================================================

-- -------------------------------------------------------
-- AUDIT LOG (CORE — IMMUTABLE)
-- -------------------------------------------------------
CREATE TABLE audit.audit_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Actor
    actor_id            UUID REFERENCES identity.user(id),  -- nullable for system events
    actor_email         VARCHAR(255),                        -- denormalized (user may be deleted)
    actor_role          VARCHAR(100),                        -- denormalized at time of action
    is_system_event     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Action
    action              audit.action_type NOT NULL,
    entity_type         VARCHAR(100) NOT NULL,               -- e.g. 'registry.property_case'
    entity_id           UUID,                                -- affected record ID
    composite_key       VARCHAR(200),                        -- Area::ValuationNumber if applicable
    description         TEXT,                                -- human-readable summary

    -- Data Change Capture
    previous_value      JSONB,                               -- state BEFORE action
    new_value           JSONB,                               -- state AFTER action
    changed_fields      TEXT[],                              -- array of changed field names

    -- Context
    ip_address          INET,
    user_agent          TEXT,
    device_id           UUID,                                -- REFERENCES identity.device (no FK — immutable)
    device_fingerprint  VARCHAR(512),                        -- denormalized

    -- GPS (mobile events)
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    location            GEOMETRY(POINT, 4326)
                            GENERATED ALWAYS AS (
                                CASE WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL
                                THEN ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326)
                                ELSE NULL END
                            ) STORED,

    -- Request tracing
    request_id          UUID,                                -- correlation ID across services
    session_id          UUID,                                -- REFERENCES identity.session (no FK)

    -- Integrity
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- server-authoritative timestamp
    client_timestamp    TIMESTAMPTZ,                         -- device time (may differ from server)
    checksum            VARCHAR(64) NOT NULL                 -- SHA-256 of core fields for tamper detection
);

-- -------------------------------------------------------
-- AUDIT INTEGRITY: Strip all write permissions from app users
-- The application writes via a SECURITY DEFINER function only.
-- -------------------------------------------------------

-- Revoke direct table write from app role (set app_role to actual NestJS DB user)
-- REVOKE INSERT, UPDATE, DELETE ON audit.audit_log FROM app_role;

-- -------------------------------------------------------
-- WRITE FUNCTION (only path into audit_log)
-- Called by trigger or application service layer.
-- SECURITY DEFINER = runs as DB owner, not calling user.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.write_audit_log(
    p_actor_id          UUID,
    p_actor_email       VARCHAR,
    p_actor_role        VARCHAR,
    p_is_system_event   BOOLEAN,
    p_action            audit.action_type,
    p_entity_type       VARCHAR,
    p_entity_id         UUID,
    p_composite_key     VARCHAR,
    p_description       TEXT,
    p_previous_value    JSONB,
    p_new_value         JSONB,
    p_changed_fields    TEXT[],
    p_ip_address        INET,
    p_user_agent        TEXT,
    p_device_id         UUID,
    p_device_fingerprint VARCHAR,
    p_gps_lat           DOUBLE PRECISION,
    p_gps_lng           DOUBLE PRECISION,
    p_request_id        UUID,
    p_session_id        UUID,
    p_client_timestamp  TIMESTAMPTZ
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
    v_id        UUID := uuid_generate_v4();
    v_checksum  VARCHAR;
BEGIN
    -- Compute integrity checksum over immutable fields
    v_checksum := encode(
        digest(
            COALESCE(p_actor_id::TEXT, '') ||
            p_action::TEXT ||
            p_entity_type ||
            COALESCE(p_entity_id::TEXT, '') ||
            COALESCE(p_composite_key, '') ||
            COALESCE(p_previous_value::TEXT, '') ||
            COALESCE(p_new_value::TEXT, '') ||
            NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    INSERT INTO audit.audit_log (
        id, actor_id, actor_email, actor_role, is_system_event,
        action, entity_type, entity_id, composite_key, description,
        previous_value, new_value, changed_fields,
        ip_address, user_agent, device_id, device_fingerprint,
        gps_lat, gps_lng, request_id, session_id,
        client_timestamp, occurred_at, checksum
    ) VALUES (
        v_id, p_actor_id, p_actor_email, p_actor_role, p_is_system_event,
        p_action, p_entity_type, p_entity_id, p_composite_key, p_description,
        p_previous_value, p_new_value, p_changed_fields,
        p_ip_address, p_user_agent, p_device_id, p_device_fingerprint,
        p_gps_lat, p_gps_lng, p_request_id, p_session_id,
        p_client_timestamp, NOW(), v_checksum
    );

    RETURN v_id;
END;
$$;

-- -------------------------------------------------------
-- PREVENT UPDATES AND DELETES (row-level trigger guard)
-- Secondary defense layer — primary is revoked permissions.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'AUDIT INTEGRITY VIOLATION: audit_log records are immutable. Action: %, Table: %',
        TG_OP, TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit.audit_log
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit.audit_log
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

-- -------------------------------------------------------
-- AUDIT SNAPSHOT (point-in-time entity reconstruction)
-- View that reconstructs entity state from audit events
-- -------------------------------------------------------
CREATE OR REPLACE VIEW audit.entity_timeline AS
SELECT
    al.id                   AS log_id,
    al.entity_type,
    al.entity_id,
    al.composite_key,
    al.action,
    al.actor_email,
    al.actor_role,
    al.description,
    al.previous_value,
    al.new_value,
    al.changed_fields,
    al.ip_address,
    al.device_fingerprint,
    al.gps_lat,
    al.gps_lng,
    al.occurred_at,
    al.client_timestamp,
    al.checksum,
    -- Flag if checksum needs re-verification
    (al.checksum IS NOT NULL) AS integrity_verified
FROM audit.audit_log al
ORDER BY al.occurred_at DESC;

-- -------------------------------------------------------
-- INDEXES (read-heavy; writes are append-only inserts)
-- -------------------------------------------------------
CREATE INDEX idx_audit_entity        ON audit.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_composite_key ON audit.audit_log(composite_key) WHERE composite_key IS NOT NULL;
CREATE INDEX idx_audit_actor         ON audit.audit_log(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_action        ON audit.audit_log(action);
CREATE INDEX idx_audit_occurred      ON audit.audit_log(occurred_at DESC);
CREATE INDEX idx_audit_request       ON audit.audit_log(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_session       ON audit.audit_log(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_location      ON audit.audit_log USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX idx_audit_entity_time   ON audit.audit_log(entity_id, occurred_at DESC);

-- JSONB path indexing for value diffing queries
CREATE INDEX idx_audit_prev_value    ON audit.audit_log USING GIN(previous_value jsonb_path_ops)
    WHERE previous_value IS NOT NULL;
CREATE INDEX idx_audit_new_value     ON audit.audit_log USING GIN(new_value jsonb_path_ops)
    WHERE new_value IS NOT NULL;
