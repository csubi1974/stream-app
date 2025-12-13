import { Pool } from 'pg';

let pool: Pool | null = null;

export async function initializePostgres() {
    if (pool) return pool;

    const connectionString = process.env.POSTGRES_URL || 'postgresql://postgres:subi2000@localhost:5432/tape_reading';

    pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected');

        // Create tables for historical data
        await client.query(`
      CREATE TABLE IF NOT EXISTS options_chain_snapshots (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        snapshot_time TIMESTAMP NOT NULL,
        expiration_date DATE NOT NULL,
        strike DECIMAL(10, 2) NOT NULL,
        type TEXT NOT NULL,
        bid DECIMAL(10, 2),
        ask DECIMAL(10, 2),
        last DECIMAL(10, 2),
        volume INTEGER,
        open_interest INTEGER,
        delta DECIMAL(10, 6),
        gamma DECIMAL(10, 6),
        theta DECIMAL(10, 6),
        vega DECIMAL(10, 6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_symbol_time 
      ON options_chain_snapshots(symbol, snapshot_time);
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_expiration 
      ON options_chain_snapshots(expiration_date);
    `);

        console.log('💾 PostgreSQL Database initialized for Historical Data');
        client.release();

        return pool;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error);
        throw error;
    }
}

export function getPool() {
    if (!pool) throw new Error('PostgreSQL not initialized');
    return pool;
}

export async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('PostgreSQL connection pool closed');
    }
}
