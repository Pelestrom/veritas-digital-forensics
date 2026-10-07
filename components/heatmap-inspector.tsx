import { useEffect, useState } from "react";
import { Activity, CircleSlash } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";

export interface HeatmapData {
  preview: string | null;
  hotspotCount: number;
  maxTileScore: number;
  cols: number;
  rows: number;
}

/**
 * Inspecteur de la carte de chaleur ELA.
 * Uniquement affiché pour les JPEG : aucun visuel ELA n'est simulé pour les
 * autres formats, où l'écran affiche explicitement « Non applicable ».
 */
export function HeatmapInspector({
  heatmap,
  fileType,
  mimeType,
  storagePath,
}: {
  heatmap: HeatmapData | null;
  fileType: string;
  mimeType: string | null;
  storagePath: string | null;
}) {
  const isJpeg = /jpe?g/i.test(mimeType ?? "") || /jpe?g/i.test(fileType);
  const [intensity, setIntensity] = useState(80);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isJpeg || !storagePath || !heatmap?.preview) return;
    void supabase.storage
      .from("evidence")
      .createSignedUrl(storagePath, 300)
      .then(({ data }) => {
        if (!cancelled) setOriginalUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [isJpeg, storagePath, heatmap?.preview]);

  if (!isJpeg) {
    return (
      <Card className="command-surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleSlash className="h-4 w-4 text-muted-foreground" />
            Carte de chaleur ELA — non applicable
          </CardTitle>
          <CardDescription>
            L'Error Level Analysis repose sur les écarts de recompression JPEG. Le format {fileType.toUpperCase()} ne
            produit pas ces écarts : aucune carte n'est générée, et aucune visualisation approchante n'est simulée.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!heatmap?.preview) return null;

  return (
    <Card className="command-surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-trust-falsified" />
          Carte de chaleur des zones suspectes
        </CardTitle>
        <CardDescription>
          Tuilage {heatmap.cols}×{heatmap.rows} · {heatmap.hotspotCount} zone(s) chaude(s) · pic{" "}
          {heatmap.maxTileScore}/100
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-md border border-border">
          {originalUrl && (
            <img src={originalUrl} alt="Image originale analysée" className="block w-full" />
          )}
          <img
            src={heatmap.preview}
            alt="Carte de chaleur des zones suspectes"
            className={originalUrl ? "absolute inset-0 h-full w-full" : "block w-full"}
            style={{ opacity: intensity / 100 }}
          />
        </div>

        <div className="max-w-sm space-y-2">
          <label htmlFor="ela-intensity" className="forensic-eyebrow block">
            Intensité de la carte · {intensity}%
          </label>
          <Slider
            id="ela-intensity"
            value={[intensity]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => setIntensity(v[0] ?? 80)}
            aria-label="Intensité de la carte de chaleur"
          />
          <p className="text-xs text-muted-foreground">
            {originalUrl
              ? "0 % affiche l'image d'origine, 100 % la carte seule : glissez pour comparer avant/après."
              : "Image d'origine indisponible — seule la carte de chaleur est affichée."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="forensic-eyebrow">Légende</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-trust-authentic/50" aria-hidden /> Recompression homogène
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-trust-manipulated/60" aria-hidden /> Écart modéré
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-trust-falsified/70" aria-hidden /> Écart fort
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Limites : un écart fort peut aussi provenir d'un redimensionnement, d'un export multiple ou d'une zone très
          texturée. La carte localise des régions à examiner, elle ne prouve pas à elle seule une retouche.
        </p>
      </CardContent>
    </Card>
  );
}
