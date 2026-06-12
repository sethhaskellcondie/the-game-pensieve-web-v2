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
}: {
  view: VideoGamesView;
  basePath?: string;
}) {
  return (
    <nav className={styles.toggle} aria-label="View">
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
