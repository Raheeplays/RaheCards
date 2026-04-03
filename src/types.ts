export interface CardData {
  id: string;
  name: string;
  symbol: string;
  rank: string;
  image: string;
  details: string;
  stats: {
    no: number;
    speed: number;
    skill: number;
    power: number;
    xp: number;
  };
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  uid: string;
  name: string;
  deck: string[]; // Store card IDs instead of full objects to stay under 1MB limit
  ready: boolean;
  isAiMode?: boolean;
  aiLevel?: 'lose' | 'normal' | 'max';
}

export interface GameRoom {
  id: string;
  roomKey: string;
  hostUid: string;
  status: GameStatus;
  mode: 'solo' | '1v1' | 'multi';
  players: Player[];
  currentTurn: string;
  comparison?: {
    stat: keyof CardData['stats'];
    startTime: string;
    playerUid: string;
  };
  lastAction?: {
    type?: string;
    playerUid: string;
    stat?: keyof CardData['stats'];
    value?: number;
    result?: 'win' | 'lose' | 'draw';
    timestamp?: number;
  };
  winner?: string;
  createdAt: any;
}

export interface UserProfile {
  name: string;
  raheeKey: string;
  wins: number;
  losses: number;
  role?: 'admin' | 'user';
  uid?: string;
  isApproved?: boolean;
}
