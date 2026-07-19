// 查询数据库的工具
import { Pool } from 'pg';
import 'dotenv/config';

// mcp server 独立进程，需要初始化数据连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * @description 查询数据库
 * @param args
 * @returns
 */
export async function handleDatabaseQuery(args: {
  name?: string;
  role?: string;
  limit?: number;
}): Promise<string> {
  const { name, role, limit } = args;
  const conditions = [] as string[];
  if (name) conditions.push(`name LIKE '%${name}%'`);
  if (role) conditions.push(`role = '${role}'`);
  const query = `SELECT id, name, role FROM users ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''} LIMIT ${limit || 10}`;
  const result = await pool.query(query);
  if (result.rows.length === 0) {
    return 'No result';
  }
  const userList = result?.rows
    ?.map((user) => {
      return `ID: ${user.id}, Name: ${user.name}, Role: ${user.role}`;
    })
    .join('\n');
  return `Found: ${result?.rows?.length}; users:\n${userList}`;
}
