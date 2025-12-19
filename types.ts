export type View = "inventory" | "orders" | "analysis" | "history" | "stats";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  pricePerUnitWithoutIVA: number;
  stockByLocation: { [key: string]: number };
}

export interface PurchaseOrder {
  id: string;
  orderDate: string;
  deliveryDate?: string;
  supplierName: string;
  items: OrderItem[];
  status: PurchaseOrderStatus;
  totalAmount: number;
}

export enum PurchaseOrderStatus {
  Pending = "Pending",
  Completed = "Completed",
  Archived = "Archived",
}

export interface InventoryRecord {
  id: string;
  date: string;
  label: string;
  type: "snapshot" | "analysis";
  items: InventoryRecordItem[];
}

export interface InventoryRecordItem {
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
  details?: Record<string, number>;
}

export interface OrderItem {
  inventoryItemId: string;
  quantity: number;
  costAtTimeOfPurchase: number;
  pricePerUnitWithoutIVA: number;
}
