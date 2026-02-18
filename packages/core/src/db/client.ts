import { neon as neonClient } from '@neondatabase/serverless';

let _pool: ReturnType<typeof neonClient> | undefined;

// Get Neon database connection - returns the query function
export function getDatabase() {
  if (_pool) {
    return _pool;
  }

  const connectionString = process.env.NEON_DB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('NEON_DB_CONNECTION_STRING is required');
  }

  _pool = neonClient(connectionString);
  return _pool;
}

// Neon-style query helper (mimics Supabase's .from())
export const db = {
  from: (table: string) => {
    const sql = getDatabase();

    return {
      select: (columns: string = '*') => {
        let query = `SELECT ${columns} FROM ${table}`;
        let params: any[] = [];
        let hasWhere = false;

        const addCondition = (clause: string, param: any) => {
          query += hasWhere ? ` AND ${clause}` : ` WHERE ${clause}`;
          params.push(param);
          hasWhere = true;
        };

        const executeQuery = async () => {
          const result = await sql(query, params);
          return { data: result, error: null };
        };

        return {
          eq: function eqMethod(column: string, value: any): any {
            addCondition(`${column} = $${params.length + 1}`, value);
            const promise = executeQuery();
            return Object.assign(promise, {
              eq: eqMethod,  // Allow chaining multiple .eq() calls
              single: async () => {
                query += ' LIMIT 1';
                const result = (await sql(query, params)) as Record<string, unknown>[];
                return { data: result[0] ?? null, error: null };
              },
              limit: async (n: number) => {
                params.push(n);
                query += ` LIMIT $${params.length}`;
                const result = await sql(query, params);
                return { data: result, error: null };
              },
              order: (orderCol: string, opts: { ascending?: boolean } = {}) => {
                const dir = opts.ascending ? 'ASC' : 'DESC';
                query += ` ORDER BY ${orderCol} ${dir}`;
                const orderPromise = executeQuery();
                return Object.assign(orderPromise, {
                  limit: async (n: number) => {
                    params.push(n);
                    query += ` LIMIT $${params.length}`;
                    const result = await sql(query, params);
                    return { data: result, error: null };
                  }
                });
              }
            });
          },
          in: (column: string, values: any[]) => {
            const placeholders = values.map((_, i) => `$${params.length + i + 1}`).join(', ');
            query += ` WHERE ${column} IN (${placeholders})`;
            params.push(...values);
            return {
              limit: async (n: number) => {
                params.push(n);
                query += ` LIMIT $${params.length}`;
                const result = await sql(query, params);
                return { data: result, error: null };
              }
            };
          },
          order: (column: string, opts: { ascending?: boolean } = {}) => {
            const dir = opts.ascending ? 'ASC' : 'DESC';
            query += ` ORDER BY ${column} ${dir}`;
            const promise = executeQuery();
            return Object.assign(promise, {
              limit: async (n: number) => {
                params.push(n);
                query += ` LIMIT $${params.length}`;
                const result = await sql(query, params);
                return { data: result, error: null };
              }
            });
          },
          limit: async (n: number) => {
            params.push(n);
            query += ` LIMIT $${params.length}`;
            const result = await sql(query, params);
            return { data: result, error: null };
          }
        };
      },

      insert: async (rows: any | any[]) => {
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        if (rowsArray.length === 0) return { data: [], error: null };

        const columns = Object.keys(rowsArray[0]);
        const placeholders = rowsArray.map((_, i) =>
          `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
        ).join(', ');
        const values = rowsArray.flatMap(row => columns.map(col => row[col]));

        const result = await sql(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} RETURNING *`,
          values
        );
        return { data: result, error: null };
      },

      upsert: async (rows: any | any[], options: { onConflict?: string } = {}) => {
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        if (rowsArray.length === 0) return { data: [], error: null };

        const columns = Object.keys(rowsArray[0]);
        const placeholders = rowsArray.map((_, i) =>
          `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
        ).join(', ');
        const values = rowsArray.flatMap(row => columns.map(col => row[col]));

        let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
        if (options.onConflict) {
          query += ` ON CONFLICT (${options.onConflict}) DO UPDATE SET ${columns.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;
        }
        query += ' RETURNING *';

        const result = await sql(query, values);
        return { data: result, error: null };
      },

      update: (updates: any) => ({
        eq: async (column: string, value: any) => {
          const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
          const result = await sql(
            `UPDATE ${table} SET ${setClause} WHERE ${column} = $1 RETURNING *`,
            [value, ...Object.values(updates)]
          );
          return { data: result, error: null };
        }
      }),

      delete: () => ({
        eq: async (column: string, value: any) => {
          const result = await sql(`DELETE FROM ${table} WHERE ${column} = $1 RETURNING *`, [value]);
          return { data: result, error: null };
        }
      })
    };
  },

  // Raw SQL execution
  query: async (text: string, params?: any[]) => {
    const sql = getDatabase();
    if (params && params.length > 0) {
      return sql(text, params);
    }
    return sql(text);
  }
};

// Compatibility wrapper - returns db query builder with .from() method
export function getDb() {
  return {
    from: (table: string) => db.from(table)
  };
}

// Alias for backward compatibility
