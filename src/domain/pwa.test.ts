import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Progressive Web App (PWA) configuration", async (t) => {
  const rootDir = process.cwd();

  await t.test("manifest.webmanifest matches required metadata", () => {
    const manifestPath = path.join(rootDir, "public", "manifest.webmanifest");
    assert.ok(fs.existsSync(manifestPath), "manifest.webmanifest should exist in public/");

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.equal(manifestContent.name, "মেডিলিঙ্ক — Jibon Rokkha");
    assert.equal(manifestContent.short_name, "medilink");
    assert.equal(manifestContent.start_url, "./");
    assert.equal(manifestContent.display, "standalone");
    assert.equal(manifestContent.background_color, "#F7FAF9");
    assert.equal(manifestContent.theme_color, "#0E7C66");

    const icons = manifestContent.icons as Array<{ src: string; sizes: string }>;
    assert.ok(Array.isArray(icons), "icons must be an array");

    const hasSymbol192 = icons.some((i) => i.src.includes("symbol.png") && i.sizes === "192x192");
    const hasSymbol512 = icons.some((i) => i.src.includes("symbol.png") && i.sizes === "512x512");
    const hasLogo192 = icons.some((i) => i.src.includes("logo.png") && i.sizes === "192x192");
    const hasLogo512 = icons.some((i) => i.src.includes("logo.png") && i.sizes === "512x512");

    assert.ok(hasSymbol192, "must include 192x192 symbol icon");
    assert.ok(hasSymbol512, "must include 512x512 symbol icon");
    assert.ok(hasLogo192, "must include 192x192 logo icon");
    assert.ok(hasLogo512, "must include 512x512 logo icon");
  });

  await t.test("service worker public/sw.js exists with caching strategies", () => {
    const swPath = path.join(rootDir, "public", "sw.js");
    assert.ok(fs.existsSync(swPath), "sw.js must exist in public/");

    const swContent = fs.readFileSync(swPath, "utf-8");
    assert.ok(swContent.includes("isFontOrImage"), "Service worker should differentiate fonts/images");
    assert.ok(swContent.includes("isHtmlOrJs"), "Service worker should differentiate HTML/JS");
    assert.ok(swContent.includes("caches.match"), "Service worker should check caches");
    assert.ok(swContent.includes("fetch"), "Service worker should handle fetch");
  });

  await t.test("index.html contains manifest and PWA meta tags", () => {
    const indexPath = path.join(rootDir, "index.html");
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    assert.ok(
      indexContent.includes('<link rel="manifest" href="./manifest.webmanifest" />') ||
        indexContent.includes('<link rel="manifest" href="./manifest.webmanifest">'),
      "index.html must link manifest.webmanifest"
    );
    assert.ok(
      indexContent.includes('<meta name="theme-color" content="#0E7C66" />') ||
        indexContent.includes('<meta name="theme-color" content="#0E7C66">'),
      "index.html must set theme-color to #0E7C66"
    );
    assert.ok(
      indexContent.includes('<meta name="apple-mobile-web-app-capable" content="yes" />') ||
        indexContent.includes('<meta name="apple-mobile-web-app-capable" content="yes">'),
      "index.html must set apple-mobile-web-app-capable"
    );
    assert.ok(
      indexContent.includes('<meta name="apple-mobile-web-app-status-bar-style" content="default" />') ||
        indexContent.includes('<meta name="apple-mobile-web-app-status-bar-style" content="default">'),
      "index.html must set apple-mobile-web-app-status-bar-style"
    );
  });

  await t.test("layout.tsx includes offline banner with bilingual messages", () => {
    const layoutPath = path.join(rootDir, "src", "components", "layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(layoutContent.includes("isOnline"), "Layout should track isOnline status");
    assert.ok(layoutContent.includes('"online"'), "Layout should listen to window online event");
    assert.ok(layoutContent.includes('"offline"'), "Layout should listen to window offline event");
    assert.ok(
      layoutContent.includes("⚠️ আপনি অফলাইনে আছেন। সংরক্ষিত তথ্য প্রদর্শিত হচ্ছে।"),
      "Layout must contain the Bengali offline warning message"
    );
    assert.ok(
      layoutContent.includes("⚠️ You are offline. Showing cached information."),
      "Layout must contain the English offline warning message"
    );
  });
});
