import { redirect } from "next/navigation";

export default async function FinanceRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const original = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(original)) {
    for (const item of Array.isArray(value) ? value : value == null ? [] : [value]) {
      params.append(key, item);
    }
  }
  if (!params.has("financeStart") && params.has("start")) params.set("financeStart", params.get("start")!);
  if (!params.has("financeEnd") && params.has("end")) params.set("financeEnd", params.get("end")!);
  params.set("section", "finance");
  redirect(`/operations?${params.toString()}`);
}
