"use client";

import { useEffect, useRef, useState, MouseEvent, useCallback } from "react";

interface ColorPickerProps {
  imageUrl: string;
  onColorChange: (hex: string | null) => void;
}

interface Sample {
  r: number; g: number; b: number;
  nx: number; ny: number;  // normalized 0-1 source coords for markers
}

interface HoverState {
  dispX: number; dispY: number;   // cursor pos within img element
  imgW: number;  imgH: number;
  hex: string;
}

const LOUPE_SIZE = 132;
const ZOOM = 12;
const GRID_PIXELS = Math.floor(LOUPE_SIZE / ZOOM); // ~11 source pixels visible

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function avgToHex(samples: Sample[]): string {
  const sum = samples.reduce(
    (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b }),
    { r: 0, g: 0, b: 0 }
  );
  const n = samples.length;
  return rgbToHex(Math.round(sum.r / n), Math.round(sum.g / n), Math.round(sum.b / n));
}

export default function ColorPicker({ imageUrl, onColorChange }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Reset state when image changes
  useEffect(() => {
    setSamples([]);
    setImgLoaded(false);
    setHover(null);
    onColorChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const drawImage = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    setImgLoaded(true);
  }, []);

  const computeSourceCoords = (e: MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = img.getBoundingClientRect();
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const sx = Math.round(dispX * scaleX);
    const sy = Math.round(dispY * scaleY);
    if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) return null;
    return { sx, sy, dispX, dispY, rectW: rect.width, rectH: rect.height, canvas };
  };

  const handleMove = (e: MouseEvent<HTMLImageElement>) => {
    if (!imgLoaded) return;
    const coords = computeSourceCoords(e);
    if (!coords) { setHover(null); return; }

    const { sx, sy, dispX, dispY, rectW, rectH, canvas } = coords;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const p = ctx.getImageData(sx, sy, 1, 1).data;
    const hex = rgbToHex(p[0], p[1], p[2]);

    // Draw zoomed pixels onto loupe canvas
    const loupe = loupeRef.current;
    if (loupe) {
      const lctx = loupe.getContext("2d");
      if (lctx) {
        lctx.imageSmoothingEnabled = false;
        lctx.fillStyle = "#1a1714";
        lctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
        const half = Math.floor(GRID_PIXELS / 2);
        lctx.drawImage(
          canvas,
          sx - half, sy - half, GRID_PIXELS, GRID_PIXELS,
          0, 0, LOUPE_SIZE, LOUPE_SIZE
        );
        // Crosshair box on center pixel
        const center = Math.floor((GRID_PIXELS / 2)) * ZOOM;
        lctx.strokeStyle = "rgba(0,0,0,0.95)";
        lctx.lineWidth = 2;
        lctx.strokeRect(center, center, ZOOM, ZOOM);
        lctx.strokeStyle = "rgba(255,255,255,0.95)";
        lctx.lineWidth = 1;
        lctx.strokeRect(center + 1, center + 1, ZOOM - 2, ZOOM - 2);
      }
    }

    setHover({ dispX, dispY, imgW: rectW, imgH: rectH, hex });
  };

  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    if (!imgLoaded) return;
    const coords = computeSourceCoords(e);
    if (!coords) return;
    const { sx, sy, canvas } = coords;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const p = ctx.getImageData(sx, sy, 1, 1).data;
    const newSample: Sample = {
      r: p[0], g: p[1], b: p[2],
      nx: sx / canvas.width,
      ny: sy / canvas.height,
    };
    const next = [...samples, newSample];
    setSamples(next);
    onColorChange(avgToHex(next));
  };

  const handleLeave = () => setHover(null);
  const handleReset = () => { setSamples([]); onColorChange(null); };
  const handleUndo = () => {
    if (samples.length === 0) return;
    const next = samples.slice(0, -1);
    setSamples(next);
    onColorChange(next.length > 0 ? avgToHex(next) : null);
  };

  const averageHex = samples.length > 0 ? avgToHex(samples) : null;

  // Smart loupe positioning - flips to avoid edges
  let loupeLeft = 0, loupeTop = 0;
  if (hover) {
    const OFFSET = 18;
    const LOUPE_BLOCK = LOUPE_SIZE + 36; // canvas + hex chip
    loupeLeft = hover.dispX + OFFSET;
    loupeTop  = hover.dispY - LOUPE_BLOCK - OFFSET;
    if (loupeLeft + LOUPE_SIZE > hover.imgW) loupeLeft = hover.dispX - LOUPE_SIZE - OFFSET;
    if (loupeTop < 0) loupeTop = hover.dispY + OFFSET;
    if (loupeLeft < 0) loupeLeft = 4;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Görselden noktalara tıkla — büyüteç ile pixel pixel seçim yapabilirsin. Birden fazla nokta = ortalama.
      </p>

      <div style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Renk seç"
          onLoad={drawImage}
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          style={{
            width: "100%",
            maxHeight: 420,
            objectFit: "contain",
            cursor: imgLoaded ? "crosshair" : "wait",
            display: "block",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* Sample markers (dots at clicked positions) */}
        {samples.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.nx * 100}%`,
              top: `${s.ny * 100}%`,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: rgbToHex(s.r, s.g, s.b),
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        ))}

        {/* Magnifier loupe */}
        <div
          style={{
            position: "absolute",
            left: loupeLeft,
            top: loupeTop,
            visibility: hover ? "visible" : "hidden",
            pointerEvents: "none",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
          }}
        >
          <canvas
            ref={loupeRef}
            width={LOUPE_SIZE}
            height={LOUPE_SIZE}
            style={{
              display: "block",
              borderRadius: 10,
              border: "3px solid #fff",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              background: "#1a1714",
            }}
          />
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: "rgba(255,255,255,0.97)",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "monospace",
            color: "var(--text-primary)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: hover?.hex ?? "transparent",
              border: "1px solid rgba(0,0,0,0.2)",
            }} />
            {hover?.hex}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {samples.length > 0 ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "var(--bg-secondary)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: averageHex ?? "transparent",
            border: "1px solid var(--border-hover)",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 500,
              color: "var(--text-primary)",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}>
              {averageHex}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {samples.length} nokta · ortalama
            </p>
          </div>
          <button
            onClick={handleUndo}
            title="Son noktayı geri al"
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--border-hover)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12, cursor: "pointer", fontWeight: 500,
            }}
          >
            ↶ Geri
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--border-hover)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12, cursor: "pointer", fontWeight: 500,
            }}
          >
            Sıfırla
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
          Henüz nokta seçilmedi
        </p>
      )}
    </div>
  );
}
