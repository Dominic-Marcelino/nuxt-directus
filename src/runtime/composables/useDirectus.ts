import { useNuxtApp } from "#app";
import type { Directus, Auth } from "@directus/sdk";

export default function () {
  const directus: Directus<DirectusCollections, Auth> = useNuxtApp().$directus;
  return directus;
}
