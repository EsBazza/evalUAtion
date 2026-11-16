'use client';

import { useState } from 'react';
import { changeOwnPassword } from '@/app/actions/settings';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';

const MIN_LENGTH = 12;
const inputClass =
  'w-full h-10 p-2.5 border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none';

/** Lets the signed-in admin change their own login password. */
export function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_LENGTH) {
      toast.error(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      toast.error('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await changeOwnPassword(current, next);
      if (!res.success) {
        toast.error(res.error || 'Failed to change password.');
        return;
      }
      toast.success('Password changed. Use the new password next time you sign in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      toast.error('Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">Change My Password</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pw-current" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Current Password</label>
            <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="pw-new" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">New Password</label>
            <input id="pw-new" type="password" autoComplete="new-password" minLength={MIN_LENGTH} maxLength={72} value={next} onChange={e => setNext(e.target.value)} className={inputClass} required />
            <span className="text-[10px] text-muted-foreground">At least {MIN_LENGTH} characters.</span>
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Confirm New Password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} required />
          </div>
          <Button type="submit" uaVariant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
