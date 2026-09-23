import { parseBody } from "next-sanity/webhook";
import { revalidatePath, revalidateTag } from "next/cache";
import { SANITY_EDITORIAL_TAG } from "@/lib/sanity/queries";

const EDITORIAL_TYPES = new Set(["siteSettings", "page", "offer", "resourcePresentation", "faq", "article"]);

export async function POST(request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "SANITY_REVALIDATE_SECRET is not configured" }, { status: 500 });
  }

  try {
    const { body, isValidSignature } = await parseBody(request, secret, true);
    if (isValidSignature !== true) {
      return Response.json({ error: "Invalid Sanity webhook signature" }, { status: 401 });
    }
    if (!body?._type || !EDITORIAL_TYPES.has(body._type)) {
      return Response.json({ error: "Unsupported or missing editorial document type" }, { status: 400 });
    }

    revalidateTag(SANITY_EDITORIAL_TAG, { expire: 0 });
    revalidateTag(`sanity:${body._type}`, { expire: 0 });
    revalidatePath("/nouveau");
    revalidatePath("/nouveau/faq");
    revalidatePath("/nouveau/bibliotheque");
    revalidatePath("/nouveau/ressources/[slug]", "page");
    if (body._type === "article") {
      revalidatePath("/nouveau/articles");
      revalidatePath("/nouveau/articles/[slug]", "page");
    }

    return Response.json({ revalidated: true, type: body._type, tag: SANITY_EDITORIAL_TAG });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook parsing failed" }, { status: 400 });
  }
}
