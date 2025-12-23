import React, { useState, useMemo, useEffect } from "react";
import {
  InventoryItem,
  PurchaseOrder,
  PurchaseOrderStatus,
  OrderItem,
  InventoryRecord,
  InventoryRecordItem,
} from "../types";
import Modal from "./Modal";
import { api } from "../src/api/index";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  SearchIcon,
  InventoryIcon,
  RefreshIcon,
  ExportIcon,
} from "./icons";
import { INVENTORY_LOCATIONS } from "../constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { userPrices } from "../App";
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
  onDeleteInventoryRecord: (id: string) => void;
  onDownloadHistoryRecord: (id: string, label: string) => void;
  activeTab: "inventory" | "orders" | "analysis" | "history";
  formatUTCToLocal: (utcDateString: string | Date | undefined) => string;
  handleResetInventoryStocks: () => void;
}

const emptyInventoryItem: Omit<InventoryItem, "id" | "stockByLocation"> = {
  name: "",
  category: "",
  pricePerUnitWithoutIVA: 0,
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
const formatToTitleCase = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      // Opcional: Mantener SL o SA siempre en mayúsculas
      if (word === "sl" || word === "sa") return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
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

// --- COMPONENTE: Calculadora de Cajas Vacías (Versión Mediana a la Izquierda) ---
// 1. Tipos de datos
interface BoxCounts {
  schweppes: number;
  cocaCola: number;
  cocaColaZero: number;
  pepsi: number;
  ambar: number;
  moritz: number;
}

interface CalculatorRowProps {
  label: string;
  multiplier: number;
  field: keyof BoxCounts;
  boxCounts: BoxCounts;
  setBoxCounts: React.Dispatch<React.SetStateAction<BoxCounts>>;
}

// 2. Componente de fila (Fuera para no perder el foco del teclado)
const CalculatorRow = ({
  label,
  multiplier,
  field,
  boxCounts,
  setBoxCounts,
}: CalculatorRowProps) => {
  const individualValue = (Number(boxCounts[field]) || 0) * multiplier;

  return (
    <div className="flex items-center justify-between bg-slate-700/20 p-2 px-3 rounded border border-slate-600/30 text-[13px] mb-1.5">
      <span className="text-slate-200 font-medium w-28 truncate">
        {label} <small className="text-[10px] opacity-40">x{multiplier}</small>
      </span>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min="0"
          // Muestra vacío si es 0 para facilitar la escritura rápida
          value={boxCounts[field] === 0 ? "" : boxCounts[field]}
          onChange={(e) => {
            const val =
              e.target.value === "" ? 0 : parseInt(e.target.value, 10);
            setBoxCounts((prev) => ({ ...prev, [field]: val }));
          }}
          className="w-14 bg-slate-800 text-white p-1 rounded border border-slate-600 text-center text-sm focus:ring-2 focus:ring-violet-500 outline-none"
        />
        <div className="w-10 text-right">
          <span className="text-yellow-400 font-bold">{individualValue}</span>
        </div>
      </div>
    </div>
  );
};

// 3. Componente de la Calculadora
const EmptyBoxesCalculator: React.FC<{
  inventoryItems: InventoryItem[];
  onSaveInventoryItem: (item: InventoryItem) => void;
}> = ({ inventoryItems, onSaveInventoryItem }) => {
  // Mantenemos tu lógica de carga desde localStorage
  const [boxCounts, setBoxCounts] = useState<BoxCounts>(() => {
    const saved = localStorage.getItem("boxCounts_persistence");
    return saved
      ? JSON.parse(saved)
      : {
          schweppes: 0,
          cocaCola: 0,
          cocaColaZero: 0,
          pepsi: 0,
          ambar: 0,
          moritz: 0,
        };
  });

  // 🛑 IMPORTANTE: Este Effect asegura que si los datos en localStorage
  // cambian (vía Reset), la calculadora se ponga a cero visualmente.
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("boxCounts_persistence");
      if (saved) setBoxCounts(JSON.parse(saved));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    localStorage.setItem("boxCounts_persistence", JSON.stringify(boxCounts));
  }, [boxCounts]);

  // Cálculos individuales memorizados
  const calc = useMemo(
    () => ({
      schweppes: boxCounts.schweppes * 28,
      cocaCola: boxCounts.cocaCola * 24,
      cocaColaZero: boxCounts.cocaColaZero * 24,
      pepsi: boxCounts.pepsi * 24,
      ambar: boxCounts.ambar * 24,
      moritz: boxCounts.moritz * 24,
    }),
    [boxCounts]
  );

  // Suma total para la base de datos
  const totalGlobal = useMemo(
    () =>
      Object.values(calc).reduce((acc: number, curr: number) => acc + curr, 0),
    [calc]
  );

  // Sincronización con la base de datos (Item "Cajas vacias")
  useEffect(() => {
    const item = inventoryItems.find((i) =>
      i.name.toLowerCase().includes("cajas vacias")
    );
    if (item) {
      const currentStock = item.stockByLocation?.Almacén || 0;
      if (currentStock !== totalGlobal) {
        onSaveInventoryItem({
          ...item,
          stockByLocation: { ...item.stockByLocation, Almacén: totalGlobal },
        });
      }
    }
  }, [totalGlobal, inventoryItems, onSaveInventoryItem]);

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mt-6 shadow-2xl max-w-[320px] ml-0 border-t-4 border-t-violet-500">
      <h3 className="text-[14px] font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
        [📦] Cajas Vacías
      </h3>

      <div className="flex flex-col">
        <CalculatorRow
          label="Schweppes"
          multiplier={28}
          field="schweppes"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
        <CalculatorRow
          label="Coca Cola"
          multiplier={24}
          field="cocaCola"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
        <CalculatorRow
          label="Coca Cola Zero"
          multiplier={24}
          field="cocaColaZero"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
        <CalculatorRow
          label="Pepsi"
          multiplier={24}
          field="pepsi"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
        <CalculatorRow
          label="Ambar"
          multiplier={24}
          field="ambar"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
        <CalculatorRow
          label="Moritz"
          multiplier={24}
          field="moritz"
          boxCounts={boxCounts}
          setBoxCounts={setBoxCounts}
        />
      </div>
    </div>
  );
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
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1200; // Resolución suficiente para que la IA lea texto
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      // Reducimos calidad al 70% para que pese muy poco y no de Timeout
      resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
  });
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
  onDeleteInventoryRecord,
  onDownloadHistoryRecord,
  formatUTCToLocal,
  handleResetInventoryStocks,
  activeTab,
}) => {
  const [isInventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [currentInventoryItem, setCurrentInventoryItem] =
    useState<Partial<InventoryItem>>(emptyInventoryItem);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

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
  const [tempOrderPrices, setTempOrderPrices] = useState<
    Record<number, string>
  >({});
  const [analysisDate, setAnalysisDate] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  const [viewingRecord, setViewingRecord] = useState<InventoryRecord | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLocationColumn, setSelectedLocationColumn] = useState<
    string | "all"
  >("all");
  // Localiza donde se recibe el nombre del proveedor de la foto
  const processOcrResult = (detectedSupplier: string) => {
    // Aplicamos el formato: "vins avinyo" -> "Vins Avinyo"
    const formattedSupplier = formatToTitleCase(detectedSupplier);

    setCurrentPurchaseOrder((prev) => ({
      ...prev,
      supplierName: formattedSupplier, // Ahora se guarda ya formateado
    }));
  };

  // 1. La función principal corregida
  const handleCaptureOrder = async (base64Data: string) => {
    try {
      const inventoryNames = inventoryItems.map((item) => item.name);
      const data = await api.ai.processOrder(base64Data, inventoryNames);

      if (!data || !data.items) return;

      const cleanNumber = (val: any) => {
        if (typeof val === "string") {
          // Reemplazamos coma por punto y quitamos todo lo que no sea número o punto
          const normalized = val.replace(",", ".").replace(/[^0-9.]/g, "");
          return parseFloat(normalized);
        }
        return Number(val) || 0;
      };

      const matchedItems = data.items
        .map((detected: any) => {
          const found = inventoryItems.find((i) =>
            i.name.toLowerCase().includes(detected.name.toLowerCase())
          );

          if (found) {
            const lineTotalNet = cleanNumber(detected.linePrice);
            const qty = Number(detected.quantity) || 0;

            // 🛑 PRECISIÓN: Calculamos el precio unitario.
            // Usamos toFixed(4) y volvemos a número para tener hasta 4 decimales si es necesario.
            // Esto es clave para productos como la Moritz donde el precio real es 0.6733
            const unitPriceNet =
              qty > 0 ? Number((lineTotalNet / qty).toFixed(4)) : 0;

            return {
              inventoryItemId: found.id,
              quantity: qty,
              costAtTimeOfPurchase: unitPriceNet, // Para el histórico
              pricePerUnitWithoutIVA: unitPriceNet,
            };
          }
          return null;
        })
        .filter(Boolean);

      // Mantenemos el total exacto del papel
      const totalPapel = cleanNumber(data.totalAmount);
      const rawSupplier = data.supplierName || "Vins Avinyó";
      const formattedSupplier = formatToTitleCase(rawSupplier);

      // 3. Abrimos el modal con los datos ya limpios
      openOrderModal({
        orderDate: data.orderDate || new Date().toISOString().split("T")[0],
        supplierName: formattedSupplier, // 👈 Aquí pasamos el nombre corregido
        items: matchedItems,
        status: PurchaseOrderStatus.Pending,
        totalAmount: totalPapel,
      } as PurchaseOrder);
    } catch (e: any) {
      console.error("Error al capturar pedido:", e);
    }
  };
  const handleBarcodeScan = (decodedText: string) => {
    // 1. Buscamos el ítem por el campo 'barcode'
    const item = inventoryItems.find((i) => i.barcode === decodedText);

    if (item) {
      // 2. Pedimos la cantidad (acepta 0,5 gracias a parseDecimal)
      const qty = window.prompt(
        `Producto detectado: ${item.name}\nIntroduce la cantidad a sumar (ej: 0,5 o 1):`,
        "1"
      );

      if (qty !== null) {
        const numericQty = parseDecimal(qty);

        // 3. Actualizamos el stock (por defecto en Almacén)
        const updatedStock = {
          ...item.stockByLocation,
          Almacén: (Number(item.stockByLocation?.Almacén) || 0) + numericQty,
        };

        onSaveInventoryItem({
          ...item,
          stockByLocation: updatedStock,
        });

        alert(`Añadido ${numericQty} a ${item.name}`);
      }
    } else {
      alert("Código de barras no encontrado en tu inventario: " + decodedText);
    }
    setIsScannerOpen(false);
  };
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

  // Función para calcular el valor total de un pedido
  const calculateOrderTotal = (
    order: PurchaseOrder,
    inventoryItems: InventoryItem[]
  ): number => {
    return order.items.reduce((total, item) => {
      const itemDetail = inventoryItems.find(
        (i) => i.id === item.inventoryItemId
      );
      const price = itemDetail?.pricePerUnitWithoutIVA || 0;
      return total + item.quantity * price;
    }, 0);
  };

  const validInventoryHistory = useMemo(() => {
    if (!Array.isArray(inventoryHistory)) return [];
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
    const uniqueItemsMap = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => {
      uniqueItemsMap.set(item.id, item);
    });

    // Convertimos a array y filtramos "cajas vacias"
    let filteredList = Array.from(uniqueItemsMap.values()).filter(
      (item) => !item.name.toLowerCase().includes("cajas vacias")
    );

    // Aplicar búsqueda del usuario si existe
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
        !item.name.toLowerCase().includes("cajas vacias") &&
        (item.name.toLowerCase().includes(lowerTerm) ||
          item.category.toLowerCase().includes(lowerTerm))
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

    const itemsForAnalysis = inventoryItems.filter(
      (item) => !item.name.toLowerCase().includes("cajas vacias")
    );

    itemsForAnalysis.forEach((item) => {
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
    if (!currentPurchaseOrder.supplierName.trim()) {
      alert("Introduce el nombre del proveedor.");
      return;
    }

    // 🛑 Sincronizar precios con el Inventario General
    currentPurchaseOrder.items.forEach((orderItem) => {
      const originalItem = inventoryItems.find(
        (i) => i.id === orderItem.inventoryItemId
      );
      if (originalItem && orderItem.pricePerUnitWithoutIVA > 0) {
        // Actualizamos el objeto userPrices global y llamamos al guardado persistente
        userPrices[originalItem.name] = orderItem.pricePerUnitWithoutIVA;
        onSaveInventoryItem({
          ...originalItem,
          pricePerUnitWithoutIVA: orderItem.pricePerUnitWithoutIVA,
        });
      }
    });

    const calculatedTotalRaw = currentPurchaseOrder.items.reduce(
      (acc, i) => acc + i.quantity * i.pricePerUnitWithoutIVA,
      0
    );

    onSavePurchaseOrder({
      ...currentPurchaseOrder,
      id: (currentPurchaseOrder as PurchaseOrder).id || crypto.randomUUID(),
      status: PurchaseOrderStatus.Pending,
      // Redondeamos el total final a 2 decimales para contabilidad
      totalAmount: Number(calculatedTotalRaw.toFixed(2)),
    } as PurchaseOrder);

    alert("Pedido guardado. Los precios se han actualizado en el inventario.");
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

    // Extraemos el precio del artículo seleccionado
    const dbPrice = item.pricePerUnitWithoutIVA || 0;

    const newItem: OrderItem = {
      inventoryItemId: item.id,
      quantity: 1,
      costAtTimeOfPurchase: 0,
      pricePerUnitWithoutIVA: dbPrice,
    };

    setCurrentPurchaseOrder((prev) => {
      const newItemsList = [...prev.items, newItem];
      const newIndex = newItemsList.length - 1;

      // 1. Sincronizamos cantidad visual
      setTempOrderQuantities((prevTemp) => ({
        ...prevTemp,
        [newIndex]: "1",
      }));

      // 2. Sincronizamos precio visual (Cargamos el de la DB)
      setTempOrderPrices((prevPrices) => ({
        ...prevPrices,
        [newIndex]: dbPrice > 0 ? String(dbPrice).replace(".", ",") : "0,00",
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
      pricePerUnitWithoutIVA: 0,
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
    // Guardamos el texto (permite escribir "0," sin borrarlo)
    setTempOrderQuantities((prev) => ({ ...prev, [index]: value }));

    // Convertimos a número solo para el cálculo interno
    const parsedQuantity = parseFloat(value.replace(",", ".")) || 0;

    setCurrentPurchaseOrder((prev) => {
      const newItems = [...prev.items];
      if (newItems[index]) {
        // 🛑 Usamos parsedQuantity para la lógica del pedido
        newItems[index].quantity = parsedQuantity;
      }
      return { ...prev, items: newItems };
    });
  };

  const handleOrderItemChange = (
    index: number,
    field: "inventoryItemId",
    value: string
  ) => {
    const selectedItem = inventoryItems.find((i) => i.id === value);
    const newItems = [...currentPurchaseOrder.items];

    newItems[index] = {
      ...newItems[index],
      [field]: value,
      // Asignamos el precio internamente aunque no haya recuadro
      pricePerUnitWithoutIVA: selectedItem?.pricePerUnitWithoutIVA || 0,
    };

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
    const formattedDate = recordDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // 1. Obtener datos de la calculadora
    const savedBoxDetails = localStorage.getItem("boxCounts_persistence");
    const boxCounts = savedBoxDetails ? JSON.parse(savedBoxDetails) : null;

    // 2. Mapear artículos normales
    const recordItems: InventoryRecordItem[] = inventoryItems
      .filter((item) => !item.name.toLowerCase().includes("cajas vacias")) // Quitamos el ítem genérico
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        category: item.category,
        currentStock: calculateTotalStock(item),
        pendingStock: stockInOrders[item.id] || 0,
        initialStock: calculateTotalStock(item),
        endStock: calculateTotalStock(item),
        consumption: 0,
        stockByLocationSnapshot: item.stockByLocation || {},
        pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA,
      }));

    // 3. 🛑 TRUCO PARA EL EXCEL: Añadir marcas de cajas como artículos individuales
    if (boxCounts) {
      const multipliers: Record<string, number> = {
        schweppes: 28,
        cocaCola: 24,
        cocaColaZero: 24,
        pepsi: 24,
        ambar: 24,
        moritz: 24,
      };

      Object.entries(boxCounts).forEach(([brand, qty]) => {
        const cantidad = Number(qty);
        if (cantidad > 0) {
          const m = multipliers[brand] || 24;
          recordItems.push({
            itemId: `box-${brand}`,
            name: `CAJAS ${brand.toUpperCase()}`,
            category: " [📦] Embalajes", // CATEGORÍA CLAVE
            currentStock: cantidad * m,
            pendingStock: 0,
            initialStock: cantidad * m,
            endStock: cantidad * m,
            consumption: 0,
            stockByLocationSnapshot: { Almacén: cantidad * m },
            pricePerUnitWithoutIVA: 0, // El precio es 0 para embalajes
          });
        }
      });
    }

    const newRecord: InventoryRecord = {
      id: crypto.randomUUID(),
      date: recordDate.toISOString(),
      label: `Inventario (${formattedDate})`,
      items: recordItems,
      type: "snapshot",
    };

    onSaveInventoryRecord(newRecord);
    alert(`Inventario guardado (${formattedDate})`);
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
      return {
        itemId: item.id,
        name: item.name,
        category: item.category,
        currentStock: totalStock,
        consumption: 0,
        details: item.details,
        stockByLocationSnapshot: item.stockByLocation || {},
        pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA,
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

  const renderStats = () => {
    // 1. Procesamos los datos por CATEGORÍA (para los gráficos de arriba)
    const categoryData = analysisGroupedItems
      .filter((group) => !group.category.toLowerCase().includes("embalajes"))
      .map(({ category, items }) => {
        const gastoTotal = items.reduce((acc, item) => {
          const consumption =
            (initialStockMap.get(item.id) || 0) +
            (stockInOrders[item.id] || 0) -
            calculateTotalStock(item);
          return (
            acc +
            (consumption > 0
              ? consumption * (item.pricePerUnitWithoutIVA || 0)
              : 0)
          );
        }, 0);
        const cleanName = category.split(" ").slice(1).join(" ") || category;
        return {
          name: cleanName,
          fullName: category,
          gasto: parseFloat(gastoTotal.toFixed(2)),
        };
      })
      .filter((d) => d.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto);

    // 2. LÓGICA DEL TOP 5 PRODUCTOS (Global o por Categoría seleccionada)
    const top5Products = inventoryItems
      .filter((item) => !item.category.toLowerCase().includes("embalajes"))
      .filter((item) => !selectedCategory || item.category === selectedCategory)
      .map((item) => {
        const consumption =
          (initialStockMap.get(item.id) || 0) +
          (stockInOrders[item.id] || 0) -
          calculateTotalStock(item);
        const gasto =
          consumption > 0
            ? consumption * (item.pricePerUnitWithoutIVA || 0)
            : 0;
        return {
          name: item.name,
          gasto: parseFloat(gasto.toFixed(2)),
          category: item.category,
        };
      })
      .filter((d) => d.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 5);

    // 3. Datos para el gráfico detallado inferior
    const productData = inventoryItems
      .filter((item) => !item.category.toLowerCase().includes("embalajes"))
      .filter((item) => !selectedCategory || item.category === selectedCategory)
      .map((item) => {
        const consumption =
          (initialStockMap.get(item.id) || 0) +
          (stockInOrders[item.id] || 0) -
          calculateTotalStock(item);
        const gasto =
          consumption > 0
            ? consumption * (item.pricePerUnitWithoutIVA || 0)
            : 0;
        return { name: item.name, gasto: parseFloat(gasto.toFixed(2)) };
      })
      .filter((d) => d.gasto > 0.1)
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 15);

    const COLORS = [
      "#5c31c0ff",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#3b82f6",
      "#ec4899",
    ];

    return (
      <div className="space-y-8 animate-fade-in pb-24">
        {/* FILA 1: RESUMEN POR CATEGORÍA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="p-2 bg-violet-500/20 rounded-lg text-violet-400 text-lg">
                  📊
                </span>
                Gasto por Categoría
              </h3>
              <p className="text-[10px] text-slate-500 italic">
                Haz clic en una barra para filtrar
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(v) => `${v}€`}
                  />
                  <Tooltip
                    cursor={{ fill: "#334155", opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "12px",
                    }}
                  />
                  <Bar
                    dataKey="gasto"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    // 🛑 EVENTO CLIC: Selecciona la categoría para filtrar el siguiente gráfico
                    onClick={(data) => setSelectedCategory(data.fullName)}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.fullName === selectedCategory
                            ? "#fff"
                            : COLORS[i % COLORS.length]
                        }
                        className="transition-all duration-300"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 text-lg">
                💰
              </span>
              Distribución del Gasto
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="gasto"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* FILA 2: PRODUCTOS (CON FILTRO ACTIVO) */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl border-t-4 border-t-indigo-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                  🏆
                </span>
                {selectedCategory
                  ? `Productos en: ${selectedCategory.split(" ")[1]}`
                  : "Top Productos Globales"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Gasto real basado en consumo y precio s/IVA
              </p>
            </div>

            {/* Botón para resetear el filtro */}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 px-4 rounded-full transition-colors flex items-center gap-2 border border-slate-600"
              >
                <span>✕</span> Ver todos los productos
              </button>
            )}
          </div>

          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productData}
                layout="vertical"
                margin={{ left: 30, right: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `${v}€`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#fff"
                  fontSize={10}
                  width={130}
                />
                <Tooltip
                  cursor={{ fill: "#334155", opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "12px",
                  }}
                  formatter={(v: number) => [`${v} €`, "Gasto"]}
                />
                <Bar
                  dataKey="gasto"
                  radius={[0, 4, 4, 0]}
                  barSize={selectedCategory ? 30 : 20}
                >
                  {productData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        selectedCategory
                          ? "#6366f1"
                          : i < 3
                          ? "#fbbf24"
                          : "#4f46e5"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryRecordDetailModal = () => {
    if (!viewingRecord || !viewingRecord.items) return null;

    const isAnalysis = viewingRecord.type === "analysis";

    const recordItems =
      (viewingRecord.items as any as InventoryRecordItem[]) || [];

    type DetailedInventoryRecordItem = InventoryRecordItem & {
      category: string;
    };

    // Ahora recordItems es reconocido como un Array, el .map funcionará:
    const itemsWithCategory: DetailedInventoryRecordItem[] = recordItems.map(
      (recordItem) => {
        const inventoryItem = inventoryItems.find(
          (i) => i.id === recordItem.itemId
        );
        const category =
          inventoryItem?.category || recordItem.category || "Uncategorized";
        return { ...recordItem, category };
      }
    );

    // El .filter y .length posteriores funcionarán sin problemas:
    const relevantItems = itemsWithCategory.filter(
      (item) => !isAnalysis || (item.consumption || 0) > 0.001
    );

    if ((relevantItems as InventoryRecordItem[]).length === 0) {
      return (
        <Modal
          title={`Detalle: ${viewingRecord.label}`}
          onClose={closeRecordDetailModal}
          onSave={closeRecordDetailModal}
          hideSaveButton={true}
          size="max-w-7xl"
        >
          <div className="text-center py-10 text-slate-500">
            <p>No se registraron artículos relevantes para mostrar.</p>
          </div>
        </Modal>
      );
    }

    // Agrupar ítems
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
    const renderSnapshotTable = (items: DetailedInventoryRecordItem[]) => {
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
        return (Number(item.pricePerUnitWithoutIVA) || 0) * totalStock;
      };

      const itemsWithTotals = items
        .map((item) => ({
          ...item,
          calculatedTotal: calculateSnapshotTotalStock(item),
        }))
        .filter((item) => {
          const isCajasVacias = item.name
            .toLowerCase()
            .includes("cajas vacias");
          return isCajasVacias || item.calculatedTotal > 0.001;
        });

      const ITEM_COL_WIDTH = "min-w-[120px]";
      const PRICE_COL_WIDTH = "min-w-[80px] w-20";
      const TOTAL_VALUE_WIDTH = "min-w-[96px] w-24";
      const TOTAL_STOCK_WIDTH = "min-w-[80px] w-20";

      return (
        <div className="overflow-x-auto">
          <table className="divide-y divide-gray-700 table-fixed min-w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th
                  className={`p-1 text-left text-xs font-medium text-gray-300 uppercase ${ITEM_COL_WIDTH}`}
                >
                  ARTÍCULO
                </th>
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${PRICE_COL_WIDTH}`}
                >
                  P.U. S/IVA
                </th>
                {INVENTORY_LOCATIONS.map((loc) => (
                  <th
                    key={loc}
                    className="p-1 text-center text-xs font-medium text-gray-300 uppercase w-16"
                  >
                    {loc.toUpperCase()}
                  </th>
                ))}
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${TOTAL_VALUE_WIDTH}`}
                >
                  VALOR TOTAL
                </th>
                <th
                  className={`p-1 text-center text-xs font-medium text-gray-300 uppercase ${TOTAL_STOCK_WIDTH}`}
                >
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {itemsWithTotals.map((item, itemIndex) => {
                const calculatedTotal = item.calculatedTotal || 0;
                const isCajasVacias = item.name
                  .toLowerCase()
                  .includes("cajas vacias");

                return (
                  <React.Fragment key={item.itemId || itemIndex}>
                    <tr className="hover:bg-gray-700/50">
                      <td
                        className={`p-1 whitespace-nowrap text-sm font-medium text-white ${ITEM_COL_WIDTH}`}
                      >
                        {item.name}
                      </td>

                      <td
                        className={`p-1 text-center text-xs text-slate-300 ${PRICE_COL_WIDTH}`}
                      >
                        {item.category.toLowerCase().includes("embalajes") ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          `${(item.pricePerUnitWithoutIVA || 0)
                            .toFixed(2)
                            .replace(".", ",")} €`
                        )}
                      </td>

                      {INVENTORY_LOCATIONS.map((loc) => {
                        if (isCajasVacias) {
                          return <td key={loc} className="p-1 w-16"></td>;
                        }

                        const stockValue =
                          item.stockByLocationSnapshot?.[loc] || 0;
                        return (
                          <td key={loc} className="p-1 text-center w-16">
                            {stockValue > 0.001 ? (
                              <div className="bg-slate-700 rounded-md p-1 w-10 mx-auto text-sm text-green-400 font-bold">
                                {item.category
                                  .toLowerCase()
                                  .includes("material") ||
                                item.category
                                  .toLowerCase()
                                  .includes("embalajes")
                                  ? Math.round(stockValue)
                                  : stockValue.toFixed(1).replace(".", ",")}
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        );
                      })}
                      {/* VALOR TOTAL Y TOTAL: Vacíos si es cajas */}
                      <td
                        className={`p-1 text-center text-sm font-bold ${TOTAL_VALUE_WIDTH}`}
                      >
                        {isCajasVacias ? (
                          ""
                        ) : calculateSnapshotTotalValue(item) > 0.01 ? (
                          `${calculateSnapshotTotalValue(item)
                            .toFixed(2)
                            .replace(".", ",")} €`
                        ) : (
                          <span className="text-slate-500 font-normal">-</span>
                        )}
                      </td>

                      {/* TOTAL STOCK: En verde y con cuadro si hay valor, si no guion */}
                      <td className={`p-1 text-center ${TOTAL_STOCK_WIDTH}`}>
                        {isCajasVacias ? (
                          ""
                        ) : calculatedTotal > 0.001 ? (
                          <div className="bg-slate-700 rounded-md p-1 px-2 w-20 mx-auto text-lg font-bold text-green-400">
                            {/* 🛑 CAMBIO: Ahora redondea si es Material O si es Embalajes */}
                            {item.category.toLowerCase().includes("material") ||
                            item.category.toLowerCase().includes("embalajes")
                              ? Math.round(calculatedTotal)
                              : calculatedTotal.toFixed(1).replace(".", ",")}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>

                    {isCajasVacias &&
                      item.details &&
                      Object.entries(item.details)
                        .filter(([_, count]) => Number(count) > 0)
                        .map(([brand, count]) => {
                          const multipliers: Record<string, number> = {
                            schweppes: 28,
                            cocaCola: 24,
                            cocaColaZero: 24,
                            pepsi: 24,
                            ambar: 24,
                            moritz: 24,
                          };
                          const m = multipliers[brand] || 24;
                          const cantidad = Number(count);
                          const total = cantidad * m;

                          return (
                            <tr
                              key={brand}
                              className="bg-slate-900/40 border-l-2 border-violet-500/50"
                            >
                              <td
                                className={`p-1 pl-8 text-xs text-slate-400 font-medium ${ITEM_COL_WIDTH}`}
                              >
                                <span className="text-slate-500 mr-2">└─</span>
                                {brand.toUpperCase()}
                              </td>

                              {/* Ocupamos el hueco de las ubicaciones para el texto del cálculo */}
                              <td
                                colSpan={INVENTORY_LOCATIONS.length + 2}
                                className="p-1 text-right pr-6 text-[11px] text-slate-500 italic uppercase font bold"
                              >
                                {cantidad} cajas x {m} uds =
                              </td>

                              <td className={TOTAL_VALUE_WIDTH}></td>

                              {/* Resultado final en amarillo */}
                              <td
                                className={`text-center text-lg font-bold text-yellow-400 w-20 mx-auto px-2 ${TOTAL_STOCK_WIDTH}`}
                              >
                                {total}
                              </td>
                            </tr>
                          );
                        })}
                  </React.Fragment>
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
      {/* SECCIÓN CODIGO DE BARRAS NUEVO */}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium ml-1">
          Código de Barras
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Escanear o escribir código..."
            value={currentInventoryItem.barcode || ""}
            onChange={(e) =>
              setCurrentInventoryItem({
                ...currentInventoryItem,
                barcode: e.target.value,
              })
            }
            className="bg-gray-700 text-white rounded p-2 w-full border border-gray-600 focus:ring-2 focus:ring-indigo-500 pl-10"
          />
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-50">
            🔍
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
  const handleGenerateSmartOrder = () => {
    if (!lastAnalysisRecord) {
      alert(
        "Se necesita al menos un análisis guardado para sugerir cantidades."
      );
      return;
    }

    const smartItems: OrderItem[] = inventoryItems
      .map((item) => {
        // Buscamos el consumo en el último registro de tipo 'analysis'
        const lastConsumption =
          lastAnalysisRecord.items.find(
            (recordItem) => recordItem.itemId === item.id
          )?.consumption || 0;

        const currentStock = calculateTotalStock(item);

        // Si lo que tenemos es menos de lo que gastamos la semana pasada, sugerimos reposición
        if (currentStock < lastConsumption) {
          return {
            inventoryItemId: item.id,
            quantity: Math.ceil(lastConsumption - currentStock),
            costAtTimeOfPurchase: 0,
            pricePerUnitWithoutIVA: item.pricePerUnitWithoutIVA || 0,
          };
        }
        return null;
      })
      .filter((item): item is OrderItem => item !== null);

    if (smartItems.length === 0) {
      alert("Tienes stock suficiente de todo según el consumo previo.");
      return;
    }

    // Actualizamos el pedido actual
    setCurrentPurchaseOrder((prev) => ({ ...prev, items: smartItems }));

    // 🛑 CRUCIAL: Actualizamos los estados temporales para que los inputs
    // de la lista muestren los valores amarillos correctamente.
    const tempQs: Record<number, string> = {};
    const tempPs: Record<number, string> = {};

    smartItems.forEach((item, idx) => {
      tempQs[idx] = String(item.quantity).replace(".", ",");
      tempPs[idx] =
        item.pricePerUnitWithoutIVA > 0
          ? String(item.pricePerUnitWithoutIVA).replace(".", ",")
          : "";
    });

    setTempOrderQuantities(tempQs);
    setTempOrderPrices(tempPs);
  };
  const renderOrderForm = () => {
    const hasItems = currentPurchaseOrder.items.length > 0;
    const allItemsAreValid = currentPurchaseOrder.items.every(
      (item) => item.quantity > 0.001 && item.inventoryItemId.trim() !== ""
    );
    const hasSupplierName = currentPurchaseOrder.supplierName.trim() !== "";
    const canSave = hasSupplierName && hasItems && allItemsAreValid;

    const currentTotalRaw = currentPurchaseOrder.items.reduce((acc, item) => {
      return acc + item.quantity * (item.pricePerUnitWithoutIVA || 0);
    }, 0);

    const currentTotal = Math.round(currentTotalRaw * 100) / 100;

    return (
      <div className="flex flex-col max-h-[80vh] space-y-4">
        <div className="flex-shrink-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="date"
              value={currentPurchaseOrder.orderDate}
              onChange={(e) => handleOrderChange("orderDate", e.target.value)}
              className="bg-gray-700 text-white rounded p-2 w-full border border-gray-600 focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Proveedor"
              value={currentPurchaseOrder.supplierName}
              onChange={(e) => {
                const formatted = formatToTitleCase(e.target.value);
                handleOrderChange("supplierName", formatted);
              }}
              className="bg-gray-700 text-white rounded p-2 w-full border border-gray-600 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 🧠 BOTÓN DE SUGERENCIA INTELIGENTE - COLOR CORREGIDO PARA VISIBILIDAD */}
          <button
            onClick={() => {
              console.log("Ejecutando sugerencia...");
              handleGenerateSmartOrder();
            }}
            type="button"
            className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_0_0_rgba(5,150,105,1)] active:shadow-none active:translate-y-[2px]"
          >
            <span className="text-lg">🧠</span> Sugerir Pedido (Consumo
            Anterior)
          </button>

          {/* 🔍 BUSCADOR CON SELECCIÓN POR ENTER */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <SearchIcon className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar producto"
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  orderSearchTerm &&
                  filteredOrderItems.length > 0
                ) {
                  e.preventDefault();
                  handleAddProductFromSearch(filteredOrderItems[0]);
                }
              }}
              className="bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 w-full border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {orderSearchTerm && filteredOrderItems.length > 0 && (
              <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-2xl">
                {filteredOrderItems.slice(0, 6).map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddProductFromSearch(item)}
                    className={`w-full text-left p-2 hover:bg-slate-700 text-white text-sm border-b border-slate-700 transition-colors ${
                      idx === 0 ? "bg-slate-700/50" : ""
                    }`}
                  >
                    {item.name}{" "}
                    {idx === 0 && (
                      <span className="text-[10px] text-indigo-400 float-right mt-1">
                        ↵ Enter
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LISTA DE ARTÍCULOS EDITABLE */}
        <div className="flex-grow overflow-y-auto pr-2 space-y-2 border-t border-gray-700 pt-4 custom-scrollbar">
          {currentPurchaseOrder.items.map((orderItem, index) => {
            const itemDetails = inventoryItems.find(
              (i) => i.id === orderItem.inventoryItemId
            );

            return (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-900/50 rounded-lg border border-gray-800"
              >
                {/* 1. SELECCIÓN DE BEBIDA (col-span-6) */}
                <div className="col-span-6">
                  {!orderItem.inventoryItemId ? (
                    <select
                      value={orderItem.inventoryItemId}
                      onChange={(e) =>
                        handleOrderItemChange(
                          index,
                          "inventoryItemId",
                          e.target.value
                        )
                      }
                      className="bg-gray-800 text-white text-[10px] rounded p-1 w-full border border-indigo-500"
                    >
                      <option value="">Seleccionar bebida...</option>
                      {inventoryItems
                        .filter(
                          (i) => !i.name.toLowerCase().includes("cajas vacias")
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="text-white text-[11px] font-bold truncate">
                      {itemDetails?.name}
                    </div>
                  )}
                </div>

                {/* 2. CANTIDAD (col-span-2) - AHORA AMARILLO */}
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Cant."
                    value={tempOrderQuantities[index] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*([,.]\d*)?$/.test(val)) {
                        handleOrderQuantityChange(index, val);
                      }
                    }}
                    inputMode="decimal"
                    className="bg-gray-800 text-white font-bold rounded p-1.5 w-full text-center text-xs border border-gray-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* 3. P.U. NETO (col-span-3) - RECUPERADO Y AMARILLO */}
                <div className="col-span-3">
                  <input
                    type="text"
                    placeholder="P.U. Neto"
                    // Muestra el precio actual con coma para facilitar la edición
                    value={
                      tempOrderPrices[index] ??
                      (orderItem.pricePerUnitWithoutIVA === 0
                        ? ""
                        : String(orderItem.pricePerUnitWithoutIVA).replace(
                            ".",
                            ","
                          ))
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      // Permitimos números, una coma/punto y hasta 5 decimales
                      if (val === "" || /^\d*([,.]\d{0,5})?$/.test(val)) {
                        setTempOrderPrices((prev) => ({
                          ...prev,
                          [index]: val,
                        }));

                        // Convertimos a número real para el cálculo del total
                        const numericVal =
                          parseFloat(val.replace(",", ".")) || 0;
                        const newItems = [...currentPurchaseOrder.items];
                        if (newItems[index]) {
                          newItems[index].pricePerUnitWithoutIVA = numericVal;
                          setCurrentPurchaseOrder((prev) => ({
                            ...prev,
                            items: newItems,
                          }));
                        }
                      }
                    }}
                    inputMode="decimal"
                    className="bg-gray-800 text-yellow-400 font-bold rounded p-1.5 w-full text-center text-xs border border-gray-700 focus:ring-1 focus:ring-yellow-500 outline-none"
                  />
                </div>

                {/* 4. BOTÓN ELIMINAR (col-span-1) */}
                <button
                  onClick={() => removeOrderItem(index)}
                  className="col-span-1 text-red-500 flex justify-center"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            );
          })}{" "}
          <button
            onClick={addOrderItem}
            className="w-full py-2 border-2 border-dashed border-gray-700 rounded-lg text-indigo-400 text-xs mt-2 font-bold"
          >
            + Añadir Producto Manual
          </button>
        </div>
        {/* TOTAL CALCULADO */}
        <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 text-sm">
              Total Pedido (Sin IVA):
            </span>
            <span className="text-xl font-bold text-yellow-400">
              {currentTotal.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              €
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={closeOrderModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={!canSave}
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                canSave
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              Guardar Pedido
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="p-4 animate-fade-in">
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* 🛑 SECCIÓN 2: Barra de Herramientas fija debajo de la Navegación */}
          <div
            className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center mb-4 gap-2 
                     sticky top-16 z-50 bg-slate-900 py-3 -mx-4 px-4 border-b border-slate-700/50 shadow-lg"
          >
            {/* top-16 es la clave: pega esta barra justo debajo de los 64px de la cabecera principal */}

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
              {/* 🔍 BOTÓN ESCANEAR CÓDIGO DE BARRAS (Insertado aquí) */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-2 md:px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition duration-300 h-7 w-8 md:w-auto"
                title="Escanear Código de Barras"
              >
                <span className="text-base">🔍</span>
                <span className="hidden md:inline">Código de barras</span>
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
            {(Object.entries(groupedItems) as [string, InventoryItem[]][])
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
                  itemCount={items.length} // Aquí items ya no será unknown
                  initialOpen={true}
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
                                  className="p-1 whitespace-nowrap text-center w-16"
                                >
                                  <input
                                    type="text"
                                    value={
                                      tempStockValues[`${item.id}-${loc}`] !==
                                      undefined
                                        ? tempStockValues[`${item.id}-${loc}`]
                                        : item.stockByLocation?.[loc] === 0
                                        ? ""
                                        : item.category
                                            .toLowerCase()
                                            .includes("material")
                                        ? Math.round(
                                            item.stockByLocation?.[loc] || 0
                                          ).toString() // Redondeo
                                        : String(
                                            item.stockByLocation?.[loc] || ""
                                          ).replace(".", ",") // Decimal
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
                                  {totalStock > 0.001
                                    ? item.category
                                        .toLowerCase()
                                        .includes("material")
                                      ? Math.round(totalStock) // Redondeo
                                      : totalStock.toFixed(1).replace(".", ",") // Decimal con coma
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
          <EmptyBoxesCalculator
            inventoryItems={inventoryItems}
            onSaveInventoryItem={onSaveInventoryItem}
          />
        </div>
      )}

      {activeTab === "orders" && (
        <div>
                    {/* Contenedor que alinea el botón a la derecha */}       
          <div className="flex justify-end mb-4 gap-3">
                     {/* 📸 INPUT DE CÁMARA (Oculto) */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              id="camera-order-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const rawBase64 = (reader.result as string).split(",")[1];
                    try {
                      const compressedBase64 = await compressImage(rawBase64);
                      handleCaptureOrder(compressedBase64);
                    } catch (error) {
                      console.error("Error al comprimir:", error);
                      handleCaptureOrder(rawBase64);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            {/* 📸 BOTÓN VISUAL PARA FOTO ALBARÁN */}
            <label
              htmlFor="camera-order-input"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition duration-300 h-7 cursor-pointer"
              title="Escanear albarán con Gemini"
            >
              <span className="text-base">📷</span>
              <span className="hidden sm:inline">Foto Pedido</span>
            </label>
            {/* BOTÓN NUEVO PEDIDO MANUAL */}
            <button
              onClick={() => openOrderModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition duration-300 h-7"
              title="Nuevo Pedido"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Nuevo Pedido</span>
            </button>
          </div>
          {/* 🛑 INICIO: Vista de ESCRITORIO (Tabla tradicional) */}
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
                  const totalAmount = calculateOrderTotal(
                    order,
                    inventoryItems
                  );
                  return (
                    <tr key={order.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 align-middle">
                        {order.orderDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium text-white">
                        {order.supplierName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-yellow-400">
                        {totalAmount > 0
                          ? `${totalAmount.toFixed(2).replace(".", ",")} €`
                          : "0,00 €"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 align-middle text-center">
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
                    </h4>{" "}
                             
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isCompleted
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {order.status}                 
                    </span>
                             
                  </div>{" "}
                           
                  {/* Fila 2: Detalles (Fecha y Opcional Fecha de Entrega) */} 
                               
                  <div className="space-y-1 text-sm">
                                   
                    <div className="flex justify-between">
                      {" "}
                                         
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
                        {" "}
                                           
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
                            
                        </button>{" "}
                                   
                      </div>
                      {order.status === PurchaseOrderStatus.Pending ? (
                        <button
                          onClick={() => handleReceiveOrder(order)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition duration-300"
                        >
                          Recibir                    
                        </button>
                      ) : (
                        <span className="text-green-400 font-bold text-lg">
                          {" "}
                          OK                      
                        </span>
                      )}
                    </div>
                  </div>{" "}
                               
                </div>
              );
            })}
               
          </div>{" "}
             
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
                          // Variable para saber si redondeamos
                          const esMaterial = item.category
                            .toLowerCase()
                            .includes("material");
                          return (
                            <tr key={item.id} className="hover:bg-gray-700/50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                                {item.name}
                              </td>

                              {/* 1. Stock Actual */}
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-300">
                                {esMaterial
                                  ? Math.round(totalStock)
                                  : totalStock.toFixed(1).replace(".", ",")}
                              </td>

                              {/* 2. En Pedidos (Suele ser material, así que redondeamos según categoría también) */}
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-yellow-400">
                                {esMaterial
                                  ? Math.round(pendingStock)
                                  : pendingStock.toFixed(1).replace(".", ",")}
                              </td>

                              {/* 3. Stock Semana Anterior */}
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-300">
                                {esMaterial
                                  ? Math.round(previousEndStock)
                                  : previousEndStock
                                      .toFixed(1)
                                      .replace(".", ",")}
                              </td>

                              {/* 4. Stock Inicial Total */}
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-blue-400 font-bold">
                                {esMaterial
                                  ? Math.round(initialTotalStock)
                                  : initialTotalStock
                                      .toFixed(1)
                                      .replace(".", ",")}
                              </td>

                              {/* 5. Consumo (Mantenemos decimales para precisión o redondeamos si prefieres) */}
                              <td
                                className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-center ${
                                  consumption > 0
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {esMaterial
                                  ? Math.round(consumption)
                                  : consumption.toFixed(1).replace(".", ",")}
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

      {/* 🛑 INICIO: PESTAÑA HISTORIAL */}
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
          <h3 className="text-l font-bold text-white mb-3 mt-8 border-t border-gray-700 pt-4">
            Registros Anteriores
          </h3>
          {(validInventoryHistory as any[]).length > 0 ? (
            <ul className="space-y-3">
              {(validInventoryHistory as any[]).map(
                (record: InventoryRecord) => (
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
                )
              )}
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
      {/* 📊 PESTAÑA DE ESTADÍSTICAS (RECHARTS) */}
      {activeTab === "stats" && renderStats()}

      {/* --- MODALES --- */}
      {isInventoryModalOpen && (
        <Modal
          title={currentInventoryItem.id ? "Editar Artículo" : "Nuevo Artículo"}
          onClose={() => setInventoryModalOpen(false)}
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
          onClose={() => setOrderModalOpen(false)}
          hideSaveButton={true}
        >
          {renderOrderForm()}
        </Modal>
      )}

      {viewingRecord && renderInventoryRecordDetailModal()}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span className="text-l">📷</span> Lector Código de Barras
              </h3>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded-lg transition-colors text-sm font-bold border border-red-500/30"
              >
                Cerrar
              </button>
            </div>

            {/* 🛑 EL ID DEBE SER "reader" PARA QUE EL EFFECT LO ENCUENTRE */}
            <div
              id="reader"
              className="overflow-hidden rounded-xl border-2 border-indigo-500/50 bg-slate-900 aspect-square shadow-inner"
            ></div>

            <div className="mt-6 text-center space-y-2">
              <p className="text-slate-200 text-sm font-medium">
                Enfoca el código de barras de la botella
              </p>
              <p className="text-slate-500 text-[11px] italic">
                Permite que la cámara enfoque automáticamente
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryComponent;
