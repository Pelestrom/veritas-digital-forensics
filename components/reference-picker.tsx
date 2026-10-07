/**
 * Sélection d'une référence enregistrée (bibliothèque privée).
 * Recherche, filtres, favoris, statut de confiance, traçabilité d'usage.
 * Aucun aperçu public : les fichiers restent dans le stockage privé.
 */

import { useMemo, useState } from "react";
import { Star, Archive, Trash2, Search, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TRUST_STATUS_LABEL, type TrustStatus } from "@/lib/forensic/reference-library.functions";

export interface ReferenceRow {
  id: string;
  collection_id: string | null;
  name: string;
  document_type: string | null;
  issuer: string | null;
  country: string | null;
  template_version: string | null;
  valid_from: string | null;
  valid_to: string | null;
  original_filename: string;
  mime_type: string | null;
  file_size: number;
  sha256: string;
  page_count: number | null;
  trust_status: string;
  fingerprint_version: string | null;
  is_favorite: boolean;
  notes: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function ReferencePicker({
  references,
  collections,
  selectedId,
  onSelect,
  onToggleFavorite,
  onArchive,
  onDelete,
}: {
  references: ReferenceRow[];
  collections: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (row: ReferenceRow) => void;
  onToggleFavorite: (row: ReferenceRow) => void;
  onArchive: (row: ReferenceRow) => void;
  onDelete: (row: ReferenceRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<"recent" | "used" | "name">("recent");

  const types = useMemo(() => Array.from(new Set(references.map((r) => r.document_type).filter(Boolean))) as string[], [references]);
  const countries = useMemo(() => Array.from(new Set(references.map((r) => r.country).filter(Boolean))) as string[], [references]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = references.filter((r) => {
      if (!showArchived && r.trust_status === "archived") return false;
      if (type !== "all" && r.document_type !== type) return false;
      if (country !== "all" && r.country !== country) return false;
      if (!q) return true;
      return [r.name, r.issuer, r.country, r.document_type, r.template_version, r.original_filename]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    out = [...out].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "used") return b.usage_count - a.usage_count;
      return (b.last_used_at ?? b.created_at).localeCompare(a.last_used_at ?? a.created_at);
    });
    return out;
  }, [references, query, type, country, showArchived, sort]);

  const collectionName = (id: string | null) => collections.find((c) => c.id === id)?.name ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une référence, une institution, un pays…"
            aria-label="Rechercher une référence"
            className="pl-9"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filtrer par type de document"
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="all">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filtrer par pays"
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="all">Tous les pays</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Trier les références"
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="recent">Récemment utilisées</option>
          <option value="used">Les plus utilisées</option>
          <option value="name">Nom</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Masquer les archivées" : "Voir les archivées"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-line-command rounded-md border border-dashed p-6 text-center text-sm">
          Aucune référence enregistrée pour le moment. Importez un document de confiance pour créer votre première référence.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <div className={`command-inset space-y-2 p-3 ${active ? "ring-primary ring-1" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => onSelect(r)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[r.document_type, r.issuer, r.country, r.template_version].filter(Boolean).join(" · ") || "Informations descriptives non renseignées"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(r)}
                      aria-label={r.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      title={r.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      <Star className={`h-4 w-4 ${r.is_favorite ? "text-accent-cyan fill-current" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                  <dl className="font-mono-display text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div><dt className="inline">Confiance : </dt><dd className="text-foreground inline">{TRUST_STATUS_LABEL[r.trust_status as TrustStatus] ?? r.trust_status}</dd></div>
                    <div><dt className="inline">Utilisations : </dt><dd className="text-foreground inline">{r.usage_count}</dd></div>
                    <div><dt className="inline">Ajoutée : </dt><dd className="text-foreground inline">{fmtDate(r.created_at)}</dd></div>
                    <div><dt className="inline">Dernier usage : </dt><dd className="text-foreground inline">{fmtDate(r.last_used_at)}</dd></div>
                    <div><dt className="inline">Pages : </dt><dd className="text-foreground inline">{r.page_count ?? "—"}</dd></div>
                    <div><dt className="inline">Période : </dt><dd className="text-foreground inline">{r.valid_from || r.valid_to ? `${fmtDate(r.valid_from)} → ${fmtDate(r.valid_to)}` : "—"}</dd></div>
                  </dl>
                  {collectionName(r.collection_id) && (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Layers className="h-3 w-3" aria-hidden /> Collection : {collectionName(r.collection_id)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => onSelect(r)}>
                      {active ? "Référence active" : "Utiliser"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onArchive(r)} title="Archiver la référence">
                      <Archive className="mr-1 h-3.5 w-3.5" /> {r.trust_status === "archived" ? "Réactiver" : "Archiver"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(r)} title="Supprimer définitivement">
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
