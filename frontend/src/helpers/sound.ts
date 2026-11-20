/**
 * Built-in synthesized sound cues (no audio files). Mute is stored in
 * localStorage (Spec §11.4: short sound on important actions).
 */
import { STORAGE_KEYS } from 'config/constants'
import { load, save } from './storage'

export type SoundName = 'success' | 'error' | 'eliminate' | 'siren' | 'vote' | 'eject' | 'alarm' | 'chat' | 'start' | 'win' | 'lose'

type Note = [freq: number, startS: number, durS: number, wave?: OscillatorType]

const CUES: Record<SoundName, Note[]> = {
  success: [[660, 0, 0.08], [880, 0.08, 0.12]],
  error: [[180, 0, 0.12, 'square']],
  eliminate: [[220, 0, 0.1, 'sawtooth'], [110, 0.1, 0.25, 'sawtooth']],
  siren: [[620, 0, 0.25, 'square'], [440, 0.25, 0.25, 'square'], [620, 0.5, 0.25, 'square']],
  vote: [[520, 0, 0.06]],
  eject: [[392, 0, 0.15], [262, 0.15, 0.3]],
  alarm: [[880, 0, 0.12, 'square'], [880, 0.2, 0.12, 'square'], [880, 0.4, 0.12, 'square']],
  chat: [[740, 0, 0.04]],
  start: [[392, 0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.18]],
  win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1046, 0.36, 0.3]],
  lose: [[392, 0, 0.18, 'triangle'], [330, 0.18, 0.18, 'triangle'], [262, 0.36, 0.4, 'triangle']],
}

let ctx: AudioContext | null = null
let muted = load(STORAGE_KEYS.muted) === '1'

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  save(STORAGE_KEYS.muted, m ? '1' : '0')
}

export function playSound(name: SoundName) {
  if (muted || typeof window === 'undefined' || !('AudioContext' in window)) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime
    for (const [freq, start, dur, wave = 'sine'] of CUES[name]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.08, t0 + start)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + start)
      osc.stop(t0 + start + dur + 0.02)
    }
  } catch {
    /* audio unavailable — ignore */
  }
}
