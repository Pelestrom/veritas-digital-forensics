/**
 * Registre des intelligences artificielles génératives et attribution
 * prudente du générateur.
 *
 * Règle absolue : le nom d'une IA n'est affiché comme « confirmé » que si une
 * preuve technique l'identifie (manifeste C2PA, métadonnée explicite, chunk
 * textuel, workflow incorporé…). Un détecteur visuel probabiliste ne permet
 * jamais de nommer un générateur.
 */

export const AI_REGISTRY_VERSION = "ai-registry-1.0.0";

export type AttributionLevel = "confirmed" | "probable" | "possible" | "unknown";

export type AttributionSource =
  | "c2pa"
  | "content_credentials"
  | "xmp"
  | "exif"
  | "iptc"
  | "png_text_chunk"
  | "jpeg_comment"
  | "pdf_properties"
  | "docx_properties"
  | "embedded_workflow"
  | "watermark"
  | "model_detector"
  | "structural_fingerprint";

export interface AiAttribution {
  detected: boolean;
  providerName: string | null;
  toolName: string | null;
  modelName: string | null;
  modelVersion: string | null;
  level: AttributionLevel;
  confidence: number;
  sources: AttributionSource[];
  rawEvidence: string[];
  explanation: string;
}

export interface AiRegistryEntry {
  id: string;
  provider: string;
  tool: string;
  /** Famille de modèle, quand elle est connue. */
  modelFamily: string | null;
  aliases: string[];
  /** Champs techniques où la signature vaut confirmation. */
  deterministicFields: string[];
  enabled: boolean;
}

const e = (
  id: string,
  provider: string,
  tool: string,
  modelFamily: string | null,
  aliases: string[],
  deterministicFields: string[] = ["XMP:CreatorTool", "EXIF:Software", "PNG:tEXt", "C2PA:claim_generator"],
): AiRegistryEntry => ({ id, provider, tool, modelFamily, aliases, deterministicFields, enabled: true });

export const AI_REGISTRY: AiRegistryEntry[] = [
  // ---- OpenAI
  e("openai_chatgpt", "OpenAI", "ChatGPT", "GPT", ["chatgpt", "chat gpt", "gpt-4", "gpt-5", "openai gpt"]),
  e("openai_dalle", "OpenAI", "DALL·E", "DALL-E", ["dall-e", "dall·e", "dalle"]),
  e("openai_gpt_image", "OpenAI", "GPT Image", "GPT Image", ["gpt image", "gpt-image", "gpt-image-1"]),
  e("openai_image_gen", "OpenAI", "OpenAI Image Generation", null, ["openai image generation", "openai image"]),

  // ---- Google
  e("google_gemini", "Google", "Gemini", "Gemini", ["gemini", "bard"]),
  e("google_imagen", "Google", "Imagen", "Imagen", ["imagen", "imagen 3", "imagen 4"]),
  e("google_ai_studio", "Google", "Google AI Studio", null, ["google ai studio", "aistudio"]),
  e("google_vertex_imagen", "Google", "Vertex AI Imagen", "Imagen", ["vertex ai imagen", "vertex imagen"]),
  e("google_nano_banana", "Google", "Nano Banana", "Gemini Image", ["nano banana", "gemini image"]),

  // ---- Adobe
  e("adobe_firefly", "Adobe", "Adobe Firefly", "Firefly", ["adobe firefly", "firefly"]),
  e("adobe_generative_fill", "Adobe", "Photoshop Generative Fill", "Firefly", ["generative fill", "generative expand", "neural filters"]),
  e("adobe_express_ai", "Adobe", "Adobe Express AI", "Firefly", ["adobe express ai", "adobe express generative"]),

  // ---- Stability AI / Stable Diffusion
  e("stable_diffusion", "Stability AI", "Stable Diffusion", "Stable Diffusion", ["stable diffusion", "stable-diffusion", "stability ai"]),
  e("sdxl", "Stability AI", "Stable Diffusion", "SDXL", ["sdxl", "stable-diffusion-xl", "sd_xl"]),
  e("sd_webui", "Communauté", "Stable Diffusion WebUI", "Stable Diffusion", ["stable diffusion webui", "sd webui"]),
  e("automatic1111", "Communauté", "AUTOMATIC1111", "Stable Diffusion", ["automatic1111", "a1111"], ["PNG:tEXt:parameters"]),
  e("comfyui", "Communauté", "ComfyUI", "Stable Diffusion", ["comfyui", "comfy ui"], ["PNG:tEXt:workflow", "PNG:tEXt:prompt"]),
  e("invokeai", "Communauté", "InvokeAI", "Stable Diffusion", ["invokeai", "invoke ai"], ["PNG:tEXt:invokeai_metadata"]),
  e("dreamstudio", "Stability AI", "DreamStudio", "Stable Diffusion", ["dreamstudio"]),

  // ---- Autres générateurs
  e("midjourney", "Midjourney", "Midjourney", "Midjourney", ["midjourney", "mj_version"]),
  e("flux", "Black Forest Labs", "FLUX", "FLUX", ["flux", "flux.1", "black forest labs"]),
  e("ideogram", "Ideogram", "Ideogram", "Ideogram", ["ideogram"]),
  e("leonardo", "Leonardo", "Leonardo AI", null, ["leonardo.ai", "leonardo ai"]),
  e("ms_designer", "Microsoft", "Microsoft Designer", null, ["microsoft designer", "ms designer"]),
  e("ms_image_creator", "Microsoft", "Microsoft Image Creator", null, ["image creator", "bing image creator"]),
  e("recraft", "Recraft", "Recraft", null, ["recraft"]),
  e("runway", "Runway", "Runway", null, ["runway", "runwayml"]),
  e("canva_magic", "Canva", "Canva Magic Media", null, ["canva magic", "magic media", "magic studio", "text to image"]),
  e("playground", "Playground", "Playground AI", null, ["playground ai", "playgroundai"]),
  e("nightcafe", "NightCafe", "NightCafe", null, ["nightcafe"]),
  e("wombo", "WOMBO", "Dream by WOMBO", null, ["dream by wombo", "wombo dream"]),
  e("craiyon", "Craiyon", "Craiyon", null, ["craiyon"]),
  e("krea", "Krea", "Krea AI", null, ["krea.ai", "krea ai"]),
  e("clipdrop", "Clipdrop", "Clipdrop", null, ["clipdrop"]),
  e("photoroom_ai", "PhotoRoom", "PhotoRoom AI", null, ["photoroom ai", "photoroom"]),
  e("freepik_ai", "Freepik", "Freepik AI", null, ["freepik ai", "freepik pikaso"]),
  e("shutterstock_ai", "Shutterstock", "Shutterstock AI", null, ["shutterstock ai", "shutterstock generate"]),
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_\-·.]+/g, " ").replace(/\s+/g, " ").trim();
}

export function findAiEntry(rawValue: string): AiRegistryEntry | null {
  const hay = normalize(rawValue);
  if (!hay) return null;
  for (const entry of AI_REGISTRY) {
    if (!entry.enabled) continue;
    if (entry.aliases.some((a) => hay.includes(normalize(a)))) return entry;
  }
  return null;
}

/** Extrait une version de modèle simple (ex. « SDXL 1.0 », « v6.1 »). */
export function extractModelVersion(rawValue: string): string | null {
  const m = rawValue.match(/\b(?:v|version\s*)?(\d+(?:\.\d+){1,2})\b/i);
  return m ? m[1] : null;
}

export const AI_ATTRIBUTION_UNKNOWN_MESSAGE = "Contenu synthétique détecté — générateur indéterminé.";

export interface AttributionInput {
  /** Valeurs techniques brutes (métadonnées, workflows, chunks). */
  technicalValues: Array<{ value: string; source: AttributionSource; fieldPath: string }>;
  /** Le détecteur probabiliste a-t-il conclu à un contenu synthétique ? */
  detectorPositive: boolean;
}

/**
 * Attribution prudente : seules les valeurs techniques peuvent nommer une IA.
 * Le détecteur probabiliste ne produit jamais de nom.
 */
export function attributeAi({ technicalValues, detectorPositive }: AttributionInput): AiAttribution {
  const sources = new Set<AttributionSource>();
  const rawEvidence: string[] = [];
  let entry: AiRegistryEntry | null = null;
  let modelVersion: string | null = null;
  let deterministicField = false;

  for (const tv of technicalValues) {
    const found = findAiEntry(tv.value);
    if (!found) continue;
    sources.add(tv.source);
    rawEvidence.push(`${tv.fieldPath} = ${tv.value.slice(0, 180)}`);
    if (!entry) {
      entry = found;
      modelVersion = extractModelVersion(tv.value);
    }
    if (found.deterministicFields.some((f) => tv.fieldPath.toLowerCase().includes(f.toLowerCase()))) {
      deterministicField = true;
    }
  }

  if (entry) {
    const strongSource =
      deterministicField ||
      sources.has("c2pa") ||
      sources.has("content_credentials") ||
      sources.has("embedded_workflow") ||
      sources.has("png_text_chunk") ||
      sources.has("xmp") ||
      sources.has("exif");
    const level: AttributionLevel = strongSource ? "confirmed" : sources.size > 1 ? "probable" : "possible";
    return {
      detected: true,
      providerName: entry.provider,
      toolName: entry.tool,
      modelName: entry.modelFamily,
      modelVersion,
      level,
      confidence: level === "confirmed" ? 95 : level === "probable" ? 70 : 45,
      sources: Array.from(sources),
      rawEvidence,
      explanation: `${entry.tool} identifié dans ${rawEvidence.length} emplacement(s) technique(s) (${Array.from(sources).join(", ")}).`,
    };
  }

  if (detectorPositive) {
    return {
      detected: true,
      providerName: null,
      toolName: null,
      modelName: null,
      modelVersion: null,
      level: "unknown",
      confidence: 0,
      sources: ["model_detector"],
      rawEvidence: [],
      explanation: AI_ATTRIBUTION_UNKNOWN_MESSAGE,
    };
  }

  return {
    detected: false,
    providerName: null,
    toolName: null,
    modelName: null,
    modelVersion: null,
    level: "unknown",
    confidence: 0,
    sources: [],
    rawEvidence: [],
    explanation: "Aucun indice d'outil de génération identifié.",
  };
}
