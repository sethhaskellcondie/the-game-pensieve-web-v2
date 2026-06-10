"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  CustomField,
  CustomFieldOption,
  CustomFieldType,
  CustomFieldValue,
  Toy,
  UpdateToyInput,
} from "@/lib/api";
import Header from "@/components/Header";
import { ToysIcon } from "@/components/icons";
import { ChevronLeftIcon } from "@/components/custom-fields/icons";
import { FIELD_TYPE_META, KindGlyph } from "@/components/custom-fields/registry";
import { useToast } from "@/components/ToastProvider";
import FieldEditor, { normalizeFieldValue } from "./toyFieldEditors";
import styles from "./ToyDetail.module.css";

// One rendered field: the fixed Name/Set rows and every custom field share this
// shape so a single row renderer drives them all. `kind` reuses the backend
// custom-field type so Name/Set borrow the "text" glyph + editor.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  onCommit: (value: string) => void;
};

export default function ToyDetail({
  toy: initialToy,
  definitions,
}: {
  toy: Toy;
  definitions: CustomField[];
}) {
  const { showToast, showSnackbar } = useToast();
  const [toy, setToy] = useState<Toy>(initialToy);

  // Optimistically apply `next`, then persist the whole toy (name + set + values
  // are all required by the backend). Roll back and surface the error on failure.
  const persist = async (next: Toy) => {
    let prev: Toy = toy;
    setToy((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateToyInput = {
        name: next.name,
        set: next.set,
        customFieldValues: next.customFieldValues,
      };
      const res = await fetch(`/api/toys/${next.id}`, {
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
      showToast({ message: "Toy updated.", variant: "success" });
    } catch (error) {
      console.error("Update toy failed", error);
      setToy(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the toy: ${error.message}`
            : "Couldn't update the toy. Please try again.",
        variant: "error",
      });
    }
  };

  // Name is required by the backend (minLength 1), so a blank commit is a no-op.
  const commitName = (raw: string) => {
    const name = raw.trim();
    if (name === "" || name === toy.name) return;
    void persist({ ...toy, name });
  };

  const commitSet = (raw: string) => {
    const set = raw.trim();
    if (set === toy.set) return;
    void persist({ ...toy, set });
  };

  // Replace (or insert) this field's value in the toy's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      toy.customFieldValues.find((v) => v.customFieldId === def.id)?.value ?? "";
    if (raw === current) return;
    const entry: CustomFieldValue = {
      customFieldId: def.id,
      customFieldName: def.name,
      customFieldType: def.type,
      value: raw,
    };
    const exists = toy.customFieldValues.some(
      (v) => v.customFieldId === def.id,
    );
    const customFieldValues = exists
      ? toy.customFieldValues.map((v) =>
          v.customFieldId === def.id ? entry : v,
        )
      : [...toy.customFieldValues, entry];
    void persist({ ...toy, customFieldValues });
  };

  // Name + Set first (guaranteeing at least two rows), then the custom fields in
  // their defined order.
  const rows: Row[] = [
    { key: "name", name: "Name", kind: "text", value: toy.name, onCommit: commitName },
    { key: "set", name: "Set", kind: "text", value: toy.set, onCommit: commitSet },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      const raw = toy.customFieldValues.find(
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
        icon={<ToysIcon />}
        title={toy.name}
        tagline="A toy in your collection"
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <Link href="/toys" className={styles.backbtn}>
              <ChevronLeftIcon aria-hidden="true" /> Back
            </Link>
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
              const meta = FIELD_TYPE_META[row.kind];
              return (
                <div className={styles.row} key={row.key}>
                  <div className={styles.rowlabel}>
                    <span
                      className={styles.glyph}
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      <KindGlyph type={row.kind} size={15} />
                    </span>
                    <span className={styles.lblwrap}>
                      <div className={styles.lbl}>{row.name}</div>
                      <div className={styles.lblkind}>{meta.label}</div>
                    </span>
                  </div>
                  <div className={styles.rowval}>
                    <FieldEditor
                      field={{
                        name: row.name,
                        kind: row.kind,
                        value: row.value,
                        options: row.options,
                      }}
                      onCommit={row.onCommit}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
