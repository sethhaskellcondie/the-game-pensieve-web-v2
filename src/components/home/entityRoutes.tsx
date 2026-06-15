import type { ComponentType, SVGProps } from "react";
import type { EntityKey } from "@/lib/api";
import {
  VideoGamesIcon,
  VideoGameBoxIcon,
  BoardGamesIcon,
  BoardGameBoxIcon,
  ToysIcon,
  SystemsIcon,
} from "@/components/icons";

// How a saved filter's target entity surfaces on its card: the collection page
// it opens, the icon shown beside the name, and the plural noun in the count
// line ("7 games" / "3 toys"). The six entities collapse onto four collection
// pages (boxes and their contents share a page), so several keys map alike — and
// for those shared pages the `view` selects the list (records) or shelf (boxes)
// half so the click lands on the manager whose fields the conditions were built
// against.
type EntityRoute = {
  route: string;
  view?: "list" | "shelf";
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  countNoun: string;
};

export const ENTITY_ROUTES: Record<EntityKey, EntityRoute> = {
  videoGame: {
    route: "/video-games",
    view: "list",
    Icon: VideoGamesIcon,
    countNoun: "games",
  },
  videoGameBox: {
    route: "/video-games",
    view: "shelf",
    Icon: VideoGameBoxIcon,
    countNoun: "games",
  },
  boardGame: {
    route: "/board-games",
    view: "list",
    Icon: BoardGamesIcon,
    countNoun: "games",
  },
  boardGameBox: {
    route: "/board-games",
    view: "shelf",
    Icon: BoardGameBoxIcon,
    countNoun: "games",
  },
  toy: { route: "/toys", Icon: ToysIcon, countNoun: "toys" },
  system: { route: "/systems", Icon: SystemsIcon, countNoun: "systems" },
};
