import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  InventoryItem,
  PurchaseOrder,
  PurchaseOrderStatus,
  InventoryRecord,
} from "./types";
import InventoryComponent from "./components/Inventory";
import { MenuIcon, XIcon } from "./components/icons";
import { INVENTORY_LOCATIONS } from "./constants";

// IMPORTANTE: Asegúrate de que este import sea correcto en tu entorno.
import { api } from "./src/api";

const userPrices: { [name: string]: number } = {
  Absolut: 11.45,
  Beluga: 28.85,
  Belvedere: 29.46,
  "Grey Goose": 36.89,
  "Bacardi 8": 22.02,
  "Bacardi Carta Blanca 1Lt": 13.55,
  "Bumbu Original": 27.12,
  "Havana Club": 19.22,
  Malibu: 10.77,
  "Sta Teresa 1796": 36.39,
  "Sta Teresa Gran Reserva": 11.51,
  "Zacapa 23": 48.77,
  "Zacapa XO": 116.86,
  Ballantines: 13.7,
  "Ballantines 10": 15.88,
  Bullet: 23.07,
  "Carlos I": 19.78,
  "Chivas 12": 22.91,
  "Chivas 15": 38.83,
  "Four Roses": 14.53,
  Hennesy: 27.78,
  "J. Walker Gold Label Reserve": 39.29,
  "J.Walcker E.Black 0.7 Luxe": 21.94,
  "Jack Daniel’s": 17.33,
  Jameson: 14.94,
  JB: 9.82,
  Lagavulin: 78.62,
  "Macallan 12 años double cask": 65.44,
  "Torres 10": 10.49,
  Beefeater: 11.97,
  "Beefeater 0%": 11.81,
  "Beefeater Black": 14.5,
  "Beefeater Pink": 12.72,
  "Bombay Saphire": 14.59,
  "G’Vine": 30.43,
  "Gin Mare": 25.49,
  Hendricks: 23.55,
  "Malfy Limón": 20.92,
  "Monkey 47": 34.1,
  Seagrams: 13.18,
  "Seagrams 0%": 13.6,
  "Tanqueray Ten": 28.16,
  "Código Blanco": 46.21,
  "Código Reposado": 53.93,
  "Código Rosa": 52.77,
  "Patrón Silver": 39.36,
  "Tequila Clase Azul Reposado": 149.41,
  "Tequila Don Julio 1942": 175.71,
  "Tequila Don Julio Blanco": 40.2,
  "Tequila Don Julio Reposado 0.7": 44.19,
  "Tequila Olmeca": 19.37,
  "Mezcal Bhanes": 32.12,
  "Mezcal Joven Casamigos": 42.5,
  "Aperitivo (Petroni)": 11.13,
  Aperol: 10.24,
  "Baileys 1 Lt": 14.92,
  "Cachaça (Vhelo Barreiro)": 11.16,
  Campari: 9.82,
  Cointreau: 14.75,
  "Cordial de Lima (Caiman)": 2.45,
  Disaronno: 12.34,
  Jagermeister: 14.36,
  Kalhua: 14.02,
  "Licor 43": 15.88,
  "Limoncello (Villa Massa)": 10.37,
  Midori: 14.13,
  Passoa: 13.68,
  Patxaran: 8.5,
  Pisco: 15.68,
  "Rua Vieja (Licor de hierbas)": 8.18,
  "Rua Vieja (crema)": 10.9,
  "Rua Vieja aguardiente": 8.18,
  "Rua Vieja café": 8.18,
  "Saint Germain": 26.08,
  "Triple Sec (Caiman)": 8.3,
  "Martini Blanco": 7.45,
  "Martini Rosso": 7.45,
  "Castell de Ribes (CAVA) Blanco": 5.29,
  "Castell de Ribes (CAVA) Rosado": 5.29,
  "CAVA Gramona LUSTROS": 26.6,
  "Convento Oreja ( Ribera del Duero)": 6.73,
  "Corbatera (Montsant)": 13.7,
  Corimbo: 17.85,
  "Corral de Campanas (TINTA DE TORO)": 7.5,
  "DOM PERIGNON": 170.63,
  "El Fanio 2022 (Xarel-lo)": 9.95,
  "El hombre bala": 15.35,
  Fenomenal: 5.4,
  "Finca Villacreces": 19.8,
  "Lagrimas de Maria (Tempranillo-Crianza)": 5.42,
  "M Minuty": 15.15,
  "Maison Sainte Marguerite": 16.67,
  "Malvasia Sitges": 10.25,
  "Mar de Frades (Albariño)": 11.85,
  MarT: 9.3,
  "MOET CHANDON BRUT": 34.88,
  "MOET CHANDON ICE": 42.82,
  "MOET CHANDON ROSE": 40.95,
  "MUM CHAMPAGNE BRUT": 35.61,
  "MUM CHAMPAGNE ICE": 43.34,
  "MUM CHAMPAGNE ROSE": 42.91,
  "Pago Carrovejas": 27.65,
  "Plana d'en fonoll (Sauvignon)": 5.38,
  Predicador: 18.55,
  Pruno: 8.3,
  "Quinta Quietud (TINTA DE TORO)": 13.97,
  Savinat: 15.3,
  Sospechoso: 6.3,
  "VEUVE CLICQUOT": 38.36,
  "7up": 1.18,
  "Agua con Gas": 0.96,
  "Agua con gas 75": 1.97,
  "Agua sin gas 33": 1.1,
  "Aquabona 33": 0.36,
  "Aquarius Naranja": 1.42,
  "Arandanos 1 Lt": 1.42,
  "Bitter Kas": 1.05,
  "Coca Cola Zero": 1.18,
  Lipton: 0.93,
  "Minute Maid Naranja": 1.17,
  "Minute Maid Piña": 1.17,
  "Minute Maid Tomate": 1.17,
  Pepsi: 1.03,
  "Pomelo 1 Lt": 1.42,
  "Schweppes Ginger Ale": 1.08,
  "Schweppes Ginger Beer": 1.8,
  "Schweppes Limon": 0.88,
  "Schweppes Naranja": 0.88,
  "Schweppes Pomelo": 1.8,
  "Schweppes Soda": 1.08,
  "Schweppes Tonica": 1.08,
  "Schweppes Tonica 0%": 1.08,
  Sprite: 1.18,
  "Tomate 1 Lt": 1.42,
  "Ambar Gluten free": 1.46,
  "BARRIL 500LT": 1005,
  "Barril Moritz 30Lt": 115.71,
  "Barril Moritz Radler 30 Lt": 138.69,
  "Moritz 0%": 1.64,
  "Moritz 7": 0.65,
  "Moritz EPIDOR": 1.62,
  // 🛑 Se eliminan los precios placeholder que no estaban en la lista original
  // El código ahora gestionará la falta de precio con un valor de 0
};

const initialStockByLocation = INVENTORY_LOCATIONS.reduce(
  (acc, loc) => ({ ...acc, [loc]: 0 }),
  {}
);

// CORRECCIÓN CLAVE: Renombrada a createInitialStockObject.
// Función SOLO para crear el objeto de stock inicial de un artículo nuevo,
// que siempre iniciará en 0 en todas las ubicaciones, excepto la forzada.
const createInitialStockObject = (
  initialStock: number = 0,
  location = "Almacén"
) => ({
  ...initialStockByLocation,
  [location]: initialStock,
});

// 💥 INVENTARIO: Items clave con stock inicial para probar el cálculo del VALOR TOTAL
// He reajustado los stocks de prueba para que funcionen con la carga de la DB
const initialInventoryItems: InventoryItem[] = [
  // Vodka
  {
    id: "a1",
    name: "Absolut",
    category: "🧊 Vodka",
    stockByLocation: createInitialStockObject(0), // Stock para prueba
    pricePerUnitWithoutIVA: userPrices["Absolut"] || 0,
  },
  {
    id: "a2",
    name: "Beluga",
    category: "🧊 Vodka",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beluga"] || 0,
  },
  {
    id: "a3",
    name: "Belvedere",
    category: "🧊 Vodka",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Belvedere"] || 0,
  },
  {
    id: "a4",
    name: "Grey Goose",
    category: "🧊 Vodka",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Grey Goose"] || 0,
  },
  {
    id: "a5",
    name: "Vozca Negro",
    category: "🧊 Vodka",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Vozca Negro"] || 0,
  },
  // Ron
  {
    id: "a6",
    name: "Bacardi 8",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0), // Stock para prueba
    pricePerUnitWithoutIVA: userPrices["Bacardi 8"] || 0,
  },
  {
    id: "a7",
    name: "Bacardi Carta Blanca 1Lt",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bacardi Carta Blanca 1Lt"] || 0,
  },
  {
    id: "a8",
    name: "Bumbu Original",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bumbu Original"] || 0,
  },
  {
    id: "a9",
    name: "Brugal",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Brugal"] || 0,
  },
  {
    id: "a10",
    name: "Havana Club",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Havana Club"] || 0,
  },
  {
    id: "a11",
    name: "Malibu",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Malibu"] || 0,
  },
  {
    id: "a12",
    name: "Sta Teresa Gran Reserva",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sta Teresa Gran Reserva"] || 0,
  },
  {
    id: "a13",
    name: "Sta Teresa 1796",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sta Teresa 1796"] || 0,
  },
  {
    id: "a14",
    name: "Zacapa 23",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Zacapa 23"] || 0,
  },
  {
    id: "a15",
    name: "Zacapa XO",
    category: "🥥 Ron",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Zacapa XO"] || 0,
  },
  // Whisky / Bourbon
  {
    id: "a16",
    name: "Ballantines",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(7.5), // Stock para prueba (decimal)
    pricePerUnitWithoutIVA: userPrices["Ballantines"] || 0,
  },
  {
    id: "a17",
    name: "Ballantines 10",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Ballantines 10"] || 0,
  },
  {
    id: "a18",
    name: "Bullet",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bullet"] || 0,
  },
  {
    id: "a19",
    name: "Chivas 12",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Chivas 12"] || 0,
  },
  {
    id: "a20",
    name: "Chivas 15",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Chivas 15"] || 0,
  },
  {
    id: "a21",
    name: "Carlos I",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Carlos I"] || 0,
  },
  {
    id: "a22",
    name: "Dewars Whait label",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Dewars Whait label"] || 0,
  },
  {
    id: "a23",
    name: "Four Roses",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Four Roses"] || 0,
  },
  {
    id: "a24",
    name: "Hennesy",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Hennesy"] || 0,
  },
  {
    id: "a25",
    name: "JB",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["JB"] || 0,
  },
  {
    id: "a26",
    name: "J. Walker Black Label",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["J. Walker Black Label"] || 0,
  },
  {
    id: "a27",
    name: "J. Walker Gold Label Reserve",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["J. Walker Gold Label Reserve"] || 0,
  },
  {
    id: "a28",
    name: "J. Walker White",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["J. Walker White"] || 0,
  },
  {
    id: "a29",
    name: "J.Walcker E.Black 0.7 Luxe",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["J.Walcker E.Black 0.7 Luxe"] || 0,
  },
  {
    id: "a30",
    name: "Jack Daniel’s",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Jack Daniel’s"] || 0,
  },
  {
    id: "a31",
    name: "Jameson",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Jameson"] || 0,
  },
  {
    id: "a32",
    name: "Lagavulin",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Lagavulin"] || 0,
  },
  {
    id: "a33",
    name: "Macallan 12 años double cask",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Macallan 12 años double cask"] || 0,
  },
  {
    id: "a34",
    name: "Torres 10",
    category: "🥃 Whisky / Bourbon",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Torres 10"] || 0,
  },
  // Ginebra
  {
    id: "a35",
    name: "Beefeater",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater"] || 0,
  },
  {
    id: "a36",
    name: "Beefeater 0%",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater 0%"] || 0,
  },
  {
    id: "a37",
    name: "Beefeater Black",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater Black"] || 0,
  },
  {
    id: "a38",
    name: "Beefeater Pink",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater Pink"] || 0,
  },
  {
    id: "a39",
    name: "Beefeater Pink 20%",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater Pink 20%"] || 0,
  },
  {
    id: "a40",
    name: "Beefeater Pink Premium",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Beefeater Pink Premium"] || 0,
  },
  {
    id: "a41",
    name: "Bombay Saphire",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bombay Saphire"] || 0,
  },
  {
    id: "a42",
    name: "G’Vine",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["G’Vine"] || 0,
  },
  {
    id: "a43",
    name: "Gin Mare",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Gin Mare"] || 0,
  },
  {
    id: "a44",
    name: "Hendricks",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Hendricks"] || 0,
  },
  {
    id: "a45",
    name: "Malfy Limón",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Malfy Limón"] || 0,
  },
  {
    id: "a46",
    name: "Monkey 47",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Monkey 47"] || 0,
  },
  {
    id: "a47",
    name: "Seagrams",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Seagrams"] || 0,
  },
  {
    id: "a48",
    name: "Seagrams 0%",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Seagrams 0%"] || 0,
  },
  {
    id: "a49",
    name: "Tanqueray Ten",
    category: "🍸 Ginebra",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tanqueray Ten"] || 0,
  },
  // Tequila
  {
    id: "a50",
    name: "Cazadores",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Cazadores"] || 0,
  },
  {
    id: "a51",
    name: "Código Blanco",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Código Blanco"] || 0,
  },
  {
    id: "a52",
    name: "Código Reposado",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Código Reposado"] || 0,
  },
  {
    id: "a53",
    name: "Código Rosa",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Código Rosa"] || 0,
  },
  {
    id: "a54",
    name: "Jose Cuervo (tequila)",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Jose Cuervo (tequila)"] || 0,
  },
  {
    id: "a55",
    name: "Patrón Reposado",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Patrón Reposado"] || 0,
  },
  {
    id: "a56",
    name: "Patrón Silver",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Patrón Silver"] || 0,
  },
  {
    id: "a57",
    name: "Tequila Clase Azul Reposado",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequila Clase Azul Reposado"] || 0,
  },
  {
    id: "a58",
    name: "Tequila Don Julio 1942",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequila Don Julio 1942"] || 0,
  },
  {
    id: "a59",
    name: "Tequila Don Julio Blanco",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequila Don Julio Blanco"] || 0,
  },
  {
    id: "a60",
    name: "Tequila Don Julio Reposado 0.7",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequila Don Julio Reposado 0.7"] || 0,
  },
  {
    id: "a61",
    name: "Tequila Olmeca",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequila Olmeca"] || 0,
  },
  {
    id: "a62",
    name: "Tequifresi",
    category: "🌵 Tequila",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tequifresi"] || 0,
  },
  // Mezcal
  {
    id: "a63",
    name: "Mezcal Bhanes",
    category: "🔥 Mezcal",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Mezcal Bhanes"] || 0,
  },
  {
    id: "a64",
    name: "Mezcal Joven Casamigos",
    category: "🔥 Mezcal",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Mezcal Joven Casamigos"] || 0,
  },
  {
    id: "a65",
    name: "Sarajishviu",
    category: "🔥 Mezcal",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sarajishviu"] || 0,
  },
  // Licores y Aperitivos
  {
    id: "a66",
    name: "Aperitivo (Petroni)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aperitivo (Petroni)"] || 0,
  },
  {
    id: "a67",
    name: "Aperol",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aperol"] || 0,
  },
  {
    id: "a68",
    name: "Baileys 1 Lt",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Baileys 1 Lt"] || 0,
  },
  {
    id: "a69",
    name: "Blue Coraçao",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Blue Coraçao"] || 0,
  },
  {
    id: "a70",
    name: "Cachaça (Vhelo Barreiro)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Cachaça (Vhelo Barreiro)"] || 0,
  },
  {
    id: "a71",
    name: "Campari",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Campari"] || 0,
  },
  {
    id: "a72",
    name: "Caiman Love Almendras",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Caiman Love Almendras"] || 0,
  },
  {
    id: "a73",
    name: "Cointreau",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Cointreau"] || 0,
  },
  {
    id: "a74",
    name: "Cordial de Lima (Caiman)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Cordial de Lima (Caiman)"] || 0,
  },
  {
    id: "a75",
    name: "Cordial de Grosella (Caiman)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Cordial de Grosella (Caiman)"] || 0,
  },
  {
    id: "a76",
    name: "Disaronno",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Disaronno"] || 0,
  },
  {
    id: "a77",
    name: "Fernet",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Fernet"] || 0,
  },
  {
    id: "a78",
    name: "Frangelico",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Frangelico"] || 0,
  },
  {
    id: "a79",
    name: "Hiervas Ibiza Mary Mayans",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Hiervas Ibiza Mary Mayans"] || 0,
  },
  {
    id: "a80",
    name: "Jagermeister",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Jagermeister"] || 0,
  },
  {
    id: "a81",
    name: "Jet Wild Fruits",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Jet Wild Fruits"] || 0,
  },
  {
    id: "a82",
    name: "Kalhua",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Kalhua"] || 0,
  },
  {
    id: "a83",
    name: "Licor 43",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Licor 43"] || 0,
  },
  {
    id: "a84",
    name: "Licor de Cassís",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Licor de Cassís"] || 0,
  },
  {
    id: "a85",
    name: "Limoncello (Villa Massa)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Limoncello (Villa Massa)"] || 0,
  },
  {
    id: "a86",
    name: "Midori",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Midori"] || 0,
  },
  {
    id: "a87",
    name: "Passoa",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Passoa"] || 0,
  },
  {
    id: "a88",
    name: "Patxaran",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Patxaran"] || 0,
  },
  {
    id: "a89",
    name: "Pisco",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pisco"] || 0,
  },
  {
    id: "a90",
    name: "Rua Vieja (crema)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Rua Vieja (crema)"] || 0,
  },
  {
    id: "a91",
    name: "Rua Vieja aguardiente",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Rua Vieja aguardiente"] || 0,
  },
  {
    id: "a92",
    name: "Rua Vieja café",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Rua Vieja café"] || 0,
  },
  {
    id: "a93",
    name: "Rua Vieja (Licor de hierbas)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Rua Vieja (Licor de hierbas)"] || 0,
  },
  {
    id: "a94",
    name: "Saint Germain",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Saint Germain"] || 0,
  },
  {
    id: "a95",
    name: "Santa Fe Grosella",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Santa Fe Grosella"] || 0, // AÑADIDO: Ahora tiene precio
  },
  {
    id: "a96",
    name: "Ratafia",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Ratafia"] || 0,
  },
  {
    id: "a97",
    name: "Triple Sec (Caiman)",
    category: "🍯 Licores y Aperitivos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Triple Sec (Caiman)"] || 0,
  },
  // Vermut
  {
    id: "a98",
    name: "Martini Blanco",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Martini Blanco"] || 0,
  },
  {
    id: "a99",
    name: "Martini Fiero",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Martini Fiero"] || 0,
  },
  {
    id: "a100",
    name: "Martini Rosso",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Martini Rosso"] || 0,
  },
  {
    id: "a101",
    name: "Martini Reserva",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Martini Reserva"] || 0,
  },
  {
    id: "a102",
    name: "UNIQ Vermut",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["UNIQ Vermut"] || 0,
  },
  {
    id: "a103",
    name: "Vermut Negro",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Vermut Negro"] || 0,
  },
  {
    id: "a104",
    name: "Vermut Miró blanco",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Vermut Miró blanco"] || 0,
  },
  {
    id: "a105",
    name: "Vermut Miró negro",
    category: "🍷 Vermut",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Vermut Miró negro"] || 0,
  },
  // Vinos y espumosos
  {
    id: "a106",
    name: "Plana d'en fonoll (Sauvignon)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Plana d'en fonoll (Sauvignon)"] || 0,
  },
  {
    id: "a107",
    name: "Piedra (Verdejo)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Piedra (Verdejo)"] || 0,
  },
  {
    id: "a108",
    name: "Bicicletas y Peces (Verdejo)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bicicletas y Peces (Verdejo)"] || 0,
  },
  {
    id: "a109",
    name: "Maricel (Malvasia de Sitges)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Maricel (Malvasia de Sitges)"] || 0,
  },
  {
    id: "a110",
    name: "Mar de Frades (Albariño)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Mar de Frades (Albariño)"] || 0,
  },
  {
    id: "a111",
    name: "El Fanio 2022 (Xarel-lo)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["El Fanio 2022 (Xarel-lo)"] || 0,
  },
  {
    id: "a112",
    name: "Albariño LAMEESPIÑAS",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Albariño LAMEESPIÑAS"] || 0,
  },
  {
    id: "a113",
    name: "MarT",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MarT"] || 0,
  },
  {
    id: "a114",
    name: "Savinat",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Savinat"] || 0,
  },
  {
    id: "a115",
    name: "Malvasia Sitges",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Malvasia Sitges"] || 0,
  },
  {
    id: "a116",
    name: "Fenomenal",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Fenomenal"] || 0,
  },
  {
    id: "a117",
    name: "Llagrimes (Gartnatxa)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Llagrimes (Gartnatxa)"] || 0,
  },
  {
    id: "a118",
    name: "Maison Sainte Marguerite",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Maison Sainte Marguerite"] || 0,
  },
  {
    id: "a119",
    name: "Sospechoso",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sospechoso"] || 0,
  },
  {
    id: "a120",
    name: "Sospechoso MAGNUM",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sospechoso MAGNUM"] || 0,
  },
  {
    id: "a121",
    name: "Miraval",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Miraval"] || 0,
  },
  {
    id: "a122",
    name: "M Minuty",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["M Minuty"] || 0,
  },
  {
    id: "a123",
    name: "Convento Oreja ( Ribera del Duero)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA:
      userPrices["Convento Oreja ( Ribera del Duero)"] || 0,
  },
  {
    id: "a124",
    name: "Corbatera (Montsant)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Corbatera (Montsant)"] || 0,
  },
  {
    id: "a125",
    name: "Plana d'en fonoll (Cabernet-Sauvignon)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA:
      userPrices["Plana d'en fonoll (Cabernet-Sauvignon)"] || 0,
  },
  {
    id: "a126",
    name: "Azpilicueta",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Azpilicueta"] || 0,
  },
  {
    id: "a127",
    name: "Lagrimas de Maria (Tempranillo-Crianza)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA:
      userPrices["Lagrimas de Maria (Tempranillo-Crianza)"] || 0,
  },
  {
    id: "a128",
    name: "Pago Carrovejas",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pago Carrovejas"] || 0,
  },
  {
    id: "a129",
    name: "Pruno",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pruno"] || 0,
  },
  {
    id: "a130",
    name: "Finca Villacreces",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Finca Villacreces"] || 0,
  },
  {
    id: "a131",
    name: "Predicador",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Predicador"] || 0,
  },
  {
    id: "a132",
    name: "El hombre bala",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["El hombre bala"] || 0,
  },
  {
    id: "a133",
    name: "Corimbo",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Corimbo"] || 0,
  },
  {
    id: "a134",
    name: "Corral de Campanas (TINTA DE TORO)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA:
      userPrices["Corral de Campanas (TINTA DE TORO)"] || 0,
  },
  {
    id: "a135",
    name: "Quinta Quietud (TINTA DE TORO)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Quinta Quietud (TINTA DE TORO)"] || 0,
  },
  {
    id: "a136",
    name: "La MULA ( TINTA DE TORO)",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["La MULA ( TINTA DE TORO)"] || 0,
  },
  {
    id: "a137",
    name: "Castell de Ribes (CAVA) Rosado",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Castell de Ribes (CAVA) Rosado"] || 0,
  },
  {
    id: "a138",
    name: "Castell de Ribes (CAVA) Blanco",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Castell de Ribes (CAVA) Blanco"] || 0,
  },
  {
    id: "a139",
    name: "CAVA Gramona LUSTROS",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["CAVA Gramona LUSTROS"] || 0,
  },
  {
    id: "a140",
    name: "MUM CHAMPAGNE BRUT",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MUM CHAMPAGNE BRUT"] || 0,
  },
  {
    id: "a141",
    name: "MUM CHAMPAGNE ROSE",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MUM CHAMPAGNE ROSE"] || 0,
  },
  {
    id: "a142",
    name: "MUM CHAMPAGNE ICE",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MUM CHAMPAGNE ICE"] || 0,
  },
  {
    id: "a143",
    name: "MOET CHANDON BRUT",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MOET CHANDON BRUT"] || 0,
  },
  {
    id: "a144",
    name: "MOET CHANDON ROSE",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MOET CHANDON ROSE"] || 0,
  },
  {
    id: "a145",
    name: "MOET CHANDON ICE",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["MOET CHANDON ICE"] || 0,
  },
  {
    id: "a146",
    name: "VEUVE CLICQUOT",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["VEUVE CLICQUOT"] || 0,
  },
  {
    id: "a147",
    name: "DOM PERIGNON",
    category: "🥂 Vinos y espumosos",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["DOM PERIGNON"] || 0,
  },
  // Refrescos y agua
  {
    id: "a148",
    name: "Agua con Gas",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Agua con Gas"] || 0,
  },
  {
    id: "a149",
    name: "Agua sin gas 33",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Agua sin gas 33"] || 0,
  },
  {
    id: "a150",
    name: "Agua con gas 75",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Agua con gas 75"] || 0,
  },
  {
    id: "a151",
    name: "Aquabona 33",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aquabona 33"] || 0,
  },
  {
    id: "a152",
    name: "Aquabona 75",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aquabona 75"] || 0,
  },
  {
    id: "a153",
    name: "Aquarius",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aquarius"] || 0,
  },
  {
    id: "a154",
    name: "Aquarius Naranja",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Aquarius Naranja"] || 0,
  },
  {
    id: "a155",
    name: "Arandanos 1 Lt",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Arandanos 1 Lt"] || 0,
  },
  {
    id: "a156",
    name: "Bitter Kas",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Bitter Kas"] || 0,
  },
  {
    id: "a157",
    name: "Coca Cola",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Coca Cola"] || 0, // AÑADIDO: Ahora tiene precio
  },
  {
    id: "a158",
    name: "Coca Cola Zero",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Coca Cola Zero"] || 0,
  },
  {
    id: "a159",
    name: "Granini Naranja 1 Lt",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Granini Naranja 1 Lt"] || 0,
  },
  {
    id: "a160",
    name: "Lipton",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Lipton"] || 0,
  },
  {
    id: "a161",
    name: "Minute Maid Tomate",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Minute Maid Tomate"] || 0,
  },
  {
    id: "a162",
    name: "Minute Maid Naranja",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Minute Maid Naranja"] || 0,
  },
  {
    id: "a163",
    name: "Minute Maid Piña",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Minute Maid Piña"] || 0,
  },
  {
    id: "a164",
    name: "Red Bull",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Red Bull"] || 0,
  },
  {
    id: "a165",
    name: "Red Bull Sin Azucar",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Red Bull Sin Azucar"] || 0,
  },
  {
    id: "a166",
    name: "Red Bull Rojo",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Red Bull Rojo"] || 0,
  },
  {
    id: "a167",
    name: "Pepsi",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pepsi"] || 0,
  },
  {
    id: "a168",
    name: "Pepsi sin azucar",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pepsi sin azucar"] || 0, // AÑADIDO: Ahora tiene precio
  },
  {
    id: "a169",
    name: "Pomelo 1 Lt",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Pomelo 1 Lt"] || 0,
  },
  {
    id: "a170",
    name: "Schweppes Ginger Ale",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Ginger Ale"] || 0,
  },
  {
    id: "a171",
    name: "Schweppes Ginger Beer",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Ginger Beer"] || 0,
  },
  {
    id: "a172",
    name: "Schweppes Limon",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Limon"] || 0,
  },
  {
    id: "a173",
    name: "Schweppes Naranja",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Naranja"] || 0,
  },
  {
    id: "a174",
    name: "Schweppes Pomelo",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Pomelo"] || 0,
  },
  {
    id: "a175",
    name: "Schweppes Soda",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Soda"] || 0,
  },
  {
    id: "a176",
    name: "Schweppes Tonica",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Tonica"] || 0,
  },
  {
    id: "a177",
    name: "Schweppes Tonica 0%",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Schweppes Tonica 0%"] || 0,
  },
  {
    id: "a178",
    name: "Sprite",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Sprite"] || 0,
  },
  {
    id: "a179",
    name: "Tomate 1 Lt",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Tomate 1 Lt"] || 0,
  },
  {
    id: "a180",
    name: "7up",
    category: "🥤Refrescos y agua",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["7up"] || 0,
  },
  // Cerveza
  {
    id: "a181",
    name: "Moritz 7",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Moritz 7"] || 0,
  },
  {
    id: "a182",
    name: "Moritz EPIDOR",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Moritz EPIDOR"] || 0,
  },
  {
    id: "a183",
    name: "Moritz 0%",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Moritz 0%"] || 0,
  },
  {
    id: "a184",
    name: "Ambar Gluten free",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Ambar Gluten free"] || 0,
  },
  {
    id: "a185",
    name: "Ambar Triple 0 Tostada",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Ambar Triple 0 Tostada"] || 0,
  },
  {
    id: "a186",
    name: "Barril Moritz 30Lt",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Barril Moritz 30Lt"] || 0,
  },
  {
    id: "a187",
    name: "Barril Moritz Radler 30 Lt",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["Barril Moritz Radler 30 Lt"] || 0,
  },
  {
    id: "a188",
    name: "BARRIL 500LT",
    category: "🍻 Cerveza",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: userPrices["BARRIL 500LT"] || 0,
  },

  // Material y Menaje
  {
    id: "m1",
    name: "Vasos",
    category: "📦 Material",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: 0,
  },
  {
    id: "m2",
    name: "Chupitos",
    category: "📦 Material",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: 0,
  },
  {
    id: "m3",
    name: "Pajitas",
    category: "📦 Material",
    stockByLocation: createInitialStockObject(0),
    pricePerUnitWithoutIVA: 0,
  },
];

const initialPurchaseOrders: PurchaseOrder[] = [];

// --- FUNCIÓN DE UTILIDAD: Convierte UTC a la hora local (Definida en App.tsx) ---
const formatUTCToLocal = (utcDateString: string | Date | undefined): string => {
  if (!utcDateString) return "N/A";

  return new Date(utcDateString).toLocaleString("es-ES", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// --- COMPONENTE PRINCIPAL ---
const App: React.FC = () => {
  // 🛑 'history' RESTAURADO
  const [activeView, setActiveView] = useState<
    "inventory" | "orders" | "analysis" | "history"
  >("inventory");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(
    initialInventoryItems
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    initialPurchaseOrders
  );
  // Eliminamos la carga de historial de localStorage, ya que ahora usamos la API
  const [inventoryHistory, setInventoryHistory] = useState<InventoryRecord[]>(
    []
  );

  // --- EFECTOS DE PERSISTENCIA (LocalStorage) ---
  // Se deja el useEffect para persistir localmente el historial (aunque ya está en la API,
  // es un fallback o mejora de rendimiento local)
  useEffect(() => {
    try {
      localStorage.setItem(
        "inventoryHistory",
        JSON.stringify(inventoryHistory)
      );
    } catch (e) {
      console.error("Failed to save inventory history to localStorage", e);
    }
  }, [inventoryHistory]);

  // --- CÁLCULOS Y HELPERS ---
  // 🛑 'history' RESTAURADO
  const navItemsFull: { id: View; label: string }[] = [
    { id: "inventory", label: "Inventario" },
    { id: "orders", label: "Pedidos" },
    { id: "analysis", label: "Análisis" },
    { id: "history", label: "Historial" },
  ];

  const uniqueSuppliers = useMemo(() => {
    const orderSuppliers = purchaseOrders.map((ord) => ord.supplierName);
    const all = new Set([...orderSuppliers]);
    return Array.from(all).filter((s) => s.trim() !== "");
  }, [purchaseOrders]);

  const addOrUpdate = useCallback(
    <T extends { id: string; name?: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      item: T
    ) => {
      setter((prev) => {
        const index = prev.findIndex((i) => i.id === item.id);
        let updatedList: T[];
        const itemWithId = { ...item, id: item.id || crypto.randomUUID() };

        if (index > -1) {
          updatedList = [...prev];
          updatedList[index] = itemWithId;
        } else {
          updatedList = [itemWithId, ...prev];
        }

        // 💥 LÓGICA DE ORDENACIÓN ALFABÉTICA
        if ((updatedList[0] as any).name !== undefined) {
          return updatedList.sort((a, b) =>
            (a as any).name.localeCompare((b as any).name)
          );
        }

        return updatedList;
      });
    },
    []
  );

  const deleteItem = useCallback(
    <T extends { id: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      id: string
    ) => {
      setter((prev) => prev.filter((item) => item.id !== id));
    },
    []
  );

  // 🛑 CORRECCIÓN 1: Implementación de handlers de Inventario para la API
  const handleSaveInventoryItem = useCallback(
    async (item: InventoryItem) => {
      try {
        const savedItem = await api.inventory.save(item);
        addOrUpdate(setInventoryItems, savedItem as InventoryItem);
      } catch (e) {
        console.error("Error saving inventory item:", e);
        alert(`Error al guardar el artículo: ${(e as Error).message}`);
      }
    },
    [addOrUpdate]
  );

  const handleDeleteInventoryItem = useCallback(
    async (id: string) => {
      try {
        await api.inventory.delete(id);
        deleteItem(setInventoryItems, id);
      } catch (e) {
        console.error("Error deleting inventory item:", e);
        alert(`Error al eliminar el artículo: ${(e as Error).message}`);
      }
    },
    [deleteItem]
  );

  // --- API Handlers para Pedidos (Mantenidos) ---
  const handleSavePurchaseOrder = useCallback(
    async (order: PurchaseOrder) => {
      try {
        // Lógica de guardado en API (Netlify Function)
        const savedOrder = await api.orders.save(order);
        addOrUpdate(setPurchaseOrders, savedOrder as PurchaseOrder);
      } catch (e) {
        console.error("Error saving order:", e);

        let errorMessage = "Error desconocido.";

        if (e instanceof Error) {
          errorMessage = e.message;
        } else if (
          typeof e === "object" &&
          e !== null &&
          "message" in e &&
          typeof e.message === "string"
        ) {
          errorMessage = e.message;
        }

        // Muestra la alerta con el mensaje detallado
        alert(`Error al guardar el pedido: ${errorMessage}`);
      }
    },
    [addOrUpdate]
  );

  const handleDeletePurchaseOrder = useCallback(
    async (id: string) => {
      try {
        await api.orders.delete(id);
        deleteItem(setPurchaseOrders, id);
      } catch (e) {
        console.error("Error deleting order:", e);
        alert(
          `Error al eliminar el pedido: ${
            e instanceof Error ? e.message : "Error desconocido"
          }`
        );
      }
    },
    [deleteItem]
  );

  // --- API Handler para Borrar Todo el Historial ---
  const handleDeleteAllHistoryRecords = useCallback(async () => {
    if (
      !window.confirm(
        "ADVERTENCIA: ¿Está seguro de que desea eliminar TODO el historial de inventario y análisis de consumo? Esta acción es irreversible."
      )
    ) {
      return;
    }
    try {
      await api.history.deleteAll();
      setInventoryHistory([]);
    } catch (e) {
      console.error("Error deleting all history:", e);
      alert(
        `Error al eliminar todo el historial: ${
          e instanceof Error ? e.message : "Error desconocido"
        }`
      );
    }
  }, []);

  // NUEVO: API Handler para Borrar un Registro Individual del Historial
  const handleDeleteInventoryRecord = useCallback(
    async (id: string) => {
      try {
        await api.history.delete(id); // Llama a la nueva función API
        deleteItem(setInventoryHistory, id);
      } catch (e) {
        console.error("Error deleting history record:", e);
        alert(
          `Error al eliminar el registro de historial: ${
            e instanceof Error ? e.message : "Error desconocido"
          }`
        );
      }
    },
    [deleteItem]
  );

  // 🛑 CORRECCIÓN 2: Guarda el registro en la API (MongoDB)
  const handleSaveInventoryRecord = useCallback(
    async (record: InventoryRecord) => {
      try {
        // 1. Guardar el registro en la API (MongoDB)
        const savedRecord = await api.history.save(record);

        // 2. Actualizar el estado local con la respuesta de la API
        addOrUpdate(setInventoryHistory, savedRecord as InventoryRecord);
      } catch (e) {
        console.error("Error saving inventory record:", e);
        alert(
          `Error al guardar el registro en el historial: ${
            e instanceof Error ? e.message : "Error desconocido"
          }`
        );
      }
    },
    [addOrUpdate]
  );

  // 🛑 RE-AÑADIDO: API Handler para Descargar un Registro (Mantenido, funciona correctamente)
  const handleDownloadHistoryRecord = async (id: string, label: string) => {
    try {
      // 1. Llamar a la API para obtener la respuesta (Response)
      const response = await api.history.download(id);

      if (!response.ok) {
        // Esto captura el 404 de la función Netlify si el ID no existe
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          // Ignorar si el cuerpo no es JSON (ej. cuerpo vacío)
        }
        throw new Error(`Error al descargar: ${errorMessage}`);
      }

      // 2. Obtener el contenido como Blob (datos binarios)
      const blob = await response.blob();

      // 3. Crear un enlace temporal para forzar la descarga en el navegador
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      // Configurar el nombre del archivo
      a.download = `${label.replace(/ /g, "_")}_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      a.href = url;

      // 4. Simular un clic y limpiar
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      console.log(`Archivo ${label} descargado correctamente.`);
    } catch (error) {
      console.error("Fallo al generar o descargar el archivo:", error);
      alert(
        `No se pudo descargar el archivo. Error: ${(error as Error).message}`
      );
    }
  };

  const handleBulkUpdateInventoryItems = useCallback(
    async (updates: { name: string; stock: number }[], mode: "set" | "add") => {
      const updateMap = new Map(
        updates.map((u) => [u.name.toLowerCase(), u.stock])
      );
      // Definir zeroedStock aquí para uso local
      const zeroedStock = INVENTORY_LOCATIONS.reduce(
        (acc, loc) => ({ ...acc, [loc]: 0 }),
        {}
      );

      setInventoryItems((prevItems) => {
        return prevItems.map((item) => {
          const updateItem = updates.find(
            (u) => u.name.toLowerCase() === item.name.toLowerCase()
          );
          if (!updateItem) return item;

          const newStockValue = updateItem.stock;

          // Caso 1: Reset completo (stock: 0 y mode: 'set' desde el botón Reset o Análisis)
          if (mode === "set" && newStockValue === 0) {
            // Si la intención es resetear, borramos todo en todas las ubicaciones.
            return { ...item, stockByLocation: zeroedStock };
          }

          // Caso 2: Actualización de stock (se asume que los updates externos siempre se dirigen a 'Almacén')

          const currentStockInAlmacen = item.stockByLocation["Almacén"] || 0;
          let finalStock;

          if (mode === "set") {
            // Reemplaza el stock existente en Almacén
            finalStock = newStockValue;
          } else {
            // Añade al stock existente en Almacén
            finalStock = currentStockInAlmacen + newStockValue;
          }

          // 🛑 LÓGICA CORRECTA: Preservar el stock de todas las demás ubicaciones (Rest, B1, Nevera, etc.)
          // Solo actualizamos "Almacén". Esto asegura que las ubicaciones introducidas manualmente
          // a través de la tabla se mantengan hasta el próximo reset.
          const newStockByLocation = {
            ...item.stockByLocation,
            Almacén: finalStock,
          };
          return { ...item, stockByLocation: newStockByLocation };
        });
      });

      // 💥 AÑADIDO: Llamar a la API para persistir el cambio en el servidor
      const updatesWithMode = updates.map((u) => ({ ...u, mode }));
      try {
        await api.inventory.bulkUpdate(updatesWithMode);
      } catch (e) {
        console.error("Error al persistir el cambio de stock masivo:", e);
        alert(
          "Error al guardar los cambios de stock en el servidor. Revise la consola."
        );
      }
    },
    []
  );

  // --- FUNCIÓN DE UTILIDAD: Resetear a 0 el stock FÍSICO (Definida en App.tsx) ---
  const handleResetInventoryStocks = useCallback(() => {
    if (
      !window.confirm(
        "ADVERTENCIA: Esta acción pondrá TODO el stock físico (en todas las ubicaciones) a 0. ¿Desea continuar?"
      )
    ) {
      return;
    }

    const updatesToReset: { name: string; stock: number }[] =
      inventoryItems.map((item) => ({
        name: item.name,
        stock: 0,
      }));

    if (updatesToReset.length > 0) {
      handleBulkUpdateInventoryItems(updatesToReset, "set");
    } else {
      alert("No hay artículos en el inventario para resetear.");
    }
  }, [inventoryItems, handleBulkUpdateInventoryItems]);

  // 🛑 CORRECCIÓN 3: Carga inicial de datos y Lógica de Siembra de Inventario
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Crear mapa de precios locales
      const itemPriceMap = new Map(
        initialInventoryItems.map((item) => [
          item.id,
          item.pricePerUnitWithoutIVA,
        ])
      );

      try {
        // 2. Fetch Inventory Items
        const items = (await api.inventory.list()) as InventoryItem[];
        let finalItems = items;

        if (items.length === 0) {
          // SEEDING LOGIC: Si la DB está vacía, guarda todo
          console.log("Database is empty. Seeding initial inventory...");
          const seedPromises = initialInventoryItems.map((item) =>
            api.inventory.save(item)
          );
          finalItems = (await Promise.all(seedPromises)) as InventoryItem[];
        } else {
          // --- 🚀 NUEVA LÓGICA: Sincronización de Material Faltante ---
          // Buscamos los artículos que tengan la categoría "📦 Material" en tu lista local
          const materialToSync = initialInventoryItems.filter(
            (i) => i.category === "📦 Material"
          );

          for (const materialItem of materialToSync) {
            // Si el nombre no existe en los items que vienen de la base de datos, lo guardamos
            const exists = items.some(
              (dbItem) => dbItem.name === materialItem.name
            );
            if (!exists) {
              console.log(`Sincronizando artículo nuevo: ${materialItem.name}`);
              const savedItem = await api.inventory.save(materialItem);
              items.push(savedItem as InventoryItem); // Lo añadimos a la lista actual
            }
          }
          // -----------------------------------------------------------

          // Fusionar precios locales con datos cargados de la DB
          finalItems = items.map((item) => {
            const seedPrice = itemPriceMap.get(item.id);
            if (
              seedPrice !== undefined &&
              (item.pricePerUnitWithoutIVA === undefined ||
                item.pricePerUnitWithoutIVA === 0)
            ) {
              return { ...item, pricePerUnitWithoutIVA: seedPrice };
            }
            return item;
          });
        }

        setInventoryItems(finalItems);

        // 3. Fetch Purchase Orders
        const orders = (await api.orders.list()) as PurchaseOrder[];
        setPurchaseOrders(orders);

        // 4. Fetch Inventory History
        const history = (await api.history.list()) as InventoryRecord[];
        setInventoryHistory(history);
      } catch (e) {
        console.error("Error loading initial data:", e);
        alert(
          `Error al cargar la información inicial de la base de datos: ${
            (e as Error).message
          }`
        );
      }
    };
    loadInitialData();
  }, [initialInventoryItems]); // Eliminamos addOrUpdate de dependencias si no se usa dentro

  const renderContent = () => {
    // Solo renderiza el componente de Inventario
    return (
      <InventoryComponent
        inventoryItems={inventoryItems}
        purchaseOrders={purchaseOrders}
        suppliers={uniqueSuppliers}
        onSaveInventoryItem={handleSaveInventoryItem} // 🛑 CORREGIDO: Usar el handler con API
        onDeleteInventoryItem={handleDeleteInventoryItem} // 🛑 CORREGIDO: Usar el handler con API
        onSavePurchaseOrder={handleSavePurchaseOrder}
        onDeletePurchaseOrder={handleDeletePurchaseOrder}
        onBulkUpdateInventoryItems={handleBulkUpdateInventoryItems}
        inventoryHistory={inventoryHistory}
        onSaveInventoryRecord={handleSaveInventoryRecord}
        onDeleteAllInventoryRecords={handleDeleteAllHistoryRecords}
        onDeleteInventoryRecord={handleDeleteInventoryRecord} // <-- AÑADIDO: Se pasa el nuevo handler
        onDownloadHistoryRecord={handleDownloadHistoryRecord} // PASADO
        activeTab={activeView}
        formatUTCToLocal={formatUTCToLocal}
        handleResetInventoryStocks={handleResetInventoryStocks}
      />
    );
  };

  const navClasses = (view: View) =>
    `px-3 py-2 text-xs rounded-md transition-colors duration-200 ${
      activeView === view
        ? "bg-violet-600 text-white shadow-lg"
        : "text-slate-300 hover:bg-slate-700 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* 1. Contenedor Sticky Superior (Título y Pestañas) */}
      <nav className="bg-slate-900/80 backdrop-blur-sm shadow-lg sticky top-0 z-30 border-b border-slate-800">
        {" "}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col">
            {/* Fila del Título y Hamburguesa */}
            <div className="flex items-center justify-between h-16">
              <div className="flex-shrink-0 text-violet-400 font-bold text-xl">
                Control de Stock y Pedidos
              </div>

              {/* 🛑 BOTÓN DE HAMBURGUESA PARA MÓVIL (VISIBLE SOLO EN PANTALLAS PEQUEÑAS) */}
              <div className="-mr-2 flex md:hidden">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  type="button"
                  className="bg-slate-800 inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white"
                  aria-controls="mobile-menu"
                  aria-expanded="false"
                >
                  <span className="sr-only">Open main menu</span>
                  {isMenuOpen ? <XIcon /> : <MenuIcon />}
                </button>
              </div>

              {/* PESTAÑAS VISIBLES EN DESKTOP (md:block) */}
              <div className="hidden md:flex items-baseline space-x-4">
                {navItemsFull.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={navClasses(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* 🛑 MENÚ DESPLEGABLE MÓVIL (Muestra las pestañas verticalmente) */}
        {isMenuOpen && (
          <div className="md:hidden" id="mobile-menu">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItemsFull.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`${navClasses(item.id)} block w-full text-left`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* 2. Contenido Principal */}
      <main className="flex-grow pt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {renderContent()}
        </div>
      </main>

      <footer className="bg-slate-900 text-center py-6 text-slate-500 text-sm border-t border-slate-800">
        © 2025 App Inventary. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
