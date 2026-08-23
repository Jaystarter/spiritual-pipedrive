// Shared between the server (page.tsx reads the cookie to scope queries) and
// the client region store. Must stay free of "use client" so both can import it.
export const REGION_COOKIE_NAME = "sd-region";
