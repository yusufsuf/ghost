"use client";

import { useState } from "react";

interface ResultViewerProps {
  original: string;
  result: string;
}

export default function ResultViewer({ original, result }: ResultViewerProps) {
  const [mode, setMode] = useState<"split" | "original" | "result">("split");

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px",
    borderRadius: 8,
    border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.03em",
    transition: "all 0.18s ease",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
  });

  const badgeStyle = (color: string): React.CSSProperties => ({
    position: "absolute",
    top: 10,
    left: 10,
    background: color,
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    zIndex: 2,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <button style={btnStyle(mode === "split")}    onClick={() => setMode("split")}>İkiye böl</button>
        <button style={btnStyle(mode === "original")} onClick={() => setMode("original")}>Orijinal</button>
        <button style={btnStyle(mode === "result")}   onClick={() => setMode("result")}>Ghost</button>
      </div>

      {/* Images */}
      <div style={{
        display: "grid",
        gridTemplateColumns: mode === "split" ? "1fr 1fr" : "1fr",
        gap: 10,
        borderRadius: 14,
        overflow: "hidden",
      }}>
        {(mode === "split" || mode === "original") && (
          <div style={{ position: "relative" }}>
            <div style={badgeStyle("rgba(26,23,20,0.55)")}>Orijinal</div>
            <img
              src={original}
              alt="Orijinal elbise"
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "contain",
                background: "var(--bg-secondary)",
                borderRadius: mode === "original" ? 14 : 0,
                display: "block",
              }}
            />
          </div>
        )}

        {(mode === "split" || mode === "result") && (
          <div style={{ position: "relative" }}>
            <div style={badgeStyle("rgba(26,23,20,0.7)")}>Ghost</div>
            <div
              className="checker"
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: mode === "result" ? 14 : 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={result}
                alt="Ghost mannequin çıktısı"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
