import { compatibility } from "@/domain/compatibility";
import type { MentorProfile, StudentProfile } from "@/domain/types";

export function topReasonText(s: StudentProfile, m: MentorProfile) {
  return compatibility(s, m)
    .components.filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((c) => `${c.label} +${c.points}`)
    .join("; ");
}
