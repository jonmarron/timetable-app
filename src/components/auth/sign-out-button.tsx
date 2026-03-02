"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
