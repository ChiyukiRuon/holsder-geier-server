export interface UserInfo {
    userId: string
    nickname: string
    color: string
    avatar: string
    background: string
}

export interface UserUpdatePayload {
    nickname?: string
    avatar?: string
    background?: string
    color?: string
}
