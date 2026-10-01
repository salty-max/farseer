import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { validateFeedSearch } from "@/lib/feedSearch";
import { Feed } from "@/routes/Feed";
import { Post } from "@/routes/Post";
import { Saved } from "@/routes/Saved";
import { Settings } from "@/routes/Settings";

const rootRoute = createRootRoute({ component: Layout });

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: validateFeedSearch,
  component: Feed,
});
const postRoute = createRoute({ getParentRoute: () => rootRoute, path: "/post/$id", component: Post });
const savedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/saved", component: Saved });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: Settings });

const routeTree = rootRoute.addChildren([feedRoute, postRoute, savedRoute, settingsRoute]);

export const router = createRouter({ routeTree, scrollRestoration: true, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
