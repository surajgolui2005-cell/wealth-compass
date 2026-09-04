import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // If a refresh token cookie exists, user may already be authenticated
  const cookieStore = cookies();
  const hasRefreshToken = cookieStore.has('refresh_token');
  if (hasRefreshToken) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Wealth Compass</h1>
          <p className="text-muted-foreground mt-1 text-sm">Portfolio monitoring &amp; risk management</p>
        </div>
        {children}
      </div>
    </div>
  );
}
