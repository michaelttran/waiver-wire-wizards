"use client";

import { useState } from "react";

export default function CopyImageButton({
  targetId,
  fileName,
}: {
  targetId: string;
  fileName: string;
}) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function handleClick() {
    const el = document.getElementById(targetId);
    if (!el) return;

    setStatus("copying");
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const fullWidth = el.scrollWidth;
      const fullHeight = el.scrollHeight;

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        width: fullWidth,
        height: fullHeight,
        // Keep the simulated window at the real viewport width so any
        // viewport-relative CSS (e.g. clamp()/vw column widths) renders
        // identically to how `fullWidth` above was measured. Overriding
        // this to `fullWidth` would make those values recompute larger
        // mid-capture and clip the right edge again.
        windowWidth: window.innerWidth,
        onclone: (_doc, clonedEl) => {
          // The target sits inside ancestors with `overflow-x-auto` (for
          // on-screen scrolling) and a card wrapper with `overflow: hidden`.
          // Both would clip the capture to the visible viewport, so widen
          // and un-clip the whole ancestor chain on the clone only.
          clonedEl.style.width = `${fullWidth}px`;
          clonedEl.style.height = `${fullHeight}px`;
          clonedEl.style.overflow = "visible";
          let node = clonedEl.parentElement;
          while (node) {
            node.style.overflow = "visible";
            node.style.maxWidth = "none";
            node = node.parentElement;
          }
        },
      });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Failed to render image");

      if (navigator.clipboard && "write" in navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus("copied");
      } else {
        // Clipboard image writes aren't supported here; fall back to a download.
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        setStatus("copied");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-purple/30 text-purple text-xs font-600 px-3 py-1.5 hover:bg-lavender transition-colors shrink-0"
    >
      {status === "copying"
        ? "Copying…"
        : status === "copied"
          ? "Copied!"
          : status === "error"
            ? "Couldn't copy — downloaded instead"
            : "Copy as Image"}
    </button>
  );
}
