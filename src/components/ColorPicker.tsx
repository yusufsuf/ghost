"use client";

import { useEffect, useRef, useState, MouseEvent, WheelEvent, useCallback } from "react";

interface ColorPickerProps {
  imageUrl: string;
  onColorChange: (hex: string | null) => void;
}

interface Sample {
  r: number; g: number; b: number;
  nx: number; ny: number;
}

interface HoverState {
  dispX: number; dispY: number;
  containerW: number; containerH: number;
  hex: string;
}

const INLINE_LOUPE_SIZE = 132;
const INLINE_ZOOM = 12;
const INLINE_GRID = Math.floor(INLINE_LOUPE_SIZE / INLINE_ZOOM);

const FS_LOUPE_SIZE = 180;
const FS_LOUPE_ZOOM = 18;
const FS_LOUPE_GRID = Math.floor(FS_LOUPE_SIZE / FS_LOUPE_ZOOM);

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 100;
const DRAG_THRESHOLD = 4;

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
  // Source canvas (hidden, holds raw pixel data)
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Inline view refs
  const inlineLoupeRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Samples
  const [samples, setSamples] = useState<Sample[]>([]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fsContainerRef = useRef<HTMLDivElement>(null);
  const fsCanvasRef = useRef<HTMLCanvasElement>(null);
  const fsLoupeRef = useRef<HTMLCanvasElement>(null);
  const [fsHover, setFsHover] = useState<HoverState | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);

  // Reset when image changes
  useEffect(() => {
    setSamples([]);
    setImgLoaded(false);
    setHover(null);
    setFsHover(null);
    setIsFullscreen(false);
    onColorChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Body scroll lock + ESC handler in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const drawSource = useCallback(() => {
    const img = imgRef.current;
    const canvas = sourceCanvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    setImgLoaded(true);
  }, []);

  const readPixel = (sx: number, sy: number): [number, number, number] | null => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return null;
    if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const p = ctx.getImageData(sx, sy, 1, 1).data;
    return [p[0], p[1], p[2]];
  };

  const addSample = (sx: number, sy: number) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const px = readPixel(sx, sy);
    if (!px) return;
    const newSample: Sample = {
      r: px[0], g: px[1], b: px[2],
      nx: sx / canvas.width,
      ny: sy / canvas.height,
    };
    const next = [...samples, newSample];
    setSamples(next);
    onColorChange(avgToHex(next));
  };

  // ───────── Inline view handlers ─────────

  const inlineCoords = (e: MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const canvas = sourceCanvasRef.current;
    if (!canvas) return null;
    const rect = img.getBoundingClientRect();
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;
    const sx = Math.round((dispX / rect.width) * canvas.width);
    const sy = Math.round((dispY / rect.height) * canvas.height);
    if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) return null;
    return { sx, sy, dispX, dispY, rectW: rect.width, rectH: rect.height };
  };

  const handleInlineMove = (e: MouseEvent<HTMLImageElement>) => {
    if (!imgLoaded) return;
    const c = inlineCoords(e);
    if (!c) { setHover(null); return; }
    const px = readPixel(c.sx, c.sy);
    if (!px) return;

    drawLoupe(inlineLoupeRef.current, c.sx, c.sy, INLINE_LOUPE_SIZE, INLINE_ZOOM, INLINE_GRID);

    setHover({
      dispX: c.dispX, dispY: c.dispY,
      containerW: c.rectW, containerH: c.rectH,
      hex: rgbToHex(px[0], px[1], px[2]),
    });
  };

  const handleInlineClick = (e: MouseEvent<HTMLImageElement>) => {
    if (!imgLoaded) return;
    const c = inlineCoords(e);
    if (!c) return;
    addSample(c.sx, c.sy);
  };

  // ───────── Fullscreen view handlers ─────────

  const drawLoupe = (
    loupe: HTMLCanvasElement | null,
    sx: number, sy: number,
    size: number, pixelZoom: number, gridSize: number
  ) => {
    if (!loupe) return;
    const source = sourceCanvasRef.current;
    if (!source) return;
    const lctx = loupe.getContext("2d");
    if (!lctx) return;
    lctx.imageSmoothingEnabled = false;
    lctx.fillStyle = "#1a1714";
    lctx.fillRect(0, 0, size, size);
    const half = Math.floor(gridSize / 2);
    lctx.drawImage(
      source,
      sx - half, sy - half, gridSize, gridSize,
      0, 0, size, size
    );
    const center = Math.floor(gridSize / 2) * pixelZoom;
    lctx.strokeStyle = "rgba(0,0,0,0.95)";
    lctx.lineWidth = 2;
    lctx.strokeRect(center, center, pixelZoom, pixelZoom);
    lctx.strokeStyle = "rgba(255,255,255,0.95)";
    lctx.lineWidth = 1;
    lctx.strokeRect(center + 1, center + 1, pixelZoom - 2, pixelZoom - 2);
  };

  const drawFullscreenCanvas = useCallback(() => {
    const display = fsCanvasRef.current;
    const source = sourceCanvasRef.current;
    const container = fsContainerRef.current;
    if (!display || !source || !container) return;
    const rect = container.getBoundingClientRect();
    if (display.width !== Math.floor(rect.width)) display.width = Math.floor(rect.width);
    if (display.height !== Math.floor(rect.height)) display.height = Math.floor(rect.height);

    const ctx = display.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, display.width, display.height);
    ctx.drawImage(
      source,
      0, 0, source.width, source.height,
      pan.x, pan.y, source.width * zoom, source.height * zoom
    );

    // Draw sample markers
    samples.forEach((s) => {
      const sx = s.nx * source.width;
      const sy = s.ny * source.height;
      const x = pan.x + sx * zoom;
      const y = pan.y + sy * zoom;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = rgbToHex(s.r, s.g, s.b);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 8.5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }, [pan, zoom, samples]);

  // Redraw fullscreen canvas when zoom/pan/samples change
  useEffect(() => {
    if (!isFullscreen) return;
    drawFullscreenCanvas();
  }, [isFullscreen, drawFullscreenCanvas]);

  // Window resize handler
  useEffect(() => {
    if (!isFullscreen) return;
    const onResize = () => drawFullscreenCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isFullscreen, drawFullscreenCanvas]);

  const openFullscreen = () => {
    const source = sourceCanvasRef.current;
    if (!source) return;
    // Fit to container (will be available after render — use viewport as estimate)
    const W = window.innerWidth;
    const H = window.innerHeight - 110; // controls bar
    const fitZoom = Math.min(W / source.width, H / source.height) * 0.92;
    setZoom(fitZoom);
    setPan({
      x: (W - source.width * fitZoom) / 2,
      y: (H - source.height * fitZoom) / 2,
    });
    setIsFullscreen(true);
    setFsHover(null);
  };

  const fsCanvasCoords = (e: MouseEvent<HTMLCanvasElement>) => {
    const display = e.currentTarget;
    const source = sourceCanvasRef.current;
    if (!source) return null;
    const rect = display.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const sx = Math.round((cx - pan.x) / zoom);
    const sy = Math.round((cy - pan.y) / zoom);
    return { cx, cy, sx, sy, rectW: rect.width, rectH: rect.height };
  };

  const handleFsMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      panX: pan.x, panY: pan.y,
      moved: false,
    };
  };

  const handleFsMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const c = fsCanvasCoords(e);

    if (drag) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
      if (drag.moved) {
        setPan({ x: drag.panX + dx, y: drag.panY + dy });
        setFsHover(null);
        return;
      }
    }

    if (!c) { setFsHover(null); return; }
    const source = sourceCanvasRef.current;
    if (!source) return;
    if (c.sx < 0 || c.sy < 0 || c.sx >= source.width || c.sy >= source.height) {
      setFsHover(null);
      return;
    }
    const px = readPixel(c.sx, c.sy);
    if (!px) return;

    drawLoupe(fsLoupeRef.current, c.sx, c.sy, FS_LOUPE_SIZE, FS_LOUPE_ZOOM, FS_LOUPE_GRID);

    setFsHover({
      dispX: c.cx, dispY: c.cy,
      containerW: c.rectW, containerH: c.rectH,
      hex: rgbToHex(px[0], px[1], px[2]),
    });
  };

  const handleFsMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    // It was a click — pick pixel
    const c = fsCanvasCoords(e);
    if (!c) return;
    const source = sourceCanvasRef.current;
    if (!source) return;
    if (c.sx < 0 || c.sy < 0 || c.sx >= source.width || c.sy >= source.height) return;
    addSample(c.sx, c.sy);
  };

  const handleFsMouseLeave = () => {
    dragRef.current = null;
    setFsHover(null);
  };

  const handleFsWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const c = fsCanvasCoords(e);
    if (!c) return;
    const factor = e.deltaY > 0 ? 1 / 1.18 : 1.18;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    if (newZoom === zoom) return;
    // Keep pixel under cursor anchored
    const sx = (c.cx - pan.x) / zoom;
    const sy = (c.cy - pan.y) / zoom;
    setPan({ x: c.cx - sx * newZoom, y: c.cy - sy * newZoom });
    setZoom(newZoom);
  };

  const setZoomCentered = (newZoom: number) => {
    const display = fsCanvasRef.current;
    if (!display) return;
    const rect = display.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const sx = (cx - pan.x) / zoom;
    const sy = (cy - pan.y) / zoom;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    setPan({ x: cx - sx * z, y: cy - sy * z });
    setZoom(z);
  };

  const handleFitScreen = () => {
    const source = sourceCanvasRef.current;
    const container = fsContainerRef.current;
    if (!source || !container) return;
    const rect = container.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / source.width, rect.height / source.height) * 0.92;
    setZoom(fitZoom);
    setPan({
      x: (rect.width - source.width * fitZoom) / 2,
      y: (rect.height - source.height * fitZoom) / 2,
    });
  };

  const handleReset = () => { setSamples([]); onColorChange(null); };
  const handleUndo = () => {
    if (samples.length === 0) return;
    const next = samples.slice(0, -1);
    setSamples(next);
    onColorChange(next.length > 0 ? avgToHex(next) : null);
  };

  const averageHex = samples.length > 0 ? avgToHex(samples) : null;

  // Inline loupe positioning (smart edge flip)
  let loupeLeft = 0, loupeTop = 0;
  if (hover) {
    const OFFSET = 18;
    const BLOCK = INLINE_LOUPE_SIZE + 36;
    loupeLeft = hover.dispX + OFFSET;
    loupeTop  = hover.dispY - BLOCK - OFFSET;
    if (loupeLeft + INLINE_LOUPE_SIZE > hover.containerW) loupeLeft = hover.dispX - INLINE_LOUPE_SIZE - OFFSET;
    if (loupeTop < 0) loupeTop = hover.dispY + OFFSET;
    if (loupeLeft < 0) loupeLeft = 4;
  }

  // FS loupe positioning
  let fsLoupeLeft = 0, fsLoupeTop = 0;
  if (fsHover) {
    const OFFSET = 22;
    const BLOCK = FS_LOUPE_SIZE + 40;
    fsLoupeLeft = fsHover.dispX + OFFSET;
    fsLoupeTop  = fsHover.dispY - BLOCK - OFFSET;
    if (fsLoupeLeft + FS_LOUPE_SIZE > fsHover.containerW) fsLoupeLeft = fsHover.dispX - FS_LOUPE_SIZE - OFFSET;
    if (fsLoupeTop < 0) fsLoupeTop = fsHover.dispY + OFFSET;
    if (fsLoupeLeft < 0) fsLoupeLeft = 4;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, flex: 1 }}>
          Pixel'lere tıkla — büyüteç ile yakından gör. Çoklu seçimde ortalama hesaplanır.
        </p>
        <button
          onClick={openFullscreen}
          disabled={!imgLoaded}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            cursor: imgLoaded ? "pointer" : "wait",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          ⛶ Tam ekran
        </button>
      </div>

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
          onLoad={drawSource}
          onClick={handleInlineClick}
          onMouseMove={handleInlineMove}
          onMouseLeave={() => setHover(null)}
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

        {samples.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.nx * 100}%`,
              top: `${s.ny * 100}%`,
              width: 14, height: 14, borderRadius: "50%",
              background: rgbToHex(s.r, s.g, s.b),
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        ))}

        <div style={{
          position: "absolute",
          left: loupeLeft, top: loupeTop,
          visibility: hover ? "visible" : "hidden",
          pointerEvents: "none",
          zIndex: 10,
          display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
        }}>
          <canvas
            ref={inlineLoupeRef}
            width={INLINE_LOUPE_SIZE} height={INLINE_LOUPE_SIZE}
            style={{
              display: "block", borderRadius: 10,
              border: "3px solid #fff",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              background: "#1a1714",
            }}
          />
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
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
              width: 12, height: 12, borderRadius: 3,
              background: hover?.hex ?? "transparent",
              border: "1px solid rgba(0,0,0,0.2)",
            }} />
            {hover?.hex}
          </div>
        </div>
      </div>

      <canvas ref={sourceCanvasRef} style={{ display: "none" }} />

      {samples.length > 0 ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
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
            }}>{averageHex}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {samples.length} nokta · ortalama
            </p>
          </div>
          <button onClick={handleUndo} title="Son noktayı geri al" style={ctrlBtn}>↶ Geri</button>
          <button onClick={handleReset} style={ctrlBtn}>Sıfırla</button>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
          Henüz nokta seçilmedi
        </p>
      )}

      {/* ───────── FULLSCREEN OVERLAY ───────── */}
      {isFullscreen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a0a",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Top bar */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 22px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
            zIndex: 20,
            pointerEvents: "none",
          }}>
            <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontFamily: "monospace",
                fontSize: 13,
                color: "#fff",
                opacity: 0.85,
                background: "rgba(255,255,255,0.08)",
                padding: "6px 12px",
                borderRadius: 6,
                fontWeight: 600,
              }}>
                {Math.round(zoom * 100)}%
              </span>
              {samples.length > 0 && averageHex && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.08)",
                  padding: "6px 12px",
                  borderRadius: 6,
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: averageHex,
                    border: "1px solid rgba(255,255,255,0.3)",
                  }} />
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff", fontWeight: 600 }}>
                    {averageHex} · {samples.length} nokta
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                pointerEvents: "auto",
                width: 38, height: 38, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.5)",
                color: "#fff",
                fontSize: 20,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Kapat (ESC)"
            >×</button>
          </div>

          {/* Canvas area */}
          <div
            ref={fsContainerRef}
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <canvas
              ref={fsCanvasRef}
              onMouseDown={handleFsMouseDown}
              onMouseMove={handleFsMouseMove}
              onMouseUp={handleFsMouseUp}
              onMouseLeave={handleFsMouseLeave}
              onWheel={handleFsWheel}
              style={{
                display: "block",
                cursor: dragRef.current?.moved ? "grabbing" : "crosshair",
                userSelect: "none",
              }}
            />

            {/* Fullscreen loupe */}
            <div style={{
              position: "absolute",
              left: fsLoupeLeft, top: fsLoupeTop,
              visibility: fsHover ? "visible" : "hidden",
              pointerEvents: "none",
              zIndex: 15,
              display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
            }}>
              <canvas
                ref={fsLoupeRef}
                width={FS_LOUPE_SIZE} height={FS_LOUPE_SIZE}
                style={{
                  display: "block", borderRadius: 12,
                  border: "3px solid #fff",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  background: "#1a1714",
                }}
              />
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px",
                background: "rgba(255,255,255,0.97)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--text-primary)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: fsHover?.hex ?? "transparent",
                  border: "1px solid rgba(0,0,0,0.2)",
                }} />
                {fsHover?.hex}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            padding: "16px 22px",
            background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            zIndex: 20,
          }}>
            <button onClick={() => setZoomCentered(zoom / 1.5)} style={fsBtn} title="Uzaklaş">−</button>

            <input
              type="range"
              min={Math.log(MIN_ZOOM)}
              max={Math.log(MAX_ZOOM)}
              step={0.01}
              value={Math.log(zoom)}
              onChange={(e) => setZoomCentered(Math.exp(parseFloat(e.target.value)))}
              style={{
                width: 240,
                accentColor: "#fff",
              }}
            />

            <button onClick={() => setZoomCentered(zoom * 1.5)} style={fsBtn} title="Yakınlaştır">+</button>
            <button onClick={handleFitScreen} style={fsBtnTxt} title="Ekrana sığdır">⛶ Sığdır</button>

            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.18)", margin: "0 6px" }} />

            <button
              onClick={handleUndo}
              disabled={samples.length === 0}
              style={{ ...fsBtnTxt, opacity: samples.length === 0 ? 0.4 : 1 }}
            >↶ Geri</button>
            <button
              onClick={handleReset}
              disabled={samples.length === 0}
              style={{ ...fsBtnTxt, opacity: samples.length === 0 ? 0.4 : 1 }}
            >Sıfırla</button>

            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.18)", margin: "0 6px" }} />

            <button onClick={() => setIsFullscreen(false)} style={fsBtnPrimary}>Tamam</button>
          </div>

          {/* Hint */}
          <div style={{
            position: "absolute",
            bottom: 80, left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 11,
            borderRadius: 100,
            pointerEvents: "none",
            letterSpacing: "0.04em",
            zIndex: 10,
          }}>
            Tıkla = nokta seç · Sürükle = kaydır · Tekerlek = zoom · ESC = kapat
          </div>
        </div>
      )}
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border-hover)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: 12, cursor: "pointer", fontWeight: 500,
};

const fsBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 18, fontWeight: 500,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const fsBtnTxt: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 12, fontWeight: 500, cursor: "pointer",
};

const fsBtnPrimary: React.CSSProperties = {
  padding: "8px 22px", borderRadius: 8,
  border: "none",
  background: "#fff",
  color: "#1a1714",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
