import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CoursesManager } from "./courses-manager";

export const metadata = { title: "Cursos · Academia de Tenis" };

export default async function CoursesPage({
  searchParams,
}: PageProps<"/admin/settings/courses">) {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const rosterCourseId = typeof params.course === "string" ? params.course : "";

  const [
    { data: courses },
    { data: pending },
    { data: courts },
    { data: coaches },
    { data: rates },
    { data: club },
    { data: roster },
    { data: members },
  ] = await Promise.all([
    supabase.rpc("list_club_courses", { p_club: clubId }),
    supabase.rpc("list_pending_enrollments", { p_club: clubId }),
    supabase.from("court").select("id, name").eq("club_id", clubId).eq("active", true).order("name"),
    supabase.rpc("list_club_coaches", { p_club: clubId }),
    supabase
      .from("rate")
      .select("id, name, price_amount")
      .eq("club_id", clubId)
      .eq("service", "course")
      .eq("active", true)
      .order("name"),
    supabase.from("club").select("currency").eq("id", clubId).single(),
    rosterCourseId
      ? supabase.rpc("list_course_roster", { p_course_id: rosterCourseId })
      : Promise.resolve({ data: null }),
    supabase.rpc("list_club_members", { p_club: clubId }),
  ]);

  return (
    <CoursesManager
      courses={courses ?? []}
      pending={pending ?? []}
      courts={courts ?? []}
      coaches={coaches ?? []}
      courseRates={rates ?? []}
      currency={club?.currency ?? "COP"}
      rosterCourseId={rosterCourseId}
      roster={roster ?? null}
      members={(members ?? []).filter((m) => m.roles.includes("student"))}
    />
  );
}
