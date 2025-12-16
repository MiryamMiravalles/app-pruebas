// netlify/functions/inventory.ts
import { Handler } from "@netlify/functions";
import connectToDatabase from "./utils/data";
import { InventoryItemModel } from "./models";
import mongoose from "mongoose";

// Definimos el tipo de dato que esperamos en el PUT (Bulk Update)
interface BulkUpdateItem {
  name: string;
  stock: number;
  mode: "set" | "add";
}

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Aseguramos la conexión a la base de datos
    await connectToDatabase();
    console.log("Database connection established for inventory function.");
  } catch (dbError) {
    console.error("Database Connection Error (inventory):", dbError);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
      body: JSON.stringify({
        error: (dbError as any).message || "Failed to connect to database.",
      }),
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const collection = InventoryItemModel;
    const ObjectId = mongoose.Types.ObjectId;

    if (event.httpMethod === "GET") {
      const items = await (collection.find as any)().sort({ name: 1 });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(items),
      };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");

      // Separar stockByLocation del resto del objeto
      const { stockByLocation, ...restOfItem } = data;

      // 1. Determinar el ID a usar
      const itemId = restOfItem.id || new ObjectId().toHexString();
      restOfItem.id = itemId; // Aseguramos que 'id' esté en el objeto

      // 2. Buscar si el documento ya existe para obtener el _id interno (si aplica)
      const existingItem = await (collection.findOne as any)({ id: itemId });

      // La clave de búsqueda será el _id interno si existe, si no, el id de la aplicación.
      const queryKey = existingItem
        ? { _id: existingItem._id }
        : { id: itemId };
      const updatePayload: any = { ...restOfItem };

      // 🛑 CORRECCIÓN CLAVE: Se eliminó el bloque condicional 'if (!existingItem) { updatePayload._id = itemId; }'
      // que causaba el error 'Cast to ObjectId failed'. Mongoose ahora generará
      // automáticamente el _id (ObjectId) cuando se cree un documento nuevo (upsert).

      // 3. Aplanar el Map 'stockByLocation' en notación de puntos y asegurar que el valor es un número
      if (stockByLocation && typeof stockByLocation === "object") {
        Object.entries(stockByLocation).forEach(([key, value]) => {
          // 🛑 CONVERSIÓN EXPLÍCITA A NÚMERO
          const numericValue = Number(value) || 0;
          updatePayload[`stockByLocation.${key}`] = numericValue;
        });
      }

      // 4. Ejecutar la actualización/inserción con el queryKey más robusto (si es posible)
      const updatedOrNewItem = await (collection.findOneAndUpdate as any)(
        queryKey,
        { $set: updatePayload }, // Usamos el payload aplanado
        { new: true, upsert: true, runValidators: true }
      );

      console.log(
        `Inventory item processed successfully: ${updatedOrNewItem.id}`
      );
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(updatedOrNewItem),
      };
    }

    // 🛑 IMPLEMENTACIÓN: Manejo de PUT para Bulk Update (MANTENIDA)
    if (event.httpMethod === "PUT") {
      const updates: BulkUpdateItem[] = JSON.parse(event.body || "[]");

      const promises = updates.map(async (update) => {
        const { name, stock, mode } = update;
        // 🛑 CORRECCIÓN CLAVE: Asegurar que el stock entrante es un número limpio.
        const inputStock = Number(stock) || 0;

        // 1. Encontrar el artículo por nombre
        const existingItem = await (collection.findOne as any)({ name });

        if (!existingItem) {
          console.warn(`Item not found for bulk update: ${name}`);
          return;
        }

        let newStockValue = inputStock;
        // 2. Calcular el stock actual en "Almacén" (asegurando el tipo Number)
        const currentStockInAlmacen =
          Number(existingItem.stockByLocation.get("Almacén")) || 0;

        // 2. Calcular el nuevo stock para la ubicación "Almacén"
        if (mode === "add") {
          newStockValue = currentStockInAlmacen + inputStock;
        } else if (mode === "set") {
          // Si mode es 'set', usamos el stock directamente
          newStockValue = inputStock;
        }

        // 3. Crear el objeto de actualización para "stockByLocation.Almacén"
        const updateOperation = {
          [`stockByLocation.Almacén`]: newStockValue,
        };

        // Ejecutar la actualización
        await (collection.updateOne as any)(
          { _id: existingItem._id }, // Usamos el _id interno para la actualización
          { $set: updateOperation }
        );
      });

      // Esperar a que todas las actualizaciones se completen
      await Promise.all(promises);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: `Bulk update processed for ${updates.length} items.`,
        }),
      };
    }

    if (event.httpMethod === "DELETE") {
      const { id } = event.queryStringParameters || {};

      // Buscar por el campo 'id' string (para compatibilidad con UUIDs)
      const query = { id };

      await (collection.deleteOne as any)(query);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Deleted" }),
      };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (error: any) {
    console.error("Error executing inventory function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
