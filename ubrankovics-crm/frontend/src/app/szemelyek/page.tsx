import { redirect } from "next/navigation";

// A személyek listája a Törzsadatok egyik füle; a közvetlen cím oda visz.
export default function Page() {
  redirect("/torzsadatok?tab=szemely");
}
