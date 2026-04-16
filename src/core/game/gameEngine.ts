import { Room } from "../room/roomManager"
import { PlayerState } from "../room/playerState"
import { MessageMap } from "../../types/ws/message"
import { logger, LogCategory } from "../../utils/logger"
import {sendSystemMessage} from "../../ws/handlers/chat";

export type GamePhase =
    | "idle"           // 未开始
    | "reveal"         // 翻开得分牌
    | "play"            // 出牌阶段
    | "resolve"         // 结算阶段
    | "end"             // 游戏结束

export interface ScoreCard {
    value: number
    type: "meerkat" | "vulture"
    index: number
}

export interface PlayedCard {
    playerId: string
    card: number
}

export interface RoundResult {
    scoreCard: ScoreCard
    winnerId: string | null
    playedCards: PlayedCard[]
    carriedOver: ScoreCard[]
}

export interface GameAction {
    actionId: string
    actionType: string
    data: any
}

const HAND_CARD_COUNT = 15
const SCORE_CARDS: Omit<ScoreCard, "index">[] = [
    // 狐獴牌
    { value: 1, type: "meerkat" },
    { value: 2, type: "meerkat" },
    { value: 3, type: "meerkat" },
    { value: 4, type: "meerkat" },
    { value: 5, type: "meerkat" },
    { value: 6, type: "meerkat" },
    { value: 7, type: "meerkat" },
    { value: 8, type: "meerkat" },
    { value: 9, type: "meerkat" },
    { value: 10, type: "meerkat" },
    // 秃鹫牌
    { value: -1, type: "vulture" },
    { value: -2, type: "vulture" },
    { value: -3, type: "vulture" },
    { value: -4, type: "vulture" },
    { value: -5, type: "vulture" },
]

export class GameEngine {
    room: Room
    players: PlayerState[]
    playerOrder: PlayerState[]

    phase: GamePhase = "idle"
    currentRound = 0

    scoreDeck: ScoreCard[] = []
    currentScoreCard: ScoreCard | null = null
    carriedOverCards: ScoreCard[] = []

    playedCards: Map<string, number> = new Map()
    roundResults: RoundResult[] = []
    lastPlayedCards: Map<string, number> = new Map()

    constructor(room: Room) {
        this.room = room
        this.players = Array.from(room.players.values())
        this.playerOrder = [...this.players]
    }

    start() {
        logger.game("Game starting", { roomId: this.room.roomId, playerCount: this.players.length, players: this.players.map(p => p.userId) })

        this.phase = "idle"
        this.currentRound = 0
        this.carriedOverCards = []
        this.roundResults = []
        this.playedCards.clear()

        this.dealHands()
        this.shuffleScoreDeck()

        sendSystemMessage(this.room, "游戏开始！")

        this.room.broadcast("game.start", {
            players: this.players.map((p) => p.toPublicInfo()),
            state: this.getState(),
        })

        this.nextRound()
    }

    // 发牌
    private dealHands() {
        for (const player of this.players) {
            player.handCards = this.generateHand()
            player.points = []
        }
    }

    private generateHand(): number[] {
        return Array.from({ length: HAND_CARD_COUNT }, (_, i) => i + 1)
    }

    private shuffleScoreDeck() {
        const cards = SCORE_CARDS.map((card, index) => ({
            ...card,
            index,
        }))

        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[cards[i], cards[j]] = [cards[j], cards[i]]
        }

        this.scoreDeck = cards
    }

    // 回合
    private nextRound() {
        this.currentRound++

        if (this.currentRound > HAND_CARD_COUNT) {
            this.endGame()
            return
        }

        // 保存上一回合的出牌记录
        this.lastPlayedCards = new Map(this.playedCards)

        this.phase = "reveal"
        this.playedCards.clear()

        const scoreCard = this.scoreDeck.pop()
        if (!scoreCard) {
            this.endGame()
            return
        }

        if (this.carriedOverCards.length > 0) {
            this.currentScoreCard = null
        } else {
            this.currentScoreCard = scoreCard
        }

        // 服务器下发游戏阶段信息
        this.room.broadcast("game.stage", {
            players: this.players.map((p) => p.toPublicInfo()),
            state: this.getState(),
        })

        logger.game("Round reveal phase", {
            roomId: this.room.roomId,
            round: this.currentRound,
            scoreCard: this.currentScoreCard,
            carriedOverCount: this.carriedOverCards.length
        })

        setTimeout(() => {
            this.phase = "play"
            this.room.broadcast("game.stage", {
                players: this.players.map((p) => p.toPublicInfo()),
                state: this.getState(),
            })
        }, 100)
    }

    // 玩家操作
    handleAction(playerId: string, action: GameAction) {
        if (this.phase !== "play") {
            throw new Error("NOT_IN_PLAY_PHASE")
        }

        const player = this.players.find((p) => p.userId === playerId)
        if (!player) {
            throw new Error("PLAYER_NOT_FOUND")
        }

        if (this.playedCards.has(playerId)) {
            throw new Error("ALREADY_PLAYED")
        }

        const { card } = action.data
        if (!player.handCards.includes(card)) {
            throw new Error("INVALID_CARD")
        }

        player.handCards = player.handCards.filter((c) => c !== card)
        this.playedCards.set(playerId, card)

        logger.game("Card played", {
            roomId: this.room.roomId,
            round: this.currentRound,
            playerId,
            card,
            remainingCards: player.handCards.length,
            totalPlayed: this.playedCards.size,
            waitingFor: this.players.length - this.playedCards.size
        })

        // 服务器向其余玩家同步某一玩家的游戏操作
        this.room.broadcastToOthers(playerId, "game.sync", {
            action: {
                player: player.toPublicInfo(),
                card,
            },
        })

        if (this.playedCards.size === this.players.length) {
            logger.game("All cards played, resolving round", {
                roomId: this.room.roomId,
                round: this.currentRound,
                playedCards: Array.from(this.playedCards.entries()).map(([id, card]) => ({ playerId: id, card }))
            })
            setTimeout(() => this.resolveRound(), 500)
        }
    }

    // 回合结算
    private resolveRound() {
        this.phase = "resolve"

        const playedCards: PlayedCard[] = Array.from(
            this.playedCards.entries()
        ).map(([playerId, card]) => ({ playerId, card }))

        let winnerId: string | null = null
        let carriedOver: ScoreCard[] = [...this.carriedOverCards]

        if (this.currentScoreCard) {
            const result = this.determineWinner(playedCards, this.currentScoreCard)
            winnerId = result.winnerId
            carriedOver.push(this.currentScoreCard)
        }

        if (!winnerId) {
            carriedOver.push(...playedCards.map((_, i) => ({
                value: 0,
                type: "meerkat" as const,
                index: -1 - i,
            })))
        }

        const resolvedCards: ScoreCard[] = []
        if (winnerId && this.currentScoreCard) {
            resolvedCards.push(this.currentScoreCard)
        }

        if (winnerId) {
            const player = this.players.find((p) => p.userId === winnerId)
            if (player && this.currentScoreCard) {
                const totalValue = carriedOver.reduce((sum, c) => sum + c.value, 0)
                player.points.push(totalValue)
            }
            carriedOver = []
        }

        const roundResult: RoundResult = {
            scoreCard: this.currentScoreCard!,
            winnerId,
            playedCards,
            carriedOver: [...carriedOver],
        }
        this.roundResults.push(roundResult)

        this.carriedOverCards = carriedOver

        logger.game("Round resolved", {
            roomId: this.room.roomId,
            round: this.currentRound,
            winnerId,
            scoreCard: this.currentScoreCard,
            carriedOverCount: this.carriedOverCards.length,
            playerScores: this.players.map(p => ({ playerId: p.userId, total: p.getTotalScore() }))
        })

        this.room.broadcast("game.resolve", {
            players: this.players.map((p) => p.toPublicInfo()),
            state: this.getState(),
        })

        setTimeout(() => {
            this.nextRound()
        }, 2000)
    }

    private determineWinner(
        playedCards: PlayedCard[],
        scoreCard: ScoreCard
    ): { winnerId: string | null } {
        if (playedCards.length === 0) {
            return { winnerId: null }
        }

        const sorted = [...playedCards].sort((a, b) => {
            if (scoreCard.type === "meerkat") {
                return b.card - a.card
            } else {
                return a.card - b.card
            }
        })

        const topCard = sorted[0].card
        const tiedPlayers = sorted.filter((p) => p.card === topCard)

        if (tiedPlayers.length === sorted.length) {
            return { winnerId: null }
        }

        if (tiedPlayers.length > 1) {
            const untied = sorted.filter((p) => p.card !== topCard)
            if (untied.length === 0) {
                return { winnerId: null }
            }
            return { winnerId: untied[0].playerId }
        }

        return { winnerId: sorted[0].playerId }
    }

    // 游戏结束
    private endGame() {
        this.phase = "end"

        const rankings = [...this.players]
            .map((p) => ({
                playerId: p.userId,
                total: p.getTotalScore(),
            }))
            .sort((a, b) => b.total - a.total)

        const winnerId = rankings[0]?.playerId
        const winner = this.players.find(p => p.userId === winnerId)
        const winnerName = winner?.ctx.user?.nickname ?? winnerId ?? "未知玩家"

        logger.game("Game ended", {
            roomId: this.room.roomId,
            winnerId,
            rankings,
            finalScores: rankings.map(r => ({ playerId: r.playerId, total: r.total }))
        })

        this.room.status = "waiting"

        sendSystemMessage(this.room, `游戏结束！${winnerName} 获胜！`)

        this.room.broadcast("game.end", {
            winnerId,
            rankings,
            playerPoints: this.players.map((p) => ({
                playerId: p.userId,
                points: p.points,
                total: p.getTotalScore(),
            })),
            players: this.players.map((p) => p.toPublicInfo()),
            state: this.getState(),
        })
    }

    getState(playerId?: string) {
        return {
            stage: this.phase,
            currentRound: this.currentRound,
            currentPointCards: this.currentScoreCard ? [this.currentScoreCard] : [],
            carriedOverCards: this.carriedOverCards,
            playedCards: Array.from(this.playedCards.entries()).map(
                ([playerId, card]) => ({ playerId, card })
            ),
            lastPlayedCards: Array.from(this.lastPlayedCards.entries()).map(
                ([playerId, card]) => ({ playerId, card })
            ),
        }
    }
}
