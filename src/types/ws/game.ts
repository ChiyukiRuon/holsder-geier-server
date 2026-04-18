import {PlayerInfo} from "./room";

export type GameStage = 'idle' | 'reveal' | 'play' | 'resolve' | 'end';

export interface GameReadyPayload {
    ready: boolean
}

export interface GameState {
    stage: GameStage
    currentRound: number
    currentPointCard: number | null
    carriedOverCards: number[]
    playedCards: Array<{ playerId: string; card: number | null }>
    lastPlayedCards?: Array<{ playerId: string; card: number | null }>
}

export interface GameStartPayload {
    players: PlayerInfo[]
    state: GameState
}

export interface GameEndPayload {
    winnerId?: string
    rankings: Array<{
        playerId: string
        total: number
    }>
    playerPointDetails: Array<{
        playerId: string
        pointCards: number[]
        totalPoint: number
    }>
    players: PlayerInfo[]
    state: GameState
}

export interface GameStatePayload {
    players: PlayerInfo[]
    state: GameState
}

export interface GameResolvePayload {
    players: PlayerInfo[]
    state: GameState
    roundWinner: PlayerInfo | null
}

export interface GameSyncPayload {
    action: {
        player: PlayerInfo
        card: number
    }
}

export interface GameActionPayload {
    action: {
        card: number
    }
}
