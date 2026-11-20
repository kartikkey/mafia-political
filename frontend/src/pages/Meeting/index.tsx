/**
 * Emergency session (Spec §8): transition → discussion (chat) → voting
 * (select + Confirm, or Skip) → results with faction reveal.
 */
import { useState } from 'react'
import { Gavel } from 'lucide-react'
import type { VoteChoice } from '@netagiri/shared'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import PixelButton from 'common/components/PixelButton'
import PixelPanel from 'common/components/PixelPanel'
import PhaseTimer from 'components/PhaseTimer/PhaseTimer'
import GameLayout from 'layout/GameLayout'
import { submitVote } from 'slices/meeting/thunk'
import PlayerVoteCard from './components/PlayerVoteCard'
import ChatPanel from './components/ChatPanel'
import VoteResults from './components/VoteResults'
import LeakClueCard from './components/LeakClueCard'
import ReplayPanel from './components/ReplayPanel'
import './Meeting.scss'

const PHASE_LABEL: Record<string, string> = {
  MEETING_TRANSITION: 'Session opens in',
  DISCUSSION: 'Discussion',
  VOTING: 'Voting closes in',
  VOTE_RESULTS: 'Results',
}

export default function Meeting() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const match = useAppSelector((s) => s.game.match)
  const { reason, callerId, clue, replay, votedPlayerIds, myVote, tally, submitLoading, error } = useAppSelector((s) => s.meeting)
  const me = useCurrentPlayer()
  const [choice, setChoice] = useState<VoteChoice | null>(null)
  if (!match) return null

  const state = match.state
  const alive = !!me?.alive
  const canVote = state === 'VOTING' && alive && !myVote
  const caller = match.players.find((p) => p.id === callerId)?.name ?? 'An MP'
  const subtitle = reason === 'BODY' ? `${caller} found a body` : `${caller} called an emergency session`
  const choiceName = choice === 'SKIP' ? 'Skip Vote' : match.players.find((p) => p.id === choice)?.name

  return (
    <GameLayout>
      <div className="meeting" data-testid="meeting-screen" data-phase={state}>
        <header className="meeting__header">
          <h1><Gavel size={26} aria-hidden /> Emergency Session</h1>
          <p className="meeting__subtitle" data-testid="meeting-reason">{subtitle}</p>
          <span data-testid="meeting-timer"><PhaseTimer label={PHASE_LABEL[state] ?? 'Meeting'} /></span>
        </header>

        {state === 'MEETING_TRANSITION' && <div className="meeting__transition" data-testid="meeting-transition">LOK SABHA IS NOW IN SESSION</div>}
        {clue && <LeakClueCard clue={clue} players={match.players} />}

        <div className="meeting__body">
          <PixelPanel title={state === 'VOTING' ? (myVote ? 'Vote confirmed' : 'Cast your vote') : 'Members present'} className="meeting__panel">
            <div className="meeting__grid">
              {match.players.map((p) => (
                <PlayerVoteCard
                  key={p.id}
                  player={p}
                  isMe={p.id === me?.id}
                  selected={choice === p.id}
                  voted={votedPlayerIds.includes(p.id)}
                  disabled={!canVote || !p.alive || !p.connected || p.id === me?.id}
                  onSelect={canVote ? () => setChoice(p.id) : undefined}
                />
              ))}
            </div>

            {state === 'VOTING' && alive && (
              <div className="meeting__vote-bar">
                {myVote ? (
                  <p data-testid="vote-confirmed">You voted: {myVote === 'SKIP' ? 'Skip Vote' : match.players.find((p) => p.id === myVote)?.name}. Votes are final.</p>
                ) : (
                  <>
                    <p>{choiceName ? `Vote for: ${choiceName}` : 'Select an MP or Skip Vote.'}</p>
                    <PixelButton variant={choice === 'SKIP' ? 'primary' : 'ghost'} onClick={() => setChoice('SKIP')} data-testid="vote-skip-btn">Skip Vote</PixelButton>
                    <PixelButton variant="danger" disabled={!choice || submitLoading} onClick={() => choice && dispatch(submitVote(choice))} data-testid="vote-confirm-btn">
                      Confirm Vote
                    </PixelButton>
                  </>
                )}
              </div>
            )}
            {state === 'VOTING' && !alive && <p className="muted">Eliminated players cannot vote.</p>}
            {state === 'DISCUSSION' && <p className="muted">Voting opens when discussion ends.</p>}
            {state === 'VOTE_RESULTS' && tally && <VoteResults tally={tally} players={match.players} />}
            {error && <p className="error-text" role="alert" data-testid="meeting-error">{error}</p>}
          </PixelPanel>

          <div className="meeting__side">
            {replay && <ReplayPanel replay={replay} players={match.players} />}
            <ChatPanel players={match.players} alive={alive} canChat={state === 'DISCUSSION' || state === 'VOTING'} />
          </div>
        </div>
      </div>
    </GameLayout>
  )
}
