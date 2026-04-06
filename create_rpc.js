require('dotenv').config();
const { Client } = require('pg');

async function createRpc() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Conectado a la base de datos Supabase');

        const sql = `
            CREATE OR REPLACE FUNCTION get_server_time()
            RETURNS bigint AS $$
              SELECT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
            $$ LANGUAGE sql STABLE;
        `;

        await client.query(sql);
        console.log('✅ Función get_server_time creada correctamente');

    } catch (err) {
        console.error('❌ Error creando función:', err);
    } finally {
        await client.end();
    }
}

createRpc();
