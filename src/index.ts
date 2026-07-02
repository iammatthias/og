import { ImageResponse } from "workers-og";
import MetamorphousFontData from "../metamorphous-400.woff";
import { AZULEJOS } from "./azulejos";

/**
 * Palette mirrors the site's design tokens (globals.css).
 * Values are sRGB hex; SVG/Satori don't accept display-p3 directly.
 */
const COLORS = {
  bg: "#f1ebdc", // warm cream paper (--color-bg)
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

/**
 * Convert binary data to a base64 string for `data:` URIs.
 *
 * Wrangler's `[[rules]] type = "Data"` imports return ArrayBuffer (not
 * Uint8Array), so indexing with `[i]` returns `undefined` and the
 * stream gets silently corrupted. Wrap in a Uint8Array view first.
 *
 * The earlier `String.fromCharCode.apply(null, typedArray)` chunk
 * approach also misbehaves in workerd — the TypedArray-as-arguments
 * pattern doesn't reliably enumerate bytes. The plain per-byte loop
 * is unambiguous and fast enough for ~50 KB JPEGs (sub-ms).
 */
function bytesToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = ArrayBuffer.isView(input)
    ? (input as Uint8Array)
    : new Uint8Array(input);
  let bin = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/* ───────── handler ───────── */

const OG_W = 1200;
const OG_H = 630;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Parse the OG image request from pathname. Segment-based:
    //   /                     → homepage card
    //   /<section>            → category card ("posts", "open-source", …)
    //   /<section>/<title>    → content card (title URL-encoded)
    // Segments (not a dash separator) because publication slugs can
    // themselves contain dashes — a dash split rendered "open-source"
    // as kicker "open" + title "source".
    const safeDecode = (s: string): string => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };
    const segments = pathname.split("/").filter(Boolean);
    const path: string | undefined = segments[0]
      ? safeDecode(segments[0])
      : undefined;
    const title: string | undefined =
      segments.length > 1 ? safeDecode(segments.slice(1).join("/")) : undefined;

    // One deterministic azulejo per page. fnv1a(pathname) % N — same URL
    // always shows the same tile.
    const seed = hashSeed(pathname || "/");
    const FALLBACK_PNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const accentSrc =
      AZULEJOS.length === 0
        ? FALLBACK_PNG
        : `data:image/jpeg;base64,${bytesToBase64(AZULEJOS[seed % AZULEJOS.length])}`;

    // Font loaded as Uint8Array via the wrangler Data rule.
    const Metamorphous =
      (MetamorphousFontData as any).buffer || MetamorphousFontData;

    const wordmark = "@iammatthias";
    // Visual diamond is ~TILE × √2 across (≈ 136px at TILE=96). The
    // wrapper holds a square layout slot bigger than the diamond's
    // bounding box so the rotated corners don't overlap the wordmark
    // below. Slot stays at 192 so the surrounding type column keeps
    // the same centered positioning across all OG variants.
    const TILE = 96;
    const TILE_SLOT = 192;

    /**
     * Common shell — full-card centered column. Single azulejo
     * (rotated to a diamond) at the top, centered horizontally, with
     * text content stacked beneath. Padding gives consistent breathing
     * room on all sides.
     */
    function shell(typeColumn: string): string {
      return `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          width: ${OG_W}px;
          height: ${OG_H}px;
          padding: 56px 96px;
          box-sizing: border-box;
          background: ${COLORS.bg};
          font-family: 'Metamorphous', serif;
          color: ${COLORS.fg};
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${TILE_SLOT}px;
            height: ${TILE_SLOT}px;
            flex-shrink: 0;
          ">
            <img
              src="${accentSrc}"
              width="${TILE}"
              height="${TILE}"
              style="display: block; width: ${TILE}px; height: ${TILE}px; transform: rotate(45deg);"
            />
          </div>
          ${typeColumn}
        </div>
      `;
    }

    let html: string;

    if (!path && !title) {
      // Homepage — wordmark + tagline, both centered beneath the tile.
      html = shell(`
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin-top: 56px;
          text-align: center;
        ">
          <div style="
            display: flex;
            font-size: 72px;
            line-height: 1;
            letter-spacing: -0.01em;
          ">${wordmark}</div>
          <div style="
            display: flex;
            font-size: 26px;
            line-height: 1.3;
            color: ${COLORS.muted};
          ">a cozy corner of the web, open and personal</div>
        </div>
      `);
    } else if (path && !title) {
      // Category page — small wordmark above, large category name below.
      html = shell(`
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          margin-top: 48px;
          text-align: center;
        ">
          <div style="
            display: flex;
            font-size: 30px;
            line-height: 1;
            color: ${COLORS.muted};
          ">${wordmark}</div>
          <div style="
            display: flex;
            font-size: 88px;
            line-height: 1.05;
            text-transform: capitalize;
            letter-spacing: -0.015em;
          ">${escapeHtml(path)}</div>
        </div>
      `);
    } else {
      // Content page — wordmark + italic kicker (path) + big title.
      html = shell(`
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 40px;
          text-align: center;
          max-width: 920px;
        ">
          <div style="
            display: flex;
            font-size: 26px;
            line-height: 1;
            color: ${COLORS.muted};
          ">${wordmark}</div>
          <div style="
            display: flex;
            font-size: 22px;
            line-height: 1;
            color: ${COLORS.accent};
            text-transform: lowercase;
            letter-spacing: 0.02em;
            margin-top: 8px;
          ">${escapeHtml(path!)}</div>
          <div style="
            display: flex;
            font-size: 56px;
            line-height: 1.1;
            letter-spacing: -0.015em;
            margin-top: 6px;
          ">${escapeHtml(title!)}</div>
        </div>
      `);
    }

    const image = new ImageResponse(html, {
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
    // The card is a pure function of the URL, so let scrapers and the
    // edge hold it — Satori re-renders are the expensive part. Content
    // changes change the title (and therefore the URL), so long TTLs
    // never serve a stale card. Wrapped in a fresh Response in case
    // ImageResponse's headers are immutable.
    return new Response(image.body, {
      status: image.status,
      headers: {
        "Content-Type": image.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
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
