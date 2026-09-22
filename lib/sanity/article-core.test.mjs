import test from "node:test";
import assert from "node:assert/strict";
import { normalizeArticle, uniquePublishedArticles, validateArticleInput, safeArticleUrl, resolveArticleIdentity, preservePublicDraftFields, shouldUploadCover } from "./article-core.mjs";

const body = [{ _type: "block", _key: "a", style: "normal", markDefs: [], children: [{ _type: "span", _key: "b", text: "Texte", marks: [] }] }];
const article = { _id: "a", slug: "exemple", status: "published", title: "Exemple", summary: "Résumé", body };
test("drafts, versions et archivés exclus même si le slug existe", () => {
  assert.equal(normalizeArticle({ ...article, _id: "drafts.a" }), null);
  assert.equal(normalizeArticle({ ...article, _id: "versions.a" }), null);
  assert.equal(normalizeArticle({ ...article, status: "archived" }), null);
  assert.equal(normalizeArticle({ ...article, status: "draft" }), null);
});
test("slugs publiés dupliqués dédupliqués", () => assert.equal(uniquePublishedArticles([article, { ...article, _id: "b" }]).length, 1));
test("texte simple devient blocs et URL dangereuse rejetée", () => {
  assert.equal(validateArticleInput({ title: "Exemple", summary: "Résumé", body: "Un paragraphe.\n\nUn autre." }).body.length, 2);
  assert.equal(safeArticleUrl("javascript:alert(1)"), "");
  assert.throws(() => validateArticleInput({ title: "Exemple", summary: "Résumé", body: [{ ...body[0], markDefs: [{ _type: "link", href: "javascript:alert(1)" }] }] }), /URL/);
});
test("fiche Studio à ID aléatoire résolue et collisions réelles refusées", () => {
  assert.equal(resolveArticleIdentity([{ _id: "random" }, { _id: "drafts.random" }], "exemple"), "random");
  assert.throws(() => resolveArticleIdentity([{ _id: "random" }, { _id: "autre" }], "exemple"), /Slug/);
});
test("édition brouillon préserve couverture et date publiques", () => {
  const fields = preservePublicDraftFields({ title: "Nouveau", publishedAt: null }, { cover: { asset: { _ref: "image-1" } }, publishedAt: "2026-01-01T00:00:00Z" });
  assert.equal(fields.title, "Nouveau");
  assert.equal(fields.cover.asset._ref, "image-1");
  assert.equal(fields.publishedAt, "2026-01-01T00:00:00Z");
});
test("seconde édition conserve les champs du brouillon plutôt que l’ancienne version publique", () => {
  const publicDoc = { cover: { asset: { _ref: "old" } }, publishedAt: "2025-01-01" };
  const draftDoc = { cover: { asset: { _ref: "new" } }, publishedAt: "2026-01-01" };
  const fields = preservePublicDraftFields({ title: "Révision", publishedAt: null }, draftDoc || publicDoc);
  assert.equal(fields.cover.asset._ref, "new");
  assert.equal(fields.publishedAt, "2026-01-01");
});
test("publication d’un brouillon ne téléverse aucune couverture", () => {
  assert.equal(shouldUploadCover({ coverPath: "photo.jpg", publish: true, hasDraft: true }), false);
  assert.equal(shouldUploadCover({ coverPath: "photo.jpg", publish: false, hasDraft: true }), true);
});
