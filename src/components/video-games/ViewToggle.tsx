import Link from "next/link";
import type { VideoGamesView } from "@/lib/uiSettings.types";
import styles from "./ViewToggle.module.css";

export type { VideoGamesView };

// Segmented List/Shelf control for the video games page. The view is encoded
// in the URL (?view=list / ?view=shelf) so it's shareable and back-button
// friendly; the page server-renders the matching view, so these are plain
// links rather than client state. Both links are explicit because the bare
// /video-games URL falls back to the user's Default Video Games View setting.
// aria-current marks the active segment.
export default function ViewToggle({ view }: { view: VideoGamesView }) {
  return (
    <nav className={styles.toggle} aria-label="View">
      <Link
        href="/video-games?view=list"
        className={styles.segment}
        aria-current={view === "list" ? "page" : undefined}
      >
        List
      </Link>
      <Link
        href="/video-games?view=shelf"
        className={styles.segment}
        aria-current={view === "shelf" ? "page" : undefined}
      >
        Shelf
      </Link>
    </nav>
  );
}
