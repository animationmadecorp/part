import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { isSafeEditorialPath } from "@/lib/sanity/content";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug") || "/nouveau";

  if (!process.env.SANITY_PREVIEW_SECRET || secret !== process.env.SANITY_PREVIEW_SECRET) {
    return new Response("Invalid preview secret", { status: 401 });
  }
  if (!process.env.SANITY_PREVIEW_TOKEN) {
    return new Response("SANITY_PREVIEW_TOKEN is not configured", { status: 503 });
  }
  if (!isSafeEditorialPath(slug)) {
    return new Response("Invalid preview path", { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();
  redirect(slug);
}
