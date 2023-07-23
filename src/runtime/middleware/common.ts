import { defineNuxtRouteMiddleware, useRuntimeConfig, navigateTo } from "#app";
import useDirectusAuth from "../composables/useDirectusAuth";

export default defineNuxtRouteMiddleware((to, from) => {
  const config = useRuntimeConfig().public.directus.auth;

  if (
    to.path === config.redirect.login ||
    to.path === config.redirect.callback
  ) {
    const { loggedIn } = useDirectusAuth();

    if (loggedIn.value) {
      const returnToPath = from.query.redirect?.toString();
      const redirectTo = returnToPath || config.redirect.home;
      return navigateTo(redirectTo);
    }
  }
});