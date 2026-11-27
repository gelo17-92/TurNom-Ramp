import { getAuthHeaders } from '../utils/authHeaders';
import type { ExtractedPayrollPayload } from '../utils/payrollValidation';

export interface PayrollPdfDocument {
  data: string;
  name?: string;
}

export interface ExtractPayrollOptions {
  text?: string;
  monthContext: string;
  base64Images?: string[];
  pdfDocuments?: PayrollPdfDocument[];
  strictRetry?: boolean;
  signal?: AbortSignal;
}

export const extractPayrollData = async (
  options: ExtractPayrollOptions
): Promise<ExtractedPayrollPayload> => {
  const { text = '', monthContext, base64Images = [], pdfDocuments = [], strictRetry = false, signal } = options;
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });

  const response = await fetch('/api/ocr/payroll', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      monthContext,
      base64Images,
      pdfDocuments,
      strictRetry,
    }),
    signal,
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let rawError = 'No se pudo procesar la nómina. Tiempo de espera agotado o error en la IA.';
    if (contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        rawError = errorData.error || rawError;
      } catch {
        // ignore JSON parse error
      }
    } else {
      if (response.status === 413) {
        rawError = 'El archivo o la imagen de la nómina es demasiado grande. Por favor, sube un archivo más pequeño o recorta la captura.';
      } else if (response.status === 502 || response.status === 504) {
        rawError = 'El servidor de la IA tardó demasiado en procesar la nómina. Inténtalo de nuevo.';
      } else if (response.status === 503) {
        rawError = 'El servicio de Inteligencia Artificial (Gemini) está experimentando alta demanda. Inténtalo de nuevo en un par de minutos.';
      }
    }

    const errStr = typeof rawError === 'string' ? rawError.toLowerCase() : JSON.stringify(rawError).toLowerCase();

    if (
      errStr.includes('503') ||
      errStr.includes('unavailable') ||
      errStr.includes('high demand') ||
      errStr.includes('temporary') ||
      errStr.includes('spikes in demand') ||
      errStr.includes('limit')
    ) {
      rawError = 'El servicio de Inteligencia Artificial (Gemini) está experimentando una alta demanda temporal. Por favor, espera unos minutos e inténtalo de nuevo.';
    }

    throw new Error(rawError);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Respuesta no válida del servidor al procesar la nómina. Por favor, inténtalo de nuevo.');
  }

  try {
    return (await response.json()) as ExtractedPayrollPayload;
  } catch {
    throw new Error('No se pudo interpretar la respuesta del servidor.');
  }
};
