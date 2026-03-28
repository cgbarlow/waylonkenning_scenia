/**
 * Iris API adapter — replaces IndexedDB with HTTP calls to the Iris backend.
 *
 * Activated when Scenia is launched with URL params:
 *   ?apiUrl=http://localhost:8000&token=JWT&setId=UUID
 *
 * Transforms between Iris API shape (entities with `data` blob) and
 * Scenia native types (flat typed objects).
 */

import type { DbAdapter, AppData } from './db';
import type { Version } from '../types';

// --- Iris API response types ---

interface IrisEntity {
  id: string;
  element_type: string;
  name: string;
  description: string | null;
  data: Record<string, unknown>;
  set_id: string | null;
  created_at: string;
  updated_at: string;
}

interface IrisDependency {
  id: string;
  source_id: string;
  target_id: string;
  dependency_type: string;
  set_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

interface IrisBulkData {
  strategies: IrisEntity[];
  programmes: IrisEntity[];
  initiatives: IrisEntity[];
  assets: IrisEntity[];
  applications: IrisEntity[];
  app_segments: IrisEntity[];
  milestones: IrisEntity[];
  resources: IrisEntity[];
  dependencies: IrisDependency[];
  asset_categories: Array<{ id: string; set_id: string; name: string; color: string | null; display_order: number }>;
  app_statuses: Array<{ id: string; set_id: string; name: string; color: string | null; display_order: number }>;
  timeline_settings: { id: string; set_id: string; start_date: string | null; data: Record<string, unknown> } | null;
  versions: unknown[];
}

// --- Transforms ---

/** Generate a simple unique ID to replace temporary 'new-*' IDs. */
function stableId(): string {
  return crypto.randomUUID();
}

function entityToNative(entity: IrisEntity): Record<string, unknown> {
  return {
    id: entity.id,
    name: entity.name,
    ...(entity.description != null ? { description: entity.description } : {}),
    ...(entity.data ?? {}),
  };
}

function nativeToEntity(
  native: Record<string, unknown>,
  setId: string,
): { id?: string; name: string; description: string | null; data: Record<string, unknown>; set_id: string } {
  const { id, name, description, ...rest } = native;
  const resolvedId = id && typeof id === 'string' && !id.startsWith('new-') ? id : stableId();
  return {
    id: resolvedId,
    name: (name as string) ?? 'Untitled',
    description: (description as string) ?? null,
    data: rest,
    set_id: setId,
  };
}

function apiToScenia(apiData: IrisBulkData): AppData {
  return {
    strategies: apiData.strategies.map(entityToNative) as AppData['strategies'],
    programmes: apiData.programmes.map(entityToNative) as AppData['programmes'],
    initiatives: apiData.initiatives.map(entityToNative) as AppData['initiatives'],
    assets: apiData.assets.map(entityToNative) as AppData['assets'],
    applications: apiData.applications.map(entityToNative) as AppData['applications'],
    applicationSegments: apiData.app_segments.map(entityToNative) as AppData['applicationSegments'],
    milestones: apiData.milestones.map(entityToNative) as AppData['milestones'],
    resources: apiData.resources.map(entityToNative) as AppData['resources'],
    dependencies: apiData.dependencies.map((dep) => ({
      id: dep.id,
      sourceId: dep.source_id,
      targetId: dep.target_id,
      type: dep.dependency_type as 'blocks' | 'requires' | 'related',
      ...dep.data,
    })),
    assetCategories: apiData.asset_categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      order: cat.display_order,
    })),
    timelineSettings: apiData.timeline_settings
      ? { ...apiData.timeline_settings.data, startDate: apiData.timeline_settings.start_date } as AppData['timelineSettings']
      : { startDate: `${new Date().getFullYear()}-01-01`, monthsToShow: 36 } as AppData['timelineSettings'],
    applicationStatuses: apiData.app_statuses.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color ?? '#6b7280',
    })),
  };
}

function sceniaToApi(data: AppData, setId: string): Record<string, unknown> {
  const entityKeys: Array<[keyof AppData, string]> = [
    ['strategies', 'strategies'],
    ['programmes', 'programmes'],
    ['initiatives', 'initiatives'],
    ['assets', 'assets'],
    ['applications', 'applications'],
    ['applicationSegments', 'app_segments'],
    ['milestones', 'milestones'],
    ['resources', 'resources'],
  ];

  const result: Record<string, unknown> = {};

  for (const [nativeKey, apiKey] of entityKeys) {
    const items = data[nativeKey];
    if (Array.isArray(items)) {
      result[apiKey] = items.map((item: Record<string, unknown>) => nativeToEntity(item, setId));
    }
  }

  if (data.dependencies) {
    result.dependencies = data.dependencies.map((dep) => {
      const { id, sourceId, targetId, type, ...rest } = dep;
      return { ...(id ? { id } : {}), source_id: sourceId, target_id: targetId, dependency_type: type, set_id: setId, data: rest };
    });
  }

  if (data.assetCategories) {
    result.asset_categories = data.assetCategories.map((cat) => ({
      id: cat.id, name: cat.name, display_order: cat.order ?? 0, set_id: setId,
    }));
  }

  if (data.applicationStatuses) {
    result.app_statuses = data.applicationStatuses.map((s) => ({
      id: s.id, name: s.name, color: s.color, display_order: 0, set_id: setId,
    }));
  }

  if (data.timelineSettings) {
    const { startDate, ...tsRest } = data.timelineSettings as Record<string, unknown>;
    result.timeline_settings = {
      start_date: startDate,
      view_mode: (data.timelineSettings as Record<string, unknown>).monthsToShow ?? 'quarterly',
      zoom_level: (data.timelineSettings as Record<string, unknown>).columnZoom ?? 1.0,
      data: tsRest,
    };
  }

  return result;
}

// --- Adapter ---

function handleAuthError(): never {
  alert('Your Iris session has expired. Please close this tab and reopen Scenia from Iris.');
  throw new Error('Iris session expired');
}

export function createIrisAdapter(apiUrl: string, token: string, setId: string): DbAdapter {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401) handleAuthError();
      if (!res.ok) throw new Error(`Iris API error: ${res.status}`);
      return res;
    } catch (e) {
      console.error('[Scenia] API fetch failed:', url, e);
      throw e;
    }
  }

  return {
    async getAppData(): Promise<AppData> {
      const res = await apiFetch(`${apiUrl}/api/scenia/data?set_id=${encodeURIComponent(setId)}`);
      const apiData: IrisBulkData = await res.json();
      return apiToScenia(apiData);
    },

    async saveAppData(data: AppData): Promise<void> {
      const payload = sceniaToApi(data, setId);
      // Log entity counts being saved
      const counts: Record<string, number> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (Array.isArray(v)) counts[k] = v.length;
      }
      console.log('[Scenia] Saving to Iris:', counts);
      await apiFetch(`${apiUrl}/api/scenia/data?set_id=${encodeURIComponent(setId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },

    async getAllVersions(): Promise<Version[]> {
      return [];
    },

    async saveVersion(): Promise<void> {},

    async deleteVersion(): Promise<void> {},
  };
}
