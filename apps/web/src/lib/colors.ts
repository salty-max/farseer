import type { Topic } from "@farseer/shared";

/** Topics wear WoW item-quality colours. */
export const TOPIC_COLOR: Record<Topic, string> = {
  news: "text-q-legendary",
  hotfix: "text-q-uncommon",
  patchnotes: "text-q-artifact",
  ptr: "text-q-epic",
  maintenance: "text-q-danger",
  bugs: "text-q-danger",
  classes: "text-q-heirloom",
  community: "text-q-poor",
};
