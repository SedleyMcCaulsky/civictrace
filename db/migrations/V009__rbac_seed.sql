-- =============================================================
-- V009 :: RBAC SEED DATA
-- Default permissions, roles, and system user
-- =============================================================

-- -------------------------------------------------------
-- PERMISSIONS (atomic capability codes)
-- -------------------------------------------------------
INSERT INTO identity.permission (code, description, domain) VALUES
-- Case Registry
('cases:read',              'View property cases',                          'registry'),
('cases:create',            'Create new property cases',                    'registry'),
('cases:update',            'Update property case details',                 'registry'),
('cases:delete',            'Soft-delete property cases',                   'registry'),
('cases:import',            'Bulk import cases from CSV',                   'registry'),
('cases:export',            'Export case data',                             'registry'),

-- Delivery
('delivery:read',           'View delivery records',                        'delivery'),
('delivery:create',         'Log delivery outcomes',                        'delivery'),
('delivery:update',         'Update delivery records',                      'delivery'),
('delivery:assign',         'Assign cases to officers',                     'delivery'),
('delivery:escalate',       'Escalate delivery issues',                     'delivery'),

-- Reconciliation
('reconciliation:read',     'View reconciliation records',                  'reconciliation'),
('reconciliation:create',   'Submit payment reconciliation',                'reconciliation'),
('reconciliation:resolve',  'Resolve reconciliation disputes',              'reconciliation'),
('reconciliation:export',   'Export reconciliation reports',                'reconciliation'),

-- Audit
('audit:read',              'View audit logs',                              'audit'),
('audit:export',            'Export audit trails',                          'audit'),
('audit:forensic',          'Access full forensic audit reconstruction',    'audit'),

-- GIS
('gis:read',                'View GIS maps and heatmaps',                   'gis'),
('gis:edit',                'Edit area boundaries',                         'gis'),

-- Compliance & Analytics
('compliance:read',         'View compliance analytics',                    'compliance'),
('compliance:risk_view',    'View risk scores and AI insights',             'compliance'),
('compliance:pattern_view', 'View pattern detection events',                'compliance'),

-- Reporting
('reports:view',            'View generated reports',                       'reporting'),
('reports:generate',        'Trigger report generation',                    'reporting'),
('reports:schedule',        'Schedule automated reports',                   'reporting'),

-- Evidence
('evidence:read',           'View evidence files',                          'evidence'),
('evidence:upload',         'Upload evidence files',                        'evidence'),
('evidence:invalidate',     'Invalidate/flag invalid evidence',             'evidence'),

-- Identity & RBAC
('users:read',              'View user accounts',                           'identity'),
('users:create',            'Create user accounts',                         'identity'),
('users:update',            'Update user accounts',                         'identity'),
('users:deactivate',        'Deactivate user accounts',                     'identity'),
('roles:manage',            'Manage roles and permissions',                 'identity'),

-- System
('system:config',           'Access system configuration',                  'system'),
('system:monitor',          'Access observability dashboards',              'system');

-- -------------------------------------------------------
-- ROLES
-- -------------------------------------------------------
INSERT INTO identity.role (name, role_type, description) VALUES
('Super Administrator',  'SUPER_ADMIN',     'Full system access including RBAC management'),
('Administrator',        'ADMIN',           'Full operational access, no RBAC management'),
('Supervisor',           'SUPERVISOR',      'Manage officers, view all area data, approve reconciliations'),
('Senior Officer',       'SENIOR_OFFICER',  'Field delivery, reconciliation submission, area-wide visibility'),
('Officer',              'OFFICER',         'Field delivery and basic case view for assigned area only'),
('Auditor',              'AUDITOR',         'Read-only audit and compliance access'),
('Read Only',            'READ_ONLY',       'Read-only access to non-sensitive operational data');

-- -------------------------------------------------------
-- ROLE <-> PERMISSION ASSIGNMENTS
-- -------------------------------------------------------

-- SUPER ADMIN: All permissions
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'SUPER_ADMIN';

-- ADMIN: All except RBAC management and system config
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'ADMIN'
  AND p.code NOT IN ('roles:manage', 'system:config', 'audit:forensic');

-- SUPERVISOR: Operational + reporting + audit read
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'SUPERVISOR'
  AND p.code IN (
    'cases:read', 'cases:export',
    'delivery:read', 'delivery:assign', 'delivery:escalate',
    'reconciliation:read', 'reconciliation:resolve', 'reconciliation:export',
    'audit:read',
    'gis:read',
    'compliance:read', 'compliance:risk_view', 'compliance:pattern_view',
    'reports:view', 'reports:generate', 'reports:schedule',
    'evidence:read', 'evidence:invalidate',
    'users:read'
  );

-- SENIOR OFFICER: Field + reconciliation submission
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'SENIOR_OFFICER'
  AND p.code IN (
    'cases:read', 'cases:create', 'cases:update', 'cases:import',
    'delivery:read', 'delivery:create', 'delivery:update',
    'reconciliation:read', 'reconciliation:create',
    'gis:read',
    'compliance:read', 'compliance:risk_view',
    'reports:view', 'reports:generate',
    'evidence:read', 'evidence:upload'
  );

-- OFFICER: Field ops only
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'OFFICER'
  AND p.code IN (
    'cases:read',
    'delivery:read', 'delivery:create', 'delivery:update',
    'evidence:read', 'evidence:upload',
    'reports:view'
  );

-- AUDITOR: Read-only audit + compliance
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'AUDITOR'
  AND p.code IN (
    'cases:read',
    'delivery:read',
    'reconciliation:read',
    'audit:read', 'audit:export', 'audit:forensic',
    'gis:read',
    'compliance:read', 'compliance:risk_view', 'compliance:pattern_view',
    'reports:view', 'reports:generate',
    'evidence:read'
  );

-- READ ONLY: Basic read access
INSERT INTO identity.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM identity.role r
CROSS JOIN identity.permission p
WHERE r.role_type = 'READ_ONLY'
  AND p.code IN (
    'cases:read',
    'delivery:read',
    'reports:view',
    'gis:read'
  );

-- -------------------------------------------------------
-- SYSTEM USER (for automated/system-generated audit events)
-- -------------------------------------------------------
INSERT INTO identity.user (
    id,
    external_auth_id,
    email,
    full_name,
    role_id,
    is_active,
    is_field_officer,
    employee_number
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'system',
    'system@civictrace.internal',
    'CivicTrace System',
    (SELECT id FROM identity.role WHERE role_type = 'SUPER_ADMIN' LIMIT 1),
    TRUE,
    FALSE,
    'SYS-0001'
);

-- -------------------------------------------------------
-- DEFAULT PARISHES / AREAS (Jamaica parishes seed)
-- -------------------------------------------------------
INSERT INTO gis.area (code, name, parish, region) VALUES
('KINGSTON',        'Kingston',             'Kingston',         'SOUTH'),
('ST_ANDREW',       'St. Andrew',           'St. Andrew',       'SOUTH'),
('ST_THOMAS',       'St. Thomas',           'St. Thomas',       'SOUTH'),
('PORTLAND',        'Portland',             'Portland',         'NORTH'),
('ST_MARY',         'St. Mary',             'St. Mary',         'NORTH'),
('ST_ANN',          'St. Ann',              'St. Ann',          'NORTH'),
('TRELAWNY',        'Trelawny',             'Trelawny',         'NORTH'),
('ST_JAMES',        'St. James',            'St. James',        'NORTH'),
('HANOVER',         'Hanover',              'Hanover',          'WEST'),
('WESTMORELAND',    'Westmoreland',         'Westmoreland',     'WEST'),
('ST_ELIZABETH',    'St. Elizabeth',        'St. Elizabeth',    'SOUTH'),
('MANCHESTER',      'Manchester',           'Manchester',       'SOUTH'),
('CLARENDON',       'Clarendon',            'Clarendon',        'SOUTH'),
('ST_CATHERINE',    'St. Catherine',        'St. Catherine',    'SOUTH'),
-- Common sub-areas for Kingston/St. Andrew
('NORBROOK',        'Norbrook',             'St. Andrew',       'SOUTH'),
('CHERRY_GARDENS',  'Cherry Gardens',       'St. Andrew',       'SOUTH'),
('BARBICAN',        'Barbican',             'St. Andrew',       'SOUTH'),
('CONSTANT_SPRING', 'Constant Spring',      'St. Andrew',       'SOUTH'),
('LIGUANEA',        'Liguanea',             'St. Andrew',       'SOUTH'),
('HALF_WAY_TREE',   'Half Way Tree',        'St. Andrew',       'SOUTH'),
('HAVENDALE',       'Havendale',            'St. Andrew',       'SOUTH'),
('MONA',            'Mona',                 'St. Andrew',       'SOUTH'),
('PAPINE',          'Papine',               'St. Andrew',       'SOUTH'),
('AUGUST_TOWN',     'August Town',          'St. Andrew',       'SOUTH');
