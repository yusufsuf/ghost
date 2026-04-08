"use client";

interface DownloadButtonProps {
  imageDataUrl: string;
  filename: string;
}

export default function DownloadButton({ imageDataUrl, filename }: DownloadButtonProps) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <button
      onClick={handleDownload}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "13px 24px",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        letterSpacing: "0.03em",
        background: "var(--accent)",
        color: "#fff",
        transition: "opacity 0.18s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      İndir
    </button>
  );
}
