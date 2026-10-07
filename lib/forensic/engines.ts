/**
 * Nomenclature officielle des 4 moteurs VERITAS.
 *
 * Les identifiants internes (`ai`, `crypto`, `metadata`, `structure`) sont
 * figés : ils sont persistés en base dans `analyses.scores`. Seuls les
 * libellés et descriptions sont centralisés ici.
 *
 * ELA n'est PAS un moteur : c'est un sous-test du moteur `structure`.
 * Les anciennes analyses qui stockent un moteur `ela` sont relues comme
 * un résultat historique du moteur Structure (voir LEGACY_ENGINE_ALIASES).
 */

export type EngineId = "ai" | "crypto" | "metadata" | "structure";

export const ENGINE_IDS: readonly EngineId[] = ["ai", "crypto", "metadata", "structure"] as const;

export interface EngineMeta {
  id: EngineId;
  /** Nom court affiché sur la carte. */
  short: string;
  /** Nom complet affiché en sous-titre. */
  full: string;
  /** Description honnête des fonctions réellement implémentées. */
  description: string;
  /** Version du moteur, journalisée dans chaque analyse. */
  version: string;
}

export const ENGINE_META: Record<EngineId, EngineMeta> = {
  ai: {
    id: "ai",
    short: "IA",
    full: "Analyse de contenu synthétique",
    description:
      "Détection d'indices de génération ou de modification par des modèles génératifs.",
    version: "ai-1.2.0",
  },
  crypto: {
    id: "crypto",
    short: "CRYPTO",
    full: "Intégrité cryptographique",
    description:
      "Vérification de l'intégrité du fichier par comparaison des empreintes SHA-256 avant et après transfert.",
    version: "crypto-2.0.0",
  },
  metadata: {
    id: "metadata",
    short: "METADATA",
    full: "Métadonnées et provenance",
    description:
      "Analyse des métadonnées, des signatures d'outils et des informations de provenance C2PA.",
    version: "metadata-2.1.0",
  },
  structure: {
    id: "structure",
    short: "STRUCTURE",
    full: "Structure et cohérence forensic",
    description:
      "Analyse structurelle adaptée au format : compression JPEG, ELA, structure PNG, polices et révisions PDF, structure XML des DOCX.",
    version: "structure-2.0.0",
  },
};

/** Description alternative quand la comparaison d'empreintes n'a pas pu être faite. */
export const CRYPTO_DESCRIPTION_NO_COMPARE = "Calcul de l'empreinte SHA-256 d'acquisition.";

/**
 * Anciens identifiants de moteurs présents dans les analyses historiques.
 * `ela` était affiché comme un cinquième moteur : il est désormais relu
 * comme un sous-test du moteur Structure.
 */
export const LEGACY_ENGINE_ALIASES: Record<string, EngineId> = {
  ela: "structure",
  pdf: "structure",
  docx: "structure",
};

export function resolveEngineId(raw: string): EngineId | null {
  if ((ENGINE_IDS as readonly string[]).includes(raw)) return raw as EngineId;
  return LEGACY_ENGINE_ALIASES[raw] ?? null;
}

export function engineLabel(raw: string): string {
  const id = resolveEngineId(raw);
  return id ? ENGINE_META[id].short : raw.toUpperCase();
}
