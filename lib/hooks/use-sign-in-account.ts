"use client";

import { useQuery } from "@tanstack/react-query";

import { getSignInAccount } from "@/lib/auth/account";

export const SIGN_IN_ACCOUNT_KEY = ["sign-in-account"] as const;

/**
 * The email and sign-in method of whoever is signed in. Neither can change
 * while they stay signed in, so it is read once.
 */
export function useSignInAccount() {
  return useQuery({
    queryKey: SIGN_IN_ACCOUNT_KEY,
    queryFn: getSignInAccount,
    staleTime: Infinity,
    retry: false,
  });
}
