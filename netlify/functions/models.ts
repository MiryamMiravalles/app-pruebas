import mongoose, { Schema } from "mongoose";

// ----------------------------------------------------
// --- Definiciones de Esquemas de Inventario y Pedidos ---
// ----------------------------------------------------

const InventoryItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: String,
    barcode: { type: String, default: "" },
    pricePerUnitWithoutIVA: { type: Number, required: false, default: 0 },
    stockByLocation: { type: Map, of: Number, minimize: false },
  },
  { timestamps: true }
);

InventoryItemSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret.id;
    delete ret._id;
  },
});

// 🛑 Reforzamiento de campos requeridos para PurchaseOrderSchema
const PurchaseOrderSchema = new Schema(
  {
    _id: { type: String, required: true },
    orderDate: { type: String, required: true },
    deliveryDate: String,
    supplierName: { type: String, required: true },
    status: { type: String, required: true },
    totalAmount: Number,
    items: [
      {
        inventoryItemId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
        costAtTimeOfPurchase: { type: Number, default: 0 },
        pricePerUnitWithoutIVA: { type: Number, default: 0 },
      },
    ],
  },

  { timestamps: true }
);

PurchaseOrderSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
  },
});

// Definición del sub-esquema para los ítems del registro de inventario
const InventoryRecordItemSchema = new Schema(
  {
    itemId: String,
    name: String,
    category: String,
    barcode: String,
    pricePerUnitWithoutIVA: Number,
    currentStock: Number,
    pendingStock: Number,
    initialStock: Number,
    endStock: Number,
    consumption: Number,
    stockByLocationSnapshot: { type: Map, of: Number, minimize: false },
  },
  { _id: false }
);

// Esquema completo para InventoryRecord
const InventoryRecordSchema = new Schema(
  {
    _id: { type: String, required: true },
    date: String,
    label: String,
    type: String,
    items: [InventoryRecordItemSchema],
  },

  { timestamps: true }
);

InventoryRecordSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
  },
});

// --- Exportaciones de Modelos ---

export const InventoryItemModel =
  mongoose.models.InventoryItem ||
  mongoose.model("InventoryItem", InventoryItemSchema);
export const PurchaseOrderModel =
  mongoose.models.PurchaseOrder ||
  mongoose.model("PurchaseOrder", PurchaseOrderSchema);
export const InventoryRecordModel =
  mongoose.models.InventoryRecord ||
  mongoose.model("InventoryRecord", InventoryRecordSchema);
