import { Room } from "../room/roomManager"
import { PlayerState } from "../room/playerState"
import { logger } from "../../utils/logger"
import { sendSystemMessage } from "../../ws/handlers/chat"

export type GameStage =
    | "idle"
    | "reveal"
    | "play"
    | "resolve"
    | "end"

export type PointCard = number

export interface PlayedCard {
    playerId: string
    card: number
}

export interface RoundResult {
    pointCard: PointCard
    winnerId: string | null
    playedCards: PlayedCard[]
    carriedOver: PointCard[]
}

export interface GameAction {
    data: {
        card: number
    }
}

const HAND_CARD_COUNT = 15

const SCORE_CARDS: PointCard[] = [
    1,2,3,4,5,6,7,8,9,10,
    -1,-2,-3,-4,-5
]

export class GameEngine {
    room: Room
    players: PlayerState[]
    playerOrder: PlayerState[]

    stage: GameStage = "idle"
    currentRound = 0
    isRoundTie = false

    pointDeck: PointCard[] = []
    currentPointCard: PointCard | null = null
    carriedOverCards: PointCard[] = []

    playedCards: Map<string, number> = new Map()
    roundResults: RoundResult[] = []
    lastPlayedCards: Map<string, number> = new Map()

    constructor(room: Room) {
        this.room = room
        this.players = room.getPlayers()
        this.playerOrder = [...this.players]
    }

    start() {
        this.stage = "idle"
        this.currentRound = 0
        this.carriedOverCards = []
        this.roundResults = []
        this.playedCards.clear()

        this.dealHands()
        this.shuffleScoreDeck()

        sendSystemMessage(this.room, "游戏开始！")

        this.room.broadcast("game.start", {
            players: this.players.map(p => p.toPublicInfo()),
            spectators: this.room.getSpectators().map(s => s.toPublicInfo()),
            state: this.getState(),
        })

        this.nextRound()
    }

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
        const cards = [...SCORE_CARDS]
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[cards[i], cards[j]] = [cards[j], cards[i]]
        }
        this.pointDeck = cards
    }

    private nextRound() {
        this.currentRound++

        if (this.currentRound > HAND_CARD_COUNT) {
            this.endGame()
            return
        }

        this.lastPlayedCards = new Map(this.playedCards)

        this.stage = "reveal"
        this.playedCards.clear()

        const scoreCard = this.pointDeck.pop()
        if (!scoreCard) {
            this.endGame()
            return
        }

        if (this.currentPointCard !== null && this.isRoundTie) {
            this.carriedOverCards.push(this.currentPointCard!)
        } else {
            this.carriedOverCards = []
        }

        this.currentPointCard = scoreCard

        // 向玩家和观战者发送游戏状态
        this.room.broadcastGameMessage(
            "game.state",
            (player) => ({
                players: this.buildPlayerListForPlayer(player.userId),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForPlayer(player.userId),
            }),
            () => ({
                players: this.buildPlayerListForSpectator(),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForSpectator(),
            })
        )

        setTimeout(() => {
            this.stage = "play"

            this.room.broadcastGameMessage(
                "game.state",
                (player) => ({
                    players: this.buildPlayerListForPlayer(player.userId),
                    spectators: this.buildSpectatorList(),
                    state: this.buildStateForPlayer(player.userId),
                }),
                () => ({
                    players: this.buildPlayerListForSpectator(),
                    spectators: this.buildSpectatorList(),
                    state: this.buildStateForSpectator(),
                })
            )
        }, 500)
    }

    handleAction(playerId: string, action: GameAction) {
        if (this.stage !== "play") {
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
        this.sendStateToAll()

        if (this.playedCards.size === this.players.length) {
            logger.game("All cards played, resolving round", {
                roomId: this.room.roomId,
                round: this.currentRound,
                playedCards: Array.from(this.playedCards.entries()).map(([id, card]) => ({ playerId: id, card }))
            })
            setTimeout(() => this.resolveRound(), 500)
        }
    }

    private resolveRound() {
        this.stage = "resolve"

        const playedCards: PlayedCard[] = Array.from(
            this.playedCards.entries()
        ).map(([playerId, card]) => ({ playerId, card }))

        let winnerId: string | null = null

        if (this.currentPointCard !== null) {
            const result = this.determineWinner(playedCards, this.currentPointCard)
            winnerId = result.winnerId
        }

        if (winnerId) {
            const player = this.players.find(p => p.userId === winnerId)
            if (player) {
                player.points.push(
                    ...this.carriedOverCards,
                    this.currentPointCard!
                )
            }
            this.isRoundTie = false
        } else {
            this.isRoundTie = true
        }

        const roundResult: RoundResult = {
            pointCard: this.currentPointCard!,
            winnerId,
            playedCards,
            carriedOver: [...this.carriedOverCards],
        }
        this.roundResults.push(roundResult)

        const roundWinner = winnerId
            ? this.players.find(p => p.userId === winnerId)?.toPublicInfo() ?? null
            : null

        this.room.broadcastGameMessage(
            "game.resolve",
            (player) => ({
                players: this.buildPlayerListForPlayer(player.userId),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForPlayer(player.userId),
                roundWinner,
            }),
            () => ({
                players: this.buildPlayerListForSpectator(),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForSpectator(),
                roundWinner,
            })
        )

        setTimeout(() => {
            this.nextRound()
        }, 3000)
    }

    private determineWinner(
        playedCards: PlayedCard[],
        scoreCard: PointCard
    ): { winnerId: string | null } {
        if (playedCards.length === 0) return { winnerId: null }

        // 统计每张牌的出现次数
        const cardCountMap = new Map<number, number>()
        playedCards.forEach(({ card }) => {
            cardCountMap.set(card, (cardCountMap.get(card) || 0) + 1)
        })

        // 过滤出只出现一次的牌（不重复的牌）
        const uniqueCards = playedCards.filter(({ card }) => cardCountMap.get(card) === 1)

        // 如果没有不重复的牌，无人获胜
        if (uniqueCards.length === 0) {
            return { winnerId: null }
        }

        // 根据分值牌的正负决定排序方式
        const sorted = uniqueCards.sort((a, b) => {
            return scoreCard > 0 ? b.card - a.card : a.card - b.card
        })

        // 返回第一个（最大值或最小值）的玩家ID
        return { winnerId: sorted[0].playerId }
    }

    private endGame() {
        this.stage = "end"

        const rankings = [...this.players]
            .map((p) => ({
                playerId: p.userId,
                totalPoint: p.getTotalPoint(),
            }))
            .sort((a, b) => b.totalPoint - a.totalPoint)

        let winnerId: string | undefined = undefined
        let isTie = false

        if (rankings.length > 0) {
            winnerId = rankings[0].playerId

            for (let i = 1; i < rankings.length; i++) {
                if (rankings[i].totalPoint !== rankings[0].totalPoint) {
                    break
                }

                if (i === rankings.length - 1) {
                    isTie = true
                    winnerId = undefined
                }
            }
        }

        logger.game("Game ended", {
            roomId: this.room.roomId,
            winnerId: isTie ? null : winnerId,
            isTie,
            rankings,
            finalScores: rankings.map(r => ({ playerId: r.playerId, total: r.totalPoint }))
        })

        this.room.status = "waiting"

        if (isTie) {
            sendSystemMessage(this.room, "游戏结束！无人获胜。")
        } else {
            const winner = this.players.find(p => p.userId === winnerId)
            const winnerName = winner?.ctx.user?.nickname ?? winnerId ?? "未知玩家"
            sendSystemMessage(this.room, `游戏结束，${winnerName} 获胜！`)
        }

        this.room.broadcast("game.end", {
            winnerId: isTie ? undefined : winnerId,
            rankings,
            playerPointDetails: this.players.map((p) => ({
                playerId: p.userId,
                pointCards: p.points,
                totalPoint: p.getTotalPoint(),
            })),
            players: this.players.map((p) => p.toPublicInfo()),
            spectators: this.buildSpectatorList(),
            state: this.getState(),
        })

        // 游戏结束后，移除所有掉线的玩家（websocket已断开的玩家）
        const disconnectedPlayers: string[] = []
        this.players.forEach((player) => {
            if (!player.ctx.ws || player.ctx.ws.readyState !== 1) {
                disconnectedPlayers.push(player.userId)
            }
        })

        if (disconnectedPlayers.length > 0) {
            logger.game("Removing disconnected players after game end", {
                roomId: this.room.roomId,
                disconnectedPlayers
            })

            disconnectedPlayers.forEach((userId) => {
                const nickname = this.room.getPlayer(userId)?.ctx.user?.nickname ?? userId
                sendSystemMessage(this.room, `${nickname} 离开了房间`)
                this.room.removePlayer(userId)
            })

            // 如果房间为空，销毁房间
            if (this.room.players.size === 0) {
                const roomManager = require("../room/roomManager").roomManager
                roomManager.deleteRoom(this.room.roomId)
                logger.room("Room deleted after game end (all players disconnected)", {
                    roomId: this.room.roomId
                })
            } else {
                this.room.broadcast("room.update", {
                    room: this.room.toRoomInfo(),
                })
            }
        }
    }

    getState() {
        return {
            stage: this.stage,
            currentRound: this.currentRound,
            currentPointCard: this.currentPointCard,
            carriedOverCards: this.carriedOverCards,
            playedCards: Array.from(this.playedCards.entries()).map(
                ([playerId, card]) => ({ playerId, card })
            ),
            lastPlayedCards: Array.from(this.lastPlayedCards.entries()).map(
                ([playerId, card]) => ({ playerId, card })
            ),
        }
    }

    buildPlayerListForPlayer(targetPlayerId: string) {
        return this.players.map((p) => {
            const info = p.toPublicInfo()
            const currentCard = this.playedCards.get(p.userId)
            const lastCard = this.lastPlayedCards.get(p.userId)

            if (p.userId === targetPlayerId) {
                return {
                    ...info,
                    currentPlayerCard: currentCard ?? null,
                    lastPlayerCard: lastCard ?? null,
                }
            } else {
                return {
                    ...info,
                    card: [],
                    point: {
                        count: info.point.count,
                        list: []
                    },
                    currentPlayerCard: currentCard !== undefined ? 0 : null,
                    lastPlayerCard: lastCard ?? null,
                }
            }
        })
    }

    buildStateForPlayer(targetPlayerId: string) {
        return {
            stage: this.stage,
            currentRound: this.currentRound,
            currentPointCard: this.currentPointCard,
            carriedOverCards: this.carriedOverCards,

            playedCards: Array.from(this.playedCards.entries()).map(
                ([playerId, card]) => {
                    if (this.stage === "resolve" || this.stage === "end") {
                        return { playerId, card }
                    }

                    return {
                        playerId,
                        card: playerId === targetPlayerId ? card : 0,
                    }
                }
            ),

            lastPlayedCards: Array.from(this.lastPlayedCards.entries()).map(
                ([playerId, card]) => ({
                    playerId,
                    card,
                })
            ),
        }
    }

    sendStateToAll() {
        this.room.broadcastGameMessage(
            "game.state",
            (player) => ({
                players: this.buildPlayerListForPlayer(player.userId),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForPlayer(player.userId),
            }),
            () => ({
                players: this.buildPlayerListForSpectator(),
                spectators: this.buildSpectatorList(),
                state: this.buildStateForSpectator(),
            })
        )
    }

    buildPlayerListForSpectator() {
        return this.players.map((p) => {
            const info = p.toPublicInfo()
            const currentCard = this.playedCards.get(p.userId)
            const lastCard = this.lastPlayedCards.get(p.userId)

            return {
                ...info,
                currentPlayerCard: currentCard ?? null,
                lastPlayerCard: lastCard ?? null,
            }
        })
    }

    buildSpectatorList() {
        const spectators = this.room.getSpectators()
        return spectators.map((s) => s.toPublicInfo())
    }

    buildStateForSpectator() {
        return {
            stage: this.stage,
            currentRound: this.currentRound,
            currentPointCard: this.currentPointCard,
            carriedOverCards: this.carriedOverCards,

            playedCards: Array.from(this.playedCards.entries()).map(
                ([playerId, card]) => ({ playerId, card })
            ),

            lastPlayedCards: Array.from(this.lastPlayedCards.entries()).map(
                ([playerId, card]) => ({
                    playerId,
                    card,
                })
            ),
        }
    }
}
