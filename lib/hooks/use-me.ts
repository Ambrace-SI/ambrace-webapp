"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, saveProfile } from "@/lib/api/me";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { Me, ProfileUpdate } from "@/types/profile";

export const ME_KEY = ["me"] as const;

/** The signed-in student and their profile. Shared by every screen. */
export function useMe() {
  const query = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const hydrated = useHydrated();

  // The frame around a page asks for the profile first, and it can arrive
  // before the page inside has been taken over from the server. The server
  // drew that page without a profile, so until then the page gets none too.
  return hydrated ? query : { ...query, data: undefined, error: null };
}

/** Saves the profile and updates every screen that shows it. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: ProfileUpdate) => saveProfile(profile),
    onSuccess: (me: Me) => queryClient.setQueryData(ME_KEY, me),
  });
}
