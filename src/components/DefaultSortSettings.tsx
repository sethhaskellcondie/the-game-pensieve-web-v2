"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CustomField, EntityKey, FilterSpecification } from "@/lib/api";
import {
  EMPTY_DEFAULT_SORT_OPTIONS,
  type DefaultSortOptions,
} from "@/lib/defaultSortOptions.types";
import SettingsSection from "./SettingsSection";
import {
  BoardGameBoxIcon,
  BoardGamesIcon,
  SystemsIcon,
  ToysIcon,
  VideoGameBoxIcon,
  VideoGamesIcon,
} from "./icons";
import SortControl from "./filters/SortControl";
import {
  fetchDefaultSortOptions,
  resolveDefaultSorts,
  toDefaultSortLevels,
} from "./filters/defaultSorts";
import {
  buildFieldList,
  sortableFields,
  supportsSorting,
} from "./filters/fieldList";
import type { ActiveSort, FilterFieldDef } from "./filters/types";
import rowStyles from "./UiSettings.module.css";
import styles from "./DefaultSortSettings.module.css";

// The collections that offer a default sort — one row per entity, games (and
// their boxes) first, then toys and systems. Each entity's manager applies
// its stored default to every search that carries no page sorts of its own.
const ENTITIES: {
  key: EntityKey;
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    key: "videoGame",
    title: "Video Games (List View)",
    description: "",
    icon: <VideoGamesIcon/>,
  },
  {
    key: "videoGameBox",
    title: "Video Game (Shelf View)",
    description: "",
    icon: <VideoGameBoxIcon />,
  },
  {
    key: "boardGame",
    title: "Board Games (List View)",
    description: "",
    icon: <BoardGamesIcon />,
  },
  {
    key: "boardGameBox",
    title: "Board Game Boxes (Shelf View)",
    description: "",
    icon: <BoardGameBoxIcon />,
  },
  {
    key: "toy",
    title: "Toys",
    description: "",
    icon: <ToysIcon />,
  },
  {
    key: "system",
    title: "Systems",
    description: "",
    icon: <SystemsIcon />,
  },
];

// Reads a route handler's response once, throwing the forwarded backend
// message on failure. Route handlers answer { status, data } or
// { status, message }.
async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(body?.message ?? "Request failed");
  }
  return body?.data as T;
}

// The sortable field list for one entity: the filter spec's standard fields
// merged with the entity's custom fields — the same list the entity page's
// own Sort button offers (including the enum custom fields, which the backend
// now sorts by option display order). Empty when the spec doesn't advertise
// sorting, which leaves that row's Sort button disabled.
async function fetchSortFields(
  key: EntityKey,
  signal?: AbortSignal,
): Promise<FilterFieldDef[]> {
  const [spec, defs] = await Promise.all([
    fetch(`/api/filters/${key}`, { signal }).then((res) =>
      readJson<FilterSpecification>(res),
    ),
    fetch(`/api/custom-fields/entity/${key}`, { signal }).then((res) =>
      readJson<CustomField[]>(res),
    ),
  ]);
  if (!supportsSorting(spec)) return [];
  return sortableFields(
    buildFieldList(
      spec,
      [...defs].sort((a, b) => a.order - b.order),
    ),
  );
}

// The Options page's "Default Sort Options" section: one row per collection,
// each reusing the SortControl popover from the collection pages to edit that
// entity's stored default sort levels. Writes are confirmed like the other
// settings — the new value is POSTed to the route handler and only committed
// locally once it acknowledges success.
export default function DefaultSortSettings() {
  const [options, setOptions] = useState<DefaultSortOptions>({
    ...EMPTY_DEFAULT_SORT_OPTIONS,
  });
  const [fieldsByEntity, setFieldsByEntity] = useState<
    Partial<Record<EntityKey, FilterFieldDef[]>>
  >({});
  const [sortsByEntity, setSortsByEntity] = useState<
    Partial<Record<EntityKey, ActiveSort[]>>
  >({});

  // Load the stored defaults and each entity's sortable field list together on
  // mount. A field list that fails to load just leaves that row's button
  // disabled; the rest of the section still works.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    (async () => {
      const [loaded, fieldLists] = await Promise.all([
        fetchDefaultSortOptions(controller.signal),
        Promise.all(
          ENTITIES.map((entity) =>
            fetchSortFields(entity.key, controller.signal).catch(
              () => [] as FilterFieldDef[],
            ),
          ),
        ),
      ]);
      if (!active) return;
      const fields: Partial<Record<EntityKey, FilterFieldDef[]>> = {};
      const sorts: Partial<Record<EntityKey, ActiveSort[]>> = {};
      ENTITIES.forEach((entity, i) => {
        fields[entity.key] = fieldLists[i];
        sorts[entity.key] = resolveDefaultSorts(loaded[entity.key], fieldLists[i]);
      });
      setOptions(loaded);
      setFieldsByEntity(fields);
      setSortsByEntity(sorts);
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Persist one entity's edited levels. SortControl is live-applying, so this
  // runs on every change; a failed write leaves the last known-good defaults
  // showing rather than diverging from the backend.
  const applySorts = async (key: EntityKey, next: ActiveSort[]) => {
    const updated = { ...options, [key]: toDefaultSortLevels(next) };
    try {
      const res = await fetch("/api/default-sort-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) return;
      setOptions(updated);
      setSortsByEntity((cur) => ({ ...cur, [key]: next }));
    } catch {
      // Confirmed writes only: the stale value stays until a write succeeds.
    }
  };

  return (
    <SettingsSection
      title="Default Sort Options"
      description="The default way data is sorted when first visiting a page."
    >
      {ENTITIES.map((entity) => (
        <div key={entity.key} className={rowStyles.row}>
          <span className={rowStyles.icon}>{entity.icon}</span>
          <div className={rowStyles.text}>
            <span className={rowStyles.title}>{entity.title}</span>
            <span className={rowStyles.description}>{entity.description}</span>
          </div>
          <SortControl
            fields={fieldsByEntity[entity.key] ?? []}
            sorts={sortsByEntity[entity.key] ?? []}
            onChange={(next) => void applySorts(entity.key, next)}
            buttonClassName={styles.sortBtn}
            ariaLabel={`Default sort for ${entity.title}`}
          />
        </div>
      ))}
    </SettingsSection>
  );
}
