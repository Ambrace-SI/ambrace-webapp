"use client";

import { Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { ChangePasswordForm } from "@/components/settings/account/change-password";
import {
  RowButton,
  SettingRow,
  SettingsGroup,
  SettingValue,
} from "@/components/settings/setting-rows";
import { Skeleton } from "@/components/ui/skeleton";
import { leaveAmbrace } from "@/lib/app/sign-out";
import type { SignInAccount } from "@/lib/auth/account";
import { useSignInAccount } from "@/lib/hooks/use-sign-in-account";

/**
 * The Account part of Settings: how the student gets in, and the way out.
 *
 * Everything here is about the account itself rather than about the student,
 * which is why it is kept apart from Profile.
 */
export function AccountSettings() {
  const account = useSignInAccount();

  return (
    <>
      <SettingsGroup title="Sign-in">
        <SettingRow
          label="Email"
          // The email is the account. Changing it safely needs the new
          // address to be confirmed first, so for now it is only shown.
          description="The address your account belongs to."
          value={
            account.isPending ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <SettingValue empty="Not available">
                {account.data?.email}
              </SettingValue>
            )
          }
        />
        {account.data ? <SignInMethod method={account.data.method} /> : null}
      </SettingsGroup>

      <SettingsGroup title="This device">
        <SignOutRow />
      </SettingsGroup>
    </>
  );
}

/**
 * The rows that depend on how the student signs in.
 *
 * An account with a password can change it. An account that signs in with
 * Google has no Ambrace password; it is told so plainly, with no button that
 * could not work.
 */
function SignInMethod({ method }: { method: SignInAccount["method"] }) {
  const [changing, setChanging] = useState(false);
  const change = useRef<HTMLButtonElement>(null);

  if (method === "google") {
    return (
      <>
        <SettingRow
          label="Google"
          description="You sign in with your Google account."
          value={<SettingValue>Connected</SettingValue>}
        />
        <SettingRow
          label="Password"
          description="Your account has no Ambrace password. You get in through Google, and Google keeps that password."
          value={<SettingValue empty="Not set">{null}</SettingValue>}
        />
      </>
    );
  }

  return (
    <SettingRow
      label="Password"
      description={
        changing
          ? "Enter the password you use now, then choose a new one."
          : "Use one you don't use anywhere else."
      }
      action={
        <RowButton ref={change} onClick={() => setChanging(true)}>
          Change password
        </RowButton>
      }
      editor={
        changing ? (
          <ChangePasswordForm
            onDone={() => {
              setChanging(false);
              // The cursor goes back to where the student pressed.
              requestAnimationFrame(() => change.current?.focus());
            }}
          />
        ) : undefined
      }
    />
  );
}

function SignOutRow() {
  const [leaving, setLeaving] = useState(false);

  return (
    <SettingRow
      label="Sign out"
      description="Your reports stay in your account."
      action={
        <RowButton
          disabled={leaving}
          aria-busy={leaving}
          onClick={() => {
            setLeaving(true);
            void leaveAmbrace();
          }}
        >
          {leaving ? (
            <>
              <Loader2Icon className="animate-spin" aria-hidden="true" />
              Signing out
            </>
          ) : (
            "Sign out"
          )}
        </RowButton>
      }
    />
  );
}
