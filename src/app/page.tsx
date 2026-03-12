import TimetableView from "@/components/timetable/timetable-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EditNameDialog } from "@/components/auth/edit-name-dialog";
import { createClient } from "@/lib/supabase/server";
import { possessiveTitle } from "@/lib/utils";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? null;
  const title = userName ? possessiveTitle(userName) : "Weekly Planner";
  const headerLabel = userName ?? user?.email ?? "";

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-350 mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-2">
            {user && (
              <EditNameDialog currentName={userName} displayLabel={headerLabel} />
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
