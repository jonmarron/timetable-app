import TimetableView from "@/components/timetable/timetable-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-350 mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.email}
              </span>
            )}
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <TimetableView />
      </div>
    </main>
  );
}
