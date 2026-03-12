"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInError, signInAction, signInPending] = useActionState(signIn, null);
  const [signUpError, signUpAction, signUpPending] = useActionState(signUp, null);

  const isSignIn = mode === "signin";
  const error = isSignIn ? signInError : signUpError;
  const formAction = isSignIn ? signInAction : signUpAction;
  const isPending = isSignIn ? signInPending : signUpPending;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignIn ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {!isSignIn && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your first name"
                disabled={isPending}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              required
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Loading…" : isSignIn ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(isSignIn ? "signup" : "signin")}
            className="text-foreground underline underline-offset-4 hover:text-primary cursor-pointer"
          >
            {isSignIn ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
