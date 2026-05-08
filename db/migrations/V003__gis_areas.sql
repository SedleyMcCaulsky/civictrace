-- =============================================================
-- V003 :: GIS DOMAIN — AREAS & SPATIAL FOUNDATION
-- Must run before registry (Area FK dependency)
-- =============================================================

-- -------------------------------------------------------
-- AREA (GIS-enabled administrative zones)
-- -------------------------------------------------------
CREATE TABLE gis.area (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50) NOT NULL UNIQUE,    -- e.g. 'NORBROOK', 'CHERRY_GARDENS'
    name            VARCHAR(255) NOT NULL,
    parish          VARCHAR(100) NOT NULL,
    region          VARCHAR(100),
    boundary        GEOMETRY(MULTIPOLYGON, 4326),   -- WGS84 parish/area boundaries
    centroid        GEOMETRY(POINT, 4326),           -- auto-computed centroid
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- OFFICER ROUTE TRACES (field movement logs)
-- -------------------------------------------------------
CREATE TABLE gis.officer_route (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    officer_id      UUID NOT NULL REFERENCES identity.user(id),
    route_date      DATE NOT NULL,
    path            GEOMETRY(LINESTRING, 4326),      -- GPS trace of full day route
    total_distance_m NUMERIC(10,2),
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- GPS BREADCRUMBS (raw officer GPS pings)
-- -------------------------------------------------------
CREATE TABLE gis.gps_breadcrumb (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    officer_id      UUID NOT NULL REFERENCES identity.user(id),
    location        GEOMETRY(POINT, 4326) NOT NULL,
    accuracy_m      NUMERIC(6,2),
    recorded_at     TIMESTAMPTZ NOT NULL,
    synced_at       TIMESTAMPTZ
);

-- Partition by month for scale (>1M rows expected)
-- Production: use pg_partman for automated partition management

-- -------------------------------------------------------
-- DELINQUENCY HEATMAP CACHE (refreshed by cron)
-- -------------------------------------------------------
CREATE TABLE gis.delinquency_heatmap_cache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id         UUID NOT NULL REFERENCES gis.area(id),
    total_cases     INT NOT NULL DEFAULT 0,
    delinquent_cases INT NOT NULL DEFAULT 0,
    delinquency_rate NUMERIC(5,4),                  -- 0.0000 to 1.0000
    total_outstanding NUMERIC(14,2) DEFAULT 0,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_month    DATE NOT NULL                    -- first day of reporting month
);

-- -------------------------------------------------------
-- SPATIAL INDEXES (critical for PostGIS query performance)
-- -------------------------------------------------------
CREATE INDEX idx_area_boundary      ON gis.area USING GIST(boundary);
CREATE INDEX idx_area_centroid      ON gis.area USING GIST(centroid);
CREATE INDEX idx_area_parish        ON gis.area(parish);
CREATE INDEX idx_route_officer      ON gis.officer_route(officer_id, route_date);
CREATE INDEX idx_route_path         ON gis.officer_route USING GIST(path);
CREATE INDEX idx_breadcrumb_officer ON gis.gps_breadcrumb(officer_id, recorded_at DESC);
CREATE INDEX idx_breadcrumb_loc     ON gis.gps_breadcrumb USING GIST(location);
CREATE INDEX idx_heatmap_area_month ON gis.delinquency_heatmap_cache(area_id, period_month DESC);

-- -------------------------------------------------------
-- AUTO-COMPUTE CENTROID TRIGGER
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION gis.compute_area_centroid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.boundary IS NOT NULL THEN
        NEW.centroid := ST_Centroid(NEW.boundary);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_area_centroid
    BEFORE INSERT OR UPDATE OF boundary ON gis.area
    FOR EACH ROW EXECUTE FUNCTION gis.compute_area_centroid();
