import { redirect } from "next/navigation";

// Az alvállalkozók listája a Törzsadatok egyik füle; a közvetlen cím oda visz.
export default function Page() {
  redirect("/torzsadatok?tab=alvallalkozo");
}
