import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import sharp from "sharp";

const ANGLE_LABELS: Record<string, string> = {
  front: "FRONT VIEW",
  side:  "SIDE VIEW",
  back:  "BACK VIEW",
};

const ANGLE_PROMPTS: Record<string, string> = {
  front: "Remove the mannequin and all background elements. Keep only the garment exactly as seen from the front (labeled FRONT VIEW). Place it on a pure white background. Preserve all fabric details, textures, colors, stitching, and embellishments. Do not include any text labels in the output.",
  side:  "Remove the mannequin and all background elements. Keep only the garment exactly as seen from the side (labeled SIDE VIEW). Place it on a pure white background. Preserve all fabric details, textures, colors, stitching, and embellishments. Do not include any text labels in the output.",
  back:  "Remove the mannequin and all background elements. Keep only the garment exactly as seen from the back (labeled BACK VIEW). Place it on a pure white background. Preserve all fabric details, textures, colors, stitching, and embellishments. Do not include any text labels in the output.",
};

async function addLabel(file: File, label: string): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const meta = await sharp(inputBuffer).metadata();
  const w = meta.width ?? 800;

  const fontSize = Math.max(32, Math.round(w * 0.05));
  const padding = Math.round(fontSize * 0.7);

  // Render the text using Sharp's Pango-based text feature.
  // Pango handles font fallback automatically (works on both Windows & Linux containers).
  const textBuffer = await sharp({
    text: {
      text: `<span foreground="white">${label}</span>`,
      font: `sans Bold ${fontSize}`,
      rgba: true,
    },
  }).png().toBuffer();

  const textMeta = await sharp(textBuffer).metadata();
  const textH = textMeta.height ?? fontSize;
  const boxH = textH + padding * 2;

  // Solid black bar (no font dependency)
  const blackBar = await sharp({
    create: {
      width: w,
      height: boxH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.82 },
    },
  }).png().toBuffer();

  // Combine text onto black bar
  const labelLayer = await sharp(blackBar)
    .composite([{ input: textBuffer, top: padding, left: padding }])
    .png()
    .toBuffer();

  return sharp(inputBuffer)
    .composite([{ input: labelLayer, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const frontFile = formData.get("front") as File | null;
    const sideFile  = formData.get("side")  as File | null;
    const backFile  = formData.get("back")  as File | null;
    const angle       = (formData.get("angle")        as string | null) ?? "front";
    const aspectRatio = (formData.get("aspect_ratio") as string | null) ?? "4:5";
    const resolution  = (formData.get("resolution")   as string | null) ?? "2K";

    if (!frontFile || !sideFile || !backFile) {
      return NextResponse.json({ error: "Ön, yan ve arka görsellerin tamamı gereklidir." }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: "FAL_KEY ayarlanmamış. .env.local dosyasına FAL_KEY ekleyin." },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    // Add view labels to each image
    const [frontLabeled, sideLabeled, backLabeled] = await Promise.all([
      addLabel(frontFile, ANGLE_LABELS.front),
      addLabel(sideFile,  ANGLE_LABELS.side),
      addLabel(backFile,  ANGLE_LABELS.back),
    ]);

    // Upload labeled images to fal storage
    const toFile = (buf: Buffer, name: string) =>
      new File([new Uint8Array(buf)], name, { type: "image/jpeg" });

    const [frontUrl, sideUrl, backUrl] = await Promise.all([
      fal.storage.upload(toFile(frontLabeled, "front.jpg")),
      fal.storage.upload(toFile(sideLabeled,  "side.jpg")),
      fal.storage.upload(toFile(backLabeled,  "back.jpg")),
    ]);

    // Primary image (selected angle) goes first
    const primaryUrl =
      angle === "front" ? frontUrl :
      angle === "side"  ? sideUrl  :
      backUrl;

    const referenceUrls = [frontUrl, sideUrl, backUrl].filter((u) => u !== primaryUrl);

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt: ANGLE_PROMPTS[angle] ?? ANGLE_PROMPTS.front,
        image_urls: [primaryUrl, ...referenceUrls],
        num_images: 1,
        output_format: "png",
        aspect_ratio: aspectRatio as "9:16" | "16:9" | "5:4" | "4:5" | "auto",
        resolution: resolution as "1K" | "2K" | "4K",
      },
    });

    const data = result.data as { images?: { url: string }[] };
    const outputUrl = data?.images?.[0]?.url;

    if (!outputUrl) {
      console.error("[/api/process] Unexpected model response:", JSON.stringify(result.data));
      return NextResponse.json({ error: "Model çıktısı alınamadı." }, { status: 500 });
    }

    const imgRes = await fetch(outputUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
      filename: `ghost_${angle}.png`,
    });
  } catch (err) {
    console.error("[/api/process]", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
