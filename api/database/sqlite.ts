
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initializeDb() {
    if (db) return db;

    db = await open({
        filename: './market_data.db',
        driver: sqlite3.Database
    });

    // Create tables for historical data
    await db.exec(`
    CREATE TABLE IF NOT EXISTS options_chain_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      snapshot_time TEXT,
      expiration_date TEXT,
      strike REAL,
      type TEXT,
      bid REAL,
      ask REAL,
      last REAL,
      volume INTEGER,
      open_interest INTEGER,
      delta REAL,
      gamma REAL,
      theta REAL,
      vega REAL
    );

    CREATE INDEX IF NOT EXISTS idx_symbol_time ON options_chain_snapshots(symbol, snapshot_time);
  `);

    console.log('💾 SQLite Database initialized for Backtesting');
    return db;
}

export function getDb() {
    if (!db) throw new Error('Database not initialized');
    return db;
}
