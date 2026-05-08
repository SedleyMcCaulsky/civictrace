-- =============================================================
-- V001 :: EXTENSIONS, SCHEMAS, CUSTOM TYPES
-- CIVICTRACE — Property Tax Compliance Operations Platform
-- =============================================================

-- -------------------------------------------------------
-- EXTENSIONS
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- fuzzy text search on owner names
CREATE EXTENSION IF NOT EXISTS "btree_gin";        -- composite GIN index support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- encrypted PII fields

-- -------------------------------------------------------
-- SCHEMAS (Domain Isolation)
-- -------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS identity;      -- users, roles, permissions
CREATE SCHEMA IF NOT EXISTS registry;      -- property cases, tax balances
CREATE SCHEMA IF NOT EXISTS delivery;      -- notice delivery, officer assignments
CREATE SCHEMA IF NOT EXISTS reconciliation; -- payment reconciliation
CREATE SCHEMA IF NOT EXISTS evidence;      -- photos, documents
CREATE SCHEMA IF NOT EXISTS gis;           -- spatial data
CREATE SCHEMA IF NOT EXISTS compliance;    -- analytics, compliance status
CREATE SCHEMA IF NOT EXISTS audit;         -- IMMUTABLE audit log
CREATE SCHEMA IF NOT EXISTS reporting;     -- materialized views, report cache

-- -------------------------------------------------------
-- CUSTOM ENUM TYPES
-- -------------------------------------------------------

-- Delivery outcome statuses
CREATE TYPE delivery.delivery_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DELIVERED',
    'OWNER_ABSENT',
    'REFUSED',
    'VACANT',
    'INCORRECT_ADDRESS',
    'ACCESS_DENIED',
    'DEMOLISHED',
    'RESCHEDULED',
    'ESCALATED'
);

-- Property types
CREATE TYPE registry.property_type AS ENUM (
    'RESIDENTIAL',
    'COMMERCIAL',
    'INDUSTRIAL',
    'AGRICULTURAL',
    'MIXED_USE',
    'VACANT_LAND',
    'GOVERNMENT',
    'INSTITUTIONAL',
    'OTHER'
);

-- Reconciliation statuses
CREATE TYPE reconciliation.reconciliation_status AS ENUM (
    'PENDING',
    'MATCHED',
    'PARTIAL_MATCH',
    'UNMATCHED',
    'DISPUTED',
    'RESOLVED',
    'ESCALATED'
);

-- Compliance statuses
CREATE TYPE compliance.compliance_status_value AS ENUM (
    'COMPLIANT',
    'DELINQUENT',
    'PARTIALLY_COMPLIANT',
    'UNDER_REVIEW',
    'ESCALATED',
    'EXEMPT'
);

-- Tax balance statuses per year
CREATE TYPE registry.balance_status AS ENUM (
    'OUTSTANDING',
    'PAID',
    'PARTIAL',
    'DISPUTED',
    'WAIVED',
    'WRITTEN_OFF'
);

-- Risk levels (AI engine output)
CREATE TYPE compliance.risk_level AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'UNKNOWN'
);

-- RBAC role types
CREATE TYPE identity.role_type AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'SUPERVISOR',
    'SENIOR_OFFICER',
    'OFFICER',
    'READ_ONLY',
    'AUDITOR'
);

-- Audit action types
CREATE TYPE audit.action_type AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'SYNC',
    'RECONCILE',
    'ASSIGN',
    'ESCALATE',
    'VIEW_SENSITIVE'
);

-- Evidence file types
CREATE TYPE evidence.file_type AS ENUM (
    'PHOTO',
    'SIGNATURE',
    'DOCUMENT',
    'VIDEO',
    'OTHER'
);

-- Sync states for mobile queue
CREATE TYPE delivery.sync_status AS ENUM (
    'PENDING',
    'SYNCED',
    'CONFLICT',
    'FAILED',
    'RETRYING'
);
