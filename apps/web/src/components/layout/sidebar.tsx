"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  BarChart2,
  ShieldAlert,
  Bell,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/common/logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolios", label: "Portfolios", icon: Briefcase },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/risk", label: "Risk Center", icon: ShieldAlert },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore errors; redirect regardless
    }
    queryClient.clear();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card shadow-sm">
      {/* Logo */}
      <div className="flex items-center px-6 py-5 border-b">
        <Logo size={36} showText showTagline href="/dashboard" priority />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-brand text-white shadow-md shadow-[#003B7A]/15 font-semibold"
                  : "text-muted-foreground hover:bg-[#F3F5F7] hover:text-[#003B7A] dark:hover:bg-accent dark:hover:text-white",
              )}
            >
              <Icon
                className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-white" : "text-current")}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}
