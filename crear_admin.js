require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Conectar con Supabase usando variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;

// Recomendamos usar SERVICE_ROLE_KEY si existe, si no, ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function run() {
    console.log("==========================================");
    console.log("🛠️  CREADOR DE SUPER ADMIN (SUPABASE)  🛠️");
    console.log("==========================================");

    rl.question('\nIngresa el EMAIL del Super Admin: ', async (email) => {
        rl.question('Ingresa la CONTRASEÑA: ', async (password) => {
            
            console.log("\n1️⃣ Creando usuario en Supabase Auth...");
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) {
                console.error("❌ Error al crear usuario de Autenticación:");
                console.error(authError.message);
                console.log("\n(Nota: Si dice 'User already registered', el usuario ya existe en Supabase.)");
                rl.close();
                return;
            }

            const userId = authData.user.id;
            console.log(`✅ Usuario credo exitosamente. ID: ${userId}`);
            
            console.log("\n2️⃣ Asignando rol 'super_admin' en la tabla perfiles...");
            const { error: profileError } = await supabase.from('perfiles').upsert({
                id: userId,
                laboratorio_id: 'super-admin',
                rol: 'super_admin',
                fecha_creacion: new Date().toISOString()
            });

            if (profileError) {
                console.error("❌ Error al guardar en la tabla perfiles:");
                console.error(profileError.message);
                console.log("\n👉 IMPORTANTE: Puede que el RLS (Row Level Security) de tu Supabase impida insertarlo desde aquí.");
                console.log("Si es así, debes ir a Supabase -> Tabla 'perfiles' e insertar manualmente:");
                console.log(`- id: ${userId}`);
                console.log(`- rol: 'super_admin'`);
                console.log(`- laboratorio_id: 'super-admin'`);
            } else {
                console.log("✅ Rol asignado correctamente.");
                console.log("\n🎉 ¡Listo! Ya puedes ir a login.html e iniciar sesión con estas credenciales. 🎉");
            }

            rl.close();
        });
    });
}

run();
