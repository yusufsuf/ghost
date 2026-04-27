"use client";

import { useEffect, useRef, useState, MouseEvent, useCallback } from "react";

interface ColorPickerProps {
  imageUrl: string;
  onColorChange: (hex: string | null) => void;
}

interface Sample { r: number; g: number; b: number; }

function avgToHex(samples: Sample[]): string {
  const sum = samples.reduce(
    (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b }),
    { r: 0, g: 0, b: 0 }
  );
  const n = samples.length;
  const r = Math.round(sum.r / n);
  const g = Math.round(sum.g / n);
  const b = Math.round(sum.b / n);
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export default function ColorPicker({ imageUrl, onColorChange }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; hex: string } | null>(null);

  // Reset state when imageUrl changes
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

  const samplePixel = (e: MouseEvent<HTMLImageElement>): Sample | null => {
    const img = e.currentTarget;
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded) return null;

    const rect = img.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const p = ctx.getImageData(x, y, 1, 1).data;
    return { r: p[0], g: p[1], b: p[2] };
  };

  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    const sample = samplePixel(e);
    if (!sample) return;
    const next = [...samples, sample];
    setSamples(next);
    onColorChange(avgToHex(next));
  };

  const handleMove = (e: MouseEvent<HTMLImageElement>) => {
    const sample = samplePixel(e);
    if (!sample) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      hex: avgToHex([sample]),
    });
  };

  const handleLeave = () => setHover(null);

  const handleReset = () => {
    setSamples([]);
    onColorChange(null);
  };

  const handleUndo = () => {
    if (samples.length === 0) return;
    const next = samples.slice(0, -1);
    setSamples(next);
    onColorChange(next.length > 0 ? avgToHex(next) : null);
  };

  const averageHex = samples.length > 0 ? avgToHex(samples) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Elbisenin saf rengini temsil eden noktalara tıkla. Birden fazla nokta seçebilirsin — ortalama hesaplanır.
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
            maxHeight: 360,
            objectFit: "contain",
            cursor: imgLoaded ? "crosshair" : "wait",
            display: "block",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* Hover preview */}
        {hover && (
          <div style={{
            position: "absolute",
            left: hover.x + 14,
            top: hover.y - 32,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            background: "rgba(255,255,255,0.95)",
            borderRadius: 6,
            boxShadow: "var(--shadow-sm)",
            pointerEvents: "none",
            fontSize: 11,
            fontFamily: "monospace",
            color: "var(--text-primary)",
            transform: "translateX(0)",
          }}>
            <span style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: hover.hex,
              border: "1px solid rgba(0,0,0,0.2)",
            }} />
            {hover.hex}
          </div>
        )}
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
            width: 40,
            height: 40,
            borderRadius: 8,
            background: averageHex ?? "transparent",
            border: "1px solid var(--border-hover)",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14,
              fontWeight: 500,
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
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-hover)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            ↶ Geri
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-hover)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Sıfırla
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
          Henüz nokta seçilmedi — fareyi gezdirip görselden tıkla
        </p>
      )}
    </div>
  );
}
