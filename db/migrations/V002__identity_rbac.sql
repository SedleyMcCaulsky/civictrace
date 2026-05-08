-- =============================================================
-- V002 :: IDENTITY & RBAC DOMAIN
-- Users, Roles, Permissions, Sessions
-- =============================================================

-- -------------------------------------------------------
-- PERMISSIONS (atomic action gates)
-- -------------------------------------------------------
CREATE TABLE identity.permission (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(100) NOT NULL UNIQUE,  -- e.g. 'cases:read', 'audit:view'
    description     TEXT,
    domain          VARCHAR(50) NOT NULL,           -- e.g. 'registry', 'audit'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- ROLES
-- -------------------------------------------------------
CREATE TABLE identity.role (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    role_type       identity.role_type NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role <-> Permission junction
CREATE TABLE identity.role_permission (
    role_id         UUID NOT NULL REFERENCES identity.role(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES identity.permission(id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by      UUID,                           -- user_id (self-referential, set after user table)
    PRIMARY KEY (role_id, permission_id)
);

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
CREATE TABLE identity.user (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_auth_id    VARCHAR(255) UNIQUE,        -- Keycloak / Auth0 subject ID
    email               VARCHAR(255) NOT NULL UNIQUE,
    full_name           VARCHAR(255) NOT NULL,
    phone               VARCHAR(50),
    role_id             UUID NOT NULL REFERENCES identity.role(id),
    region              VARCHAR(100),               -- assigned operational region
    employee_number     VARCHAR(50) UNIQUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_field_officer    BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ                 -- soft delete only
);

-- Add FK back to role_permission now that user exists
ALTER TABLE identity.role_permission
    ADD CONSTRAINT fk_role_perm_granted_by
    FOREIGN KEY (granted_by) REFERENCES identity.user(id) ON DELETE SET NULL;

-- -------------------------------------------------------
-- SUPERVISOR <-> OFFICER HIERARCHY
-- -------------------------------------------------------
CREATE TABLE identity.officer_supervisor (
    officer_id      UUID NOT NULL REFERENCES identity.user(id) ON DELETE CASCADE,
    supervisor_id   UUID NOT NULL REFERENCES identity.user(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (officer_id, supervisor_id)
);

-- -------------------------------------------------------
-- DEVICE REGISTRY (mobile officer devices)
-- -------------------------------------------------------
CREATE TABLE identity.device (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES identity.user(id) ON DELETE CASCADE,
    device_fingerprint  VARCHAR(512) NOT NULL UNIQUE,
    device_name     VARCHAR(255),
    platform        VARCHAR(50),                    -- 'android', 'ios'
    app_version     VARCHAR(50),
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ,
    is_trusted      BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ
);

-- -------------------------------------------------------
-- SESSIONS (JWT session tracking for audit)
-- -------------------------------------------------------
CREATE TABLE identity.session (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES identity.user(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES identity.device(id) ON DELETE SET NULL,
    ip_address      INET,
    user_agent      TEXT,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    is_mobile       BOOLEAN NOT NULL DEFAULT FALSE
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_user_email        ON identity.user(email);
CREATE INDEX idx_user_role         ON identity.user(role_id);
CREATE INDEX idx_user_region       ON identity.user(region) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_active       ON identity.user(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_session_user      ON identity.session(user_id, expires_at);
CREATE INDEX idx_device_user       ON identity.device(user_id);
CREATE INDEX idx_device_fp         ON identity.device(device_fingerprint);
