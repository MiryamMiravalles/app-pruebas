import { Handler } from "@netlify/functions";
import connectToDatabase from "./utils/data";
import mongoose from "mongoose";
import { Collection, Document } from "mongodb";

const COLLECTION_NAME = "inventoryrecords";

// --- Definiciones de Tipos ---
interface InventoryRecordItem {
  itemId: string;
  name: string;
  category: string;
  currentStock?: number;
  pendingStock?: number;
  initialStock?: number;
  endStock?: number;
  consumption?: number;
  stockByLocationSnapshot?: { [key: string]: number };
  pricePerUnitWithoutIVA?: number;
}

interface InventoryRecordDocument extends Document {
  _id: string | mongoose.Types.ObjectId;
  date: string;
  label: string;
  type: "snapshot" | "analysis";
  items: Array<InventoryRecordItem>;
  id?: string;
}

// 🛑 ORDEN DE CATEGORÍAS (Usando el orden de la web)
const CATEGORY_ORDER = [
  "🧊 Vodka",
  "🥥 Ron",
  "🥃 Whisky / Bourbon",
  "🍸 Ginebra",
  "🌵 Tequila",
  "🔥 Mezcal",
  "🍯 Licores y Aperitivos",
  "🍷 Vermut",
  "🥂 Vinos y espumosos",
  "🥤Refrescos y agua",
  "🍻 Cerveza",
];

// Función de ayuda para ordenar: 1. Por índice de CATEGORY_ORDER, 2. Alfabéticamente por nombre.
const sortItems = (items: InventoryRecordItem[]): InventoryRecordItem[] => {
  return [...items].sort((a, b) => {
    const catA = a.category || "Uncategorized";
    const catB = b.category || "Uncategorized";

    const indexA = CATEGORY_ORDER.indexOf(catA);
    const indexB = CATEGORY_ORDER.indexOf(catB);

    if (indexA !== indexB) {
      // Manejar categorías no listadas (Uncategorized) al final
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }

    // 🛑 ORDEN ALFABÉTICO DENTRO DE LA CATEGORÍA (insensible a mayúsculas)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
};

// Función para convertir el array de items de registro a formato CSV
const convertToCsv = (record: InventoryRecordDocument): string => {
  const isAnalysis = record.type === "analysis";

  let csv = "";
  const separator = ";"; // 🛑 USAMOS EL ORDENAMIENTO REQUERIDO

  const sortedItems = sortItems(record.items);
  let lastCategory = "";

  if (isAnalysis) {
    // === Lógica para Análisis (Consumo) - PRECIO EXCLUIDO ===
    // 🛑 CORREGIDO: Eliminada la columna P.U. s/IVA de la cabecera
    const headerRow = `Articulo${separator}Stock Actual${separator}En Pedidos${separator}Stock Inicial Total${separator}Consumo\n`;
    csv += headerRow;

    sortedItems.forEach((item) => {
      // 🛑 INYECCIÓN DE CABECERA DE CATEGORÍA
      if (item.category && item.category !== lastCategory) {
        csv += `\n"${item.category}"\n`; // Fila de Categoría Separada
        lastCategory = item.category;
      }

      const currentStock =
        item.currentStock !== undefined
          ? Number(item.currentStock).toFixed(2).replace(".", ",")
          : "0,00";
      const pendingStock =
        item.pendingStock !== undefined
          ? Number(item.pendingStock).toFixed(2).replace(".", ",")
          : "0,00";
      const initialTotalStock =
        item.initialStock !== undefined
          ? Number(item.initialStock).toFixed(2).replace(".", ",")
          : "0,00";
      const consumption =
        item.consumption !== undefined
          ? Number(item.consumption).toFixed(2).replace(".", ",")
          : "0,00"; // 🛑 ELIMINADA la declaración de la variable 'price' que no se usa. // 🛑 CORREGIDO: Fila de Datos SIN la columna 'price'. // Antes: csv += `"${item.name}"${separator}${price}${separator}${currentStock}${separator}${pendingStock}${separator}${initialTotalStock}${separator}${consumption}\n`;

      csv += `"${item.name}"${separator}${currentStock}${separator}${pendingStock}${separator}${initialTotalStock}${separator}${consumption}\n`;
    });
  } else {
    // === Lógica para Snapshot (Inventario) - (Se mantiene con precio) ===

    // ORDEN FIJO DE UBICACIONES
    const REQUESTED_LOCATIONS = [
      "Rest",
      "Nevera",
      "B1",
      "Ofice B1",
      "B2",
      "Ofice B2",
      "B3",
      "Ofice B3",
      "B4",
      "Ofice B4",
      "Almacén",
    ]; // Recoger todas las ubicaciones que tienen stock en el registro

    const allLocations = new Set<string>();
    record.items.forEach((item) => {
      Object.keys(item.stockByLocationSnapshot || {}).forEach((loc) =>
        allLocations.add(loc)
      );
    }); // Crear la lista de ubicaciones a mostrar, respetando el orden fijo

    const locations = REQUESTED_LOCATIONS.filter((loc) =>
      allLocations.has(loc)
    ); // Encabezados para Snapshot (Inventario por Ubicación)

    let header = "Articulo";
    header += `${separator}P.U. s/IVA`; // 🛑 CORRECCIÓN: AÑADIDO: Columna Valor Total en el encabezado
    header += `${separator}VALOR TOTAL`;
    locations.forEach((loc) => {
      header += `${separator}${loc.toUpperCase()}`;
    });
    header += `${separator}Total\n`;
    csv += header; // Añadir encabezado solo una vez

    sortedItems.forEach((item) => {
      // 🛑 INYECCIÓN DE CABECERA DE CATEGORÍA
      if (item.category && item.category !== lastCategory) {
        csv += `\n"${item.category}"\n`;
        lastCategory = item.category;
      } // CÁLCULO DEL STOCK TOTAL

      const totalStock = Object.values(
        item.stockByLocationSnapshot || {}
      ).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0); // Precio

      const price =
        item.pricePerUnitWithoutIVA !== undefined
          ? Number(item.pricePerUnitWithoutIVA)
          : 0; // 🛑 CORRECCIÓN: CÁLCULO DEL VALOR TOTAL

      const totalValue = price * totalStock;

      let priceFormatted = Number(price).toFixed(2).replace(".", ",");
      let totalValueFormatted = Number(totalValue).toFixed(2).replace(".", ","); // Fila de Datos del Artículo

      let row = `"${item.name}"${separator}${priceFormatted}`; // 🛑 CORRECCIÓN: AÑADIDO: Valor Total

      row += `${separator}${totalValueFormatted}`; // Iterar sobre la lista de ubicaciones FIJAS

      locations.forEach((loc) => {
        const rawStock = item.stockByLocationSnapshot?.[loc];
        const stock =
          rawStock !== undefined
            ? Number(rawStock).toFixed(2).replace(".", ",")
            : "0,00";
        row += `${separator}${stock}`;
      }); // Añadir el Total (stock) al final

      row += `${separator}${Number(totalStock).toFixed(2).replace(".", ",")}\n`;
      csv += row;
    });
  } // Añadir BOM (Byte Order Mark)

  return "\ufeff" + csv;
};

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let db: any;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Content-Disposition", // 🛑 CORRECCIÓN: Permitir PUT para manejo robusto de upsert
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    db = await connectToDatabase();
  } catch (dbError) {
    console.error("Database Connection Error (history):", dbError);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: (dbError as any).message || "Failed to connect to database.",
      }),
    };
  }

  try {
    const ObjectId = mongoose.Types.ObjectId; // Nota: El modelo es accesible globalmente si está en el archivo models.ts // Si no lo estuviera, habría que importarlo/definirlo aquí.

    const collection: Collection<InventoryRecordDocument> =
      db.collection(COLLECTION_NAME);

    const formatRecord = (record: InventoryRecordDocument | null) => {
      if (!record) return null;
      const _idString = ObjectId.isValid(record._id)
        ? record._id.toString()
        : String(record._id); // Usar un método de Mongoose para asegurar la virtualización
      const { _id, ...rest } = record;
      return { id: _idString, ...rest };
    };

    if (event.httpMethod === "GET") {
      const { id, format } = event.queryStringParameters || {};

      if (id && format === "csv") {
        const orQuery: any[] = [];
        orQuery.push({ _id: id });

        if (ObjectId.isValid(id)) {
          try {
            const objectId = new ObjectId(id);
            orQuery.push({ _id: objectId });
          } catch (e) {
            /* ignora errores de construcción de ObjectId */
          }
        }

        const record = await collection.findOne({ $or: orQuery });

        if (!record) {
          return {
            statusCode: 404,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              error: `Record Not Found for ID: ${id}. Please ensure the record was saved correctly. Try saving a NEW analysis.`,
            }),
          };
        }

        const csvData = convertToCsv(record as InventoryRecordDocument);

        const sanitizedLabel = record.label
          .replace(/[\\/:*?"<>|]/g, "")
          .substring(0, 50);
        const typeLabel =
          record.type === "analysis" ? "Analisis" : "Inventario";
        const fileName = `${sanitizedLabel}_${typeLabel}.csv`;
        const encodedFileName = encodeURIComponent(fileName);

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${encodedFileName}"`,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
            "Access-Control-Allow-Methods": "GET",
          },
          body: csvData,
        };
      }

      const records = await collection.find().sort({ date: -1 }).toArray();
      const formattedRecords = records.map(formatRecord);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(formattedRecords),
      };
    } // 🛑 CORRECCIÓN: Aceptar tanto POST (crear) como PUT (actualizar) para guardar el historial

    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      const data = JSON.parse(event.body || "{}");
      const recordToSave: any = { ...data };

      let _idToSave: any = recordToSave.id;

      if (!_idToSave) {
        _idToSave = new ObjectId();
      } else if (ObjectId.isValid(_idToSave)) {
        _idToSave = new ObjectId(_idToSave);
      } else {
        _idToSave = String(recordToSave.id);
      }

      recordToSave._id = _idToSave;

      delete recordToSave.id;

      if (!recordToSave.date) {
        recordToSave.date = new Date().toISOString();
      }

      await collection.updateOne(
        { _id: recordToSave._id },
        { $set: recordToSave },
        { upsert: true }
      );

      const newRecord = await collection.findOne({ _id: recordToSave._id });
      const formattedRecord = formatRecord(newRecord);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(formattedRecord),
      };
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id;

      if (id) {
        // Lógica para eliminar un registro individual
        let deleteId: any = id;

        if (ObjectId.isValid(id)) {
          deleteId = new ObjectId(id);
        }

        const result = await collection.deleteOne({ _id: deleteId });

        if (result.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              message: `Record with ID ${id} not found.`,
            }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: `Deleted single record with ID ${id}`,
          }),
        };
      } else {
        // Lógica para eliminar todos los registros
        await collection.deleteMany({});
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: "All history records deleted" }),
        };
      }
    } // Si el método no es ninguno de los anteriores

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (error: any) {
    console.error("Error executing history function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
