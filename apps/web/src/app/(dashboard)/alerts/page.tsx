'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, Bell, Clock } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  alertType: string;
  condition: Record<string, unknown>;
  channels: string[];
  cooldownDurationMinutes: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

const alertSchema = z.object({
  name: z.string().min(2),
  alertType: z.enum(['DRAWDOWN_LIMIT', 'PORTFOLIO_REBALANCE', 'RISK_SCORE_SPIKE']),
  thresholdPct: z.coerce.number().min(1).max(100),
  cooldownDurationMinutes: z.coerce.number().min(30).default(1440),
});
type AlertForm = z.infer<typeof alertSchema>;

const alertTypeLabels: Record<string, string> = {
  DRAWDOWN_LIMIT: 'Drawdown Limit',
  PORTFOLIO_REBALANCE: 'Portfolio Rebalance',
  RISK_SCORE_SPIKE: 'Volatility Spike',
  PRICE_THRESHOLD: 'Price Threshold',
  FD_MATURITY: 'FD Maturity',
  SYNC_FAILURE: 'Sync Failure',
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ['alerts', 'rules'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts/rules');
      return (res as any).data ?? res.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AlertForm>({
    resolver: zodResolver(alertSchema),
    defaultValues: { alertType: 'DRAWDOWN_LIMIT', cooldownDurationMinutes: 1440 },
  });

  const createMutation = useMutation({
    mutationFn: (data: AlertForm) =>
      apiClient.post('/alerts/rules', {
        name: data.name,
        alertType: data.alertType,
        condition: { thresholdPct: data.thresholdPct },
        channels: ['IN_APP'],
        cooldownDurationMinutes: data.cooldownDurationMinutes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
      reset();
      setShowForm(false);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create alert rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/alerts/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Rules</h2>
          <p className="text-muted-foreground">Configure threshold-based portfolio alerts</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          New Rule
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Alert Rule</CardTitle></CardHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rule Name</Label>
                  <Input placeholder="Large Drawdown Alert" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Alert Type</Label>
                  <select {...register('alertType')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="DRAWDOWN_LIMIT">Drawdown Limit</option>
                    <option value="PORTFOLIO_REBALANCE">Portfolio Rebalance</option>
                    <option value="RISK_SCORE_SPIKE">Volatility Spike</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Threshold (%)</Label>
                  <Input type="number" placeholder="15" {...register('thresholdPct')} />
                  {errors.thresholdPct && <p className="text-xs text-destructive">{errors.thresholdPct.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Cooldown (minutes)</Label>
                  <Input type="number" placeholder="1440" {...register('cooldownDurationMinutes')} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" isLoading={isSubmitting || createMutation.isPending}>Create</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          title="No alert rules"
          description="Create a rule to receive notifications when thresholds are breached."
          actionLabel="Create Rule"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Badge variant="outline">{alertTypeLabels[rule.alertType] ?? rule.alertType}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rule.cooldownDurationMinutes}m cooldown
                      </span>
                      {rule.lastTriggeredAt && (
                        <span>Last fired: {formatDate(rule.lastTriggeredAt)}</span>
                      )}
                      <span>{rule.triggerCount} triggers</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
