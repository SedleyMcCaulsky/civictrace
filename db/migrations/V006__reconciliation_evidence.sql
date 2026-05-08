-- =============================================================
-- V006 :: PAYMENT RECONCILIATION DOMAIN
-- Manual reconciliation against legacy system payment reports
-- =============================================================

-- -------------------------------------------------------
-- RECONCILIATION BATCH (imported legacy payment report)
-- Officers generate this in the legacy system, then manually
-- enter the data here. No automated sync.
-- -------------------------------------------------------
CREATE TABLE reconciliation.reconciliation_batch (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference     VARCHAR(100) NOT NULL,           -- reference from legacy system report
    report_period_start DATE NOT NULL,
    report_period_end   DATE NOT NULL,
    submitted_by        UUID NOT NULL REFERENCES identity.user(id),
    total_records       INT NOT NULL DEFAULT 0,
    matched_count       INT NOT NULL DEFAULT 0,
    unmatched_count     INT NOT NULL DEFAULT 0,
    disputed_count      INT NOT NULL DEFAULT 0,
    total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'PROCESSING'
                            CHECK (status IN ('PROCESSING', 'COMPLETE', 'DISPUTED', 'ESCALATED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- PAYMENT RECONCILIATION RECORD (per-property entry)
-- Manually entered from legacy payment report.
-- Linked to PropertyCase via Area + Valuation Number.
-- -------------------------------------------------------
CREATE TABLE reconciliation.payment_reconciliation (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                UUID NOT NULL REFERENCES reconciliation.reconciliation_batch(id),
    property_case_id        UUID REFERENCES registry.property_case(id), -- nullable: may not find match

    -- Entered from legacy report (raw values)
    raw_area_code           VARCHAR(50) NOT NULL,
    raw_valuation_number    VARCHAR(100) NOT NULL,
    raw_owner_name          VARCHAR(255),               -- as it appears in legacy report

    -- Payment details from legacy report
    amount_paid             NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
    payment_date            DATE NOT NULL,
    payment_reference       VARCHAR(100),               -- legacy receipt number if available
    years_covered           INT[] NOT NULL DEFAULT '{}', -- e.g. {2022, 2023}

    -- Reconciliation outcome
    status                  reconciliation.reconciliation_status NOT NULL DEFAULT 'PENDING',
    match_confidence        NUMERIC(3,2),               -- 0.00 to 1.00 (system-computed match score)
    conflict_reason         TEXT,                       -- if DISPUTED or UNMATCHED
    resolution_notes        TEXT,

    -- Officer who submitted and who resolved
    submitted_by            UUID NOT NULL REFERENCES identity.user(id),
    resolved_by             UUID REFERENCES identity.user(id),
    resolved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- RECONCILIATION DISPUTE LOG
-- Formal dispute register when records cannot be matched
-- -------------------------------------------------------
CREATE TABLE reconciliation.reconciliation_dispute (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id   UUID NOT NULL REFERENCES reconciliation.payment_reconciliation(id),
    raised_by           UUID NOT NULL REFERENCES identity.user(id),
    dispute_reason      TEXT NOT NULL,
    supporting_notes    TEXT,
    escalated_to        UUID REFERENCES identity.user(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    resolution_notes    TEXT,
    resolved_by         UUID REFERENCES identity.user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_recon_batch          ON reconciliation.payment_reconciliation(batch_id);
CREATE INDEX idx_recon_case           ON reconciliation.payment_reconciliation(property_case_id)
    WHERE property_case_id IS NOT NULL;
CREATE INDEX idx_recon_status         ON reconciliation.payment_reconciliation(status);
CREATE INDEX idx_recon_valuation_trgm ON reconciliation.payment_reconciliation
    USING GIN(raw_valuation_number gin_trgm_ops);
CREATE INDEX idx_recon_area_valuation ON reconciliation.payment_reconciliation(raw_area_code, raw_valuation_number);
CREATE INDEX idx_recon_payment_date   ON reconciliation.payment_reconciliation(payment_date DESC);
CREATE INDEX idx_dispute_recon        ON reconciliation.reconciliation_dispute(reconciliation_id);
CREATE INDEX idx_dispute_status       ON reconciliation.reconciliation_dispute(status)
    WHERE status IN ('OPEN', 'UNDER_REVIEW');

-- -------------------------------------------------------
-- TRIGGERS
-- -------------------------------------------------------
CREATE TRIGGER trg_recon_batch_updated_at
    BEFORE UPDATE ON reconciliation.reconciliation_batch
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_recon_updated_at
    BEFORE UPDATE ON reconciliation.payment_reconciliation
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update tax_balance when reconciliation MATCHED
CREATE OR REPLACE FUNCTION reconciliation.apply_payment_to_balance()
RETURNS TRIGGER AS $$
DECLARE
    yr INT;
BEGIN
    -- Only process when status transitions to MATCHED
    IF NEW.status = 'MATCHED' AND OLD.status != 'MATCHED' AND NEW.property_case_id IS NOT NULL THEN
        FOREACH yr IN ARRAY NEW.years_covered
        LOOP
            UPDATE registry.tax_balance
            SET amount_paid = LEAST(amount_due, amount_paid + (NEW.amount_paid / ARRAY_LENGTH(NEW.years_covered, 1))),
                last_reconciled_at = NOW(),
                reconciled_by = NEW.resolved_by,
                status = CASE
                    WHEN (amount_paid + (NEW.amount_paid / ARRAY_LENGTH(NEW.years_covered, 1))) >= amount_due
                    THEN 'PAID'::registry.balance_status
                    ELSE 'PARTIAL'::registry.balance_status
                END,
                updated_at = NOW()
            WHERE property_case_id = NEW.property_case_id
              AND tax_year = yr;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_payment_on_match
    AFTER UPDATE OF status ON reconciliation.payment_reconciliation
    FOR EACH ROW EXECUTE FUNCTION reconciliation.apply_payment_to_balance();


-- =============================================================
-- V006b :: EVIDENCE MANAGEMENT DOMAIN
-- Attached to delivery records; photos, signatures, documents
-- =============================================================

CREATE TABLE evidence.evidence_file (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_delivery_id  UUID NOT NULL REFERENCES delivery.notice_delivery(id) ON DELETE CASCADE,
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id),
    officer_id          UUID NOT NULL REFERENCES identity.user(id),

    file_type           evidence.file_type NOT NULL,
    storage_key         VARCHAR(500) NOT NULL UNIQUE,   -- MinIO/S3 object key
    storage_bucket      VARCHAR(100) NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(100),
    file_size_bytes     BIGINT,
    checksum_sha256     VARCHAR(64),                    -- integrity verification

    -- GPS at time of capture
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    captured_at         TIMESTAMPTZ NOT NULL,           -- device time of capture
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Moderation / validation
    is_valid            BOOLEAN NOT NULL DEFAULT TRUE,
    invalidated_reason  TEXT,
    invalidated_by      UUID REFERENCES identity.user(id)
);

-- Signed URL cache (transient — for pre-signed download links)
CREATE TABLE evidence.signed_url_cache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id     UUID NOT NULL REFERENCES evidence.evidence_file(id) ON DELETE CASCADE,
    signed_url      TEXT NOT NULL,                      -- pre-signed S3/MinIO URL
    expires_at      TIMESTAMPTZ NOT NULL,
    created_for     UUID REFERENCES identity.user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_delivery     ON evidence.evidence_file(notice_delivery_id);
CREATE INDEX idx_evidence_case         ON evidence.evidence_file(property_case_id);
CREATE INDEX idx_evidence_officer      ON evidence.evidence_file(officer_id);
CREATE INDEX idx_evidence_type         ON evidence.evidence_file(file_type);
CREATE INDEX idx_signed_url_expires    ON evidence.signed_url_cache(expires_at);
