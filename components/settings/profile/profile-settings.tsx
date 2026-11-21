"use client";

import { ProfileDetails } from "@/components/settings/profile/profile-details";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/hooks/use-me";

/** The Profile part of Settings: who the student is. */
export function ProfileSettings() {
  const { data: me } = useMe();
  const profile = me?.profile;

  if (!profile) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your profile
        </p>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  return <ProfileDetails profile={profile} />;
}
