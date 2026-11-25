import { isEducator, type EducatorType, type Profile } from "@/types/profile";

/**
 * Teachers and parents use the same screens; only the words differ. A parent
 * thinks of "my children", not "my students".
 */
export function membersLabel(type: EducatorType, count: number): string {
  if (type === "parent") return count === 1 ? "1 child" : `${count} children`;
  return count === 1 ? "1 student" : `${count} students`;
}

export function membersNoun(type: EducatorType): string {
  return type === "parent" ? "children" : "students";
}

/** "Class 9 · 24 students", or just the count when the group has no class. */
export function groupDetails(
  type: EducatorType,
  group: { class_level: number | null; member_count: number },
): string {
  return [
    group.class_level === null ? null : `Class ${group.class_level}`,
    membersLabel(type, group.member_count),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Teacher or parent, for wording. Defaults to teacher while loading. */
export function educatorTypeOf(
  profile: Profile | null | undefined,
): EducatorType {
  return profile && isEducator(profile.account_type)
    ? profile.account_type
    : "teacher";
}
