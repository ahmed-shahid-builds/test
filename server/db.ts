import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

let pool: Pool | undefined;

function database(): Pool {
  if (!pool) throw new Error("Database is not initialized.");
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Managed database connection is unavailable.");

  pool = createPool(databaseUrl);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
        started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        completed_at TIMESTAMP(3) NULL,
        INDEX quiz_attempts_completed_at_idx (completed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end();
    pool = undefined;
    throw error;
  }
}

export async function insertQuizAttempt(attemptId: string): Promise<void> {
  await database().execute(
    "INSERT INTO quiz_attempts (attempt_id) VALUES (?)",
    [attemptId],
  );
}

export async function markQuizAttemptComplete(attemptId: string): Promise<boolean> {
  const db = database();
  const [result] = await db.execute<ResultSetHeader>(
    "UPDATE quiz_attempts SET completed_at = CURRENT_TIMESTAMP(3) WHERE attempt_id = ? AND completed_at IS NULL",
    [attemptId],
  );
  if (result.affectedRows === 1) return true;

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT attempt_id FROM quiz_attempts WHERE attempt_id = ? LIMIT 1",
    [attemptId],
  );
  return rows.length > 0;
}

export async function getAttemptTotals(): Promise<{ totalStarted: number; totalCompleted: number }> {
  const [rows] = await database().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total_started, COUNT(completed_at) AS total_completed FROM quiz_attempts",
  );
  const row = rows[0];
  return {
    totalStarted: Number(row?.total_started ?? 0),
    totalCompleted: Number(row?.total_completed ?? 0),
  };
}
