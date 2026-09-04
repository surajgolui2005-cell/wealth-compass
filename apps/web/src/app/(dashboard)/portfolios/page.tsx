'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency } from '@/lib/utils';
import { Plus, ArrowRight, RefreshCw } from 'lucide-react';

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  description?: string;
  totalValue: number;
  createdAt: string;
}

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  currency: z.string().length(3, 'Must be a 3-letter currency code').toUpperCase(),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

export default function PortfoliosPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: portfolios = [], isLoading } = useQuery<Portfolio[]>({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const res = await apiClient.get('/portfolios');
      return (res as any).data ?? res.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { currency: 'INR' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => apiClient.post('/portfolios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      reset();
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Portfolios</h2>
          <p className="text-muted-foreground">Manage your investment portfolios</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Portfolio
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Portfolio</CardTitle></CardHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="My Growth Portfolio" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input placeholder="INR" maxLength={3} {...register('currency')} />
                  {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input placeholder="Long-term equity investments" {...register('description')} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" isLoading={isSubmitting || createMutation.isPending}>Create</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Portfolio list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6"><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-8 w-24 mb-1" /><Skeleton className="h-3 w-16" /></Card>
          ))}
        </div>
      ) : portfolios.length === 0 ? (
        <EmptyState
          title="No portfolios yet"
          description="Create your first portfolio to start tracking investments."
          actionLabel="Create Portfolio"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => (
            <Link key={p.id} href={`/portfolios/${p.id}`}>
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  </div>
                  <Badge variant="secondary">{p.currency}</Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(p.totalValue ?? 0, p.currency, true)}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">Total value</p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
