import Requests from "./requests";
import "./requests.css";
import AccessBoundary from "../_components/AccessBoundary";
import { requireAdminPage } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const access = await requireAdminPage();
  if (!access.ok) return <AccessBoundary reason={access.reason}/>;

  const query = await searchParams;
  const requestedId = typeof query?.requestId === "string" ? query.requestId : null;
  return <Requests initialRequestId={requestedId}/>;
}
