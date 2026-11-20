/** Appendix A — breaking-news ticker copy. Keyed by server event. */
export const NEWS = {
  POWER_SABOTAGED: "BREAKING: Parliament's power supply has been compromised!",
  DOCUMENT_LEAK: 'ALERT: Parliamentary records access has been disrupted!',
  BODY_REPORTED: 'BREAKING: An MP has been found. Emergency session called!',
  MEETING_STARTED: 'LOK SABHA: Emergency session is now in progress.',
  PLAYER_VOTED_OUT: 'PARLIAMENT: A sitting MP has been voted out.',
  NO_EJECTION: 'PARLIAMENT: The house could not reach a majority. No MP removed.',
  POWER_RESTORED: 'UPDATE: Parliamentary power has been restored.',
  DOCUMENT_LEAK_CONTAINED: 'UPDATE: The leaked files have been recovered. Records access restored.',
  GOVERNMENT_WINS: 'DEMOCRACY SURVIVES: The infiltrators have been exposed.',
  DEEP_STATE_WINS: 'GOVERNMENT COLLAPSES: Parliament has fallen under covert control.',
} as const

export type NewsKey = keyof typeof NEWS
