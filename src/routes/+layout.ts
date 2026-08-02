// The docs site is a static export: every route is prerendered at build time, which is what lets
// GitHub Pages serve it without a server. There is no dynamic route and no server code, so this
// applies cleanly to all of them.
export const prerender = true;
