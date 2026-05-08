-- =============================================================
-- V004 :: PROPERTY CASE REGISTRY DOMAIN
-- PropertyCase, TaxBalance — Core Operational Domain
-- =============================================================

-- -------------------------------------------------------
-- PROPERTY CASE (primary operational entity)
-- -------------------------------------------------------
CREATE TABLE registry.property_case (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- =====================================================
    -- CRITICAL DOMAIN KEY: Area + Valuation Number
    -- This is the primary reconciliation anchor.
    -- All search, reporting, GIS, and audit keys off this.
    -- =====================================================
    area_id             UUID NOT NULL REFERENCES gis.area(id),
    area_code           VARCHAR(50) NOT NULL,           -- denormalized for query speed
    valuation_number    VARCHAR(100) NOT NULL,           -- e.g. '105C-2W-06-038'
    composite_key       VARCHAR(200) GENERATED ALWAYS AS (area_code || '::' || valuation_number) STORED,

    -- Property Identity
    owner_name          BYTEA NOT NULL,                 -- PGP encrypted (PII)
    owner_name_search   TEXT GENERATED ALWAYS AS (NULL) STORED, -- filled by app-layer hash for search
    property_address    TEXT NOT NULL,
    property_type       registry.property_type NOT NULL,
    volume              VARCHAR(50),
    folio               VARCHAR(50),

    -- GIS Location
    location            GEOMETRY(POINT, 4326),           -- geocoded property coordinates
    geo_accuracy        VARCHAR(20),                     -- 'EXACT', 'APPROXIMATE', 'AREA_CENTROID'

    -- Lifecycle
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID NOT NULL REFERENCES identity.user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ                      -- soft delete only

    CONSTRAINT uq_area_valuation UNIQUE (area_id, valuation_number)
);

-- Plaintext owner name search column (app-layer decrypted and stored as trigram-indexed)
-- NOTE: This stores a normalized (lowercased, stripped) plaintext version for search.
--       PII policy: acceptable for internal government ops. Adjust if stricter required.
ALTER TABLE registry.property_case
    ALTER COLUMN owner_name_search DROP EXPRESSION;     -- allow app to set manually

-- -------------------------------------------------------
-- TAX BALANCE (per-year outstanding amounts)
-- -------------------------------------------------------
CREATE TABLE registry.tax_balance (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id) ON DELETE CASCADE,

    tax_year            SMALLINT NOT NULL,               -- e.g. 2022, 2023, 2024
    amount_due          NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
    amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    balance             NUMERIC(12,2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
    status              registry.balance_status NOT NULL DEFAULT 'OUTSTANDING',
    notes               TEXT,

    -- Reconciliation linkage (set when payment reconciled)
    last_reconciled_at  TIMESTAMPTZ,
    reconciled_by       UUID REFERENCES identity.user(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_case_year UNIQUE (property_case_id, tax_year),
    CONSTRAINT chk_paid_not_exceed_due CHECK (amount_paid <= amount_due)
);

-- -------------------------------------------------------
-- COMPLIANCE STATUS (current computed state per case)
-- -------------------------------------------------------
CREATE TABLE compliance.case_compliance_status (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_case_id    UUID NOT NULL UNIQUE REFERENCES registry.property_case(id) ON DELETE CASCADE,

    status              compliance.compliance_status_value NOT NULL DEFAULT 'DELINQUENT',
    risk_level          compliance.risk_level NOT NULL DEFAULT 'UNKNOWN',
    risk_score          NUMERIC(5,2),                   -- 0.00 to 100.00 (AI-generated)
    risk_score_reason   TEXT,                            -- AI narrative
    total_outstanding   NUMERIC(14,2) NOT NULL DEFAULT 0,
    years_outstanding   INT NOT NULL DEFAULT 0,
    last_delivery_status delivery.delivery_status,
    last_delivery_at    TIMESTAMPTZ,
    last_payment_at     TIMESTAMPTZ,

    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- IMPORT BATCH (tracks bulk imports from printed notice batches)
-- -------------------------------------------------------
CREATE TABLE registry.import_batch (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference VARCHAR(100) NOT NULL,           -- officer-entered batch ID from legacy system
    imported_by     UUID NOT NULL REFERENCES identity.user(id),
    total_records   INT NOT NULL DEFAULT 0,
    successful      INT NOT NULL DEFAULT 0,
    failed          INT NOT NULL DEFAULT 0,
    source          VARCHAR(50) NOT NULL DEFAULT 'MANUAL', -- 'MANUAL', 'CSV_UPLOAD'
    notes           TEXT,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link cases to import batch
ALTER TABLE registry.property_case
    ADD COLUMN import_batch_id UUID REFERENCES registry.import_batch(id);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------

-- CRITICAL: Composite key search (most frequent query pattern)
CREATE UNIQUE INDEX idx_case_composite_key
    ON registry.property_case(area_id, valuation_number)
    WHERE deleted_at IS NULL;

-- Composite key text index (for API text-based lookup)
CREATE UNIQUE INDEX idx_case_composite_text
    ON registry.property_case(composite_key)
    WHERE deleted_at IS NULL;

-- Valuation number partial match
CREATE INDEX idx_case_valuation_trgm
    ON registry.property_case USING GIN(valuation_number gin_trgm_ops);

-- Owner name fuzzy search (trigram on plaintext search column)
CREATE INDEX idx_case_owner_trgm
    ON registry.property_case USING GIN(owner_name_search gin_trgm_ops)
    WHERE owner_name_search IS NOT NULL;

-- GIS spatial index on property locations
CREATE INDEX idx_case_location
    ON registry.property_case USING GIST(location)
    WHERE location IS NOT NULL;

-- Area-based queries (most report groupings use this)
CREATE INDEX idx_case_area
    ON registry.property_case(area_id)
    WHERE deleted_at IS NULL;

-- Tax balance lookups
CREATE INDEX idx_balance_case         ON registry.tax_balance(property_case_id);
CREATE INDEX idx_balance_year         ON registry.tax_balance(tax_year);
CREATE INDEX idx_balance_status       ON registry.tax_balance(status);
CREATE INDEX idx_balance_outstanding  ON registry.tax_balance(property_case_id, tax_year)
    WHERE status = 'OUTSTANDING';

-- Compliance lookups
CREATE INDEX idx_compliance_status    ON compliance.case_compliance_status(status);
CREATE INDEX idx_compliance_risk      ON compliance.case_compliance_status(risk_level);
CREATE INDEX idx_compliance_total_out ON compliance.case_compliance_status(total_outstanding DESC);

-- Import batch
CREATE INDEX idx_case_import_batch    ON registry.property_case(import_batch_id);

-- -------------------------------------------------------
-- UPDATED_AT TRIGGER (reusable function)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_case_updated_at
    BEFORE UPDATE ON registry.property_case
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tax_balance_updated_at
    BEFORE UPDATE ON registry.tax_balance
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_compliance_status_updated_at
    BEFORE UPDATE ON compliance.case_compliance_status
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
