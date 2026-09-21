import { redirect } from "next/navigation";

// proxy.ts redirige "/" según la sesión y el rol; esto es solo el respaldo.
export default function Home() {
  redirect("/login");
}
