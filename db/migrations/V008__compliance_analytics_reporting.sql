-- =============================================================
-- V008 :: COMPLIANCE ANALYTICS & AI DOMAIN
-- Risk Scores, Pattern Detection, Executive Summary Cache
-- =============================================================

-- -------------------------------------------------------
-- AI RISK SCORE HISTORY (append-only scoring log)
-- -------------------------------------------------------
CREATE TABLE compliance.risk_score_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_case_id    UUID NOT NULL REFERENCES registry.property_case(id),
    composite_key       VARCHAR(200) NOT NULL,

    risk_score          NUMERIC(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_level          compliance.risk_level NOT NULL,
    scoring_model       VARCHAR(100) NOT NULL DEFAULT 'v1',
    score_factors       JSONB NOT NULL DEFAULT '{}',        -- e.g. {"years_delinquent": 3, "failed_deliveries": 2}
    narrative           TEXT,                               -- AI-generated explanation

    scored_by           VARCHAR(50) NOT NULL DEFAULT 'SYSTEM', -- 'SYSTEM' or user_id
    scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- AI EXECUTIVE SUMMARY CACHE
-- Generated weekly by AI service, stored for fast retrieval
-- -------------------------------------------------------
CREATE TABLE compliance.executive_summary (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    area_id             UUID REFERENCES gis.area(id),       -- NULL = system-wide
    summary_type        VARCHAR(30) NOT NULL DEFAULT 'WEEKLY'
                            CHECK (summary_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),

    narrative           TEXT NOT NULL,                      -- AI-generated markdown
    key_metrics         JSONB NOT NULL DEFAULT '{}',        -- structured KPIs
    recommendations     JSONB NOT NULL DEFAULT '[]',        -- AI recommendations array

    generated_by        VARCHAR(50) NOT NULL DEFAULT 'AI',
    model_version       VARCHAR(50),
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_summary_period_area UNIQUE (period_start, period_end, summary_type, area_id)
);

-- -------------------------------------------------------
-- PATTERN DETECTION EVENTS
-- -------------------------------------------------------
CREATE TABLE compliance.pattern_detection_event (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type        VARCHAR(100) NOT NULL,              -- 'REPEAT_FAILED_DELIVERY', 'GEO_CLUSTER', 'LOW_CONVERSION_ZONE'
    area_id             UUID REFERENCES gis.area(id),
    property_case_id    UUID REFERENCES registry.property_case(id),
    officer_id          UUID REFERENCES identity.user(id),

    severity            compliance.risk_level NOT NULL,
    description         TEXT NOT NULL,
    affected_count      INT,
    metadata            JSONB NOT NULL DEFAULT '{}',        -- pattern-specific detail

    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by     UUID REFERENCES identity.user(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ
);

-- -------------------------------------------------------
-- REPORTING :: MATERIALIZED VIEWS
-- Refreshed by scheduled jobs (cron in NestJS)
-- -------------------------------------------------------

-- Officer daily delivery summary
CREATE MATERIALIZED VIEW reporting.officer_daily_summary AS
SELECT
    nd.officer_id,
    u.full_name                         AS officer_name,
    DATE(nd.delivered_at)               AS report_date,
    nd.assignment_id,
    COUNT(*)                            AS total_attempts,
    COUNT(*) FILTER (WHERE nd.status = 'DELIVERED')         AS delivered,
    COUNT(*) FILTER (WHERE nd.status = 'OWNER_ABSENT')      AS owner_absent,
    COUNT(*) FILTER (WHERE nd.status = 'REFUSED')           AS refused,
    COUNT(*) FILTER (WHERE nd.status = 'VACANT')            AS vacant,
    COUNT(*) FILTER (WHERE nd.status = 'INCORRECT_ADDRESS') AS incorrect_address,
    COUNT(*) FILTER (WHERE nd.status = 'ACCESS_DENIED')     AS access_denied,
    COUNT(*) FILTER (WHERE nd.status = 'DEMOLISHED')        AS demolished,
    ROUND(
        COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') * 100.0 / NULLIF(COUNT(*), 0),
        2
    )                                   AS delivery_rate_pct,
    MIN(nd.delivered_at)                AS first_delivery,
    MAX(nd.delivered_at)                AS last_delivery,
    a.code                              AS area_code,
    a.name                              AS area_name
FROM delivery.notice_delivery nd
JOIN identity.user u ON u.id = nd.officer_id
LEFT JOIN delivery.officer_assignment oa ON oa.id = nd.assignment_id
LEFT JOIN gis.area a ON a.id = oa.area_id
WHERE nd.delivered_at IS NOT NULL
GROUP BY nd.officer_id, u.full_name, DATE(nd.delivered_at), nd.assignment_id, a.code, a.name;

CREATE UNIQUE INDEX idx_mv_officer_daily
    ON reporting.officer_daily_summary(officer_id, report_date, assignment_id);

-- Area delinquency summary
CREATE MATERIALIZED VIEW reporting.area_delinquency_summary AS
SELECT
    a.id                                AS area_id,
    a.code                              AS area_code,
    a.name                              AS area_name,
    a.parish,
    COUNT(pc.id)                        AS total_cases,
    COUNT(pc.id) FILTER (
        WHERE ccs.status = 'DELINQUENT'
    )                                   AS delinquent_cases,
    ROUND(
        COUNT(pc.id) FILTER (WHERE ccs.status = 'DELINQUENT') * 100.0 / NULLIF(COUNT(pc.id), 0),
        2
    )                                   AS delinquency_rate_pct,
    COALESCE(SUM(ccs.total_outstanding), 0) AS total_outstanding_amount,
    COALESCE(AVG(ccs.risk_score), 0)    AS avg_risk_score,
    COUNT(pc.id) FILTER (
        WHERE ccs.risk_level = 'CRITICAL'
    )                                   AS critical_risk_cases,
    NOW()                               AS computed_at
FROM gis.area a
LEFT JOIN registry.property_case pc ON pc.area_id = a.id AND pc.deleted_at IS NULL
LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
GROUP BY a.id, a.code, a.name, a.parish;

CREATE UNIQUE INDEX idx_mv_area_delinquency ON reporting.area_delinquency_summary(area_id);

-- Payment conversion summary (per reconciliation period)
CREATE MATERIALIZED VIEW reporting.payment_conversion_summary AS
SELECT
    DATE_TRUNC('month', pr.payment_date)  AS period_month,
    pc.area_id,
    a.name                                AS area_name,
    COUNT(pr.id)                          AS total_reconciled,
    COUNT(pr.id) FILTER (WHERE pr.status = 'MATCHED')    AS matched,
    COUNT(pr.id) FILTER (WHERE pr.status = 'UNMATCHED')  AS unmatched,
    COUNT(pr.id) FILTER (WHERE pr.status = 'DISPUTED')   AS disputed,
    COALESCE(SUM(pr.amount_paid) FILTER (WHERE pr.status = 'MATCHED'), 0)   AS matched_amount,
    COALESCE(SUM(pr.amount_paid) FILTER (WHERE pr.status = 'UNMATCHED'), 0) AS unmatched_amount,
    NOW()                                 AS computed_at
FROM reconciliation.payment_reconciliation pr
LEFT JOIN registry.property_case pc ON pc.id = pr.property_case_id
LEFT JOIN gis.area a ON a.id = pc.area_id
GROUP BY DATE_TRUNC('month', pr.payment_date), pc.area_id, a.name;

CREATE INDEX idx_mv_payment_conv ON reporting.payment_conversion_summary(period_month DESC, area_id);

-- -------------------------------------------------------
-- REPORT JOB QUEUE (scheduled report generation)
-- -------------------------------------------------------
CREATE TABLE reporting.report_job (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type     VARCHAR(100) NOT NULL,
    parameters      JSONB NOT NULL DEFAULT '{}',
    requested_by    UUID REFERENCES identity.user(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED')),
    file_key        VARCHAR(500),                       -- MinIO storage key when complete
    error_message   TEXT,
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_risk_log_case      ON compliance.risk_score_log(property_case_id, scored_at DESC);
CREATE INDEX idx_risk_log_level     ON compliance.risk_score_log(risk_level, scored_at DESC);
CREATE INDEX idx_exec_summary_date  ON compliance.executive_summary(period_start DESC, summary_type);
CREATE INDEX idx_pattern_type       ON compliance.pattern_detection_event(pattern_type, detected_at DESC);
CREATE INDEX idx_pattern_area       ON compliance.pattern_detection_event(area_id, detected_at DESC);
CREATE INDEX idx_pattern_unresolved ON compliance.pattern_detection_event(detected_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX idx_report_job_status  ON reporting.report_job(status, queued_at)
    WHERE status IN ('QUEUED', 'PROCESSING');
