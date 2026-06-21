import { redirect } from "next/navigation";
import { getDefaultPathForUser } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? getDefaultPathForUser(user) : "/login");
}
