import { ImageResponse } from "workers-og";
import MetamorphousFontData from "../metamorphous-400.woff";
import { AZULEJOS } from "./azulejos";

/**
 * Palette mirrors the site's design tokens (globals.css).
 * Values are sRGB hex; SVG/Satori don't accept display-p3 directly.
 */
const COLORS = {
  bg: "#f5efe5", // warm cream paper
  fg: "#1c1a16", // warm near-black
  muted: "#7a7368",
  border: "#e6dfd1",
  accent: "#4a6b8a", // dusty blue
};

/* ───────── seeded RNG + hash ───────── */

/** FNV-1a 32-bit. Stable across requests; same path → same azulejo. */
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Convert a Uint8Array to a base64 string (no Buffer in Workers). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  // 0x8000 chunks avoid hitting the JS engine's argument count limit on
  // String.fromCharCode for large buffers.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(bin);
}

/* ───────── handler ───────── */

const OG_W = 1200;
const OG_H = 630;
const ACCENT_W = 200;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Parse the OG image request from pathname.
    // Routes: / (homepage), /posts (category), /posts-my-title (content)
    let path: string | undefined;
    let title: string | undefined;

    if (pathname === "/" || pathname === "") {
      path = undefined;
      title = undefined;
    } else {
      const cleanPath = pathname.substring(1);
      const firstDashIndex = cleanPath.indexOf("-");
      if (firstDashIndex === -1) {
        path = cleanPath;
        title = undefined;
      } else {
        path = cleanPath.substring(0, firstDashIndex);
        title = decodeURIComponent(cleanPath.substring(firstDashIndex + 1));
      }
    }

    // Pick an azulejo deterministically by URL hash. Same path → same
    // tile forever. Empty manifest → worker falls back to a solid strip.
    const seed = hashSeed(pathname || "/");
    let accentSrc: string;
    if (AZULEJOS.length > 0) {
      const tile = AZULEJOS[seed % AZULEJOS.length];
      accentSrc = `data:image/png;base64,${bytesToBase64(tile)}`;
    } else {
      // 1×1 transparent PNG fallback. The strip's background color
      // shows through, so the layout still reads even without
      // generated tiles available.
      accentSrc =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    }

    // Font loaded as Uint8Array via the wrangler Data rule.
    const Metamorphous =
      (MetamorphousFontData as any).buffer || MetamorphousFontData;

    const wordmark = "@iammatthias";

    /**
     * Common shell — azulejo accent strip on the left (200px), type
     * column on the right with consistent padding.
     */
    function shell(typeColumn: string): string {
      return `
        <div style="
          display: flex;
          width: ${OG_W}px;
          height: ${OG_H}px;
          background: ${COLORS.bg};
          font-family: 'Metamorphous', serif;
        ">
          <div style="
            display: flex;
            flex-shrink: 0;
            width: ${ACCENT_W}px;
            height: ${OG_H}px;
            background: ${COLORS.border};
            overflow: hidden;
          ">
            <img
              src="${accentSrc}"
              width="${ACCENT_W}"
              height="${ACCENT_W}"
              style="display: block; width: ${ACCENT_W}px; height: auto;"
            />
          </div>
          <div style="
            display: flex;
            flex-direction: column;
            flex: 1;
            padding: 60px 72px;
            box-sizing: border-box;
            color: ${COLORS.fg};
          ">
            ${typeColumn}
          </div>
        </div>
      `;
    }

    let html: string;

    if (!path && !title) {
      // Homepage — wordmark centered with a small italic tagline
      html = shell(`
        <div style="
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: auto 0;
        ">
          <div style="
            display: flex;
            font-size: 72px;
            line-height: 1.1;
            letter-spacing: -0.01em;
          ">${wordmark}</div>
          <div style="
            display: flex;
            font-size: 28px;
            line-height: 1.3;
            color: ${COLORS.muted};
          ">a personal site of thoughts, projects, and ideas</div>
        </div>
      `);
    } else if (path && !title) {
      // Category page — wordmark top, large category name
      html = shell(`
        <div style="
          display: flex;
          font-size: 28px;
          line-height: 1;
          color: ${COLORS.muted};
          margin-bottom: auto;
        ">${wordmark}</div>
        <div style="
          display: flex;
          font-size: 88px;
          line-height: 1.05;
          text-transform: capitalize;
          letter-spacing: -0.015em;
        ">${escapeHtml(path)}</div>
      `);
    } else {
      // Content page — wordmark top, kicker + title
      html = shell(`
        <div style="
          display: flex;
          font-size: 28px;
          line-height: 1;
          color: ${COLORS.muted};
          margin-bottom: auto;
        ">${wordmark}</div>
        <div style="
          display: flex;
          flex-direction: column;
          gap: 22px;
        ">
          <div style="
            display: flex;
            font-size: 26px;
            line-height: 1;
            color: ${COLORS.accent};
            text-transform: lowercase;
            letter-spacing: 0.01em;
          ">${escapeHtml(path!)}</div>
          <div style="
            display: flex;
            font-size: 60px;
            line-height: 1.1;
            letter-spacing: -0.015em;
          ">${escapeHtml(title!)}</div>
        </div>
      `);
    }

    return new ImageResponse(html, {
      width: OG_W,
      height: OG_H,
      fonts: [
        {
          name: "Metamorphous",
          data: Metamorphous,
          style: "normal",
          weight: 400,
        },
      ],
      debug: false,
    });
  },
};

/** Minimal HTML escape so titles with `<` etc. don't break Satori parsing. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
