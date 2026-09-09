import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CopilotProvider } from "@/context/CopilotContext";
import { CopilotDrawer } from "@/components/copilot/CopilotDrawer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const hasAuth = cookieStore.has("refresh_token") || cookieStore.has("access_token");
  if (!hasAuth) {
    redirect("/login");
  }

  return (
    <CopilotProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      {/* Floating AI Copilot — persists across all dashboard tab navigation */}
      <CopilotDrawer />
    </CopilotProvider>
  );
}
