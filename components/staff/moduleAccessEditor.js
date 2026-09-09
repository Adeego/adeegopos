import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck } from 'lucide-react';
import {
  ACCESS_LEVELS,
  MODULE_IDS,
  MODULE_OPTIONS,
  PRESET_OPTIONS,
} from '@/lib/rbac';

const LEVEL_LABELS = {
  none: 'No access',
  view: 'View',
  operate: 'Operate',
  manage: 'Manage',
};

export default function ModuleAccessEditor({
  moduleAccess = {},
  accessPreset = 'custom',
  onChange,
  onPresetChange,
  actorIsOwner = false,
  targetIsOwner = false,
  disabled = false,
}) {
  const applyPreset = (presetId) => {
    const preset = PRESET_OPTIONS.find((entry) => entry.id === presetId);
    if (!preset || presetId === 'owner') return;
    onPresetChange?.(presetId, { ...preset.moduleAccess });
  };

  const updateModule = (moduleId, level) => {
    const next = { ...moduleAccess };
    if (level === ACCESS_LEVELS.NONE) delete next[moduleId];
    else next[moduleId] = level;
    onChange?.(next, 'custom');
  };

  const assigned = MODULE_OPTIONS.filter((module) => moduleAccess[module.id]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Job preset</Label>
        <Select value={targetIsOwner ? 'owner' : accessPreset} onValueChange={applyPreset} disabled={disabled || targetIsOwner}>
          <SelectTrigger><SelectValue placeholder="Choose a starting preset" /></SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.filter((preset) => preset.id !== 'owner').map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
            ))}
            {accessPreset === 'custom' && <SelectItem value="custom" disabled>Custom access</SelectItem>}
            {targetIsOwner && <SelectItem value="owner">Owner</SelectItem>}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Presets are a starting point. Changing a module below creates a custom assignment.</p>
      </div>

      {targetIsOwner && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          The store owner always has full access and cannot be demoted or archived.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {MODULE_OPTIONS.map((module) => {
          const isAdminModule = module.id === MODULE_IDS.STAFF_ADMIN;
          const locked = disabled || targetIsOwner || (isAdminModule && !actorIsOwner);
          return (
            <div key={module.id} className="space-y-3 rounded-md border bg-white p-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{module.label}</p>
                  {isAdminModule && !actorIsOwner && <Badge variant="outline">Owner assigns</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
              </div>
              <Select
                value={targetIsOwner ? module.levels.at(-1) : (moduleAccess[module.id] || ACCESS_LEVELS.NONE)}
                onValueChange={(level) => updateModule(module.id, level)}
                disabled={locked}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ACCESS_LEVELS.NONE}>No access</SelectItem>
                  {module.levels
                    .filter((level) => targetIsOwner || module.id !== MODULE_IDS.STAFF_ADMIN || level !== ACCESS_LEVELS.MANAGE)
                    .map((level) => <SelectItem key={level} value={level}>{LEVEL_LABELS[level]}</SelectItem>)}
                </SelectContent>
              </Select>
              {module.dependencies.length > 0 && moduleAccess[module.id] && (
                <p className="text-xs text-muted-foreground">Built-in lookup: {module.dependencies.join(', ')}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-md bg-muted p-3">
        <p className="text-sm font-medium">Effective module access</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {targetIsOwner
            ? <Badge>All modules · Full access</Badge>
            : assigned.length > 0
              ? assigned.map((module) => <Badge key={module.id} variant="secondary">{module.label} · {LEVEL_LABELS[moduleAccess[module.id]]}</Badge>)
              : <span className="text-sm text-muted-foreground">No modules assigned</span>}
        </div>
      </div>
    </div>
  );
}
