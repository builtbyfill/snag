import { redirect } from "next/navigation";

// "/" has nothing of its own: the dashboard, or /login when there's no session.
export default function Home() {
  redirect("/dashboard");
}
