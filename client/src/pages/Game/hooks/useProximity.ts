/** What the local player is standing next to (Spec §3.2 contextual priority). */
import type { MutableRefObject } from 'react'
import {
  MATCH_SETTINGS,
  POWER_PANEL,
  ROOMS,
  distance,
  withinRange,
  type Body,
  type ClientMatchView,
  type TaskInstance,
  type PublicPlayer,
  type RoleAssignment,
  type Vec2,
} from '@netagiri/shared'

const nearest = <T,>(items: T[], at: (t: T) => Vec2, here: Vec2, range: number) =>
  items
    .filter((i) => withinRange(here, at(i), range))
    .sort((a, b) => distance(here, at(a)) - distance(here, at(b)))[0]

export interface Proximity {
  nearTask?: TaskInstance
  nearBody?: Body
  nearTarget?: PublicPlayer
  nearPanel: boolean
  roomLabel: string
}

export function useProximity(match: ClientMatchView | null, me: PublicPlayer | null, role: RoleAssignment | null, pos: MutableRefObject<Vec2 | null>): Proximity {
  const here = pos.current ?? me?.position
  if (!match || !me || !here) return { nearPanel: false, roomLabel: '' }
  const deep = role?.faction === 'DEEP_STATE'
  const nearTask = nearest(match.tasks.filter((t) => t.status !== 'COMPLETE'), (t) => t.position, here, MATCH_SETTINGS.interactionRange)
  const nearBody = nearest(match.bodies.filter((b) => !b.reported), (b) => b.position, here, MATCH_SETTINGS.reportRange)
  const nearTarget = deep
    ? nearest(
        match.players.filter((p) => p.alive && p.connected && p.id !== me.id && !role?.teammateIds.includes(p.id)),
        (p) => p.position,
        here,
        MATCH_SETTINGS.eliminationRange
      )
    : undefined
  const nearPanel = withinRange(here, POWER_PANEL, MATCH_SETTINGS.interactionRange)
  const roomLabel = nearTask ? (ROOMS.find((r) => r.id === nearTask.roomId)?.label ?? '') : ''
  return { nearTask, nearBody, nearTarget, nearPanel, roomLabel }
}
