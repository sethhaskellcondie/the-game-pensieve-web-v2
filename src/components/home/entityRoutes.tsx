import type { ComponentType, SVGProps } from "react";
import type { EntityKey } from "@/lib/api";
import {
  VideoGamesIcon,
  BoardGamesIcon,
  ToysIcon,
  SystemsIcon,
} from "@/components/icons";

// How a saved filter's target entity surfaces on its card: the collection page
// it opens, the icon shown beside the name, and the plural noun in the count
// line ("7 games" / "3 toys"). The six entities collapse onto four collection
// pages (boxes and their contents share a page), so several keys map alike.
type EntityRoute = {
  route: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  countNoun: string;
};

export const ENTITY_ROUTES: Record<EntityKey, EntityRoute> = {
  videoGame: { route: "/video-games", Icon: VideoGamesIcon, countNoun: "games" },
  videoGameBox: {
    route: "/video-games",
    Icon: VideoGamesIcon,
    countNoun: "games",
  },
  boardGame: { route: "/board-games", Icon: BoardGamesIcon, countNoun: "games" },
  boardGameBox: {
    route: "/board-games",
    Icon: BoardGamesIcon,
    countNoun: "games",
  },
  toy: { route: "/toys", Icon: ToysIcon, countNoun: "toys" },
  system: { route: "/systems", Icon: SystemsIcon, countNoun: "systems" },
};
