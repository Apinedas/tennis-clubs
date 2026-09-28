import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { BookingPolicyForm } from "./booking-policy-form";

export const metadata = { title: "Reservas · Academia de Tenis" };

export default async function BookingPolicyPage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const { data: policy, error } = await supabase
    .from("booking_policy")
    .select("*")
    .eq("club_id", clubId)
    .single();

  if (error || !policy) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar la política de reservas.
      </p>
    );
  }

  return <BookingPolicyForm policy={policy} />;
}
