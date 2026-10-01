// Rasterize public/icon.svg into the PWA / favicon PNGs: `bun run icons`.
import { Resvg } from "@resvg/resvg-js";

const pub = new URL("../public/", import.meta.url);
const icon = await Bun.file(new URL("icon.svg", pub)).text();

async function png(svg: string, size: number, name: string) {
  const out = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  await Bun.write(new URL(name, pub), out);
}

await png(icon, 512, "pwa-512.png");
await png(icon, 192, "pwa-192.png");
await png(icon, 180, "apple-touch-icon.png");
await png(icon, 32, "favicon-32.png");

// Maskable: full-bleed background, the mark shrunk into the 80% safe zone.
const inner = icon.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0d12"/><g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`,
  512,
  "pwa-maskable-512.png",
);

// Android status-bar badge: a white silhouette on transparent.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#fff">
    <path d="M40 262 C 130 130, 382 130, 472 262 C 382 394, 130 394, 40 262 Z M256 168 a94 94 0 1 0 0.1 0 Z" fill-rule="evenodd"/>
    <circle cx="256" cy="262" r="58"/>
  </svg>`,
  96,
  "badge-96.png",
);
console.log("icons written");
