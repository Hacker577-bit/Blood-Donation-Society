import { headers } from "next/headers";

export async function getRequestIp(): Promise<string> {
  const headerList = await headers();

  if (typeof headerList.get !== "function") {
    return "unknown";
  }

  return (
    headerList.get("x-real-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
