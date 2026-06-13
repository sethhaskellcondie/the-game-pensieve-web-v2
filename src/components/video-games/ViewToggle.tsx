import Link from "next/link";
import type { CollectionView } from "@/lib/uiSettings.types";
import styles from "./ViewToggle.module.css";

export type VideoGamesView = CollectionView;

// Segmented List/Shelf control for the collection pages (video games, board
// games). The view is encoded in the URL (?view=list / ?view=shelf) so it's
// shareable and back-button friendly; the page server-renders the matching
// view, so these are plain links rather than client state. Both links are
// explicit because the bare collection URL falls back to the user's default
// view setting. aria-current marks the active segment.
export default function ViewToggle({
  view,
  basePath = "/video-games",
  pinned = true,
}: {
  view: VideoGamesView;
  basePath?: string;
  // When true (the default) the control pins itself to the header's right edge.
  // Set false to render it in normal flow — e.g. inside a flex cluster that
  // also holds a beginner hint.
  pinned?: boolean;
}) {
  return (
    <nav
      className={pinned ? styles.toggle : `${styles.toggle} ${styles.inline}`}
      aria-label="View"
    >
      <Link
        href={`${basePath}?view=list`}
        className={styles.segment}
        aria-current={view === "list" ? "page" : undefined}
      >
        List
      </Link>
      <Link
        href={`${basePath}?view=shelf`}
        className={styles.segment}
        aria-current={view === "shelf" ? "page" : undefined}
      >
        Shelf
      </Link>
    </nav>
  );
}
