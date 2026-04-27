"use client";

import { useState, useCallback } from "react";
import Uploader from "@/components/Uploader";
import ResultViewer from "@/components/ResultViewer";
import DownloadButton from "@/components/DownloadButton";
import ColorPicker from "@/components/ColorPicker";

type State = "idle" | "loading" | "done" | "error";
type Angle = "front" | "side" | "back";
type AspectRatio = "9:16" | "16:9" | "5:4" | "4:5";
type Resolution = "2K" | "4K";
type GarmentColor = "auto" | "white" | "black" | "colored" | "pixel";

interface SlotData { file: File; preview: string; }

const SLOTS: { key: Angle; label: string }[] = [
  { key: "front", label: "Ön" },
  { key: "side",  label: "Yan" },
  { key: "back",  label: "Arka" },
];

const RATIOS: AspectRatio[] = ["9:16", "16:9", "5:4", "4:5"];
const RESOLUTIONS: Resolution[] = ["2K", "4K"];
const COLORS: { key: GarmentColor; label: string }[] = [
  { key: "auto",    label: "Otomatik" },
  { key: "white",   label: "Beyaz" },
  { key: "black",   label: "Siyah" },
  { key: "colored", label: "Renkli" },
  { key: "pixel",   label: "Pixel seç" },
];

export default function Home() {
  const [slots, setSlots] = useState<Record<Angle, SlotData | null>>({ front: null, side: null, back: null });
  const [angle, setAngle] = useState<Angle>("front");
  const [ratio, setRatio] = useState<AspectRatio>("4:5");
  const [resolution, setResolution] = useState<Resolution>("2K");
  const [garmentColor, setGarmentColor] = useState<GarmentColor>("auto");
  const [garmentColorHex, setGarmentColorHex] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<{ image: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allReady = slots.front !== null && slots.side !== null && slots.back !== null;
  const isLoading = state === "loading";

  const handleSelect = useCallback((slot: Angle) => (file: File, preview: string) => {
    setSlots((p) => ({ ...p, [slot]: { file, preview } }));
    setResult(null); setError(null); setState("idle");
  }, []);

  const handleRemove = useCallback((slot: Angle) => () => {
    setSlots((p) => ({ ...p, [slot]: null }));
    setResult(null); setError(null); setState("idle");
  }, []);

  const handleProcess = async () => {
    if (!allReady) return;
    setState("loading"); setError(null);
    try {
      const fd = new FormData();
      fd.append("front", slots.front!.file);
      fd.append("side",  slots.side!.file);
      fd.append("back",  slots.back!.file);
      fd.append("angle", angle);
      fd.append("aspect_ratio", ratio);
      fd.append("resolution", resolution);
      fd.append("garment_color", garmentColor);
      if (garmentColor === "pixel" && garmentColorHex) {
        fd.append("garment_color_hex", garmentColorHex);
      }

      const res = await fetch("/api/process", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Bilinmeyen hata."); setState("error"); return; }
      setResult({ image: data.image, filename: data.filename });
      setState("done");
    } catch {
      setError("Ağ hatası. İnternet bağlantınızı kontrol edin.");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setSlots({ front: null, side: null, back: null });
    setResult(null); setError(null);
  };

  const uploadedCount = [slots.front, slots.side, slots.back].filter(Boolean).length;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 100 }}>

      {/* Header */}
      <header style={{ width: "100%", maxWidth: 900, padding: "72px 28px 56px", textAlign: "center" }}>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(42px, 7vw, 72px)",
          fontWeight: 300,
          lineHeight: 1.1,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
          marginBottom: 20,
        }}>
          Elbiseni Ghost&apos;a<br />
          <em style={{ fontStyle: "italic", fontWeight: 400 }}>Dönüştür</em>
        </h1>

      </header>

      {/* Content */}
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: 900, padding: "0 28px" }}>

        {state === "done" && result ? (
          /* ─── Result View ─── */
          <div style={{
            background: "var(--bg-card)",
            borderRadius: 20,
            padding: 32,
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}>
            <ResultViewer original={slots[angle]!.preview} result={result.image} />
            <DownloadButton imageDataUrl={result.image} filename={result.filename} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setState("idle"); setResult(null); setError(null); }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid var(--accent)",
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "opacity 0.18s ease",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                ↻ İşleme devam et
              </button>
              <button
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 400,
                  transition: "all 0.18s ease",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                + Yeni fotoğraf
              </button>
            </div>
          </div>
        ) : (
          /* ─── Upload & Settings View ─── */
          <div style={{
            background: "var(--bg-card)",
            borderRadius: 20,
            padding: 32,
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}>

            {/* Upload slots */}
            <div>
              <SectionLabel>Fotoğraflar</SectionLabel>
              <div
                className="slot-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 14 }}
              >
                {SLOTS.map(({ key, label }) => (
                  <Uploader
                    key={key}
                    label={label}
                    preview={slots[key]?.preview ?? null}
                    onImageSelect={handleSelect(key)}
                    onRemove={handleRemove(key)}
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            <Divider />

            {/* Angle selection */}
            <div>
              <SectionLabel>Üretilecek açı</SectionLabel>
              <div
                className="angle-row"
                style={{ display: "flex", gap: 8, marginTop: 12 }}
              >
                {SLOTS.map(({ key, label }) => (
                  <ToggleBtn
                    key={key}
                    active={angle === key}
                    onClick={() => setAngle(key)}
                    disabled={isLoading}
                  >
                    {label}
                  </ToggleBtn>
                ))}
              </div>
            </div>

            {/* Aspect ratio */}
            <div>
              <SectionLabel>Çıktı oranı</SectionLabel>
              <div
                className="ratio-row"
                style={{ display: "flex", gap: 8, marginTop: 12 }}
              >
                {RATIOS.map((r) => (
                  <ToggleBtn
                    key={r}
                    active={ratio === r}
                    onClick={() => setRatio(r)}
                    disabled={isLoading}
                  >
                    {r}
                  </ToggleBtn>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div>
              <SectionLabel>Çözünürlük</SectionLabel>
              <div
                className="ratio-row"
                style={{ display: "flex", gap: 8, marginTop: 12 }}
              >
                {RESOLUTIONS.map((r) => (
                  <ToggleBtn
                    key={r}
                    active={resolution === r}
                    onClick={() => setResolution(r)}
                    disabled={isLoading}
                  >
                    {r}
                  </ToggleBtn>
                ))}
              </div>
            </div>

            {/* Garment color */}
            <div>
              <SectionLabel>Elbise rengi</SectionLabel>
              <div
                className="ratio-row"
                style={{ display: "flex", gap: 8, marginTop: 12 }}
              >
                {COLORS.map(({ key, label }) => (
                  <ToggleBtn
                    key={key}
                    active={garmentColor === key}
                    onClick={() => setGarmentColor(key)}
                    disabled={isLoading}
                  >
                    {label}
                  </ToggleBtn>
                ))}
              </div>

              {garmentColor === "pixel" && (
                slots.front ? (
                  <ColorPicker
                    imageUrl={slots.front.preview}
                    onColorChange={setGarmentColorHex}
                  />
                ) : (
                  <p style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 12,
                    padding: "12px 14px",
                    background: "var(--bg-secondary)",
                    borderRadius: 10,
                    textAlign: "center",
                  }}>
                    Pixel seçimi için önce Ön fotoğrafı yükle
                  </p>
                )
              )}
            </div>

            <Divider />

            {/* Error */}
            {state === "error" && error && (
              <div style={{
                background: "rgba(181,71,26,0.06)",
                border: "1px solid rgba(181,71,26,0.2)",
                borderRadius: 10,
                padding: "13px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B5471A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={{ color: "#B5471A", fontSize: 13, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleProcess}
                disabled={!allReady || isLoading}
                style={{
                  flex: 1,
                  padding: "14px 24px",
                  borderRadius: 12,
                  border: "none",
                  cursor: !allReady || isLoading ? "not-allowed" : "pointer",
                  background: !allReady || isLoading ? "rgba(26,23,20,0.25)" : "var(--accent)",
                  color: "#fff",
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.03em",
                  transition: "opacity 0.18s ease",
                }}
                onMouseEnter={(e) => { if (allReady && !isLoading) e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                {isLoading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span
                      className="animate-spin"
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.25)",
                        borderTop: "2px solid #fff",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                    Oluşturuluyor…
                  </span>
                ) : !allReady ? (
                  `Ghost Yap  ·  ${uploadedCount}/3`
                ) : (
                  `Ghost Yap  ·  ${SLOTS.find(s => s.key === angle)?.label}`
                )}
              </button>

              <button
                onClick={handleReset}
                disabled={isLoading}
                style={{
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 400,
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                Sıfırla
              </button>
            </div>

          </div>
        )}

      </div>

    </main>
  );
}

/* ─── Small reusable primitives ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10,
      fontWeight: 500,
      color: "var(--text-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
    }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)" }} />;
}

function ToggleBtn({ active, onClick, disabled, children }: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: "10px 16px",
        borderRadius: 10,
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        letterSpacing: "0.02em",
        transition: "all 0.18s ease",
      }}
    >
      {children}
    </button>
  );
}
