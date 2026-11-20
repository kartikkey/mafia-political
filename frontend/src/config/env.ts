export const env = {
  serverUrl: import.meta.env.VITE_SERVER_URL || location.origin,
  socketPath: import.meta.env.VITE_SOCKET_PATH || '/api/socket.io',
}
