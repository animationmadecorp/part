import assert from "node:assert/strict";
import test from "node:test";
import { buildResourceStructurePatch } from "./resource-migration.mjs";
import { normalizeResourceGallery, resolveResourceMedia } from "./resource-core.mjs";

const imageUrl = (name) => `https://cdn.sanity.io/images/ez6qtt5k/production/${name}-1200x800.png`;

test("la galerie legacy déduplique la couverture répétée dans le corps", () => {
  const resource = {
    title: "Personnalise ta scène Blender",
    coverUrl: imageUrl("cover"),
    coverAlt: "Vue de la scène éclairée",
    coverAssetRef: "image-cover",
    body: [
      { _type: "block", style: "normal", children: [] },
      { _type: "image", asset: { _ref: "image-cover" }, assetRef: "image-cover", url: imageUrl("cover"), alt: "Vue de la scène éclairée" },
      { _type: "image", asset: { _ref: "image-detail" }, assetRef: "image-detail", url: imageUrl("detail"), alt: "Réglages de la lumière" },
    ],
  };

  const resolved = resolveResourceMedia(resource);
  assert.equal(resolved.gallery.length, 2);
  assert.deepEqual(resolved.gallery.map((item) => item.assetRef), ["image-cover", "image-detail"]);
  assert.equal(resolved.legacyBody.filter((block) => block._type === "image").length, 0);
  assert.equal(resolved.usedLegacyGallery, true);
});

test("une galerie structurée garde ses médias et retire les doublons du corps legacy", () => {
  const resource = {
    title: "Ressource structurée",
    gallery: [{ mediaType: "image", imageUrl: imageUrl("structured"), imageAlt: "Aperçu structuré", imageAssetRef: "image-structured" }],
    body: [
      { _type: "block", style: "normal", children: [] },
      { _type: "image", asset: { _ref: "image-structured" }, url: imageUrl("structured"), alt: "Aperçu structuré" },
    ],
  };

  const resolved = resolveResourceMedia(resource);
  assert.equal(resolved.gallery.length, 1);
  assert.equal(resolved.gallery[0].type, "image");
  assert.equal(resolved.legacyBody.length, 1);
  assert.equal(resolved.legacyBody[0]._type, "block");
  assert.equal(resolved.usedLegacyGallery, false);
});

test("les vidéos et leurs posters sont normalisés pour le futur sans inventer de média", () => {
  const gallery = normalizeResourceGallery([
    { mediaType: "video", videoUrl: "https://cdn.sanity.io/files/ez6qtt5k/production/demo.mp4", videoAssetRef: "file-demo", posterUrl: imageUrl("poster"), posterAlt: "Poster" },
    { mediaType: "image", imageUrl: "http://insecure.example/image.png", imageAlt: "Refusée" },
  ]);

  assert.equal(gallery.length, 1);
  assert.equal(gallery[0].type, "video");
  assert.equal(gallery[0].posterUrl, imageUrl("poster"));
});

test("la migration ciblée prépare un brouillon sans supprimer le corps source", () => {
  const resource = {
    title: "Personnalise ta scène Blender",
    subtitle: "Une lumière et un fond, sans tout refaire.",
    coverUrl: imageUrl("cover"),
    coverAlt: "Couverture",
    coverAssetRef: "image-cover",
    body: [{ _type: "image", assetRef: "image-detail", url: imageUrl("detail"), alt: "Détail" }],
  };

  const result = buildResourceStructurePatch(resource);
  assert.equal(result.patch.summary, resource.subtitle);
  assert.equal(result.patch.gallery.length, 2);
  assert.equal(result.notes.includes("installation à structurer manuellement depuis le corps legacy"), false);
});
