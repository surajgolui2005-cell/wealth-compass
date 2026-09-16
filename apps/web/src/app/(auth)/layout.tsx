import { Logo } from "@/components/common/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#F3F5F7] dark:bg-[#071321] p-4 overflow-hidden">
      {/* Decorative gradient radial glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#005A9C]/10 dark:bg-[#003B7A]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00A99D]/15 dark:bg-[#00A99D]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 bg-white dark:bg-[#0B1E32] rounded-2xl shadow-xl shadow-[#003B7A]/10 border border-[#00A99D]/20 mb-4">
            <Logo size={68} priority />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-[#003B7A] dark:text-white">Wealth</span>
            <span className="text-[#00A99D] dark:text-[#6DD5A3]">Compass</span>
          </h1>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#008B75] dark:text-[#6DD5A3] uppercase mt-1">
            Plan Smarter • Grow Further
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Investor Portfolio Monitoring &amp; Institutional Risk Management
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-xl shadow-[#003B7A]/5 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
