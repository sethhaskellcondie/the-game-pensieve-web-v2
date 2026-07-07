"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  toCustomFieldValue,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
  type NewVideoGameInput,
  type System,
  type UpdateVideoGameBoxInput,
  type VideoGame,
  type VideoGameBox,
} from "@/lib/api";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { SystemsIcon, VideoGameBoxIcon } from "@/components/icons";
import {
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/custom-fields/icons";
import VideoGameCreateModal from "./VideoGameCreateModal";
import VideoGameAddExistingModal from "./VideoGameAddExistingModal";
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
// Aliased: CustomFieldValue (the type) is already imported from the API types.
import CustomFieldValueDisplay from "@/components/toys/CustomFieldValue";
import FieldEditor, {
  normalizeFieldValue,
} from "@/components/toys/toyFieldEditors";
import styles from "@/components/toys/ToyDetail.module.css";
import localStyles from "./VideoGameBoxDetail.module.css";

// One rendered field — the same Row shape VideoGameDetail uses, so a single
// row renderer drives the standard rows and the custom fields alike.
type Row = {
  key: string;
  name: string;
  kind: CustomFieldType;
  value: string;
  options?: CustomFieldOption[];
  standard?: boolean;
  onCommit: (value: string) => void;
};

export default function VideoGameBoxDetail({
  box: initialBox,
  definitions,
  gameDefinitions,
  systems,
}: {
  box: VideoGameBox;
  definitions: CustomField[];
  // The videoGame entity's custom-field definitions — they drive the columns
  // of the read-only game chart (and provide the options needed to render
  // dropdown/radio/progress values).
  gameDefinitions: CustomField[];
  systems: System[];
}) {
  const { showToast, showSnackbar } = useToast();
  const { canWrite } = useSession();
  const [box, setBox] = useState<VideoGameBox>(initialBox);
  // The game whose delete confirmation menu is open, if any.
  const [confirmingGameId, setConfirmingGameId] = useState<number | null>(null);
  // Create-game dialog state: open flag + in-flight guard for its save button.
  const [creating, setCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  // Add-existing-game dialog state: open flag + in-flight guard for its picker.
  const [addingExisting, setAddingExisting] = useState(false);
  const [savingAddExisting, setSavingAddExisting] = useState(false);

  // Any click elsewhere (the menu and its trigger stop propagation) or Escape
  // dismisses the confirmation menu.
  useEffect(() => {
    if (confirmingGameId === null) return;
    const close = () => setConfirmingGameId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirmingGameId]);

  // Optimistically apply `next`, then persist the whole box — the backend's
  // VideoGameBoxRequest requires every field, so the box's current game ids
  // ride along (newVideoGames stays empty: this page edits box fields only).
  // Roll back and surface the error on failure.
  const persist = async (next: VideoGameBox) => {
    let prev: VideoGameBox = box;
    setBox((cur) => {
      prev = cur;
      return next;
    });
    try {
      const input: UpdateVideoGameBoxInput = {
        title: next.title,
        systemId: next.system.id,
        existingVideoGameIds: next.videoGames.map((g) => g.id),
        newVideoGames: [],
        isPhysical: next.isPhysical,
        customFieldValues: next.customFieldValues,
      };
      const res = await bffFetch(`/api/video-game-boxes/${next.id}`, {
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
      showToast({ message: "Video game box updated.", variant: "success" });
    } catch (error) {
      console.error("Update video game box failed", error);
      setBox(prev);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't update the video game box: ${error.message}`
            : "Couldn't update the video game box. Please try again.",
        variant: "error",
      });
    }
  };

  // Title is required by the backend (minLength 1), so a blank commit is a no-op.
  const commitTitle = (raw: string) => {
    const title = raw.trim();
    if (title === "" || title === box.title) return;
    void persist({ ...box, title });
  };

  // The System dropdown commits by name; map it back to the system itself
  // (duplicate names resolve to the first match). Unknown or unchanged picks
  // are no-ops.
  const commitSystem = (systemName: string) => {
    const next = systems.find((s) => s.name === systemName);
    if (!next || next.id === box.system.id) return;
    void persist({ ...box, system: next });
  };

  const commitPhysical = (raw: string) => {
    const isPhysical = raw === "true";
    if (isPhysical === box.isPhysical) return;
    void persist({ ...box, isPhysical });
  };

  // Replace (or insert) this field's value in the box's customFieldValues.
  const commitField = (def: CustomField, raw: string) => {
    const current =
      box.customFieldValues.find((v) => v.customFieldId === def.id)?.value ??
      "";
    if (raw === current) return;
    const entry: CustomFieldValue = toCustomFieldValue(def, raw);
    const exists = box.customFieldValues.some(
      (v) => v.customFieldId === def.id,
    );
    const customFieldValues = exists
      ? box.customFieldValues.map((v) =>
          v.customFieldId === def.id ? entry : v,
        )
      : [...box.customFieldValues, entry];
    void persist({ ...box, customFieldValues });
  };

  // Removing a game from the box drops its id from the PUT's
  // existingVideoGameIds (the backend deletes games that no longer belong to
  // any box). The last game can't be removed — a box must hold at least one —
  // so the trash button only renders when the box has more than one game.
  const removeGame = (id: number) => {
    setConfirmingGameId(null);
    void persist({
      ...box,
      videoGames: box.videoGames.filter((g) => g.id !== id),
    });
  };

  // Create a game inside this box: PUT the box with the new game riding in
  // newVideoGames (games have no standalone create endpoint). Not optimistic —
  // the row needs the backend-assigned game id, so the box state is replaced
  // with the response. Returns whether it succeeded; the dialog decides what
  // to do next (close, or reset for another entry in mass-input mode).
  const handleCreateGame = async (
    input: NewVideoGameInput,
  ): Promise<boolean> => {
    setSavingCreate(true);
    try {
      const body: UpdateVideoGameBoxInput = {
        title: box.title,
        systemId: box.system.id,
        existingVideoGameIds: box.videoGames.map((g) => g.id),
        newVideoGames: [input],
        isPhysical: box.isPhysical,
        customFieldValues: box.customFieldValues,
      };
      const res = await bffFetch(`/api/video-game-boxes/${box.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: VideoGameBox;
        message?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.message ?? "Request failed");
      }
      setBox(payload.data);
      showToast({ message: "Video game created.", variant: "success" });
      return true;
    } catch (error) {
      console.error("Create video game failed", error);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't create the video game: ${error.message}`
            : "Couldn't create the video game. Please try again.",
        variant: "error",
      });
      return false;
    } finally {
      setSavingCreate(false);
    }
  };

  // Attach an existing game to this box: PUT the box with the picked game's id
  // added to existingVideoGameIds (newVideoGames stays empty). Like
  // handleCreateGame it isn't optimistic — the box state is replaced with the
  // response so the new row arrives in the backend's slim shape. Returns whether
  // it succeeded so the picker can clear its query and stay open for the next.
  const handleAddExistingGame = async (
    game: VideoGame,
  ): Promise<boolean> => {
    setSavingAddExisting(true);
    try {
      const body: UpdateVideoGameBoxInput = {
        title: box.title,
        systemId: box.system.id,
        existingVideoGameIds: [...box.videoGames.map((g) => g.id), game.id],
        newVideoGames: [],
        isPhysical: box.isPhysical,
        customFieldValues: box.customFieldValues,
      };
      const res = await bffFetch(`/api/video-game-boxes/${box.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: VideoGameBox;
        message?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.message ?? "Request failed");
      }
      setBox(payload.data);
      showToast({ message: "Video game added.", variant: "success" });
      return true;
    } catch (error) {
      console.error("Add existing video game failed", error);
      showSnackbar({
        message:
          error instanceof Error
            ? `Couldn't add the video game: ${error.message}`
            : "Couldn't add the video game. Please try again.",
        variant: "error",
      });
      return false;
    } finally {
      setSavingAddExisting(false);
    }
  };

  // The System row borrows the dropdown editor, with the systems list as its
  // options (committed by name, mapped back to a systemId on persist).
  const systemOptions: CustomFieldOption[] = systems.map((s, i) => ({
    id: s.id,
    customFieldId: -1,
    name: s.name,
    isDefault: false,
    order: i,
  }));

  // Title + System + Physical first, then the custom fields in their defined
  // order. Collection is deliberately absent — it's backend-derived (a box
  // becomes a collection by holding multiple games), so it can't be edited
  // and doesn't belong among the editors.
  const rows: Row[] = [
    { key: "title", name: "Title", kind: "text", value: box.title, standard: true, onCommit: commitTitle },
    { key: "system", name: "System", kind: "dropdown", value: box.system?.name ?? "", options: systemOptions, standard: true, onCommit: commitSystem },
    { key: "physical", name: "Physical", kind: "boolean", value: box.isPhysical ? "true" : "false", standard: true, onCommit: commitPhysical },
    ...definitions.map<Row>((def) => {
      const options = [...def.options].sort((a, b) => a.order - b.order);
      const raw = box.customFieldValues.find(
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

  const games = box.videoGames ?? [];

  return (
    <>
      <Header
        icon={<VideoGameBoxIcon />}
        title="VIDEO GAME BOX"
        tagline={`${box.title} · ${box.system?.name ?? ""}`}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <Button href="/video-games?view=shelf" className={styles.backbtn}>
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
                    {/* Editing is a write — guests/lapsed see the value read-only. */}
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

          {/* The games inside this box as a slim read-only chart: title, the
              game's own system chip, and one cell per videoGame custom field. The
              whole row links to the game's detail page (the title is the
              anchor, stretched over the row via CSS); the trash button sits
              above the overlay. Games are edited on their own detail pages,
              not here. */}
          <div className={`${styles.card} ${localStyles.gamesCard}`}>
            <div className={styles.caphdr}>
              <span className={styles.caphdrTitle}>Video Games</span>
              {/* Adding games (existing or new) is a write — only an active
                  (Paid) account sees these controls. */}
              {canWrite && (
                <div className={localStyles.headActions}>
                  <button
                    type="button"
                    className={localStyles.newBtn}
                    onClick={() => setAddingExisting(true)}
                  >
                    <PlusIcon aria-hidden="true" /> Add Existing Game
                  </button>
                  <button
                    type="button"
                    className={localStyles.newBtn}
                    onClick={() => setCreating(true)}
                  >
                    <PlusIcon aria-hidden="true" /> New Video Game
                  </button>
                </div>
              )}
              <span className={`${styles.caphdrCount} ${localStyles.count}`}>
                <b>{games.length}</b> {games.length === 1 ? "game" : "games"}
              </span>
            </div>
            {games.length === 0 ? (
              <div className={styles.row}>
                <span className={styles.vText}>No games yet.</span>
              </div>
            ) : (
              <ul aria-label="Video games" className={localStyles.gameList}>
                {games.map((game) => (
                  <li className={localStyles.game} key={game.id}>
                    <div>
                      <div className={localStyles.gameHead}>
                        <Link
                          href={`/video-games/${game.id}`}
                          className={localStyles.gameTitle}
                        >
                          {game.title}
                        </Link>
                        <span className={localStyles.systemChip}>
                          <SystemsIcon aria-hidden="true" />
                          {game.system?.name}
                        </span>
                      </div>

                      <div className={localStyles.fieldGrid}>
                        {gameDefinitions.map((def) => (
                          <div key={def.id}>
                            <div className={localStyles.fieldLabel}>
                              {def.name}
                            </div>
                            <div className={localStyles.fieldValue}>
                              <CustomFieldValueDisplay
                                type={def.type}
                                value={
                                  game.customFieldValues.find(
                                    (v) => v.customFieldId === def.id,
                                  )?.value
                                }
                                options={def.options}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Removing a game is a write — hidden for guests/lapsed. */}
                    {canWrite && games.length > 1 && (
                      <div className={localStyles.delwrap}>
                        <button
                          type="button"
                          className={localStyles.trash}
                          aria-label={`Delete ${game.title}`}
                          aria-haspopup="menu"
                          aria-expanded={confirmingGameId === game.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingGameId((cur) =>
                              cur === game.id ? null : game.id,
                            );
                          }}
                        >
                          <TrashIcon />
                        </button>
                        {confirmingGameId === game.id && (
                          <div
                            role="menu"
                            aria-label={`Delete ${game.title}?`}
                            className={localStyles.confirm}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className={localStyles.confirmText}>
                              Are you sure?
                            </span>
                            <button
                              type="button"
                              role="menuitem"
                              className={localStyles.confirmDelete}
                              onClick={() => removeGame(game.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DeleteEntityButton
            endpoint={`/api/video-game-boxes/${box.id}`}
            label="Delete Video Game Box"
            successMessage="Video game box deleted."
            errorNoun="video game box"
            backHref="/video-games?view=shelf"
          />
        </div>
      </main>

      {creating && (
        <VideoGameCreateModal
          definitions={gameDefinitions}
          systems={systems}
          defaultSystemId={box.system?.id}
          saving={savingCreate}
          onCreate={handleCreateGame}
          onClose={() => setCreating(false)}
        />
      )}

      {addingExisting && (
        <VideoGameAddExistingModal
          excludeIds={games.map((g) => g.id)}
          saving={savingAddExisting}
          onAdd={handleAddExistingGame}
          onClose={() => setAddingExisting(false)}
        />
      )}
    </>
  );
}
