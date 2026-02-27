import { Pool } from "pg";

let pool: Pool | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getDatabaseUrl(): string {
  return process.env.SUPABASE_DB_URL ?? required("DATABASE_URL");
}

function getPool(): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl()
  });
  return pool;
}

export async function getNextGlobalSequence(counterName: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_counters (
        name TEXT PRIMARY KEY,
        value BIGINT NOT NULL
      )
    `);
    await client.query(
      `
        INSERT INTO global_counters (name, value)
        VALUES ($1, 0)
        ON CONFLICT (name) DO NOTHING
      `,
      [counterName]
    );
    const updateResult = await client.query<{ value: string }>(
      `
        UPDATE global_counters
        SET value = value + 1
        WHERE name = $1
        RETURNING value
      `,
      [counterName]
    );
    await client.query("COMMIT");

    const value = updateResult.rows[0]?.value;
    if (!value) {
      throw new Error("Failed to get next global sequence value.");
    }

    return Number(value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
