import { getAuthHeaders } from '../utils/authHeaders';

export interface ExtractedShift {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isLibre: boolean;
}

export async function extractShiftsFromImages(base64Images: string[], monthContext: string, signal?: AbortSignal): Promise<ExtractedShift[]> {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/ocr/shifts", {
    method: "POST",
    headers,
    body: JSON.stringify({ base64Images, monthContext }),
    signal,
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMsg = "Error al procesar las capturas en el servidor";
    if (contentType.includes("application/json")) {
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
    } else {
      if (response.status === 413) {
        errorMsg = "Las imágenes son demasiado grandes. Por favor, sube menos fotos o recórtalas.";
      } else if (response.status === 502 || response.status === 504) {
        errorMsg = "El servidor de la IA tardó demasiado en responder. Inténtalo de nuevo.";
      } else if (response.status === 503) {
        errorMsg = "El servicio de Inteligencia Artificial está experimentando alta demanda. Inténtalo en un par de minutos.";
      }
    }
    throw new Error(errorMsg);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("Respuesta no válida del servidor. Por favor, vuelve a intentarlo.");
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error("No se pudo interpretar la respuesta del servidor.");
  }
}
