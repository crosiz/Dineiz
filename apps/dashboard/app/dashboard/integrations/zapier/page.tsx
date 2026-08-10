'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dineiz/ui/src/components/card';
import { Input } from '@dineiz/ui/src/components/input';
import { Button } from '@dineiz/ui/src/components/button';
import { apiFetch } from '../../../../lib/api';

type ZapierSub = {
  id: string;
  event: string;
  url: string;
  secret: string | null;
  isActive: boolean;
  lastStatus?: 'PENDING' | 'DELIVERED' | 'FAILED' | null;
  lastError?: string | null;
  lastDeliveredAt?: string | null;
  createdAt?: string;
};

export default function ZapierIntegrationsPage() {
  const [subs, setSubs] = useState<ZapierSub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [event, setEvent] = useState('order.created');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [isActive, setIsActive] = useState(true);

  const canCreate = useMemo(() => event.trim() && url.trim(), [event, url]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ZapierSub[]>('/api/integrations/zapier/subscriptions');
      setSubs(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setError(null);
    try {
      await apiFetch('/api/integrations/zapier/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          event,
          url,
          secret: secret.trim() ? secret.trim() : undefined,
          isActive,
        }),
      });
      setUrl('');
      setSecret('');
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/integrations/zapier/subscriptions/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function test(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/integrations/zapier/subscriptions/${id}/test`, { method: 'POST' });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Zapier Webhooks</h1>
        <p className="text-sm text-text-secondary">Send Dineiz events (orders, etc.) to Zapier catch hooks.</p>
      </div>

      {error && (
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Create subscription</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Event e.g. order.created" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Zapier catch URL" />
          <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Optional secret header" />
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Active
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={create} disabled={!canCreate}>Create</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-sm text-text-secondary">Loading…</div>}
          {!loading && subs.length === 0 && <div className="text-sm text-text-secondary">No subscriptions yet.</div>}
          {subs.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">{s.event}</div>
                  <div className="text-xs text-text-secondary break-all">{s.url}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" onClick={() => test(s.id)}>Test</Button>
                  <Button variant="destructive" onClick={() => remove(s.id)}>Delete</Button>
                </div>
              </div>
              <div className="text-xs text-text-secondary">
                Status: {s.lastStatus ?? '—'}
                {s.lastDeliveredAt ? ` • Last delivered: ${new Date(s.lastDeliveredAt).toLocaleString()}` : ''}
                {s.lastError ? ` • Error: ${s.lastError}` : ''}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

