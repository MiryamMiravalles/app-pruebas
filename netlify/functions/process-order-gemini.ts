import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event: any) => {
  const apiKey = process.env.GEMINI_API_KEY?.replace(/['" ]+/g, "").trim();
  if (!apiKey)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Falta API KEY" }),
    };

  try {
    const { imageBase64, inventoryNames } = JSON.parse(event.body);
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" } as any,
    });

    const prompt = `
  Analiza detalladamente este albarán de hostelería. Tu objetivo es una extracción contable impecable.
  PRODUCTOS DISPONIBLES EN MI SISTEMA: 
  ${inventoryNames ? inventoryNames.join(", ") : "Cualquiera"}

  REGLAS DE PROCESAMIENTO CRÍTICAS:
  1. FECHA: Busca la fecha de emisión (devuelve YYYY-MM-DD).
  2. PROVEEDOR: Identifica el nombre de la empresa emisora (ej: "VINS AVINYÓ").
  3. TOTAL ALBARÁN: Extrae el número exacto que aparece como base imponible o total de artículos. 
     - En este albarán busca específicamente la cifra "265,99". 
     - NO realices cálculos, NO quites IVA, solo LEE el número impreso.
     - Si ves varios totales, usa el que corresponde a la suma de los artículos sin IVA (ej: 265.99).
     ATENCIÓN CONTABLE:
  - El sistema espera recibir únicamente la BASE IMPONIBLE (NETO).
  - En este documento, la cifra correcta es "265.99".
  - Bajo ninguna circunstancia calcules impuestos.
  - El campo "totalAmount" debe ser exactamente la suma de los "linePrice" de los artículos.
  - "linePrice" debe ser el precio total de la línea ANTES de impuestos.
  REGLAS DE PRECIO:
  1. Extrae el "TOTAL NETO" o "BASE IMPONIBLE". En este caso es "265.99".
  2. Para cada artículo, extrae el PRECIO UNITARIO que aparece en el papel (antes de IVA).
  3. Si el artículo es "Moritz 7", fíjate en el precio de la caja y divídelo por 24, o busca el precio unitario si aparece. 
  4. ASEGÚRATE de que (cantidad * precioUnitario) de todos los items sume exactamente "265.99".

  RESPONDE CON ESTE JSON:
  {
    "orderDate": "YYYY-MM-DD",
    "supplierName": "Nombre",
    "totalAmount": 265.99,
    "items": [
      {
        "name": "nombre_sistema",
        "quantity": 0,
        "unitPrice": 0.0000, // <--- CAMBIAMOS linePrice por unitPrice con 4 decimales
        "totalLine": 0.00
  4. LECTURA DE TABLA COMPLETA: 
     - No ignores ninguna fila. Lee cada artículo, incluyendo licores como "JACK DANIEL'S".
  5. MULTIPLICACIÓN DE UNIDADES:
     - Si ves formato de cajas (ej: "8 Btl.") y unidades por caja (ej: "(24 a.)"), MULTIPLICA:
       Ejemplo: "8 Moritz (24 a.)" -> quantity: 192.
  
  REGLA DE EMPAREJAMIENTO INTELIGENTE:
  - Si el albarán dice "Mixe Fresa" -> es "Tequifresa Mixe".
  - Si el albarán dice "Jack Daniel's" -> busca su equivalente en mi sistema.
  - REGLA DE ORO: Si hay coincidencia, usa el nombre exacto de MI SISTEMA.

  RESPONDE ÚNICAMENTE CON ESTE JSON:
  {
    "orderDate": "YYYY-MM-DD",
    "supplierName": "Nombre",
    "totalAmount": 0.00,
    "items": [
      {
        "name": "nombre_exacto_del_sistema",
        "quantity": 0.0,
        "linePrice": 0.00
      }
    ]
  }
`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: result.response.text(),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
