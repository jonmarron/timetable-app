"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) return "Email and password are required.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return error.message;

  redirect("/");
}

export async function signUp(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) return "Email and password are required.";
  if (password.length < 6) return "Password must be at least 6 characters.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) return error.message;

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
