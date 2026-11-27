import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { APP_VERSION, UPDATES_HISTORY } from "./src/data/updatesHistory";
import { normalizeExtractedPayroll, validateExtractedPayroll } from "./src/utils/payrollValidation";
import firebaseConfig from "./firebase-applet-config.json";

const app = express();
const PORT = 3000;
app.set("trust proxy", 1);

// Set up payload limits for OCR image uploads
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

// =========================================================================
// Security: Firebase ID Token Verification (JWKS) & Rate Limiting
// =========================================================================

const FIREBASE_PROJECT_ID = firebaseConfig?.projectId || process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ADMIN_EMAILS = new Set([
  "angel2martinez92@gmail.com",
  "gelo.mm92@gmail.com",
]);

interface VerifiedAuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

let cachedJwks: Map<string, crypto.KeyObject> = new Map();
let cachedJwksExpiresAt = 0;

async function fetchFirebaseJwks(forceRefresh = false): Promise<Map<string, crypto.KeyObject>> {
  const now = Date.now();
  if (!forceRefresh && cachedJwks.size > 0 && now < cachedJwksExpiresAt) {
    return cachedJwks;
  }

  const res = await fetch(FIREBASE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Could not fetch Firebase JWKS (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 3600 * 1000;

  const body = (await res.json()) as { keys?: Array<Record<string, unknown>> };
  const nextMap = new Map<string, crypto.KeyObject>();
  if (Array.isArray(body?.keys)) {
    for (const jwk of body.keys) {
      if (typeof jwk.kid === "string") {
        try {
          const keyObj = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
          nextMap.set(jwk.kid, keyObj);
        } catch {
          // Skip malformed key
        }
      }
    }
  }

  if (nextMap.size > 0) {
    cachedJwks = nextMap;
    cachedJwksExpiresAt = now + ttlMs;
  }
  return cachedJwks;
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const jsonStr = Buffer.from(segment, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedAuthUser | null> {
  if (!token || !FIREBASE_PROJECT_ID) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);
  if (!header || !payload) return null;

  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  const aud = typeof payload.aud === "string" ? payload.aud : "";
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";

  if (!sub || aud !== FIREBASE_PROJECT_ID || iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    return null;
  }
  if (exp <= nowSec || iat > nowSec + 300) {
    return null;
  }

  let keys = await fetchFirebaseJwks(false);
  let pubKey = keys.get(header.kid);
  if (!pubKey) {
    keys = await fetchFirebaseJwks(true);
    pubKey = keys.get(header.kid);
  }
  if (!pubKey) return null;

  const signature = Buffer.from(sigB64, "base64url");
  const isValidSig = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    pubKey,
    signature
  );
  if (!isValidSig) return null;

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const emailVerified = payload.email_verified === true;

  return {
    uid: sub,
    email,
    emailVerified,
    isAdmin: emailVerified && ADMIN_EMAILS.has(email),
  };
}

function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function getRequestUser(req: express.Request): Promise<VerifiedAuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    return null;
  }
}

async function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: "Autenticación requerida." });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ error: "Acceso restringido a administradores." });
  }
  return next();
}

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(options: { windowMs: number; max: number }) {
  const buckets = new Map<string, RateBucket>();
  let lastSweep = Date.now();

  return (key: string): { allowed: boolean; retryAfterSec: number } => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [k, b] of buckets.entries()) {
        if (b.resetAt <= now) buckets.delete(k);
      }
      lastSweep = now;
    }

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }

    if (current.count >= options.max) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  };
}

const ocrAuthLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });
const ocrGuestLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 6 });
const suggestionSubmitLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// Initialize Gemini Client
const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Active recommended Gemini models with graceful fallback on transient bottlenecks (503/429)
const FALLBACK_MODELS = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

const THINKING_SUPPORTED_MODELS = new Set(["gemini-4-hydrogen", "gemini-4-neon"]);

async function generateContentWithRetry(params: any, maxRetries = 4, initialDelay = 1500) {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const modelToUse = FALLBACK_MODELS[(attempt - 1) % FALLBACK_MODELS.length] || params.model || "gemini-4-hydrogen";
    try {
      let configToUse = params.config;
      if (configToUse && configToUse.thinkingConfig && !THINKING_SUPPORTED_MODELS.has(modelToUse)) {
        const { thinkingConfig: _omitThinking, ...restConfig } = configToUse;
        configToUse = restConfig;
      }
      return await ai.models.generateContent({
        ...params,
        model: modelToUse,
        ...(configToUse ? { config: configToUse } : {}),
      });
    } catch (error: any) {
      console.warn(`[Gemini Retry Handler] Attempt ${attempt}/${maxRetries} (${modelToUse}) failed:`, error.message || error);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.8, 8000);
    }
  }
  throw new Error("All retry attempts failed.");
}

// Function to parse raw Gemini errors and return a human-friendly Spanish message
function getFriendlyErrorMessage(err: any): string {
  const msg = err.message || String(err);
  
  if (typeof msg === 'string') {
    const trimmed = msg.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const innerError = parsed.error || parsed.ERROR || parsed;
        const code = innerError.code || innerError.CODE;
        const innerMessage = innerError.message || innerError.MESSAGE || "";
        const status = innerError.status || innerError.STATUS;
        
        if (code === 503 || status === "UNAVAILABLE" || innerMessage.toLowerCase().includes("high demand") || innerMessage.toLowerCase().includes("experiencing high demand") || innerMessage.toLowerCase().includes("temporary") || innerMessage.toLowerCase().includes("spikes in demand")) {
          return "El servicio de Inteligencia Artificial (Gemini) está experimentando una alta demanda temporal. Por favor, espera unos minutos e inténtalo de nuevo.";
        }
        if (code === 429 || status === "RESOURCE_EXHAUSTED" || innerMessage.toLowerCase().includes("quota") || innerMessage.toLowerCase().includes("limit")) {
          return "Se ha superado el límite de solicitudes de la Inteligencia Artificial. Por favor, inténtalo de nuevo en un minuto.";
        }
        if (code === 400 && innerMessage.toLowerCase().includes("api key")) {
          return "La clave de la API (GEMINI_API_KEY) es inválida o no está configurada correctamente.";
        }
        if (innerMessage) {
          return `Error de la Inteligencia Artificial: ${innerMessage}`;
        }
      } catch (e) {
        // Fallback to text matching if JSON parsing fails
      }
    }

    const msgLower = msg.toLowerCase();
    if (msgLower.includes("503") || msgLower.includes("unavailable") || msgLower.includes("high demand") || msgLower.includes("spikes in demand") || msgLower.includes("temporary")) {
      return "El servicio de Inteligencia Artificial (Gemini) está experimentando una alta demanda temporal. Por favor, espera unos minutos e inténtalo de nuevo.";
    }
    if (msgLower.includes("429") || msgLower.includes("resource_exhausted") || msgLower.includes("quota") || msgLower.includes("limit")) {
      return "Se ha superado el límite de solicitudes de la Inteligencia Artificial. Por favor, inténtalo de nuevo en un minuto.";
    }
    if (msgLower.includes("api key") || msgLower.includes("key not found") || msgLower.includes("unauthorized") || msgLower.includes("403")) {
      return "La clave de la API (GEMINI_API_KEY) no está configurada correctamente o es inválida.";
    }
  }

  return "No se pudo procesar el documento. Por favor, inténtalo de nuevo en unos momentos.";
}

// Helper to parse base64 image data and detect mimeType dynamically
function parseBase64Image(base64: string) {
  let mimeType = "image/png";
  let cleanedData = base64;

  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1] || "image/png";
      cleanedData = match[2];
    } else if (base64.includes(",")) {
      cleanedData = base64.split(",")[1];
    }
  } else if (base64.includes(",")) {
    cleanedData = base64.split(",")[1];
  }

  return {
    inlineData: {
      data: cleanedData,
      mimeType: mimeType
    }
  };
}

// Helper to parse base64 PDF data into inlineData part
function parseBase64Pdf(base64: string) {
  let cleanedData = base64.trim();
  if (cleanedData.startsWith("data:")) {
    const match = cleanedData.match(/^data:[^;]+;base64,(.+)$/);
    if (match) {
      cleanedData = match[1];
    } else if (cleanedData.includes(",")) {
      cleanedData = cleanedData.split(",")[1];
    }
  } else if (cleanedData.includes(",")) {
    cleanedData = cleanedData.split(",")[1];
  }

  return {
    inlineData: {
      data: cleanedData,
      mimeType: "application/pdf"
    }
  };
}

// Endpoint to process shift image OCR
app.post("/api/ocr/shifts", async (req, res) => {
  try {
    const authUser = await getRequestUser(req);
    const limitResult = authUser
      ? ocrAuthLimiter(`uid:${authUser.uid}`)
      : ocrGuestLimiter(`ip:${getClientIp(req)}`);
    if (!limitResult.allowed) {
      res.setHeader("Retry-After", String(limitResult.retryAfterSec));
      return res.status(429).json({
        error: "Has alcanzado el límite temporal de lecturas OCR. Espera unos minutos o inicia sesión para ampliar tu cuota."
      });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const { base64Images, monthContext } = req.body || {};
    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return res.status(400).json({ error: "Missing base64Images array." });
    }
    if (base64Images.length > 15) {
      return res.status(400).json({ error: "Puedes analizar un máximo de 15 capturas por petición." });
    }
    if (!base64Images.every((item: unknown) => typeof item === "string" && item.length > 0)) {
      return res.status(400).json({ error: "Formato de imagen no válido." });
    }

    const safeMonthContext = typeof monthContext === "string" ? monthContext.slice(0, 80) : "este mes";

    const prompt = `
      Analiza detenidamente estas capturas de pantalla de la aplicación de turnos de trabajo (ej: "AZUL HANDLING" o similares) para el contexto de mes/año: "${safeMonthContext}".
      Extrae la lista completa de todos los días y sus turnos visibles en las imágenes.

      FORMATO Y ESTRUCTURA DE LAS TARJETAS / FILAS:
      - Cada día suele mostrarse en una tarjeta con la fecha (ej: "Lunes, 17 de Agost.", "Martes, 18 de Agost.", "Miércoles, 19 de Agost.", "17 de Agosto", "L17", "17/08", etc.).
      - Si el día es libre/descanso, dirá "Libre", "LIBRE", "DESCANSO", "L", "V" o mostrará un icono de verificación verde. En este caso:
        "isLibre": true, "startTime": "", "endTime": "".
      - Si el día tiene turno de trabajo, mostrará las horas de inicio y fin (ej: "04:45 - 12:45", "18:00 - 02:00", "08:00 - 16:00", etc.).
        "isLibre": false, "startTime": "HH:mm", "endTime": "HH:mm".
      - Si hay un día con jornada partida (múltiples tramos como "08:00 - 12:00" y "16:00 - 20:00"), genera una entrada para cada tramo con la misma fecha.

      CÁLCULO DE LA FECHA (FORMATO YYYY-MM-DD):
      - Para el año y mes:
        * Si el texto menciona el mes o abreviatura (ej: "Agost.", "Agosto", "Ene.", "Feb.", "Mar.", "Abr.", "May.", "Jun.", "Jul.", "Sept.", "Oct.", "Nov.", "Dic."), determina el número de mes correspondiente.
        * Asigna el año basándote en el contexto "${safeMonthContext}" o el año actual si no se especifica.
      - Para el día: Extrae el número de día correspondiente.
      - Ejemplo: "Lunes, 17 de Agost." con contexto "Agosto 2026" produce "2026-08-17".

      Devuelve un array de objetos estricto.
    `;

    const imageParts = base64Images.map((base64: string) => parseBase64Image(base64));

    const response = await generateContentWithRetry({
      model: "gemini-4-hydrogen",
      contents: [
        {
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista de turnos extraídos",
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD" },
              startTime: { type: Type.STRING, description: "Hora de inicio HH:mm o vacía si es libre" },
              endTime: { type: Type.STRING, description: "Hora de fin HH:mm o vacía si es libre" },
              isLibre: { type: Type.BOOLEAN, description: "True si el día es libre o de descanso" }
            },
            required: ["date", "startTime", "endTime", "isLibre"]
          }
        }
      }
    });

    const text = response.text || "[]";
    let result = [];
    try {
      result = JSON.parse(text.trim());
    } catch (e) {
      const cleanText = text.replace(/```json|```/g, "").trim();
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No se pudo estructurar el formato JSON de los turnos");
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error("Error in server shift OCR:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

const PAYROLL_SYSTEM_INSTRUCTION = `Eres un auditor contable experto en nóminas españolas y del sector de handling aeroportuario (convenio de handling, Azul Handling y empresas similares).

REGLAS ESTRICTAS DE EXTRACCIÓN:
1. Formato numérico español: Convierte SIEMPRE los números españoles al formato JSON estándar con punto decimal (ej. "1.234,56" -> 1234.56; "-45,20" -> -45.20; "4,70%" -> 4.70). Nunca confundas el punto de miles con separador decimal.
2. Separación estricta Devengos vs Deducciones:
   - En "devengos" incluye ÚNICAMENTE percepciones salariales y no salariales (Salario Base, Nocturnidad, Horas Nocturnas, Madrugue, Festivos, Domingos, Manutención, Turnicidad, Jornada Fraccionada, Horas Perentorias, Horas Complementarias, Prorrata Pagas Extras, Paga Extra, Plus Transporte, Teamleader, ARCO, RCO, Duty, Productividad, IT / Prestaciones, etc.).
   - Si en la columna de devengos aparece un concepto con importe NEGATIVO (ej. regularizaciones, atrasos negativos, absentismo o descuentos aplicados dentro de devengos), MANTÉN su signo negativo en "devengos".
   - En "deducciones" incluye ÚNICAMENTE las retenciones y aportaciones del trabajador (Contingencias Comunes, Desempleo, Formación Profesional, MEI, Horas Extras SS, IRPF / Retención IRPF, Cuota Sindical, Anticipos, Embargos, etc.). Todos los importes en "deducciones" deben ser números POSITIVOS (si aparecen con signo "-" en el documento, conviértelos a positivo).
3. NO incluir filas de totales ni bases informativas dentro de los arrays:
   - NUNCA metas en "devengos" ni en "deducciones" las líneas de "TOTAL DEVENGADO", "A. TOTAL DEVENGADO", "TOTAL A DEDUCIR", "B. TOTAL A DEDUCIR", "LÍQUIDO TOTAL A PERCIBIR", "BASE COTIZACIÓN", "BASE IRPF", "APORTACIÓN EMPRESA" o "COSTE EMPRESA".
   - Los totales finales deben ir únicamente en "totalDevengados", "totalDeducciones" y "liquido".
4. Varias páginas o capturas: Si se adjuntan varias páginas PDF o varias capturas de pantalla de la misma nómina (por ejemplo, parte superior con devengos y parte inferior con deducciones y líquido), combínalas sin duplicar líneas repetidas que aparezcan solapadas entre dos capturas.
5. Verificación matemática obligatoria antes de responder:
   - Comprueba internamente que: suma(devengos.importe) ≈ totalDevengados
   - Comprueba internamente que: suma(deducciones.importe) ≈ totalDeducciones
   - Comprueba internamente que: totalDevengados - totalDeducciones ≈ liquido
   - Si detectas una fila omitida o un dígito mal leído (por ejemplo 3 vs 8, 1 vs 7, coma desplazada), corrígelo leyendo de nuevo la columna exacta del documento antes de emitir el JSON.`;

const PAYROLL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    devengos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          concepto: { type: Type.STRING, description: "Nombre exacto del concepto devengado" },
          unidades: { type: Type.STRING, description: "Cantidad, días u horas si aparecen en la fila" },
          precio: { type: Type.NUMBER, description: "Precio unitario si aparece en la fila" },
          importe: { type: Type.NUMBER, description: "Importe del concepto (puede ser negativo en regularizaciones)" }
        },
        required: ["concepto", "importe"]
      }
    },
    deducciones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          concepto: { type: Type.STRING, description: "Nombre exacto de la deducción o retención" },
          base: { type: Type.NUMBER, description: "Base de cotización o sujeta a IRPF si aparece" },
          tipo: { type: Type.NUMBER, description: "Porcentaje aplicado (ej. 4.7, 12.5) si aparece" },
          importe: { type: Type.NUMBER, description: "Importe deducido expresado siempre en positivo" }
        },
        required: ["concepto", "importe"]
      }
    },
    totalDevengados: { type: Type.NUMBER, description: "Total devengado oficial impreso en la nómina" },
    totalDeducciones: { type: Type.NUMBER, description: "Total a deducir oficial impreso en la nómina (en positivo)" },
    liquido: { type: Type.NUMBER, description: "Líquido total a percibir impreso en la nómina" }
  },
  required: ["devengos", "deducciones", "totalDevengados", "totalDeducciones", "liquido"]
};

function safeParseJsonResponse(rawText: string): any {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// Endpoint to process payroll OCR
app.post("/api/ocr/payroll", async (req, res) => {
  try {
    const authUser = await getRequestUser(req);
    const limitResult = authUser
      ? ocrAuthLimiter(`uid:${authUser.uid}`)
      : ocrGuestLimiter(`ip:${getClientIp(req)}`);
    if (!limitResult.allowed) {
      res.setHeader("Retry-After", String(limitResult.retryAfterSec));
      return res.status(429).json({
        error: "Has alcanzado el límite temporal de análisis de nóminas. Espera unos minutos o inicia sesión para ampliar tu cuota."
      });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const { text, monthContext, base64Images, pdfDocuments, strictRetry } = req.body || {};

    const validImages = Array.isArray(base64Images)
      ? base64Images
          .filter((item: unknown): item is string => typeof item === "string" && item.length > 0 && item.length <= 12_000_000)
          .slice(0, 10)
      : [];

    const validPdfs = Array.isArray(pdfDocuments)
      ? pdfDocuments
          .map((item: unknown) => {
            if (typeof item === "string") return { data: item, name: "nomina.pdf" };
            if (item && typeof item === "object" && typeof (item as any).data === "string") {
              return {
                data: (item as any).data as string,
                name: typeof (item as any).name === "string" ? (item as any).name.slice(0, 120) : "nomina.pdf",
              };
            }
            return null;
          })
          .filter((item): item is { data: string; name: string } => Boolean(item && item.data.length > 0 && item.data.length <= 15_000_000))
          .slice(0, 4)
      : [];

    const truncatedText = typeof text === "string" ? text.trim().slice(0, 20000) : "";

    if (!truncatedText && validImages.length === 0 && validPdfs.length === 0) {
      return res.status(400).json({ error: "Debes proporcionar un PDF, capturas de pantalla o texto de la nómina." });
    }

    const safeMonthContext = typeof monthContext === "string" ? monthContext.slice(0, 80) : "este mes";
    const pdfParts = validPdfs.map((pdf) => parseBase64Pdf(pdf.data));
    const imageParts = validImages.map((base64: string) => parseBase64Image(base64));
    const mediaParts = [...pdfParts, ...imageParts];

    const sourceSummaryParts: string[] = [];
    if (validPdfs.length > 0) sourceSummaryParts.push(`${validPdfs.length} PDF original(es)`);
    if (validImages.length > 0) sourceSummaryParts.push(`${validImages.length} captura(s) de pantalla`);
    if (truncatedText) sourceSummaryParts.push("texto auxiliar extraído");

    const pass1Prompt = `Analiza los documentos adjuntos (${sourceSummaryParts.join(", ")}) y extrae con precisión contable todos los conceptos económicos de la nómina correspondiente a: "${safeMonthContext}".
Si el documento contiene nóminas de varios meses, PRIORIZA exclusivamente los datos de "${safeMonthContext}".
${validPdfs.length > 0 ? "Lee directamente las tablas y columnas de los PDF adjuntos para mantener la alineación exacta entre concepto, unidades, precio/tipo e importe." : ""}
${validImages.length > 0 ? "Revisa todas las capturas adjuntas de arriba abajo; si dos capturas solapan alguna fila, inclúyela una sola vez." : ""}
${truncatedText ? `\nTexto auxiliar de referencia (úsalo solo como apoyo si alguna cifra visual no está clara):\n${truncatedText}` : ""}`;

    const pass1Response = await generateContentWithRetry({
      model: "gemini-4-hydrogen",
      contents: [{
        parts: [
          ...mediaParts,
          { text: pass1Prompt }
        ]
      }],
      config: {
        systemInstruction: PAYROLL_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: PAYROLL_RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingLevel: strictRetry ? ThinkingLevel.XHIGH : ThinkingLevel.HIGH,
        },
      }
    });

    const pass1Raw = safeParseJsonResponse(pass1Response.text || "{}");
    let bestPayload = normalizeExtractedPayroll(pass1Raw);
    let bestValidation = validateExtractedPayroll(bestPayload);

    const hasSomeExtractedData =
      bestPayload.devengos.length > 0 ||
      bestPayload.deducciones.length > 0 ||
      bestPayload.totalDevengados !== 0 ||
      bestPayload.liquido !== 0;

    // Pass 2 automatic self-correction when accounting checks do not balance
    if (!bestValidation.isBalanced && hasSomeExtractedData) {
      try {
        const discrepancySummary = bestValidation.discrepancies
          .map((d) => `- ${d.label}: suma calculada = ${d.expected.toFixed(2)} €, valor en nómina = ${d.extracted.toFixed(2)} € (diferencia = ${d.diff.toFixed(2)} €)`)
          .join("\n");

        const pass2Prompt = `AUDITORÍA Y CORRECCIÓN (PASADA 2):
Tu extracción inicial de la nómina de "${safeMonthContext}" presenta los siguientes descuadres matemáticos:
${discrepancySummary}

JSON inicial extraído:
${JSON.stringify(bestPayload)}

Instrucciones de corrección:
1. Vuelve a revisar línea por línea los documentos adjuntos (PDF/capturas).
2. Busca conceptos omitidos, duplicados por solapamiento entre capturas, filas de totales metidas por error dentro de devengos/deducciones, signos mal leídos o dígitos confundidos (coma decimal, 3/8, 5/6, 1/7).
3. Devuelve el JSON completo CORREGIDO de modo que:
   - suma(devengos.importe) == totalDevengados
   - suma(deducciones.importe) == totalDeducciones
   - totalDevengados - totalDeducciones == liquido
No inventes cifras que no figuren en el documento: corrige únicamente leyendo con mayor atención los documentos originales.`;

        const pass2Response = await generateContentWithRetry({
          model: "gemini-4-hydrogen",
          contents: [{
            parts: [
              ...mediaParts,
              { text: pass2Prompt }
            ]
          }],
          config: {
            systemInstruction: PAYROLL_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: PAYROLL_RESPONSE_SCHEMA,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.XHIGH,
            },
          }
        }, 2, 1500);

        const pass2Raw = safeParseJsonResponse(pass2Response.text || "{}");
        const candidatePayload = normalizeExtractedPayroll(pass2Raw);
        const candidateValidation = validateExtractedPayroll(candidatePayload);

        if (candidateValidation.isBalanced || candidateValidation.totalError < bestValidation.totalError) {
          bestPayload = candidatePayload;
          bestValidation = {
            ...candidateValidation,
            autoCorrected: candidateValidation.isBalanced,
          };
        }
      } catch (pass2Error: any) {
        console.warn("[Payroll OCR Pass 2] Auto-correction skipped due to error:", pass2Error?.message || pass2Error);
      }
    }

    res.json({
      ...bestPayload,
      validation: bestValidation,
    });
  } catch (err: any) {
    console.error("Error in server payroll OCR:", err);
    res.status(500).json({ error: getFriendlyErrorMessage(err) });
  }
});

const SERVER_BOOT_TIME = Date.now();

// Deployment version endpoint for update detection (immediate notification on release)
app.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    version: APP_VERSION,
    buildTime: SERVER_BOOT_TIME,
    latestUpdate: UPDATES_HISTORY[0],
    isWednesdayReleaseDay: true,
    releasePolicy: "immediate"
  });
});

// Persistent file-backed store for received suggestions & admin notification settings
interface ServerSuggestion {
  id: string;
  userName: string;
  type: string;
  description: string;
  userEmail?: string;
  appVersion: string;
  createdAt: string;
  displayDate?: string;
  timestamp: number;
  screenshots?: string[];
}

const SUGGESTIONS_STORE_PATH = path.join(process.cwd(), ".turnom-suggestions.json");

let inMemorySuggestions: ServerSuggestion[] = [];
let suggestionSettings: { notifyEmail: boolean; updatedAt?: number } = {
  notifyEmail: true,
  updatedAt: 0
};

const loadSuggestionsFromDisk = () => {
  try {
    if (fs.existsSync(SUGGESTIONS_STORE_PATH)) {
      const raw = fs.readFileSync(SUGGESTIONS_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.suggestions)) {
        inMemorySuggestions = parsed.suggestions;
      }
      if (typeof parsed?.settings?.notifyEmail === "boolean") {
        suggestionSettings.notifyEmail = parsed.settings.notifyEmail;
      }
      if (typeof parsed?.settings?.updatedAt === "number") {
        suggestionSettings.updatedAt = parsed.settings.updatedAt;
      }
    }
  } catch (err) {
    console.warn("[Buzon TurNom] Could not load suggestions store from disk:", err);
  }
};

const saveSuggestionsToDisk = () => {
  try {
    fs.writeFileSync(
      SUGGESTIONS_STORE_PATH,
      JSON.stringify({ suggestions: inMemorySuggestions, settings: suggestionSettings }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.warn("[Buzon TurNom] Could not persist suggestions store to disk:", err);
  }
};

loadSuggestionsFromDisk();

app.get("/api/suggestion-settings", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json(suggestionSettings);
});

app.post("/api/suggestion-settings", requireAdmin, (req, res) => {
  const { notifyEmail, updatedAt } = req.body || {};
  if (typeof notifyEmail !== "boolean") {
    return res.status(400).json({ error: "Valor de configuración no válido." });
  }
  suggestionSettings.notifyEmail = notifyEmail;
  suggestionSettings.updatedAt = typeof updatedAt === "number" && !isNaN(updatedAt) ? updatedAt : Date.now();
  saveSuggestionsToDisk();
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.json({ success: true, settings: suggestionSettings });
});

// Endpoint to fetch suggestions (restricted to verified admins)
app.get("/api/suggestions", requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json(inMemorySuggestions);
});

// Endpoint to delete a suggestion by ID (restricted to verified admins)
app.delete("/api/suggestions/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || id.length > 128) {
    return res.status(400).json({ error: "Identificador no válido." });
  }
  const beforeLen = inMemorySuggestions.length;
  inMemorySuggestions = inMemorySuggestions.filter((item) => item.id !== id);
  if (inMemorySuggestions.length !== beforeLen) {
    saveSuggestionsToDisk();
  }
  return res.json({ success: true });
});

// Endpoint to receive suggestions from users and record them safely
app.post("/api/suggestions", async (req, res) => {
  try {
    const limitResult = suggestionSubmitLimiter(`ip:${getClientIp(req)}`);
    if (!limitResult.allowed) {
      res.setHeader("Retry-After", String(limitResult.retryAfterSec));
      return res.status(429).json({
        error: "Has enviado demasiadas sugerencias seguidas. Por favor, inténtalo de nuevo en unos minutos."
      });
    }

    const { id, userName, type, description, userEmail, appVersion, submittedAt, timestamp, screenshots } = req.body || {};
    
    if (!description || typeof description !== "string" || description.trim().length < 5) {
      return res.status(400).json({ error: "La descripción de la sugerencia debe tener al menos 5 caracteres." });
    }

    const cleanUserName = (userName && typeof userName === "string" && userName.trim()) ? userName.trim().slice(0, 100) : "Usuario anónimo";
    const cleanType = (type && typeof type === "string" && type.trim()) ? type.trim().slice(0, 50) : "Sugerencia";
    const cleanDesc = description.trim().slice(0, 5000);
    const cleanAppVersion = (appVersion && typeof appVersion === "string") ? appVersion.slice(0, 40) : APP_VERSION;
    const cleanUserEmail = (userEmail && typeof userEmail === "string") ? userEmail.slice(0, 200) : "No especificado / Sesión local";
    const cleanScreenshots = Array.isArray(screenshots)
      ? screenshots
          .filter((img): img is string => typeof img === "string" && img.startsWith("data:image/") && img.length <= 450000)
          .slice(0, 3)
      : [];
    const now = new Date();
    const createdAtIso = (submittedAt && typeof submittedAt === "string" && !isNaN(Date.parse(submittedAt)))
      ? submittedAt
      : now.toISOString();
    const ts = typeof timestamp === "number" && !isNaN(timestamp) ? timestamp : Date.parse(createdAtIso) || now.getTime();
    const dateFormatted = now.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
    const entryId = (id && typeof id === "string" && id.trim())
      ? id.trim()
      : `sug_${ts}_${Math.random().toString(36).substring(2, 6)}`;

    // Avoid duplicates if retried with same id
    inMemorySuggestions = inMemorySuggestions.filter((s) => s.id !== entryId);
    inMemorySuggestions.unshift({
      id: entryId,
      userName: cleanUserName,
      type: cleanType,
      description: cleanDesc,
      userEmail: cleanUserEmail,
      appVersion: cleanAppVersion,
      createdAt: createdAtIso,
      displayDate: dateFormatted,
      timestamp: ts,
      ...(cleanScreenshots.length > 0 ? { screenshots: cleanScreenshots } : {})
    });

    if (inMemorySuggestions.length > 200) {
      inMemorySuggestions = inMemorySuggestions.slice(0, 200);
    }

    saveSuggestionsToDisk();

    // Safe logging without user-supplied keywords that could be misidentified as crashes
    console.log(`[Buzon TurNom] Nueva propuesta registrada de ${cleanUserName}`);

    return res.json({
      success: true,
      id: entryId,
      message: "¡Sugerencia recibida con éxito!"
    });
  } catch (err: any) {
    console.warn("[Buzon TurNom] Incidencia al procesar registro:", err?.message || err);
    return res.status(500).json({ error: "No se pudo registrar la sugerencia en este momento." });
  }
});

// Custom Express error handler for /api routes to always return JSON instead of HTML
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API Middleware Error:", err);
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      error: "Las imágenes o archivos seleccionados son demasiado grandes. Por favor, sube menos fotos o recórtalas."
    });
  }
  return res.status(err.status || 500).json({
    error: getFriendlyErrorMessage(err) || "Error al procesar la solicitud en el servidor."
  });
});

// Vite / static middleware integration
async function integrateVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith("index.html") ||
            filePath.endsWith("sw.js") ||
            filePath.includes("registerSW") ||
            filePath.endsWith("manifest.webmanifest")
          ) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

integrateVite();
