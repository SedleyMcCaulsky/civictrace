-- =============================================================
-- V005 :: NOTICE DELIVERY DOMAIN
-- Officer Assignments, Delivery Records, Mobile Sync Queue
-- =============================================================

-- -------------------------------------------------------
-- OFFICER ASSIGNMENT (batch-level work assignment)
-- -------------------------------------------------------
CREATE TABLE delivery.officer_assignment (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),
    supervisor_id       UUID REFERENCES identity.user(id),
    area_id             UUID NOT NULL REFERENCES gis.area(id),

    assignment_date     DATE NOT NULL,
    total_cases         INT NOT NULL DEFAULT 0,
    completed_cases     INT NOT NULL DEFAULT 0,
    notes               TEXT,

    status              VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link property cases to assignments (many-to-many via assignment)
CREATE TABLE delivery.assignment_case (
    assignment_id       UUID NOT NULL REFERENCES delivery.officer_assignment(id) ON DELETE CASCADE,
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id),
    sequence_order      INT,                            -- suggested delivery order
    PRIMARY KEY (assignment_id, property_case_id)
);

-- -------------------------------------------------------
-- NOTICE DELIVERY RECORD (per-property field outcome)
-- -------------------------------------------------------
CREATE TABLE delivery.notice_delivery (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),
    assignment_id       UUID REFERENCES delivery.officer_assignment(id),

    -- Delivery Outcome
    status              delivery.delivery_status NOT NULL,
    notes               TEXT,
    recipient_name      VARCHAR(255),                   -- who received the notice (if delivered)

    -- GPS Evidence
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    gps_accuracy_m      NUMERIC(6,2),
    location            GEOMETRY(POINT, 4326)
                            GENERATED ALWAYS AS (
                                CASE WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL
                                THEN ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326)
                                ELSE NULL END
                            ) STORED,

    -- Timestamps
    delivered_at        TIMESTAMPTZ,                    -- actual field timestamp (may differ from created_at)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Offline Sync Metadata
    local_id            UUID,                           -- mobile device UUID before server sync
    sync_status         delivery.sync_status NOT NULL DEFAULT 'SYNCED',
    synced_at           TIMESTAMPTZ,
    device_id           UUID REFERENCES identity.device(id),
    client_version      VARCHAR(20),

    -- Version for conflict detection
    version             INT NOT NULL DEFAULT 1
);

-- Prevent duplicate final deliveries per case per day
CREATE UNIQUE INDEX idx_delivery_case_officer_date
    ON delivery.notice_delivery(property_case_id, officer_id, DATE(delivered_at))
    WHERE status = 'DELIVERED';

-- -------------------------------------------------------
-- DELIVERY ATTEMPT HISTORY (audit trail per case)
-- Captures all attempts, not just final outcome
-- -------------------------------------------------------
CREATE TABLE delivery.delivery_attempt (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_delivery_id  UUID NOT NULL REFERENCES delivery.notice_delivery(id),
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),

    attempt_number      SMALLINT NOT NULL DEFAULT 1,
    status              delivery.delivery_status NOT NULL,
    notes               TEXT,
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    location            GEOMETRY(POINT, 4326)
                            GENERATED ALWAYS AS (
                                CASE WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL
                                THEN ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326)
                                ELSE NULL END
                            ) STORED
);

-- -------------------------------------------------------
-- MOBILE OFFLINE SYNC QUEUE
-- Stores events generated offline, pending server sync
-- -------------------------------------------------------
CREATE TABLE delivery.sync_queue (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id            UUID NOT NULL,                  -- device-generated UUID
    device_id           UUID REFERENCES identity.device(id),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),

    entity_type         VARCHAR(50) NOT NULL,           -- 'notice_delivery', 'evidence', etc.
    operation           VARCHAR(20) NOT NULL CHECK (operation IN ('CREATE', 'UPDATE')),
    payload             JSONB NOT NULL,                 -- full entity snapshot

    status              delivery.sync_status NOT NULL DEFAULT 'PENDING',
    retry_count         SMALLINT NOT NULL DEFAULT 0,
    last_error          TEXT,
    conflict_reason     TEXT,

    queued_at           TIMESTAMPTZ NOT NULL,           -- device time when action taken
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- server time of receipt
    processed_at        TIMESTAMPTZ
);

-- -------------------------------------------------------
-- SYNC CONFLICT LOG
-- When server-side conflict detected, log for manual resolution
-- -------------------------------------------------------
CREATE TABLE delivery.sync_conflict (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_queue_id       UUID NOT NULL REFERENCES delivery.sync_queue(id),
    property_case_id    UUID REFERENCES registry.property_case(id),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),

    conflict_type       VARCHAR(50) NOT NULL,           -- 'VERSION_MISMATCH', 'DUPLICATE', 'INVALID_STATE'
    local_payload       JSONB NOT NULL,
    server_state        JSONB,
    resolution          VARCHAR(30),                    -- 'SERVER_WINS', 'LOCAL_WINS', 'MANUAL', 'PENDING'
    resolved_by         UUID REFERENCES identity.user(id),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_assignment_officer     ON delivery.officer_assignment(officer_id, assignment_date DESC);
CREATE INDEX idx_assignment_area        ON delivery.officer_assignment(area_id, assignment_date DESC);
CREATE INDEX idx_assignment_supervisor  ON delivery.officer_assignment(supervisor_id);

CREATE INDEX idx_delivery_case          ON delivery.notice_delivery(property_case_id);
CREATE INDEX idx_delivery_officer       ON delivery.notice_delivery(officer_id);
CREATE INDEX idx_delivery_status        ON delivery.notice_delivery(status);
CREATE INDEX idx_delivery_date          ON delivery.notice_delivery(delivered_at DESC);
CREATE INDEX idx_delivery_location      ON delivery.notice_delivery USING GIST(location)
    WHERE location IS NOT NULL;
CREATE INDEX idx_delivery_sync          ON delivery.notice_delivery(sync_status)
    WHERE sync_status != 'SYNCED';

CREATE INDEX idx_attempt_delivery       ON delivery.delivery_attempt(notice_delivery_id);
CREATE INDEX idx_attempt_case           ON delivery.delivery_attempt(property_case_id);

CREATE INDEX idx_sync_queue_status      ON delivery.sync_queue(status, received_at)
    WHERE status IN ('PENDING', 'RETRYING', 'FAILED');
CREATE INDEX idx_sync_queue_officer     ON delivery.sync_queue(officer_id, queued_at DESC);
CREATE INDEX idx_sync_conflict_status  ON delivery.sync_conflict(resolution)
    WHERE resolution IS NULL OR resolution = 'PENDING';

-- -------------------------------------------------------
-- TRIGGERS
-- -------------------------------------------------------
CREATE TRIGGER trg_assignment_updated_at
    BEFORE UPDATE ON delivery.officer_assignment
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_delivery_updated_at
    BEFORE UPDATE ON delivery.notice_delivery
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update assignment completion counter
CREATE OR REPLACE FUNCTION delivery.update_assignment_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE delivery.officer_assignment
    SET completed_cases = (
        SELECT COUNT(DISTINCT property_case_id)
        FROM delivery.notice_delivery
        WHERE assignment_id = NEW.assignment_id
          AND status = 'DELIVERED'
    ),
    updated_at = NOW()
    WHERE id = NEW.assignment_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delivery_assignment_progress
    AFTER INSERT OR UPDATE OF status ON delivery.notice_delivery
    FOR EACH ROW
    WHEN (NEW.assignment_id IS NOT NULL)
    EXECUTE FUNCTION delivery.update_assignment_progress();
