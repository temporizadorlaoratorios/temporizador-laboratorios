const { Client } = require('pg');

const connectionString = 'postgresql://postgres:TemporizadorDB888!@db.qhjrqfrsphctbdjubxpv.supabase.co:5432/postgres';

async function addColumn() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conectado a Supabase Postgres');

        console.log('Agregando columna "operador" a la tabla "historial"...');
        await client.query(`
            ALTER TABLE historial ADD COLUMN IF NOT EXISTS operador TEXT;
        `);
        console.log('✅ Columna "operador" agregada exitosamente.');

        // También agregar isAcknowledged a timers si no existe, por si acaso
        console.log('Verificando columna "isAcknowledged" en tabla "timers"...');
         await client.query(`
            ALTER TABLE timers ADD COLUMN IF NOT EXISTS "isAcknowledged" BOOLEAN DEFAULT false;
        `);
        console.log('✅ Verificación completada.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

addColumn();
