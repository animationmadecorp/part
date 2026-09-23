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

test("la migration AM Light structure le contenu connu sans réécrire le corps", () => {
  const body = [
    { _type: "block", _key: "b1", style: "normal", children: [{ _type: "span", text: "Introduction" }] },
    { _type: "block", _key: "b2", style: "h2", children: [{ _type: "span", text: "Quatre ambiances à explorer" }] },
    { _type: "block", _key: "b3", style: "normal", children: [{ _type: "span", text: "Classique, doux, packshot et rim light." }] },
    { _type: "image", _key: "b4", assetRef: "image-cover", url: imageUrl("cover"), alt: "Cover" },
    { _type: "image", _key: "b5", assetRef: "image-detail", url: imageUrl("detail"), alt: "Détail" },
    { _type: "block", _key: "b6", style: "h2", children: [{ _type: "span", text: "Garde la main sur ton éclairage" }] },
    { _type: "block", _key: "b7", style: "normal", children: [{ _type: "span", text: "Choisis la distance et l’intensité." }] },
    { _type: "block", _key: "b8", style: "h2", children: [{ _type: "span", text: "Installation" }] },
    { _type: "block", _key: "b9", style: "normal", children: [{ _type: "span", text: "Installe le ZIP dans Blender." }] },
    { _type: "block", _key: "b10", style: "normal", children: [{ _type: "span", text: "Version 1.2.0. Le fichier déclare Blender 3.0 minimum ; compatibilité à vérifier sur ta version. Licence GPL-3.0-or-later." }] },
  ];
  const resource = {
    title: "Personnalise ta scène Blender",
    subtitle: "Quatre éclairages pour tes scènes Blender.",
    coverUrl: imageUrl("cover"),
    coverAlt: "Cover",
    coverAssetRef: "image-cover",
    body,
    metadata: [
      { _key: "version", _type: "resourceMetadataItem", label: "Version", value: "1.2.0" },
      { _key: "lights", _type: "resourceMetadataItem", label: "Éclairages", value: "Classique, Doux, Packshot, Rim light" },
      { _key: "installation", _type: "resourceMetadataItem", label: "Installation", value: "ZIP à installer dans Blender" },
    ],
  };

  const result = buildResourceStructurePatch(resource);
  assert.equal(result.patch.recap.filter((block) => block._type === "image").length, 0);
  assert.equal(result.patch.recap.length, 5);
  assert.equal(result.patch.installation.length, 1);
  assert.equal(result.patch.license, "GPL-3.0-or-later");
  assert.deepEqual(result.patch.technicalDetails.map((item) => item.value), ["1.2.0", "Blender 3.0 minimum · à vérifier sur ta version"]);
  assert.deepEqual(result.patch.metadata.map((item) => item.label), ["Éclairages"]);
});

test("un brouillon déjà structuré reste idempotent et conserve ses choix éditoriaux", () => {
  const resource = {
    title: "Ressource éditée",
    subtitle: "Ancienne phrase",
    summary: "Phrase corrigée dans Studio.",
    gallery: [{ mediaType: "image", imageUrl: imageUrl("edited"), imageAlt: "Visuel corrigé", imageAssetRef: "image-edited" }],
    recap: [{ _type: "block", _key: "recap-edited", style: "normal", children: [{ _type: "span", text: "Récapitulatif corrigé." }] }],
    installation: [{ _type: "block", _key: "install-edited", style: "normal", children: [{ _type: "span", text: "Installation corrigée." }] }],
    technicalDetails: [{ _key: "version-edited", _type: "resourceDetailItem", label: "Version", value: "2.0.0" }],
    license: "GPL-3.0-or-later",
    metadata: [{ _key: "lights", _type: "resourceMetadataItem", label: "Éclairages", value: "Choix édité" }],
    body: [{ _type: "block", children: [{ _type: "span", text: "Corps legacy intact." }] }],
  };

  const result = buildResourceStructurePatch(resource);
  assert.deepEqual(result.patch, {});
});
