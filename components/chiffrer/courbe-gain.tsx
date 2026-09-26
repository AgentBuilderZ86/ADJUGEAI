"use client";

import { useState } from "react";
import type { PointSimulation } from "@/lib/marches/simulation";
import { mad, pct } from "@/lib/utils";

const L = 640;
const H = 260;
const M = { haut: 16, droite: 16, bas: 36, gauche: 44 };

/** Probabilité de gain selon le prix déposé (une seule série, survol avec réticule). */
export function CourbeGain({ points, recommande }: { points: PointSimulation[]; recommande: PointSimulation | null }) {
  const [survol, setSurvol] = useState<PointSimulation | null>(null);
  if (points.length < 2) return null;

  const rMin = points[0].ratio;
  const rMax = points[points.length - 1].ratio;
  const pMax = Math.max(0.05, ...points.map((p) => p.probabiliteGain));
  const yMax = Math.min(1, Math.ceil(pMax * 10) / 10);
  const x = (r: number) => M.gauche + ((r - rMin) / (rMax - rMin)) * (L - M.gauche - M.droite);
  const y = (p: number) => M.haut + (1 - p / yMax) * (H - M.haut - M.bas);

  const valides = points.filter((p) => !p.ecartee);
  const chemin = valides.map((p, i) => `${i ? "L" : "M"}${x(p.ratio).toFixed(1)},${y(p.probabiliteGain).toFixed(1)}`).join("");
  const graduationsY = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);
  const graduationsX = points.filter((_, i) => i % Math.ceil(points.length / 8) === 0);
  const zonesEcartees = points.filter((p) => p.ecartee);

  function survoler(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = rMin + ((e.clientX - rect.left) / rect.width) * (rMax - rMin);
    let proche = points[0];
    for (const p of points) if (Math.abs(p.ratio - r) < Math.abs(proche.ratio - r)) proche = p;
    setSurvol(proche);
  }

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label="Probabilité de gain selon le prix déposé">
        {zonesEcartees.map((p) => (
          <rect
            key={p.ratio}
            x={x(p.ratio) - 3}
            y={M.haut}
            width={6}
            height={H - M.haut - M.bas}
            className="fill-slate-100"
          />
        ))}
        {graduationsY.map((g) => (
          <g key={g}>
            <line x1={M.gauche} x2={L - M.droite} y1={y(g)} y2={y(g)} className="stroke-slate-200" strokeWidth={1} />
            <text x={M.gauche - 6} y={y(g) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {Math.round(g * 100)} %
            </text>
          </g>
        ))}
        {graduationsX.map((p) => (
          <text key={p.ratio} x={x(p.ratio)} y={H - 14} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {Math.round(p.ratio * 100)} %
          </text>
        ))}
        <text x={L - M.droite} y={H - 2} textAnchor="end" className="fill-slate-400 text-[10px]">
          prix / estimation
        </text>
        <path d={chemin} fill="none" className="stroke-marque-700" strokeWidth={2} strokeLinejoin="round" />
        {recommande && (
          <circle
            cx={x(recommande.ratio)}
            cy={y(recommande.probabiliteGain)}
            r={5}
            className="fill-marque-700 stroke-white"
            strokeWidth={2}
          />
        )}
        {survol && (
          <g pointerEvents="none">
            <line x1={x(survol.ratio)} x2={x(survol.ratio)} y1={M.haut} y2={H - M.bas} className="stroke-slate-400" strokeDasharray="3 3" />
            {!survol.ecartee && (
              <circle cx={x(survol.ratio)} cy={y(survol.probabiliteGain)} r={4} className="fill-white stroke-marque-700" strokeWidth={2} />
            )}
          </g>
        )}
        <rect
          x={M.gauche}
          y={M.haut}
          width={L - M.gauche - M.droite}
          height={H - M.haut - M.bas}
          fill="transparent"
          onMouseMove={survoler}
          onMouseLeave={() => setSurvol(null)}
        />
      </svg>
      {survol && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `min(calc(${(x(survol.ratio) / L) * 100}% + 8px), calc(100% - 12rem))` }}
        >
          <p className="font-semibold">{mad(survol.prix)}</p>
          <p className="text-slate-600">{pct(survol.ratio, 1)} de l&apos;estimation</p>
          {survol.ecartee ? (
            <p className="text-slate-600">Offre écartée (hors bornes)</p>
          ) : (
            <p className="text-slate-600">Probabilité de gain : {pct(survol.probabiliteGain)}</p>
          )}
          {survol.margeEsperee !== null && !survol.ecartee && (
            <p className="text-slate-600">Marge espérée : {mad(survol.margeEsperee)}</p>
          )}
        </div>
      )}
      <figcaption className="mt-1 text-xs text-slate-500">
        {zonesEcartees.length > 0 && <>Zones grisées : offre écartée d&apos;office (art. 44-B). </>}
        Point plein : prix recommandé. Survolez la courbe pour le détail.
      </figcaption>
    </figure>
  );
}
