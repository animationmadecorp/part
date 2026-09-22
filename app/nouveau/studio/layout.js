import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata = { robots: NO_INDEX_ROBOTS };

export default function StudioLayout({ children }) {
  return children;
}
