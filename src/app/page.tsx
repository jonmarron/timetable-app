import TimetableView from "@/components/timetable/timetable-view";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-350 mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <ThemeToggle />
        </div>
        <TimetableView />
      </div>
    </main>
  );
}
