import { Logo } from "@/components/common/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={64} className="mb-3" priority />
          <h1 className="text-3xl font-bold tracking-tight">Wealth Compass</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Portfolio monitoring &amp; risk management
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
