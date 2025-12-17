import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  InventoryItem,
  PurchaseOrder,
  PurchaseOrderStatus,
  OrderItem,
  InventoryRecord,
  InventoryRecordItem,
} from "../types";
import Modal from "./Modal";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  SearchIcon,
  InventoryIcon,
  RefreshIcon,
  ExportIcon, // IMPORTADO
} from "./icons";
import { INVENTORY_LOCATIONS } from "../constants";

interface InventoryProps {
  inventoryItems: InventoryItem[];
  purchaseOrders: PurchaseOrder[];
  suppliers: string[];
  inventoryHistory: InventoryRecord[];
  onSaveInventoryItem: (item: InventoryItem) => void;
  onDeleteInventoryItem: (id: string) => void;
  onSavePurchaseOrder: (order: PurchaseOrder) => void;
  onDeletePurchaseOrder: (id: string) => void;
  onBulkUpdateInventoryItems: (
    updates: { name: string; stock: number }[],
    mode: "set" | "add"
  ) => void;
  onSaveInventoryRecord: (record: InventoryRecord) => void;
  onDeleteAllInventoryRecords: () => void;
  onDeleteInventoryRecord: (id: string) => void; // AÑADIDO
  onDownloadHistoryRecord: (id: string, label: string) => void; // AÑADIDO
  activeTab: "inventory" | "orders" | "analysis" | "history";
  formatUTCToLocal: (utcDateString: string | Date | undefined) => string;
  handleResetInventoryStocks: () => void;
}

const emptyInventoryItem: Omit<InventoryItem, "id" | "stockByLocation"> = {
  name: "",
  category: "",
  pricePerUnitWithoutIVA: 0, // MODIFICADO
};

const emptyPurchaseOrder: Omit<PurchaseOrder, "id"> = {
  orderDate: new Date().toISOString().split("T")[0],
  supplierName: "",
  items: [],
  status: PurchaseOrderStatus.Pending,
  totalAmount: 0,
};

const parseDecimal = (input: string): number => {
  if (typeof input !== "string" || !input) return 0;
  // Aseguramos que solo haya puntos para que parseFloat funcione.
  const sanitized = input.replace(",", ".");
  const number = parseFloat(sanitized);
  return isNaN(number) ? 0 : number;
};

const parseCurrency = (input: string): number => {
  if (typeof input !== "string" || !input) return 0;
  const sanitized = input
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const number = parseFloat(sanitized);
  return isNaN(number) ? 0 : number;
};

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

// --- Local Component: CategoryAccordion (Se mantiene) ---

interface CategoryAccordionProps {
  title: string;
  children: React.ReactNode;
  itemCount: number;
  initialOpen?: boolean;
}
// Función para calcular el valor total de un pedido
const calculateOrderTotal = (
  order: PurchaseOrder,
  inventoryItems: InventoryItem[]
): number => {
  return order.items.reduce((total, item) => {
    // Obtenemos el precio unitario del artículo correspondiente en el inventario actual
    const itemDetail = inventoryItems.find(
      (i) => i.id === item.inventoryItemId
    );
    // Usamos el precio del inventario, ya que el precio en OrderItem no se mantiene actualizado en este flujo.
    const price = itemDetail?.pricePerUnitWithoutIVA || 0;
    return total + item.quantity * price;
  }, 0);
};
const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  title,
  children,
  itemCount,
  initialOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left text-lg font-bold text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span>{title}</span>
          <span className="text-xs font-normal bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
            {itemCount} items
          </span>
        </div>
        <ChevronDownIcon
          className={`h-6 w-6 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-500 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-2 border-t border-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
};

// 🛑 WeeklyConsumptionAnalysis RESTAURADO Y MODIFICADO
interface WeeklyConsumptionAnalysisProps {
  inventoryHistory: InventoryRecord[];
  inventoryItems: InventoryItem[]; // AÑADIDO
  formatUTCToLocal: (utcDateString: string | Date | undefined) => string;
}

const WeeklyConsumptionAnalysis: React.FC<WeeklyConsumptionAnalysisProps> = ({
  inventoryHistory,
  inventoryItems, // ACEPTADO
  formatUTCToLocal,
}) => {
  const lastRecord = useMemo(() => {
    if (!Array.isArray(inventoryHistory) || inventoryHistory.length === 0)
      return null;

    return inventoryHistory.find((r) => r.type === "analysis");
  }, [inventoryHistory]);

  if (!lastRecord) {
    return (
      <div className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-lg">
        <p>
          Se necesita al menos **un registro de análisis** para mostrar el
          análisis de consumo.
        </p>
        <p className="text-sm mt-2">
          Guarda el inventario actual en la pestaña de 'Análisis'.
        </p>
      </div>
    );
  }

  const consumptionItems = Array.isArray(lastRecord.items)
    ? lastRecord.items.filter((item) => (item.consumption || 0) > 0.001)
    : [];

  // NUEVA LÓGICA DE AGRUPACIÓN Y ORDENACIÓN
  const groupedConsumption = useMemo(() => {
    type DetailedConsumptionItem = InventoryRecordItem & { category: string };

    const itemsWithCategory: DetailedConsumptionItem[] = consumptionItems.map(
      (recordItem) => {
        const inventoryItem = inventoryItems.find(
          (i) => i.id === recordItem.itemId
        );
        const category = inventoryItem?.category || "Uncategorized";
        return { ...recordItem, category };
      }
    );

    const grouped = itemsWithCategory.reduce((acc, item) => {
      const category = item.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as { [key: string]: DetailedConsumptionItem[] });

    return Object.entries(grouped).sort(([catA], [catB]) => {
      const indexA = CATEGORY_ORDER.indexOf(catA);
      const indexB = CATEGORY_ORDER.indexOf(catB);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return catA.localeCompare(catB);
    });
  }, [consumptionItems, inventoryItems]);
  // FIN NUEVA LÓGICA

  return (
    <div className="bg-gray-800 shadow-xl rounded-lg overflow-x-auto p-4 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-xl font-bold text-white">
          Consumo de la Última Semana (Finalizado en:
          {formatUTCToLocal(lastRecord.date)})
        </h2>
      </div>
      {consumptionItems.length > 0 ? (
        // REEMPLAZO DE LA TABLA PLANA POR ACORDEONES AGRUPADOS
        <div className="space-y-3 mt-4">
          {groupedConsumption.map(([category, items]) => (
            <CategoryAccordion
              key={category}
              title={category}
              itemCount={items.length}
              initialOpen={true}
            >
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Artículo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Cantidad Gastada
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {items.map((item) => (
                    <tr key={item.itemId} className="hover:bg-gray-700/50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {item.name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-lg font-bold text-red-400">
                        {item.consumption
                          ? item.consumption.toFixed(1).replace(".", ",")
                          : "0,0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CategoryAccordion>
          ))}
        </div>
      ) : (
        <div className="text-center py-5 text-slate-500">
          <p>No hay artículos con consumo registrado en este análisis.</p>
        </div>
      )}
    </div>
  );
};

const InventoryComponent: React.FC<InventoryProps> = ({
  inventoryItems,
  purchaseOrders,
  suppliers,
  inventoryHistory,
  onSaveInventoryItem,
  onDeleteInventoryItem,
  onSavePurchaseOrder,
  onDeletePurchaseOrder,
  onBulkUpdateInventoryItems,
  onSaveInventoryRecord,
  onDeleteAllInventoryRecords,
  onDeleteInventoryRecord, // RECIBIDO
  onDownloadHistoryRecord, // RECIBIDO
  formatUTCToLocal,
  handleResetInventoryStocks,
  activeTab, // Propiedad activa de App.tsx
}) => {
  const [isInventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [currentInventoryItem, setCurrentInventoryItem] =
    useState<Partial<InventoryItem>>(emptyInventoryItem);

  // 🛑 AÑADIDO: Estado temporal para el input de precio decimal
  const [tempPriceString, setTempPriceString] = useState("");

  const [isOrderModalOpen, setOrderModalOpen] = useState(false);
  const [currentPurchaseOrder, setCurrentPurchaseOrder] = useState<
    PurchaseOrder | Omit<PurchaseOrder, "id">
  >(emptyPurchaseOrder);
  const [tempOrderQuantities, setTempOrderQuantities] = useState<
    Record<number, string>
  >({});

  const [tempStockValues, setTempStockValues] = useState<
    Record<string, string>
  >({});

  const [analysisDate, setAnalysisDate] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  const [viewingRecord, setViewingRecord] = useState<InventoryRecord | null>(
    null
  );

  const [selectedLocationColumn, setSelectedLocationColumn] = useState<
    string | "all"
  >("all");

  const calculateTotalStock = (item: InventoryItem) => {
    if (!item.stockByLocation) return 0;
    // Aseguramos que los valores son tratados como números para la suma.
    return Object.values(item.stockByLocation).reduce(
      (sum, val) => sum + (Number(val) || 0),
      0
    );
  };

  // 🛑 FUNCIÓN: Calcular el valor total del stock (Aseguramos la conversión a número)
  const calculateTotalValue = (item: InventoryItem): number => {
    const totalStock = calculateTotalStock(item);
    // Si el precio es undefined o null, se usa 0.
    return (Number(item.pricePerUnitWithoutIVA) || 0) * totalStock;
  };

  // 🛑 [INICIO DE FRAGMENTO 1 CORREGIDO]

  // Función para calcular el valor total de un pedido
  const calculateOrderTotal = (
    order: PurchaseOrder,
    inventoryItems: InventoryItem[]
  ): number => {
    return order.items.reduce((total, item) => {
      const itemDetail = inventoryItems.find(
        (i) => i.id === item.inventoryItemId
      );
      // Usamos el precio del inventario, ya que el precio en OrderItem no se mantiene actualizado en este flujo.
      const price = itemDetail?.pricePerUnitWithoutIVA || 0;
      return total + item.quantity * price;
    }, 0);
  };
  // 🛑 [FIN DE FRAGMENTO 1 CORREGIDO]

  const validInventoryHistory = useMemo(() => {
    if (!Array.isArray(inventoryHistory)) return [];
    // ... el resto de tu useMemo

    return inventoryHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ) as InventoryRecord[];
  }, [inventoryHistory]);

  const stockInOrders = useMemo(() => {
    const pending: { [key: string]: number } = {};
    purchaseOrders
      .filter((o) => o.status === PurchaseOrderStatus.Completed)
      .forEach((o) => {
        o.items.forEach((item) => {
          pending[item.inventoryItemId] =
            (pending[item.inventoryItemId] || 0) + item.quantity;
        });
      });
    return pending;
  }, [purchaseOrders]);

  // 🛑 ÚLTIMO ANÁLISIS GUARDADO
  const lastAnalysisRecord = useMemo(() => {
    return validInventoryHistory.find((r) => r.type === "analysis");
  }, [validInventoryHistory]);

  // 🛑 ÚLTIMO SNAPSHOT GUARDADO
  const lastSnapshotRecord = useMemo(() => {
    const latestSnapshot = validInventoryHistory.find(
      (r) => r.type === "snapshot"
    );
    return latestSnapshot;
  }, [validInventoryHistory]);

  const lastRecord = useMemo(() => {
    // Retorna el registro más reciente que puede ser análisis o snapshot (usado para initialStockMap)
    return validInventoryHistory.find(
      (r) => r.type === "analysis" || r.type === "snapshot"
    );
  }, [validInventoryHistory]);

  const initialStockMap = useMemo(() => {
    if (!lastRecord || !Array.isArray(lastRecord.items))
      return new Map<string, number>();

    return new Map<string, number>(
      lastRecord.items.map((item) => [
        item.itemId,
        item.endStock || item.initialStock || 0,
      ])
    );
  }, [lastRecord]);

  useEffect(() => {
    if (!isOrderModalOpen) return;
    setCurrentPurchaseOrder((prev) => ({ ...prev, totalAmount: 0 }));
  }, [currentPurchaseOrder.items, isOrderModalOpen]);

  useEffect(() => {
    if (isOrderModalOpen) {
      setOrderSearchTerm("");
    }
  }, [isOrderModalOpen]);

  const filteredItems = useMemo(() => {
    // 🛑 CORRECCIÓN: Usamos un Map para garantizar la deduplicación por ID.
    const uniqueItemsMap = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => {
      uniqueItemsMap.set(item.id, item);
    });
    let filteredList = Array.from(uniqueItemsMap.values());

    // Aplicar búsqueda
    if (!searchTerm) return filteredList;

    const lowerTerm = searchTerm.toLowerCase();
    return filteredList.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerTerm) ||
        item.category.toLowerCase().includes(lowerTerm)
    );
  }, [inventoryItems, searchTerm]);

  const filteredOrderItems = useMemo(() => {
    if (!orderSearchTerm) return inventoryItems;
    const lowerTerm = orderSearchTerm.toLowerCase();
    return inventoryItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerTerm) ||
        item.category.toLowerCase().includes(lowerTerm)
    );
  }, [inventoryItems, orderSearchTerm]);

  const groupedItems = useMemo(() => {
    const groups = filteredItems.reduce((acc, item) => {
      const category = item.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as { [key: string]: InventoryItem[] });

    // 🛑 AÑADIDO: Ordenar alfabéticamente los artículos dentro de cada categoría
    Object.keys(groups).forEach((category) => {
      groups[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [filteredItems]);

  const analysisGroupedItems = useMemo(() => {
    const groups: { [key: string]: typeof inventoryItems } = {};

    inventoryItems.forEach((item) => {
      const category = item.category || "Uncategorized";
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });

    const sortedGroups = Object.entries(groups).sort(([catA], [catB]) => {
      const indexA = CATEGORY_ORDER.indexOf(catA);
      const indexB = CATEGORY_ORDER.indexOf(catB);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return catA.localeCompare(catB);
    });

    return sortedGroups.map(([category, items]) => {
      const categoryTotalRelevantStock = items.reduce((sum, item) => {
        const currentStock = calculateTotalStock(item);
        const pendingStock = stockInOrders[item.id] || 0;
        return sum + currentStock + pendingStock;
      }, 0);
      return { category, items, categoryTotalRelevantStock };
    });
  }, [inventoryItems, stockInOrders]);

  // 🛑 CORRECCIÓN: Implementación de handlers para estado temporal y lógica de guardado
  const openInventoryModal = (item?: InventoryItem) => {
    const itemToEdit = item || emptyInventoryItem;
    setCurrentInventoryItem(itemToEdit);

    // 🛑 CORRECCIÓN CLAVE: Si el precio es 0, inicializar como cadena vacía ("")
    const priceValue = itemToEdit.pricePerUnitWithoutIVA || 0;
    setTempPriceString(
      priceValue > 0.01 ? String(priceValue).replace(".", ",") : ""
    );

    setInventoryModalOpen(true);
  };

  const closeInventoryModal = () => {
    setInventoryModalOpen(false);
    setCurrentInventoryItem(emptyInventoryItem);
    // 🛑 LIMPIAR ESTADO TEMPORAL AL CERRAR
    setTempPriceString("");
  };

  const handleSaveInventory = () => {
    const itemToSave: Partial<InventoryItem> = { ...currentInventoryItem };

    // 🛑 USAR EL VALOR PARSEADO DEL ESTADO TEMPORAL
    const finalPrice = parseDecimal(tempPriceString);
    itemToSave.pricePerUnitWithoutIVA = finalPrice;

    if (!itemToSave.id) {
      const initialStock = INVENTORY_LOCATIONS.reduce(
        (acc, loc) => ({ ...acc, [loc]: 0 }),
        {}
      );
      itemToSave.stockByLocation = initialStock;
    }

    onSaveInventoryItem({
      ...itemToSave,
      id: itemToSave.id || crypto.randomUUID(),
    } as InventoryItem);
    closeInventoryModal();
  };

  const handleInventoryChange = (
    field:
      | keyof Omit<InventoryItem, "id" | "stockByLocation">
      | "pricePerUnitWithoutIVA",
    value: string | number
  ) => {
    setCurrentInventoryItem((prev) => ({ ...prev, [field]: value }));
  };

  // 🛑 NUEVAS FUNCIONES PARA EL MANEJO DEL INPUT DE PRECIO DECIMAL
  const handlePriceInputChange = (value: string) => {
    // Validación para permitir solo números enteros o decimales con coma o punto (hasta 2 decimales)
    if (value && !/^\d*([,.]\d{0,2})?$/.test(value)) {
      return;
    }
    // Actualiza la CADENA DE TEXTO TEMPORAL (lo que el usuario ve)
    setTempPriceString(value);
  };

  const handlePriceInputBlur = () => {
    // En el BLUR, parsea el valor y actualiza el estado numérico real del artículo
    const newPrice = parseDecimal(tempPriceString);
    setCurrentInventoryItem((prev) => ({
      ...prev,
      pricePerUnitWithoutIVA: newPrice,
    }));
  };
  // 🛑 FIN DE NUEVOS HANDLERS

  const handleStockInputChange = (
    itemId: string,
    location: string,
    value: string
  ) => {
    // 🛑 CORRECCIÓN: Permite coma (,) o punto (.) como separador decimal y hasta DOS decimales.
    if (value && !/^\d*([,.]\d{0,2})?$/.test(value)) {
      return;
    }
    setTempStockValues((prev) => ({
      ...prev,
      [`${itemId}-${location}`]: value,
    }));
  };

  const handleStockInputBlur = (item: InventoryItem, location: string) => {
    const tempValue = tempStockValues[`${item.id}-${location}`];
    if (tempValue !== undefined) {
      const newStock = parseDecimal(tempValue); // Nuevo stock (número)

      // 🛑 CORRECCIÓN CLAVE: Usar Number() y comparación por Epsilon para robustez de punto flotante.
      const currentStock = Number(item.stockByLocation[location]) || 0; // Stock actual (aseguramos que es número)
      const difference = Math.abs(newStock - currentStock);
      const EPSILON = 0.001; // Tolerancia de 0.001

      if (difference > EPSILON) {
        // Solo guardamos si hay una diferencia significativa
        const updatedStockByLocation = {
          ...item.stockByLocation, // 🛑 Esto ahora es un objeto plano gracias a la corrección en App.tsx
          [location]: newStock, // Guardamos el nuevo valor numérico parseado
        };
        onSaveInventoryItem({
          ...item, // 🛑 IMPORTANTE: Mantenemos el objeto 'item' completo, que incluye el precio.
          stockByLocation: updatedStockByLocation,
        });
      }

      setTempStockValues((prev) => {
        const newTemp = { ...prev };
        delete newTemp[`${item.id}-${location}`];
        return newTemp;
      });
    }
  };

  const openOrderModal = (order?: PurchaseOrder) => {
    const initialOrder: PurchaseOrder | Omit<PurchaseOrder, "id"> = order
      ? {
          ...order,
          items: order.items.map((item) => ({
            ...item,
            costAtTimeOfPurchase: 0,
          })),
        }
      : emptyPurchaseOrder;

    setCurrentPurchaseOrder(initialOrder);

    const tempQs: Record<number, string> = {};
    initialOrder.items.forEach((item, index) => {
      tempQs[index] = item.quantity
        ? String(item.quantity).replace(".", ",")
        : "";
    });
    setTempOrderQuantities(tempQs);
    setOrderModalOpen(true);
  };
  const closeOrderModal = () => {
    setOrderModalOpen(false);
    setCurrentPurchaseOrder(emptyPurchaseOrder);
    setTempOrderQuantities({}); // Limpiar cantidades temporales
  };

  const handleSaveOrder = () => {
    const hasItems = currentPurchaseOrder.items.length > 0;

    const allItemsAreValid = currentPurchaseOrder.items.every(
      (item) => item.quantity > 0.001 && item.inventoryItemId.trim() !== ""
    );
    const hasSupplierName = currentPurchaseOrder.supplierName.trim() !== "";

    if (!hasSupplierName || !hasItems || !allItemsAreValid) {
      // 🛑 Validación estricta
      alert(
        "Por favor, introduce el proveedor y asegúrate de que el pedido contiene al menos un artículo válido (cantidad positiva y seleccionado)."
      );
      return;
    }
    const orderToSave: PurchaseOrder = {
      ...currentPurchaseOrder,
      id: (currentPurchaseOrder as PurchaseOrder).id || crypto.randomUUID(),
      status: (currentPurchaseOrder as PurchaseOrder).status
        ? currentPurchaseOrder.status
        : PurchaseOrderStatus.Pending,
      totalAmount: 0,
    } as PurchaseOrder;

    onSavePurchaseOrder(orderToSave);

    alert(
      "Pedido guardado correctamente. Los artículos no aparecerán en 'En Pedidos' hasta ser recibidos"
    );
    closeOrderModal();
  };

  const handleReceiveOrder = (order: PurchaseOrder) => {
    if (
      order.status === PurchaseOrderStatus.Completed ||
      order.status === PurchaseOrderStatus.Archived
    ) {
      alert("Este pedido ya fue recibido.");
      return;
    }

    if (
      !window.confirm(
        `¿Confirmar la recepción del pedido a ${order.supplierName} (${order.orderDate})? Esto actualizará el estado a 'Completed' y las cantidades AHORA se reflejarán en la columna \"En Pedidos\" del Análisis.`
      )
    ) {
      return;
    }

    onSavePurchaseOrder({
      ...order,
      status: PurchaseOrderStatus.Completed,
      deliveryDate: new Date().toISOString().split("T")[0],
    } as PurchaseOrder);
  };

  const handleOrderChange = (
    field: keyof Omit<PurchaseOrder, "id" | "items">,
    value: string | PurchaseOrderStatus
  ) => {
    setCurrentPurchaseOrder((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddProductFromSearch = (item: InventoryItem) => {
    const isAlreadyInOrder = currentPurchaseOrder.items.some(
      (oi) => oi.inventoryItemId === item.id
    );

    if (isAlreadyInOrder) return;

    const newItem: OrderItem = {
      inventoryItemId: item.id,
      quantity: 1,
      costAtTimeOfPurchase: 0,
      pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA || 0, // AÑADIDO
    };

    setCurrentPurchaseOrder((prev) => {
      const newItemsList = [...prev.items, newItem];
      const newIndex = newItemsList.length - 1;

      setTempOrderQuantities((prevTemp) => ({
        ...prevTemp,
        [newIndex]: "1",
      }));
      return { ...prev, items: newItemsList };
    });

    setOrderSearchTerm("");
  };

  const addOrderItem = () => {
    const newItem: OrderItem = {
      inventoryItemId: "",
      quantity: 1,
      costAtTimeOfPurchase: 0,
      pricePerUnitWithoutIVA: 0, // AÑADIDO
    };
    const newIndex = currentPurchaseOrder.items.length;
    setCurrentPurchaseOrder((prev) => {
      const newItemsList = [...prev.items, newItem];
      setTempOrderQuantities((prevValues) => ({
        ...prevValues,
        [newIndex]: "1",
      }));
      return { ...prev, items: newItemsList };
    });
  };

  const removeOrderItem = (index: number) => {
    setCurrentPurchaseOrder((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      setTempOrderQuantities((prevTemp) => {
        const newTemp: Record<number, string> = {};
        newItems.forEach((item, newIndex) => {
          const oldIndex = prev.items.findIndex(
            (prevItem) => prevItem.inventoryItemId === item.inventoryItemId
          );
          newTemp[newIndex] =
            prevTemp[oldIndex] || String(item.quantity).replace(".", ",");
        });
        return newTemp;
      });
      return { ...prev, items: newItems };
    });
  };

  const handleOrderQuantityChange = (index: number, value: string) => {
    if (value && !/^\d*[,]?\d*$/.test(value)) {
      return;
    }
    setTempOrderQuantities((prev) => ({ ...prev, [index]: value }));

    const parsedQuantity = parseDecimal(value);
    setCurrentPurchaseOrder((prev) => {
      const newItems = [...prev.items]; // Corregido el acceso al array, asegurando que existe antes de actualizar
      if (newItems[index] && newItems[index].quantity !== parsedQuantity) {
        newItems[index] = { ...newItems[index], quantity: parsedQuantity };
      }
      return { ...prev, items: newItems };
    });
  };

  const handleOrderItemChange = (
    index: number,
    field: "inventoryItemId",
    value: string
  ) => {
    // Validación para evitar duplicados si se selecciona manualmente
    const isAlreadyInOrder = currentPurchaseOrder.items.some(
      (oi, i) => i !== index && oi.inventoryItemId === value
    );

    if (isAlreadyInOrder) {
      alert("Este artículo ya ha sido añadido a la lista.");
      return;
    }

    const newItems = [...currentPurchaseOrder.items];
    const itemToUpdate = { ...newItems[index], [field]: value };
    newItems[index] = itemToUpdate;
    setCurrentPurchaseOrder((prev) => ({ ...prev, items: newItems }));
  };

  // --- Handlers de Descarga ---
  const handleDownloadLastSnapshot = () => {
    if (lastSnapshotRecord) {
      onDownloadHistoryRecord(lastSnapshotRecord.id, lastSnapshotRecord.label);
    } else {
      alert(
        "No se ha guardado ninguna instantánea de inventario todavía. Por favor, guarda una primero."
      );
    }
  };

  const handleDownloadLastAnalysis = () => {
    if (lastAnalysisRecord) {
      onDownloadHistoryRecord(lastAnalysisRecord.id, lastAnalysisRecord.label);
    } else {
      alert(
        "No se ha guardado ningún análisis de consumo todavía. Por favor, guarda uno primero."
      );
    }
  };

  // --- Guardar Inventario (Snapshot - Pestaña Inventario) ---
  const handleSaveInventorySnapshot = () => {
    if (inventoryItems.length === 0) {
      alert("No hay artículos en el inventario para guardar.");
      return;
    }

    const recordDate = new Date();

    const formattedDate = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const recordItems: InventoryRecordItem[] = inventoryItems.map((item) => {
      const totalStock = calculateTotalStock(item);
      const pendingStock = stockInOrders[item.id] || 0;

      return {
        itemId: item.id,
        name: item.name,
        category: item.category, // Aseguramos la categoría
        currentStock: totalStock,
        pendingStock: pendingStock,
        initialStock: totalStock,
        endStock: totalStock,
        consumption: 0,
        stockByLocationSnapshot: item.stockByLocation || {},
        pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA, // AÑADIDO
      };
    });

    const newRecord: InventoryRecord = {
      id: crypto.randomUUID(),
      date: recordDate.toISOString(),
      label: `Inventario (${formattedDate})`,
      items: recordItems,
      type: "snapshot",
    };

    onSaveInventoryRecord(newRecord);

    alert(
      `Instantánea del inventario (${formattedDate}) guardada en el historial`
    );
  };

  // --- Guardar Análisis de Consumo (Pestaña Análisis) ---
  const handleSaveCurrentInventory = async () => {
    if (inventoryItems.length === 0) {
      alert("No hay artículos en el inventario para guardar.");
      return;
    }

    const recordDate = new Date();

    const recordItems: InventoryRecordItem[] = inventoryItems.map((item) => {
      const totalStock = calculateTotalStock(item);
      const pendingStock = stockInOrders[item.id] || 0;

      const previousEndStock = initialStockMap.get(item.id) || 0;
      const initialTotalStock = previousEndStock + pendingStock;

      const endStock = totalStock;
      const consumption = initialTotalStock - endStock;

      return {
        itemId: item.id,
        name: item.name,
        category: item.category, // Aseguramos la categoría
        currentStock: totalStock,
        pendingStock: pendingStock,
        initialStock: initialTotalStock,
        endStock: endStock,
        consumption: consumption,
        pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA, // AÑADIDO
      };
    });

    const formattedDate = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const newRecord: InventoryRecord = {
      id: crypto.randomUUID(),
      date: recordDate.toISOString(),
      label: `Análisis (${formattedDate})`,
      items: recordItems,
      type: "analysis",
    };

    onSaveInventoryRecord(newRecord);

    purchaseOrders
      .filter((o) => o.status === PurchaseOrderStatus.Completed)
      .forEach((order) => {
        onSavePurchaseOrder({
          ...order,
          status: PurchaseOrderStatus.Archived,
        } as PurchaseOrder);
      });

    alert(`Análisis de consumo (${formattedDate}) guardado`);
  };

  const handleResetInventory = handleResetInventoryStocks;

  // --- Historial Handlers (Restaurados) ---
  const handleDeleteAllHistory = () => {
    onDeleteAllInventoryRecords();
  };

  // NUEVA FUNCIÓN PARA BORRAR UN REGISTRO INDIVIDUAL
  const handleDeleteRecord = (record: InventoryRecord) => {
    if (
      window.confirm(
        `¿Está seguro de que desea eliminar el registro de historial: "${record.label}"? Esta acción no se puede deshacer.`
      )
    ) {
      onDeleteInventoryRecord(record.id);
    }
  };

  const handleDownloadRecord = (recordId: string, recordLabel: string) => {
    onDownloadHistoryRecord(recordId, recordLabel);
  };

  const closeRecordDetailModal = () => {
    setViewingRecord(null);
  };

  const openRecordDetailModal = (record: InventoryRecord) => {
    setViewingRecord(record);
  };

  const renderInventoryRecordDetailModal = () => {
    if (!viewingRecord || !Array.isArray(viewingRecord.items)) return null;

    const isAnalysis = viewingRecord.type === "analysis";

    const recordItems = viewingRecord.items as InventoryRecordItem[];

    // NEW LOGIC: Type, Mapping, Filtering, Grouping, Sorting
    // Tipo auxiliar para incluir la categoría del item actual
    type DetailedInventoryRecordItem = InventoryRecordItem & {
      category: string;
    };

    const itemsWithCategory: DetailedInventoryRecordItem[] = recordItems.map(
      (recordItem) => {
        // Usar inventoryItems prop para encontrar la categoría
        const inventoryItem = inventoryItems.find(
          (i) => i.id === recordItem.itemId
        );
        const category = inventoryItem?.category || "Uncategorized";
        return { ...recordItem, category };
      }
    );

    // Filtra los ítems relevantes: Para análisis, solo los que tuvieron consumo.
    const relevantItems = itemsWithCategory.filter(
      (item) => !isAnalysis || (item.consumption || 0) > 0.001
    );

    if (relevantItems.length === 0) {
      return (
        <Modal
          title={`Detalle: ${viewingRecord.label}`}
          onClose={closeRecordDetailModal}
          onSave={closeRecordDetailModal}
          hideSaveButton={true}
          size="max-w-7xl"
        >
          <div className="text-center py-10 text-slate-500">
            <p>
              No se registraron artículos relevantes para mostrar en este
              historial.
            </p>
            {/* CORRECCIÓN DE ERROR: Se reemplaza '>' por '&gt;' */}
            {isAnalysis && (
              <p className="text-sm mt-2">
                Sólo se muestran artículos con consumo registrado (&gt; 0.001).
              </p>
            )}
          </div>
        </Modal>
      );
    }

    // Agrupar ítems por categoría
    const groupedHistoryItems = relevantItems.reduce((acc, item) => {
      const category = item.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as { [key: string]: DetailedInventoryRecordItem[] });

    // Ordenar grupos por CATEGORY_ORDER
    const sortedHistoryGroups = Object.entries(groupedHistoryItems).sort(
      ([catA], [catB]) => {
        const indexA = CATEGORY_ORDER.indexOf(catA);
        const indexB = CATEGORY_ORDER.indexOf(catB);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return catA.localeCompare(catB);
      }
    );
    // END NEW LOGIC

    // MODIFIED: Acepta ítems ya filtrados para la categoría
    const renderAnalysisTable = (items: DetailedInventoryRecordItem[]) => {
      const consumedItems = items;

      if (consumedItems.length === 0) {
        return (
          <div className="text-center py-5 text-slate-500">
                     
            <p>No se registró consumo de artículos en esta categoría.</p>       
          </div>
        );
      }

      return (
        <div>
                 
          <table className="min-w-full divide-y divide-gray-700">
                 
            <thead className="bg-gray-700/50">
                         
              <tr>
                                {/* 🛑 Columna 1: Artículo */}       
                <th className="px-0 py-1 text-left text-sm font-medium text-gray-300 uppercase min-w-[120px] whitespace-normal">
                                    Artículo            
                </th>
                               {/* 🛑 Columna 2: STOCK ACTUAL */}             
                <th className="px-0 py-1 text-center text-xs font-medium text-gray-300 uppercase min-w-[40px] whitespace-normal">
                                    STOCK ACTUAL          
                </th>
                               
                {/* 🛑 Columna 3: EN PEDIDOS (Anteriormente Pedidos) */}       
                <th className="px-0 py-1 text-center text-xs font-medium text-gray-300 uppercase min-w-[40px] whitespace-normal">
                                    EN PEDIDOS          
                </th>
                               
                {/* 🛑 Columna 4: STOCK SEMANA ANTERIOR (Anteriormente Stock Inicial) */}
                   
                <th className="px-0 py-1 text-center text-xs font-medium text-gray-300 uppercase min-w-[40px] whitespace-normal">
                                    STOCK SEMANA ANTERIOR          
                </th>
                               
                {/* 🛑 Columna 5: STOCK INICIAL TOTAL (Anteriormente Stock Final) */}
                       
                <th className="px-0 py-1 text-center text-xs font-medium text-gray-300 uppercase min-w-[40px] whitespace-normal">
                                    STOCK INICIAL TOTAL          
                </th>
                               {/* 🛑 Columna 6: Consumo */}             
                <th className="px-0 py-1 text-center text-xs font-medium text-gray-300 uppercase min-w-[45px] whitespace-normal">
                                    Consumo          
                </th>
                     
              </tr>
                   
            </thead>
                 
            <tbody className="bg-gray-800 divide-y divide-gray-700">
                       
              {consumedItems.map((item, itemIndex) => (
                <tr key={item.itemId || itemIndex}>
                                    {/* Artículo (Data) */}           
                  <td className="px-0 py-1 whitespace-nowrap text-sm font-medium text-white min-w-[120px]">
                                        {item.name}               
                  </td>
                                   {/* 🛑 STOCK ACTUAL (Data) */}               
                  <td className="px-0 py-1 whitespace-nowrap text-sm text-center text-gray-300 min-w-[40px]">
                               {/* Muestra el stock actual (EndStock) */}       
                             
                    {item.endStock && item.endStock > 0.001
                      ? item.endStock.toFixed(1).replace(".", ",")
                      : "0,0"}
                             
                  </td>
                  {/* 🛑 EN PEDIDOS (Data) */}             
                  <td className="px-0 py-1 whitespace-nowrap text-sm text-center text-yellow-400 min-w-[40px]">
                                 
                    {item.pendingStock && item.pendingStock > 0.001
                      ? item.pendingStock.toFixed(1).replace(".", ",")
                      : "0,0"}
                             
                  </td>
                                   {/* 🛑 STOCK SEMANA ANTERIOR (Data) */}     
                     
                  <td className="px-0 py-1 whitespace-nowrap text-sm text-center text-gray-300 min-w-[40px]">
                             
                    {/* Usamos EndStock del registro anterior (que es InitialStock en el cálculo) */}
                           
                    {item.initialStock && item.initialStock > 0.001
                      ? (item.initialStock - (item.pendingStock || 0))
                          .toFixed(1)
                          .replace(".", ",")
                      : "0,0"}
                           
                  </td>
                                   {/* 🛑 STOCK INICIAL TOTAL (Data) */}       
                     
                  <td className="px-0 py-1 whitespace-nowrap text-sm text-center text-blue-400 font-bold min-w-[40px]">
                                 
                    {item.initialStock && item.initialStock > 0.001
                      ? item.initialStock.toFixed(1).replace(".", ",")
                      : "0,0"}
                             
                  </td>
                             
                  <td
                    className={`px-0 py-1 whitespace-nowrap text-lg text-center font-bold min-w-[45px] ${
                      item.consumption && item.consumption > 0.001
                        ? "text-red-400"
                        : "text-green-400"
                    }`}
                  >
                               
                    {item.consumption && item.consumption > 0.001
                      ? item.consumption.toFixed(1).replace(".", ",")
                      : "0,0"}
                               
                  </td>
                     
                </tr>
              ))}
                       
            </tbody>
                 
          </table>
               
        </div>
      );
    };

    // MODIFIED: Acepta ítems ya filtrados para la categoría
    // MODIFIED: Acepta ítems ya filtrados para la categoría
    const renderSnapshotTable = (items: DetailedInventoryRecordItem[]) => {
      // 🛑 DEFINICIÓN LOCAL DE HELPERS PARA OPERAR SOBRE InventoryRecordItem
      const calculateSnapshotTotalStock = (
        item: DetailedInventoryRecordItem
      ): number => {
        return Object.values(item.stockByLocationSnapshot || {}).reduce(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
      };

      const calculateSnapshotTotalValue = (
        item: DetailedInventoryRecordItem
      ): number => {
        const totalStock = calculateSnapshotTotalStock(item);
        // Usamos el precio almacenado en el registro del historial (pricePerUnitWithoutIVA)
        return (Number(item.pricePerUnitWithoutIVA) || 0) * totalStock;
      };
      // 🛑 FIN DE DEFINICIÓN LOCAL

      const itemsWithTotals = items // Usar los ítems ya agrupados
        .map((item) => ({
          ...item,
          // 🛑 Uso la función de cálculo LOCAL definida arriba
          calculatedTotal: calculateSnapshotTotalStock(item),
        }))
        .filter((item) => item.calculatedTotal > 0.001);

      if (itemsWithTotals.length === 0) {
        return (
          <div className="text-center py-5 text-slate-500">
            <p>No se registraron artículos en stock en esta categoría.</p>
          </div>
        );
      }

      // Definición de anchos de columna para Snapshot
      const ITEM_COL_WIDTH = "min-w-[120px]";
      const PRICE_COL_WIDTH = "min-w-[80px] w-20";
      const TOTAL_VALUE_WIDTH = "min-w-[96px] w-24";
      const TOTAL_STOCK_WIDTH = "min-w-[80px] w-20";

      return (
        <div className="overflow-x-auto">
          {/* 🛑 table-fixed para controlar anchos */}
          <table className="divide-y divide-gray-700 table-fixed min-w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {/* ARTÍCULO */}
                <th
                  className={`p-1 text-left text-xs font-medium text-gray-300 uppercase ${ITEM_COL_WIDTH} whitespace-nowrap overflow-hidden text-ellipsis`}
                >
                  ARTÍCULO
                </th>
                {/* P.U. S/IVA */}
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${PRICE_COL_WIDTH}`}
                >
                  P.U. S/IVA
                </th>
                {/* UBICACIONES */}
                {INVENTORY_LOCATIONS.map((loc) => (
                  <th
                    key={loc}
                    className={`p-1 text-center text-xs font-medium text-gray-300 uppercase w-16 whitespace-nowrap overflow-hidden text-ellipsis`}
                    title={loc}
                  >
                    {loc.toUpperCase()}
                  </th>
                ))}
                {/* 🛑 VALOR TOTAL (Monetario) */}
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${TOTAL_VALUE_WIDTH}`}
                >
                  VALOR TOTAL
                </th>
                {/* 🛑 TOTAL (Unidades) */}
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${TOTAL_STOCK_WIDTH}`}
                >
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {itemsWithTotals.map((item, itemIndex) => {
                // 🛑 Uso las funciones de cálculo LOCALES
                const calculatedTotal = item.calculatedTotal || 0; // Unidades Totales
                const totalValue = calculateSnapshotTotalValue(item); // Valor Monetario Total

                return (
                  <tr
                    key={item.itemId || itemIndex}
                    className="hover:bg-gray-700/50"
                  >
                    {/* ARTÍCULO DATA */}
                    <td
                      className={`p-1 whitespace-nowrap text-sm font-medium text-white ${ITEM_COL_WIDTH}`}
                    >
                      {item.name}
                    </td>
                    {/* P.U. S/IVA DATA */}
                    <td
                      className={`p-1 text-center whitespace-nowrap text-xs text-slate-300 ${PRICE_COL_WIDTH}`}
                    >
                      {item.pricePerUnitWithoutIVA &&
                      item.pricePerUnitWithoutIVA > 0.01
                        ? item.pricePerUnitWithoutIVA
                            .toFixed(2)
                            .replace(".", ",") + " €"
                        : "0,00 €"}
                    </td>
                    {/* UBICACIONES DATA (Solo lectura) */}
                    {INVENTORY_LOCATIONS.map((loc) => {
                      const stockValue =
                        item.stockByLocationSnapshot?.[loc] || 0;
                      return (
                        <td
                          key={loc}
                          className="p-1 whitespace-nowrap text-center w-16"
                        >
                          {/* Stock por ubicación */}
                          <div
                            className={`
                                                bg-slate-700 rounded-md p-1 w-10 text-center mx-auto 
                                                ${
                                                  stockValue > 0.001
                                                    ? "text-green-400 font-bold text-sm"
                                                    : "text-slate-400 text-sm"
                                                }
                                            `}
                          >
                            {stockValue > 0.001
                              ? stockValue.toFixed(1).replace(".", ",")
                              : "0"}
                          </div>
                        </td>
                      );
                    })}

                    {/* 🛑 VALOR TOTAL DATA (Monetario) */}
                    <td
                      className={`p-1 text-center whitespace-nowrap text-sm font-bold ${TOTAL_VALUE_WIDTH}`}
                    >
                      <span
                        className={
                          totalValue > 0.01
                            ? "text-yellow-400"
                            : "text-slate-400"
                        }
                      >
                        {totalValue > 0.01
                          ? `${totalValue.toFixed(2).replace(".", ",")} €`
                          : "0,00 €"}
                      </span>
                    </td>

                    {/* 🛑 TOTAL DATA (Unidades) */}
                    <td
                      className={`p-1 text-center whitespace-nowrap text-lg font-bold ${TOTAL_STOCK_WIDTH}`}
                    >
                      <span
                        className={
                          calculatedTotal > 0.001
                            ? "text-green-400"
                            : "text-slate-400"
                        }
                      >
                        {calculatedTotal > 0.001
                          ? calculatedTotal.toFixed(1).replace(".", ",")
                          : "0,0"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };
    return (
      <Modal
        title={`Detalle: ${viewingRecord.label}`}
        onClose={closeRecordDetailModal}
        onSave={closeRecordDetailModal}
        hideSaveButton={true}
        size="max-w-7xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-sm text-slate-400 mb-4">
            Registrado el
            {formatUTCToLocal(viewingRecord.date)}.
          </p>
          {/* MODIFICADO PARA AGRUPAR POR CATEGORÍA */}
          <div className="space-y-4">
            {sortedHistoryGroups.map(([category, items]) => (
              <CategoryAccordion
                key={category}
                title={category}
                itemCount={items.length}
                initialOpen={true}
              >
                {isAnalysis
                  ? renderAnalysisTable(items)
                  : renderSnapshotTable(items)}
              </CategoryAccordion>
            ))}
          </div>
          {/* FIN MODIFICACIÓN */}
        </div>
      </Modal>
    );
  };

  const renderInventoryForm = () => (
    <div className="space-y-4">
      {/* SECCIÓN NOMBRE: Ahora visible siempre para permitir edición */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium ml-1">
          Nombre del Artículo
        </label>
        <input
          type="text"
          placeholder="Nombre del Artículo"
          value={currentInventoryItem.name || ""}
          onChange={(e) => handleInventoryChange("name", e.target.value)}
          className="bg-gray-700 text-white rounded p-2 w-full border border-gray-600 focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>

      {/* SECCIÓN PRECIO: Usa el estado temporal para manejar decimales correctamente */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium ml-1">
          Precio Unitario sin IVA
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Precio Unitario sin IVA (Ej: 12,50)"
            value={tempPriceString}
            onChange={(e) => handlePriceInputChange(e.target.value)}
            onBlur={handlePriceInputBlur}
            className="bg-gray-700 text-white rounded p-2 w-full pr-8 border border-gray-600 focus:ring-2 focus:ring-indigo-500"
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 pointer-events-none">
            €
          </span>
        </div>
      </div>

      {/* SECCIÓN CATEGORÍA */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium ml-1">
          Categoría
        </label>
        <select
          value={currentInventoryItem.category || ""}
          onChange={(e) => handleInventoryChange("category", e.target.value)}
          className="bg-gray-700 text-white rounded p-2 w-full border border-gray-600 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="" disabled>
            Seleccionar Categoría
          </option>
          {CATEGORY_ORDER.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          {currentInventoryItem.category &&
            !CATEGORY_ORDER.includes(currentInventoryItem.category) && (
              <option
                key={currentInventoryItem.category}
                value={currentInventoryItem.category}
              >
                {currentInventoryItem.category} (Personalizada)
              </option>
            )}
        </select>
      </div>
    </div>
  );

  const renderOrderForm = () => {
    const hasItems = currentPurchaseOrder.items.length > 0;

    const allItemsAreValid = currentPurchaseOrder.items.every(
      (item) => item.quantity > 0.001 && item.inventoryItemId.trim() !== ""
    );
    const hasSupplierName = currentPurchaseOrder.supplierName.trim() !== "";
    const canSave = hasSupplierName && hasItems && allItemsAreValid;

    let disabledTitle = "Guardar pedido";

    if (!hasSupplierName) {
      disabledTitle = "Introduce el proveedor para guardar";
    } else if (!hasItems) {
      disabledTitle = "Añade al menos un artículo al pedido para guardar";
    } else if (!allItemsAreValid) {
      disabledTitle =
        "Asegúrate de que todos los artículos tienen cantidad positiva y están seleccionados";
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="date"
            value={currentPurchaseOrder.orderDate}
            onChange={(e) => handleOrderChange("orderDate", e.target.value)}
            className="bg-gray-700 text-white rounded p-2 w-full"
          />
          <div className="relative">
            <input
              type="text"
              list="supplier-list"
              placeholder="Proveedor"
              value={currentPurchaseOrder.supplierName}
              onChange={(e) =>
                handleOrderChange("supplierName", e.target.value)
              }
              className="bg-gray-700/50 text-white rounded p-2 w-full"
            />
            <datalist id="supplier-list">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        <h3 className="text-lg font-bold text-white pt-4">
          Artículos del Pedido
        </h3>
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Buscar producto para añadir..."
            value={orderSearchTerm}
            onChange={(e) => setOrderSearchTerm(e.target.value)}
            className="bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 w-full border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
          />
        </div>
        {orderSearchTerm && filteredOrderItems.length > 0 && (
          <div className="bg-slate-900/50 rounded-md p-2 space-y-1">
            {filteredOrderItems.slice(0, 5).map((item) => {
              const isAlreadyInOrder = currentPurchaseOrder.items.some(
                (oi) => oi.inventoryItemId === item.id
              );

              return (
                <div
                  key={item.id}
                  className={`flex justify-between items-center p-2 rounded-sm ${
                    isAlreadyInOrder
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-slate-700/50"
                  }`}
                >
                  <span className="text-white text-sm">{item.name}</span>
                  <button
                    onClick={() => handleAddProductFromSearch(item)}
                    className={`p-1 rounded text-white text-xs flex items-center gap-1 ${
                      isAlreadyInOrder
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    disabled={isAlreadyInOrder}
                  >
                    {isAlreadyInOrder ? "Añadido" : "✅ Añadir"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {currentPurchaseOrder.items.map((orderItem, index) => {
          const itemDetails = inventoryItems.find(
            (item) => item.id === orderItem.inventoryItemId
          ); // Artículos disponibles para el select (no deben estar ya en el pedido)
          const availableItems = inventoryItems.filter(
            (item) =>
              !currentPurchaseOrder.items.some(
                (oi, i) => i !== index && oi.inventoryItemId === item.id
              )
          );

          return (
            <div
              key={index}
              className="flex gap-2 items-center p-2 bg-gray-900/50 rounded-md"
            >
              {orderItem.inventoryItemId && itemDetails ? (
                <span className="text-white w-1/3 flex-shrink-0">
                  {itemDetails.name}
                </span>
              ) : (
                <select
                  value={orderItem.inventoryItemId}
                  onChange={(e) =>
                    handleOrderItemChange(
                      index,
                      "inventoryItemId",
                      e.target.value
                    )
                  }
                  className="bg-gray-700 text-white rounded p-2 flex-grow"
                >
                  <option value="">Seleccionar Artículo</option>
                  {availableItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Cantidad"
                value={tempOrderQuantities[index] ?? ""}
                onChange={(e) =>
                  handleOrderQuantityChange(index, e.target.value)
                }
                className="bg-gray-700 text-white rounded p-2 w-24"
              />
              <div className="relative w-28 invisible">
                <input
                  type="text"
                  disabled
                  className="bg-gray-700 text-white rounded p-2 w-full pr-8"
                  value={"0,00"}
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 pointer-events-none">
                  €
                </span>
              </div>
              <button
                onClick={() => removeOrderItem(index)}
                className="p-1 bg-red-600 rounded text-white h-7 w-7 flex items-center justify-center"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <button
          onClick={addOrderItem}
          className="text-indigo-400 hover:text-indigo-300 text-xs font-medium mt-1"
        >
          + Añadir Artículo (manualmente)
        </button>
        <div className="flex justify-end p-4 border-t border-gray-700 rounded-b-lg mt-4 bg-gray-800">
          <button
            onClick={closeOrderModal}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-1.5 px-3.5 rounded-lg mr-2 text-sm transition duration-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveOrder}
            disabled={!canSave}
            className={`font-medium py-1.5 px-3.5 rounded-lg text-sm transition duration-300 ${
              canSave
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
            title={disabledTitle}
          >
            Guardar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 animate-fade-in">
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center mb-4 gap-2">
            <div className="flex w-full gap-2 flex-wrap sm:justify-start">
              <div className="relative w-7/12 max-w-none sm:w-56 order-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar bebida..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-gray-700 text-white rounded-lg pl-9 pr-3 py-1.5 w-full text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
                />
              </div>

              <div className="flex-shrink-0 w-7/12 max-w-none sm:w-56 order-2">
                <select
                  value={selectedLocationColumn}
                  onChange={(e) => setSelectedLocationColumn(e.target.value)}
                  className="bg-gray-700 text-white rounded-lg p-1.5 w-full text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[100px] appearance-none"
                >
                  <option value="all">Todas las ubicaciones</option>
                  {INVENTORY_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end order-3 mt-2 sm:mt-0">
              {/* 🛑 BOTÓN DE DESCARGA: Ancho fijo 'w-8' en móvil y padding 'px-2' */}
              <button
                onClick={handleDownloadLastSnapshot}
                // w-8 (móvil compacto), md:w-auto (escritorio completo), px-2 (padding reducido en móvil)
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-2 md:px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition duration-300 h-7 w-8 md:w-auto"
                title="Descargar Última Instantánea de Inventario"
                disabled={!lastSnapshotRecord}
              >
                <ExportIcon className="h-6 w-6 md:h-4 md:w-4" />
                {/* Ocultar texto hasta md */}
                <span className="hidden md:inline">Descargar</span>
              </button>

              {/* 🛑 BOTÓN RESETEAR: Ancho fijo 'w-8' en móvil y padding 'px-2' */}
              <button
                onClick={handleResetInventory}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-2 md:px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition duration-300 h-7 w-8 md:w-auto"
                title="Resetear Stock a 0"
              >
                <RefreshIcon className="h-6 w-6 md:h-4 md:w-4" />
                {/* Ocultar texto hasta md */}
                <span className="hidden md:inline">Resetear</span>
              </button>

              {/* 🛑 BOTÓN GUARDAR: Ancho fijo 'w-8' en móvil y padding 'px-2' */}
              <button
                onClick={handleSaveInventorySnapshot}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-1.5 px-2 md:px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition duration-300 h-7 w-8 md:w-auto"
                title="Guardar Snapshot"
              >
                <InventoryIcon className="h-6 w-6 md:h-4 md:w-4" />
                {/* Ocultar texto hasta md */}
                <span className="hidden md:inline">Guardar</span>
              </button>

              {/* 🛑 BOTÓN NUEVO PRODUCTO: Ancho fijo 'w-8' en móvil y padding 'px-2' */}
              <button
                onClick={() => openInventoryModal(undefined)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-2 md:px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition duration-300 h-7 w-8 md:w-auto"
                title="Nuevo Producto"
              >
                <PlusIcon className="h-6 w-6 md:h-4 md:w-4" />
                {/* Ocultar texto hasta md */}
                <span className="hidden md:inline">Producto</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedItems)
              .sort(([catA], [catB]) => {
                const indexA = CATEGORY_ORDER.indexOf(catA);
                const indexB = CATEGORY_ORDER.indexOf(catB);

                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;

                return catA.localeCompare(catB);
              })
              .map(([category, items]) => (
                <CategoryAccordion
                  key={category}
                  title={category}
                  itemCount={items.length}
                  initialOpen={true} // ABRIR POR DEFECTO EN INVENTARIO
                >
                  <div className="overflow-x-auto">
                    {/* 🛑 table-fixed Mantiene las columnas fijas a la derecha */}
                    <table className="min-w-full table-fixed">
                      <thead>
                        <tr>
                          {/* 🛑 Celda de NOMBRE */}
                          <th className="p-1 text-left text-xs font-medium text-gray-300 uppercase w-40 min-w-[150px] max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis">
                            ARTÍCULO
                          </th>

                          {/* 🛑 AÑADIDO: P.U. s/IVA (w-20 min-w:[80px]) */}
                          <th className="p-1 text-center text-xs font-medium text-gray-300 uppercase w-20 min-w-[80px]">
                            P.U. s/IVA
                          </th>

                          {/* Determinar qué ubicaciones se muestran */}
                          {(selectedLocationColumn === "all"
                            ? INVENTORY_LOCATIONS
                            : [selectedLocationColumn]
                          ).map((loc) => (
                            <th
                              key={loc}
                              // 🛑 Ancho pequeño y fijo para el campo de stock
                              className={`p-1 text-center text-xs font-medium text-gray-300 uppercase w-16 whitespace-nowrap overflow-hidden text-ellipsis`}
                              title={loc}
                            >
                              {/* 🛑 Muestra la ubicación seleccionada (ej. B1) o el nombre completo */}
                              {loc.toUpperCase()}
                            </th>
                          ))}

                          {/* 🛑 MODIFICACIÓN: Columna VALOR TOTAL */}
                          <th className="p-1 text-center text-xs font-medium text-gray-300 uppercase w-24">
                            VALOR TOTAL
                          </th>

                          {/* 🛑 MODIFICACIÓN: Columna TOTAL */}
                          <th className="p-1 text-center text-xs font-medium text-gray-300 uppercase w-20">
                            TOTAL
                          </th>

                          {/* Ancho fijo para acciones */}
                          <th className="p-1 text-right text-xs font-medium text-gray-300 uppercase w-14">
                            ACCIONES
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {items.map((item) => {
                          const totalStock = calculateTotalStock(item);
                          const totalValue = calculateTotalValue(item);

                          return (
                            <tr key={item.id} className="hover:bg-gray-700/50">
                              {/* 🛑 ARTÍCULO DATA (w-40 min-w:[150px]) */}
                              <td className="p-1 whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-white w-40 min-w-[150px] max-w-[220px]">
                                {item.name}
                              </td>

                              {/* 🛑 AÑADIDO: P.U. s/IVA DATA */}
                              <td className="p-1 text-center whitespace-nowrap text-xs text-slate-300 w-20 min-w-[80px]">
                                {/* 🛑 CORRECCIÓN: Si el precio es <= 0.01, muestra solo "-" */}
                                {item.pricePerUnitWithoutIVA &&
                                item.pricePerUnitWithoutIVA > 0.01
                                  ? item.pricePerUnitWithoutIVA
                                      .toFixed(2)
                                      .replace(".", ",") + " €"
                                  : "0,00 €"}
                              </td>

                              {/* Renderizar campos de input solo para la columna seleccionada o todas */}
                              {(selectedLocationColumn === "all"
                                ? INVENTORY_LOCATIONS
                                : [selectedLocationColumn]
                              ).map((loc) => (
                                <td
                                  key={loc}
                                  // 🛑 text-center para el input, y ancho fijo (w-16)
                                  className={`p-1 whitespace-nowrap text-center w-16`}
                                >
                                  <input
                                    type="text"
                                    value={
                                      tempStockValues[`${item.id}-${loc}`] !==
                                      undefined
                                        ? tempStockValues[`${item.id}-${loc}`]
                                        : // 🛑 CORRECCIÓN: Si el stock es 0, el valor es "" (cadena vacía)
                                        item.stockByLocation?.[loc] === 0
                                        ? ""
                                        : item.stockByLocation?.[loc] !==
                                          undefined
                                        ? String(
                                            item.stockByLocation[loc]
                                          ).replace(".", ",")
                                        : ""
                                    }
                                    onChange={(e) =>
                                      handleStockInputChange(
                                        item.id,
                                        loc,
                                        e.target.value
                                      )
                                    }
                                    onBlur={() =>
                                      handleStockInputBlur(item, loc)
                                    }
                                    // 🛑 ESTILO DE BOTÓN Y CENTRADO: p-1 para el padding, w-10 para el ancho, rounded-md
                                    className="bg-slate-700 text-white rounded-md p-1 w-10 text-center text-sm border border-slate-700 inline-block"
                                    placeholder="0"
                                  />
                                </td>
                              ))}

                              {/* 🛑 NUEVA COLUMNA: VALOR TOTAL */}
                              <td className="p-1 text-center whitespace-nowrap text-sm font-bold w-24">
                                <span
                                  className={
                                    totalValue > 0.01
                                      ? "text-yellow-400"
                                      : "text-slate-400"
                                  }
                                >
                                  {/* 🛑 CORRECCIÓN: No mostrar "0,00 €" si el valor es 0 */}
                                  {totalValue > 0.01
                                    ? `${totalValue
                                        .toFixed(2)
                                        .replace(".", ",")} €`
                                    : "0,00 €"}
                                </span>
                              </td>

                              {/* 🛑 MODIFICACIÓN: Columna TOTAL */}
                              <td className="p-1 text-center whitespace-nowrap text-lg font-bold w-20">
                                <span
                                  className={
                                    totalStock > 0.001
                                      ? "text-green-400"
                                      : "text-slate-400"
                                  }
                                >
                                  {/* 🛑 CORRECCIÓN: No mostrar "0,0" si el stock es 0 */}
                                  {totalStock > 0.001
                                    ? totalStock.toFixed(1).replace(".", ",")
                                    : "0,0"}
                                </span>
                              </td>

                              {/* Ancho fijo para acciones y usar justify-end */}
                              <td className="p-1 whitespace-nowrap text-right text-sm w-14">
                                <div className="flex justify-end items-center gap-1">
                                  <button
                                    onClick={() => openInventoryModal(item)}
                                    className="text-indigo-400"
                                    title="Editar Artículo"
                                  >
                                    <PencilIcon />
                                  </button>
                                  <button
                                    onClick={() =>
                                      window.confirm(
                                        "¿Seguro que quieres eliminar este artículo?"
                                      ) && onDeleteInventoryItem(item.id)
                                    }
                                    className="text-red-500"
                                    title="Eliminar Artículo"
                                  >
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CategoryAccordion>
              ))}
          </div>
        </div>
      )}
      {activeTab === "orders" && (
        <div>
                    {/* Contenedor que alinea el botón a la derecha */}       
          <div className="flex justify-end mb-4">
                     
            <button
              onClick={() => openOrderModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition duration-300 h-7"
              title="Nuevo Pedido"
            >
                            <PlusIcon className="h-4 w-4" />           
              <span>Nuevo Pedido</span>         
            </button>
                   
          </div>
                 
          {/* 🛑 INICIO: Vista de ESCRITORIO (Tabla tradicional, visible en sm: y superior) */}
                 
          <div className="bg-gray-800 shadow-xl rounded-lg overflow-x-auto hidden sm:block">
                     
            <table className="min-w-full divide-y divide-gray-700">
                         
              <thead className="bg-gray-700/50">
                             
                <tr>
                                 
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                                        Fecha Pedido                
                  </th>
                                 
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                                        Proveedor                
                  </th>
                                 
                  {/* 🛑 AÑADIDO: Total Pedido (Entre Proveedor y Estado) */}   
                             
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                                        Total Pedido                
                  </th>
                                 
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                                        &nbsp;&nbsp;&nbsp;Estado                
                  </th>
                                 
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                                        Completado                
                  </th>
                                 
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                                        Acciones                
                  </th>
                               
                </tr>
                           
              </thead>
                         
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                             
                {purchaseOrders.map((order) => {
                  // 🛑 LLAMADA A LA FUNCIÓN GLOBAL (CORREGIDO)
                  const totalAmount = calculateOrderTotal(
                    order,
                    inventoryItems
                  );

                  return (
                    <tr key={order.id} className="hover:bg-gray-700/50">
                                         
                      {/* Columna Fecha Pedido: Agregamos align-middle */}     
                                   
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 align-middle">
                                                {order.orderDate}               
                           
                      </td>
                                         
                      {/* Columna Proveedor: Agregamos align-middle */}         
                               
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium text-white">
                                                {order.supplierName}           
                               
                      </td>
                      {/* 🛑 NUEVA CELDA: TOTAL PEDIDO */}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-yellow-400">
                        {totalAmount > 0
                          ? `${totalAmount.toFixed(2).replace(".", ",")} €`
                          : "0,00 €"}
                      </td>
                                         
                      {/* Columna Estado: Usamos flex para centrar verticalmente el chip */}
                                         
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 align-middle text-center">
                        {" "}
                                             
                        <div className="flex items-center h-full">
                                                 
                          <span
                            className={`px-3 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.status === PurchaseOrderStatus.Completed ||
                              order.status === PurchaseOrderStatus.Archived
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                                                        {order.status}         
                                         
                          </span>
                                               
                        </div>
                                           
                      </td>
                                         
                      {/* Columna Completado: Usamos flex para centrar vertical y horizontalmente */}
                                         
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm align-middle">
                                             
                        <div className="flex items-center justify-center h-full">
                                                 
                          {order.status === PurchaseOrderStatus.Pending && (
                            <button
                              onClick={() => handleReceiveOrder(order)}
                              className="px-1.5 py-0.5 bg-green-600/30 text-green-400 hover:bg-green-600 hover:text-white rounded-xl text-xs font-medium transition duration-300"
                            >
                                                            Recibir            
                                           
                            </button>
                          )}
                                                 
                          {(order.status === PurchaseOrderStatus.Completed ||
                            order.status === PurchaseOrderStatus.Archived) && (
                            <span className="text-green-400 font-bold">OK</span>
                          )}
                                               
                        </div>
                                           
                      </td>
                                         
                      {/* Columna Acciones: Usamos flex para centrar verticalmente */}
                                         
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm align-middle">
                                             
                        <div className="flex items-center justify-end h-full">
                                                 
                          <button
                            onClick={() => openOrderModal(order)}
                            className="text-indigo-400 mr-2 h-4 w-4"
                          >
                                                        <PencilIcon />         
                                         
                          </button>
                                                 
                          <button
                            onClick={() =>
                              window.confirm(
                                "¿Seguro que quieres eliminar este pedido?"
                              ) && onDeletePurchaseOrder(order.id)
                            }
                            className="text-red-500 h-4 w-4"
                          >
                                                        <TrashIcon />           
                                       
                          </button>
                                               
                        </div>
                                           
                      </td>
                                     
                    </tr>
                  );
                })}
                                 
              </tbody>
                       
            </table>
                   
          </div>
                    {/* 🛑 FIN: Vista de ESCRITORIO */}       
          {/* 🛑 INICIO: Vista de MÓVIL (Estructura de Tarjetas/Cascada, visible solo en móvil) */}
                 
          <div className="sm:hidden space-y-4">
                     
            {purchaseOrders.map((order) => {
              const isCompleted =
                order.status === PurchaseOrderStatus.Completed ||
                order.status === PurchaseOrderStatus.Archived;
              // 🛑 CALCULAR EL TOTAL EN MÓVIL
              const totalAmount = calculateOrderTotal(order, inventoryItems);

              return (
                <div
                  key={order.id}
                  className="bg-gray-800 shadow-xl rounded-lg p-4 border border-gray-700"
                >
                                    {/* Fila 1: Proveedor y Estado */}         
                       
                  <div className="flex justify-between items-start border-b border-gray-700 pb-2 mb-2">
                                     
                    <h4 className="text-lg font-bold text-white flex-1 truncate">
                                            {order.supplierName}               
                       
                    </h4>
                                     
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isCompleted
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                                            {order.status}                 
                    </span>
                                   
                  </div>
                                 
                  {/* Fila 2: Detalles (Fecha y Opcional Fecha de Entrega) */} 
                               
                  <div className="space-y-1 text-sm">
                                     
                    <div className="flex justify-between">
                                         
                      <span className="text-gray-400 font-medium">
                                                Fecha Pedido:                  
                         
                      </span>
                                         
                      <span className="text-white">{order.orderDate}</span>     
                                 
                    </div>
                    {/* 🛑 NUEVA FILA: TOTAL PEDIDO (Móvil) */}
                    <div className="flex justify-between pt-1">
                      <span className="text-gray-400 font-medium">Total:</span>
                      <span className="text-yellow-400 font-bold">
                        {totalAmount > 0
                          ? `${totalAmount.toFixed(2).replace(".", ",")} €`
                          : "0,00 €"}
                      </span>
                    </div>
                                        {/* Fila 3: Acciones */}               
                     
                    <div className="pt-4 flex justify-between items-center border-t border-gray-700 mt-3">
                                         
                      {/* Botones de Edición y Eliminación */}                 
                       
                      <div className="flex items-center space-x-3">
                                             
                        <button
                          onClick={() => openOrderModal(order)}
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                                                 
                          <PencilIcon className="h-5 w-5" />                   
                                <span className="text-sm">Editar</span>         
                                     
                        </button>
                                             
                        <button
                          onClick={() =>
                            window.confirm(
                              "¿Seguro que quieres eliminar este pedido?"
                            ) && onDeletePurchaseOrder(order.id)
                          }
                          className="text-red-500 hover:text-red-400 flex items-center gap-1"
                        >
                                                 
                          <TrashIcon className="h-5 w-5" />                     
                              <span className="text-sm">Eliminar</span>         
                                     
                        </button>
                                           
                      </div>
                                            {/* Botón Completado / OK */}       
                                 
                      {order.status === PurchaseOrderStatus.Pending ? (
                        <button
                          onClick={() => handleReceiveOrder(order)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition duration-300"
                        >
                                                    Recibir                    
                           
                        </button>
                      ) : (
                        <span className="text-green-400 font-bold text-lg">
                                                    OK                      
                        </span>
                      )}
                                       
                    </div>
                                   
                  </div>
                               
                </div>
              );
            })}
                   
          </div>
                    {/* 🛑 FIN: Vista de MÓVIL */}     
        </div>
      )}
      {activeTab === "analysis" && (
        <div className="bg-gray-800 shadow-xl rounded-lg overflow-x-auto p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h2 className="text-xl font-bold text-white">
              Análisis de Consumo Semanal
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 🛑 BOTÓN DE DESCARGA EN ANÁLISIS */}
              <button
                onClick={handleDownloadLastAnalysis}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded-lg flex items-center gap-1.5 text-sm transition duration-300"
                title="Descargar Último Análisis de Consumo"
                disabled={!lastAnalysisRecord}
              >
                <ExportIcon className="h-4 w-4" />
                <span>Descargar</span>
              </button>

              <button
                onClick={handleSaveCurrentInventory}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-1 px-3 rounded-lg text-sm transition duration-300"
              >
                Guardar Análisis de Consumo
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {analysisGroupedItems.map(
              ({ category, items, categoryTotalRelevantStock }) => (
                <CategoryAccordion
                  key={category}
                  title={category}
                  itemCount={items.length}
                  initialOpen={true}
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                            Artículo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                            Stock Actual
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                            En Pedidos
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                            Stock Semana Anterior
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                            Stock Inicial Total
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                            Consumo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {items.map((item) => {
                          const totalStock = calculateTotalStock(item);
                          const pendingStock = stockInOrders[item.id] || 0;
                          const previousEndStock =
                            initialStockMap.get(item.id) || 0;
                          const initialTotalStock =
                            previousEndStock + pendingStock;
                          const endStock = totalStock;
                          const consumption = initialTotalStock - endStock;

                          return (
                            <tr key={item.id} className="hover:bg-gray-700/50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                                {item.name}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-300">
                                {totalStock.toFixed(1).replace(".", ",")}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-yellow-400">
                                {pendingStock.toFixed(1).replace(".", ",")}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-300">
                                {previousEndStock.toFixed(1).replace(".", ",")}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-blue-400 font-bold">
                                {initialTotalStock.toFixed(1).replace(".", ",")}
                              </td>
                              <td
                                className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-center ${
                                  consumption > 0
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {consumption.toFixed(1).replace(".", ",")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CategoryAccordion>
              )
            )}
          </div>
        </div>
      )}

      {/* 🛑 INICIO: PESTAÑA HISTORIAL RESTAURADA Y MODIFICADA LA LLAMADA */}
      {activeTab === "history" && (
        <div className="bg-gray-800 shadow-xl rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Historial 📊</h2>
            <button
              onClick={handleDeleteAllHistory}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded-lg flex items-center gap-1.5 text-sm transition duration-300"
            >
              <TrashIcon /> Borrar Historial
            </button>
          </div>
          {/* ELIMINADO WeeklyConsumptionAnalysis de aquí */}
          <h3 className="text-l font-bold text-white mb-3 mt-8 border-t border-gray-700 pt-4">
            Registros Anteriores
          </h3>
          {validInventoryHistory.length > 0 ? (
            <ul className="space-y-3">
              {validInventoryHistory.map((record: InventoryRecord) => (
                <li
                  key={record.id}
                  className="bg-slate-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-700/50 transition-colors"
                >
                  <div className="mb-2 sm:mb-0">
                    <p className="font-semibold text-white">{record.label}</p>
                    <p className="text-sm text-slate-400">
                      {formatUTCToLocal(record.date)}
                    </p>
                  </div>
                  <div className="flex gap-3 mt-2 sm:mt-0">
                    {/* Botón Ver Detalles */}
                    <button
                      onClick={() => openRecordDetailModal(record)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-1 px-4 rounded-lg flex items-center gap-2 transition duration-300"
                      title="Ver Detalles"
                    >
                      Ver Detalles
                    </button>
                    {/* Botón Borrar Registro Individual */}
                    <button
                      onClick={() => handleDeleteRecord(record)}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-4 rounded-lg flex items-center justify-center transition duration-300"
                      title={`Eliminar Registro: ${record.label}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 text-slate-500">
              <p>No hay análisis guardados en el historial.</p>
              <p className="text-sm mt-2">
                Ve a la pestaña de 'Análisis' para guardar el estado actual del
                inventario.
              </p>
            </div>
          )}
        </div>
      )}
      {/* 🛑 FIN: PESTAÑA HISTORIAL RESTAURADA */}

      {isInventoryModalOpen && (
        <Modal
          title={currentInventoryItem.id ? "Editar Artículo" : "Nuevo Artículo"}
          onClose={closeInventoryModal}
          onSave={handleSaveInventory}
        >
          {renderInventoryForm()}
        </Modal>
      )}
      {isOrderModalOpen && (
        <Modal
          title={
            "id" in currentPurchaseOrder ? "Editar Pedido" : "Nuevo Pedido"
          }
          onClose={closeOrderModal}
          hideSaveButton={true}
        >
          {renderOrderForm()}
        </Modal>
      )}
      {viewingRecord && renderInventoryRecordDetailModal()}
    </div>
  );
};

export default InventoryComponent;
