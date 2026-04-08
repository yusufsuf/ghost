"use client";

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";

interface SlotUploaderProps {
  label: string;
  preview: string | null;
  onImageSelect: (file: File, preview: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export default function Uploader({ label, preview, onImageSelect, onRemove, disabled }: SlotUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      onImageSelect(file, url);
    },
    [onImageSelect]
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
      <p style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        margin: 0,
      }}>
        {label}
      </p>

      {preview ? (
        <div style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          aspectRatio: "3/4",
          background: "var(--bg-secondary)",
          boxShadow: "var(--shadow-sm)",
        }}>
          <img
            src={preview}
            alt={label}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {!disabled && (
            <button
              onClick={onRemove}
              title="Kaldır"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.9)",
                color: "var(--text-primary)",
                fontSize: 16,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-sm)",
                backdropFilter: "blur(4px)",
              }}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={!disabled ? onDrop : undefined}
          onDragOver={!disabled ? onDragOver : undefined}
          onDragLeave={!disabled ? onDragLeave : undefined}
          onClick={() => !disabled && inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--border-hover)"}`,
            borderRadius: 12,
            aspectRatio: "3/4",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: disabled ? "not-allowed" : "pointer",
            background: dragging ? "rgba(26,23,20,0.03)" : "var(--bg-card)",
            transition: "all 0.2s ease",
            opacity: disabled ? 0.5 : 1,
            userSelect: "none",
            boxShadow: dragging ? "var(--shadow-md)" : "var(--shadow-sm)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onChange}
          />

          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--bg-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>
            {dragging ? "Bırakın" : "Yükle"}
          </p>
        </div>
      )}
    </div>
  );
}
