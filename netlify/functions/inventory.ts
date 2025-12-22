// netlify/functions/inventory.ts
import { Handler } from "@netlify/functions";
import connectToDatabase from "./utils/data";
import { InventoryItemModel } from "./models";
import mongoose from "mongoose";

interface BulkUpdateItem {
  name: string;
  stock: number;
  mode: "set" | "add";
}

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectToDatabase();
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
      return { statusCode: 200, headers, body: JSON.stringify(items) };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");
      const { stockByLocation, ...restOfItem } = data;

      const itemId = restOfItem.id || new ObjectId().toHexString();
      restOfItem.id = itemId;

      const existingItem = await (collection.findOne as any)({ id: itemId });
      const queryKey = existingItem
        ? { _id: existingItem._id }
        : { id: itemId };

      const updatePayload: any = { ...restOfItem };

      // 🛑 CORRECCIÓN: Procesar stockByLocation asegurando tipos y guardando valores
      if (stockByLocation && typeof stockByLocation === "object") {
        Object.entries(stockByLocation).forEach(([key, value]) => {
          let numericValue = 0;

          if (typeof value === "string") {
            // Convertimos string (ej: "0,5") a número limpio
            numericValue = parseFloat(value.replace(",", ".")) || 0;
          } else if (typeof value === "number") {
            numericValue = value;
          }

          // 🛑 ASIGNACIÓN: Usamos notación de puntos para actualizar el Map interno en MongoDB
          updatePayload[`stockByLocation.${key}`] = numericValue;
        });
      }

      const updatedOrNewItem = await (collection.findOneAndUpdate as any)(
        queryKey,
        { $set: updatePayload },
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

    if (event.httpMethod === "PUT") {
      const updates: BulkUpdateItem[] = JSON.parse(event.body || "[]");

      const promises = updates.map(async (update) => {
        const { name, stock, mode } = update;
        const inputStock = Number(stock) || 0;

        const existingItem = await (collection.findOne as any)({ name });
        if (!existingItem) return;

        let newStockValue = inputStock;
        // Acceso seguro al stock actual en Almacén
        const currentStockInAlmacen =
          existingItem.stockByLocation instanceof Map
            ? Number(existingItem.stockByLocation.get("Almacén")) || 0
            : Number(existingItem.stockByLocation["Almacén"]) || 0;

        if (mode === "add") {
          newStockValue = currentStockInAlmacen + inputStock;
        } else if (mode === "set") {
          newStockValue = inputStock === 0 ? currentStockInAlmacen : inputStock;
        }

        await (collection.updateOne as any)(
          { _id: existingItem._id },
          { $set: { [`stockByLocation.Almacén`]: newStockValue } }
        );
      });

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
      await (collection.deleteOne as any)({ id });
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
