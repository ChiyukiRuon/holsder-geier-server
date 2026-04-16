import {PlayerInfo} from "./room";

export interface PointCard {
    value: number;
}

export type GameStage = 'idle' | 'reveal' | 'play' | 'resolve' | 'end';

export interface GameReadyPayload {
    ready: boolean
}

export interface GameState {
    stage: GameStage
    currentRound: number
    currentPointCards: PointCard[]
    carriedOverCards: PointCard[]
    playedCards: Array<{ playerId: string; card: number | null }>
    lastPlayedCards?: Array<{ playerId: string; card: number | null }>
}

export interface GameStartPayload {
    players: PlayerInfo[]
    state: GameState
}

export interface GameEndPayload {
    winnerId?: string
    rankings?: Array<{
        playerId: string
        total: number
    }>
    playerPoints: Array<{
        playerId: string
        points: number[]
        total: number
    }>
    players: PlayerInfo[]
    state: GameState
}

export interface GameStagePayload {
    players: PlayerInfo[]
    state: GameState
}

export interface GameSyncPayload {
    action: {
        player: PlayerInfo
        card: number
    }
}

export interface GameActionPayload {
    action: {
        player: PlayerInfo
        card: number
    }
}

export interface GameResolvePayload {
    players: PlayerInfo[]
    state: GameState
}
