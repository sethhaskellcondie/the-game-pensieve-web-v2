"use client";

import { useState } from "react";
import {
  toCustomFieldValue,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
  type System,
  type UpdateSystemInput,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { SystemsIcon } from "@/components/icons";
import { ChevronLeftIcon } from "@/components/custom-fields/icons";
import {
  FIELD_TYPE_META,
  KindGlyph,
  STANDARD_FIELD_META,
  StandardFieldGlyph,
} from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { bffFetch } from "@/lib/bffClient";
import DeleteEntityButton from "@/components/detail/DeleteEntityButton";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import CustomFieldValueDisplay from "@/components/toys/CustomFieldValue";
import styles from "@/components/toys/ToyDetail.module.css";

// One rendered field: the fixed Name/Generation/Handheld rows and every custom
// field share this shape so a single row renderer drives them all. `kind`
// reuses the backend custom-field types so the standard fields borrow the
// text/number/boolean editors. `standard` marks the built-in rows so they get
// the neutral standard-field glyph + label instead of a custom-field type's.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

export default function SystemDetail({
  system: initialSystem,
  definitions,
}: {
  system: System;
  definitions: CustomField[];
}) {
  const { showToast, showSnackbar } = useToast();
  const { canWrite } = useSession();
  const [system, setSystem] = useState<System>(initialSystem);

  // Optimistically apply `next`, then persist the whole system (name +
  // generation + handheld + values are all required by the backend). Roll back
  // and surface the error on failure.
  const persist = async (next: System) => {
    let prev: System = system;
    setSystem((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateSystemInput = {
        name: next.name,
        generation: next.generation,
        handheld: next.handheld,
        customFieldValues: next.customFieldValues,
      };
      const res = await bffFetch(`/api/systems/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Request failed");
      }
      showToast({ message: "System updated.", variant: "success" });
    } catch (error) {
      console.error("Update system failed", error);
      setSystem(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the system: ${error.message}`
            : "Couldn't update the system. Please try again.",
        variant: "error",
      });
    }
  };

  // Name is required by the backend (minLength 1), so a blank commit is a no-op.
  const commitName = (raw: string) => {
    const name = raw.trim();
    if (name === "" || name === system.name) return;
    void persist({ ...system, name });
  };

  // Generation is a required integer; the number editor commits "" when cleared,
  // which (like an unchanged value) is a no-op revert.
  const commitGeneration = (raw: string) => {
    if (raw === "") return;
    const generation = Number(raw);
    if (Number.isNaN(generation) || generation === system.generation) return;
    void persist({ ...system, generation });
  };

  const commitHandheld = (raw: string) => {
    const handheld = raw === "true";
    if (handheld === system.handheld) return;
    void persist({ ...system, handheld });
  };

  // Replace (or insert) this field's value in the system's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      system.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
      "";
    if (raw === current) return;
    const entry: CustomFieldValue = toCustomFieldValue(def, raw);
    const exists = system.customFieldValues.some(
      (v) => v.customFieldId === def.id,
    );
    const customFieldValues = exists
      ? system.customFieldValues.map((v) =>
          v.customFieldId === def.id ? entry : v,
        )
      : [...system.customFieldValues, entry];
    void persist({ ...system, customFieldValues });
  };

  // Name + Generation + Handheld first (guaranteeing at least three rows), then
  // the custom fields in their defined order.
  const rows: Row[] = [
    { key: "name", name: "Name", kind: "text", value: system.name, standard: true, onCommit: commitName },
    { key: "generation", name: "Generation", kind: "number", value: String(system.generation), standard: true, onCommit: commitGeneration },
    { key: "handheld", name: "Handheld", kind: "boolean", value: system.handheld ? "true" : "false", standard: true, onCommit: commitHandheld },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      const raw = system.customFieldValues.find(
        (v) => v.customFieldId === def.id,
      )?.value;
      return {
        key: `cf-${def.id}`,
        name: def.name,
        kind: def.type,
        // Invalid stored values fall back to the empty state.
        value: normalizeFieldValue(def.type, raw, options),
        options,
        onCommit: (v: string) => commitField(def, v),
      };
    }),
  ];

  return (
    <>
      <Header
        icon={<SystemsIcon />}
        title="SYSTEM"
        tagline={`${system.name} · Generation ${system.generation}`}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <Button href="/systems" className={styles.backbtn}>
              <ChevronLeftIcon aria-hidden="true" /> Back
            </Button>
          </div>

          <div className={styles.card}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Fields</span>
              <span className={styles.caphdrCount}>
                <b>{definitions.length}</b>{" "}
                {definitions.length === 1 ? "custom field" : "custom fields"}
              </span>
            </div>

            {rows.map((row) => {
              const meta = row.standard
                ? STANDARD_FIELD_META
                : FIELD_TYPE_META[row.kind];
              return (
                <div className={styles.row} key={row.key}>
                  <div className={styles.rowlabel}>
                    <span
                      className={styles.glyph}
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {row.standard ? (
                        <StandardFieldGlyph size={15} />
                      ) : (
                        <KindGlyph type={row.kind} size={15} />
                      )}
                    </span>
                    <span className={styles.lblwrap}>
                      <div className={styles.lbl}>{row.name}</div>
                      <div className={styles.lblkind}>{meta.label}</div>
                    </span>
                  </div>
                  <div className={styles.rowval}>
                    {canWrite ? (
                      <FieldEditor
                        field={{
                          name: row.name,
                          kind: row.kind,
                          value: row.value,
                          options: row.options,
                        }}
                        onCommit={row.onCommit}
                      />
                    ) : (
                      <CustomFieldValueDisplay
                        type={row.kind}
                        value={row.value}
                        options={row.options}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DeleteEntityButton
            endpoint={`/api/systems/${system.id}`}
            label="Delete System"
            successMessage="System deleted."
            errorNoun="system"
            backHref="/systems"
          />
        </div>
      </main>
    </>
  );
}
