// netlify/functions/utils/data.ts
import mongoose, { Mongoose } from "mongoose";
import { Db } from "mongodb";

// La URI de la base de datos debería estar configurada en Netlify.
const MONGO_URI = process.env.MONGO_URI;

// Nombre de la base de datos (extraído de la URI o especificado por si la URI no lo tiene)
const DB_NAME_DEFAULT = "inventary_app";

// Caching de la conexión Mongoose y la base de datos nativa
let cachedMongoose: Mongoose | null = null;
let cachedDb: Db | null = null;

/**
 * Conecta a la base de datos (usando Mongoose para compatibilidad con models.ts)
 * o reutiliza la conexión en caché. Retorna el objeto DB nativo de MongoDB.
 */
const connectToDatabase = async (): Promise<Db> => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI environment variable not set.");
  }

  // 1. Reutilizar la conexión si ya está en caché.
  if (cachedDb) {
    console.log("Using existing database connection (Mongoose Cached).");
    return cachedDb;
  }

  // 2. Conectar a la BD si no está conectado.
  console.log("Connecting to database using Mongoose...");
  try {
    // Usar la conexión de Mongoose.
    const mongooseClient = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    } as any);

    // Extraer el nombre de la DB de la URI
    const match = MONGO_URI.match(/\/([^/?]+)\?/);
    const dbName = match ? match[1] : DB_NAME_DEFAULT;

    // Obtener el objeto DB nativo a través del cliente Mongoose
    const db = mongooseClient.connection.db;

    // 3. Almacenar la conexión en caché
    cachedMongoose = mongooseClient;
    cachedDb = db;

    console.log(`Successfully connected to database: ${dbName}`);
    return db;
  } catch (error) {
    console.error("Error connecting to database:", error);
    // Relanzar un error que será capturado por la función Netlify.
    throw new Error(
      "Database connection failed. Check MONGO_URI, password, and IP access in MongoDB Atlas."
    );
  }
};

// 🛑 EXPORTACIÓN CLAVE: Exportación por defecto
export default connectToDatabase;
