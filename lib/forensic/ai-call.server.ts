/**
 * Appel unifié et résilient aux services IA du moteur VERITAS.
 *
 * Chaîne de repli (dans l'ordre) :
 *   1. Passerelle Lovable AI  (LOVABLE_API_KEY / AI_GATEWAY_API_KEY)
 *   2. Google AI Studio direct (GEMINI_API_KEY, en-tête x-goog-api-key)
 *
 * Chaque tentative est rejouée une fois sur 429 / 500 / 502 / 503 / 504
 * (erreurs transitoires) avec une courte attente. Les statuts terminaux
 * (400, 401, 402, 403, 404) passent immédiatement à la tentative suivante.
 * Aucune valeur de repli n'est inventée : en cas d'échec total, l'appelant
 * reçoit le dernier code d'erreur rencontré.
 */

type ChatMessage = {
  role: "system" | "user";
  content: unknown;
};

type GooglePart = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface AiCallSuccess {
  ok: true;
  content: string;
  model: string;
  provider: "gateway" | "google";
}

export interface AiCallFailure {
  ok: false;
  errorCode: string;
  detail: string;
}

export type AiCallResult = AiCallSuccess | AiCallFailure;

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function httpLabel(status: number): string {
  switch (status) {
    case 401:
      return "clé de service IA refusée (401)";
    case 402:
      return "crédits IA épuisés (402)";
    case 403:
      return "accès IA bloqué (403)";
    case 404:
      return "modèle IA introuvable (404)";
    case 429:
      return "quota dépassé (429)";
    case 503:
      return "service momentanément indisponible (503)";
    default:
      return `erreur HTTP ${status}`;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(
  provider: "gateway" | "google",
  endpoint: string,
  headers: Record<string, string>,
  model: string,
  messages: ChatMessage[],
): Promise<AiCallResult> {
  const body = JSON.stringify({
    model,
    messages,
    response_format: { type: "json_object" },
  });

  for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
    let res: Response;
    try {
      res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
    } catch {
      if (tryIndex === 0) {
        await sleep(800);
        continue;
      }
      return { ok: false, errorCode: "NETWORK", detail: "service IA inaccessible (réseau)" };
    }

    if (!res.ok) {
      if (RETRYABLE.has(res.status) && tryIndex === 0) {
        await sleep(res.status === 429 ? 1500 : 900);
        continue;
      }
      let providerDetail = "";
      try {
        const errorBody = (await res.json()) as { error?: { message?: string }; message?: string };
        providerDetail = errorBody.error?.message ?? errorBody.message ?? "";
      } catch {
        // La réponse d'erreur peut ne pas être du JSON.
      }
      return {
        ok: false,
        errorCode: `HTTP_${res.status}`,
        detail: providerDetail ? `${httpLabel(res.status)} : ${providerDetail.slice(0, 240)}` : httpLabel(res.status),
      };
    }

    let content = "";
    try {
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      content = json.choices?.[0]?.message?.content ?? "";
    } catch {
      return { ok: false, errorCode: "BAD_RESPONSE", detail: "réponse du service illisible" };
    }
    if (!content) return { ok: false, errorCode: "EMPTY_RESPONSE", detail: "réponse vide du service" };

    return { ok: true, content, model, provider };
  }

  return { ok: false, errorCode: "NETWORK", detail: "service IA inaccessible (réseau)" };
}

function toGoogleRequest(messages: ChatMessage[]) {
  const system = messages.find((message) => message.role === "system");
  const userMessages = messages.filter((message) => message.role === "user");
  const parts: GooglePart[] = [];
  for (const message of userMessages) {
    if (typeof message.content === "string") {
      parts.push({ text: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) continue;

    for (const part of message.content as unknown[]) {
      if (!part || typeof part !== "object") continue;
      const value = part as { type?: string; text?: string; image_url?: { url?: string } };
      if (value.type === "text" && value.text) {
        parts.push({ text: value.text });
      } else if (value.type === "image_url" && value.image_url?.url) {
        const match = /^data:([^;]+);base64,(.*)$/s.exec(value.image_url.url);
        if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
  }

  return {
    systemInstruction: system && typeof system.content === "string" ? { parts: [{ text: system.content }] } : undefined,
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json" },
  };
}

/** Modèles Google de secours, essayés dans l'ordre si le modèle demandé reste surchargé. */
const GOOGLE_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];

/** Attentes progressives entre tentatives (ms). 4 tentatives par modèle. */
const GOOGLE_BACKOFF = [700, 1800, 3500];

async function attemptGoogleModel(model: string, apiKey: string, body: string): Promise<AiCallResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  for (let tryIndex = 0; tryIndex < GOOGLE_BACKOFF.length + 1; tryIndex += 1) {
    const isLast = tryIndex === GOOGLE_BACKOFF.length;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
      });
    } catch {
      if (!isLast) {
        await sleep(GOOGLE_BACKOFF[tryIndex]!);
        continue;
      }
      return { ok: false, errorCode: "NETWORK", detail: "service IA inaccessible (réseau)" };
    }

    if (!res.ok) {
      if (RETRYABLE.has(res.status) && !isLast) {
        await sleep(res.status === 429 ? GOOGLE_BACKOFF[tryIndex]! * 2 : GOOGLE_BACKOFF[tryIndex]!);
        continue;
      }
      return { ok: false, errorCode: `HTTP_${res.status}`, detail: httpLabel(res.status) };
    }

    try {
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      return content
        ? { ok: true, content, model, provider: "google" }
        : { ok: false, errorCode: "EMPTY_RESPONSE", detail: "réponse vide du service" };
    } catch {
      return { ok: false, errorCode: "BAD_RESPONSE", detail: "réponse du service illisible" };
    }
  }

  return { ok: false, errorCode: "NETWORK", detail: "service IA inaccessible (réseau)" };
}

/**
 * Repli Google : le modèle demandé d'abord, puis les modèles de secours si le
 * service reste surchargé (503) ou saturé (429). Les statuts terminaux
 * (clé refusée, crédits, requête invalide) arrêtent immédiatement la chaîne.
 */
async function attemptGoogle(model: string, apiKey: string, messages: ChatMessage[]): Promise<AiCallResult> {
  const body = JSON.stringify(toGoogleRequest(messages));
  const models = [model, ...GOOGLE_FALLBACK_MODELS.filter((m) => m !== model)];

  let last: AiCallFailure = { ok: false, errorCode: "NETWORK", detail: "service IA inaccessible (réseau)" };
  for (const candidate of models) {
    const result = await attemptGoogleModel(candidate, apiKey, body);
    if (result.ok) return result;
    last = result;
    // 404 (modèle absent) et surcharge justifient d'essayer le modèle suivant ;
    // 400/401/402/403 sont terminaux.
    const status = Number(result.errorCode.replace("HTTP_", ""));
    const tryNext = result.errorCode === "NETWORK" || status === 404 || RETRYABLE.has(status);
    if (!tryNext) return result;
  }
  return last;
}

/**
 * @param gatewayModel identifiant passerelle, ex. "google/gemini-3.6-flash"
 * @param googleModel identifiant natif Google, ex. "gemini-3.6-flash"
 */
export async function callAiJson(opts: {
  gatewayModel: string;
  googleModel: string;
  messages: ChatMessage[];
}): Promise<AiCallResult> {
  const gatewayKey = process.env['LOVABLE_API_KEY'] ?? process.env['AI_GATEWAY_API_KEY'] ?? '';
  const geminiKey = process.env['GEMINI_API_KEY'] ?? '';

  if (!gatewayKey && !geminiKey) {
    return { ok: false, errorCode: "MISSING_KEY", detail: "aucune clé de service IA configurée sur cet hébergement" };
  }

  let last: AiCallFailure = { ok: false, errorCode: "MISSING_KEY", detail: "aucune clé de service IA configurée" };

  if (gatewayKey) {
    const result = await attempt(
      "gateway",
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      { Authorization: `Bearer ${gatewayKey}` },
      opts.gatewayModel,
      opts.messages,
    );
    if (result.ok) return result;
    last = result;
  }

  if (geminiKey) {
    const result = await attemptGoogle(opts.googleModel, geminiKey, opts.messages);
    if (result.ok) return result;
    // On conserve l'erreur la plus explicite : celle du repli si la passerelle
    // n'était pas configurée, sinon celle de la passerelle.
    if (!gatewayKey) last = result;
    else last = { ok: false, errorCode: last.errorCode, detail: `${last.detail} ; repli Google : ${result.detail}` };
  }

  return last;
}
