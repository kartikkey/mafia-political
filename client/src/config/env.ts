export const env = {
  serverUrl: import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:3001`,
}
