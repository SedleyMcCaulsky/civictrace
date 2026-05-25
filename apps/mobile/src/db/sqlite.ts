import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('valugrid_local.db');
  }
  return db;
}

export async function initLocalDatabase() {
  const database = getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS local_deliveries (
      local_id TEXT PRIMARY KEY,
      property_case_id TEXT NOT NULL,
      composite_key TEXT,
      status TEXT NOT NULL,
      notes TEXT,
      recipient_name TEXT,
      gps_lat REAL,
      gps_lng REAL,
      gps_accuracy_m REAL,
      delivered_at TEXT NOT NULL,
      assignment_id TEXT,
      client_version TEXT DEFAULT '1.0',
      sync_status TEXT DEFAULT 'PENDING',
      server_id TEXT,
      synced_at TEXT,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_cases (
      id TEXT PRIMARY KEY,
      area_code TEXT NOT NULL,
      valuation_number TEXT NOT NULL,
      composite_key TEXT NOT NULL,
      owner_name TEXT,
      property_address TEXT NOT NULL,
      property_type TEXT,
      total_outstanding REAL DEFAULT 0,
      years_outstanding INTEGER DEFAULT 0,
      compliance_status TEXT,
      last_delivery_status TEXT,
      cached_at TEXT NOT NULL
    )
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_assignments (
      id TEXT PRIMARY KEY,
      area_name TEXT,
      area_code TEXT,
      assignment_date TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      total_cases INTEGER DEFAULT 0,
      completed_cases INTEGER DEFAULT 0,
      cached_at TEXT NOT NULL
    )
  `);

  console.log('[SQLite] Local database initialized');
}
