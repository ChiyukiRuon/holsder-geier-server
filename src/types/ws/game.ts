export interface GameReadyPayload {
    ready: boolean
}

export interface GameStartPayload {
    players: Array<{
        playerId: string
        name: string
    }>
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
    state: GameState
}

export interface GameStagePayload {
    stage: "idle" | "reveal" | "play" | "resolve" | "end"
    round: number
    scoreCard: {
        value: number
        type: "meerkat" | "vulture"
        index: number
    } | null
    carriedOver: Array<{
        value: number
        type: "meerkat" | "vulture"
        index: number
    }>
    state: GameState
}

export interface GameSyncPayload {
    action: {
        playerId: string
        actionId: string
        actionType: string
        card: number
    }
    state: GameState
}

export interface GameActionPayload {
    actionId: string
    actionType: string
    data: {
        card: number
    }
}

export interface GameState {
    phase: "idle" | "reveal" | "play" | "resolve" | "end"
    currentRound: number
    currentScoreCard: {
        value: number
        type: "meerkat" | "vulture"
        index: number
    } | null
    carriedOverCards: Array<{
        value: number
        type: "meerkat" | "vulture"
        index: number
    }>
    playedCards: Array<{
        playerId: string
        card: number
    }>
    lastPlayedCards: Array<{
        playerId: string
        card: number
    }>
    playerHands: Array<{
        playerId: string
        handCount: number
        scoreCardCount: number
        score: number | null
    }>
}

export interface GameResolvePayload {
    round: number
    playedCards: Array<{
        playerId: string
        card: number
    }>
    winnerId: string | null
    scoreCard: {
        value: number
        type: "meerkat" | "vulture"
        index: number
    } | null
    carriedOver: Array<{
        value: number
        type: "meerkat" | "vulture"
        index: number
    }>
    playerPoints: Array<{
        playerId: string
        points: number[]
        total: number
    }>
    state: GameState
}