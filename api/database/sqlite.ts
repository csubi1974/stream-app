import fs from 'fs';
import path from 'path';

let db: any = null;
let isAvailable = false;
const JSON_DB_PATH = './market_data_fallback.json';

// Simple JSON-based DB Mock for when SQLite fails
class JsonFallbackDB {
  private data: any = { snapshots: [], alerts: [] };

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(JSON_DB_PATH)) {
      try {
        this.data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
        console.log(`📂 Loaded ${this.data.alerts.length} alerts from JSON fallback`);
      } catch (e) {
        console.error('❌ Error loading JSON DB:', e.message);
        this.data = { snapshots: [], alerts: [] };
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('❌ Error saving JSON DB:', e.message);
    }
  }

  async exec(query: string) { return; }

  async run(query: string, params: any[]) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('insert into trade_alerts') || lowerQuery.includes('insert or ignore into trade_alerts')) {
      const [id, strategy, underlying, generated_at, status, alert_data, quality_score, quality_level, risk_level, quality_metadata, exit_criteria, result, realized_pnl, closed_at_price] = params;
      if (!this.data.alerts.find((a: any) => a.id === id)) {
        this.data.alerts.push({
          id, strategy, underlying, generated_at, status, alert_data,
          quality_score, quality_level, risk_level, quality_metadata, exit_criteria,
          result, realized_pnl, closed_at_price
        });
        this.save();
        console.log(`✅ Alert ${id} saved to JSON fallback`);
      } else {
        console.log(`ℹ️ Alert ${id} already exists in JSON fallback`);
      }
    } else if (lowerQuery.includes('update trade_alerts set result')) {
      // Mock update for results
      const [result, realized_pnl, closed_at_price, status, id] = params;
      const alertIndex = this.data.alerts.findIndex((a: any) => a.id === id);
      if (alertIndex !== -1) {
        this.data.alerts[alertIndex] = { ...this.data.alerts[alertIndex], result, realized_pnl, closed_at_price, status };
        this.save();
        console.log(`✅ Alert ${id} updated with results in JSON fallback`);
      }
    }
  }

  async all(query: string, params: any[]) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('from trade_alerts')) {
      let results = [...this.data.alerts];
      const symbol = params[0];
      const date = params[1]?.replace('%', '');

      if (symbol) {
        results = results.filter(a => a.underlying === symbol);
      }
      if (date) {
        results = results.filter(a => a.generated_at && a.generated_at.startsWith(date));
      }

      return results.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    }
    return [];
  }

  async get(query: string, params: any[]) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('from trade_alerts')) {
      const id = params[0];
      const result = this.data.alerts.find((a: any) => a.id === id) || null;
      return result;
    }
    return null;
  }

  async prepare() {
    return {
      run: async () => { },
      finalize: async () => { }
    };
  }
}

export async function initializeDb() {
  if (db && isAvailable) return db;

  try {
    const sqlite3 = (await import('sqlite3')).default;
    const { open } = await import('sqlite');

    db = await open({
      filename: './market_data.db',
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS options_chain_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT, snapshot_time TEXT, expiration_date TEXT, strike REAL, type TEXT,
        bid REAL, ask REAL, last REAL, volume INTEGER, open_interest INTEGER,
        delta REAL, gamma REAL, theta REAL, vega REAL
      );
      CREATE TABLE IF NOT EXISTS trade_alerts (
        id TEXT PRIMARY KEY, strategy TEXT, underlying TEXT, generated_at TEXT, 
        status TEXT, alert_data TEXT,
        quality_score INTEGER, quality_level TEXT, risk_level TEXT, quality_metadata TEXT,
        exit_criteria TEXT,
        result TEXT, realized_pnl REAL, closed_at_price REAL
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_time ON options_chain_snapshots(symbol, snapshot_time);
      CREATE INDEX IF NOT EXISTS idx_alerts_time ON trade_alerts(generated_at);
    `);

    // Migration for existing tables
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN quality_score INTEGER;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN quality_level TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN risk_level TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN quality_metadata TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN exit_criteria TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN result TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN realized_pnl REAL;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE trade_alerts ADD COLUMN closed_at_price REAL;`); } catch (e) { }

    isAvailable = true;
    console.log('💾 SQLite Database initialized (Native)');
    return db;
  } catch (error) {
    console.warn('⚠️ Native SQLite failed, using JSON Fallback');
    db = new JsonFallbackDB();
    isAvailable = true;
    return db;
  }
}

export function getDb() {
  if (!db) {
    db = new JsonFallbackDB();
  }
  return db;
}
