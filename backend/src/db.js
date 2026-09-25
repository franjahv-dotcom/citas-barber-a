const mysql = require("mysql2/promise");
const config = require("./config");
const pool = mysql.createPool(config.db);
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    // One database row serializes scheduling writes, including catalog and calendar edits.
    // Unlike an in-memory mutex, this also works with multiple server processes.
    await connection.query(
      "SELECT id FROM schedule_mutex WHERE id = 1 FOR UPDATE",
    );
    const q = async (sql, params = []) =>
      (await connection.execute(sql, params))[0];
    const result = await work(q);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
module.exports = { pool, query, transaction };
