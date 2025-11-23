
import { Timestamp } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  playerID: string; // Added playerID as a core part of the user profile
}

// FIX: Add missing HighValueWin type for the winner marquee.
export interface HighValueWin {
  nickname: string;
  amount: number;
  gameName: string;
}

// All game-specific types have been removed. 
// 'xboom' can be used as a placeholder for the main/home view.
export type GameId = 
  | 'xboom' 
  | 'chickenRoad' 
  | 'coinFlip' 
  | 'dragonKing' 
  | 'crashGame' 
  | 'stockMarketGame'
  | 'highLow'
  | 'slotMachine'
  | 'guessColor'
  | 'diceRoll'
  | 'rockPaperScissors'
  | 'cardDraw'
  | 'findTheBox'
  | 'numberGuess'
  | 'plinko'
  | 'luckyWheel'
  | 'greedyGame'
  | 'treasureHunt'
  | 'domino'
  | 'quickSyndicate'
  | 'colorWar'
  | 'timeBomb'
  | 'camelRace'
  | 'uniqueBid'
  | 'safeZone'
  | 'bankOfLuck'
  | 'majorityRules'
  | 'zodiacArena'
  | 'forestRun'
  | 'pearlDiving'
  | 'cyberHack'
  | 'desertCaravan'
  | 'cardsClub'
  | 'spaceWar'
  | 'potionLab'
  | 'fishingNet'
  | 'chefBattle'
  | 'monsterHunt';

export interface TransactionRequest {
  id: string;
  userEmail: string;
  userId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface MailboxMessage {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  timestamp: number; // Firestore Timestamp
}

export interface SystemNotification extends MailboxMessage {
  recipientId: string;
  recipientEmail: string;
}

export interface ProfitLogEntry {
  id: string;
  amount: number;
  percentage: number;
  gameId: GameId;
  userId: string;
  userEmail: string;
  originalBet: number;
  timestamp: number;
}

export interface SyndicateParticipant {
    userId: string;
    nickname: string;
    avatar: string;
    joinedAt: number;
}

export interface QuickSyndicateState {
    roundId: string;
    entryFee: number;
    participants: SyndicateParticipant[];
    startTime: number;
    endTime: number;
    status: 'open' | 'processing' | 'completed';
    lastWinners?: string[]; // Nicknames of last round winners
    totalPot?: number;
}

// --- Time Bomb Types ---
export interface TimeBombParticipant {
    userId: string;
    nickname: string;
    avatar: string;
    status: 'alive' | 'dead' | 'winner'; // حالة اللاعب في الجولة الحالية
    gridIndex: number; // موقعه في الشبكة
}

export interface TimeBombState {
    roundId: string;
    status: 'waiting' | 'active' | 'exploded';
    participants: TimeBombParticipant[];
    startTime: number;     // وقت بدء الجولة
    explosionTime: number; // وقت الانفجار المتوقع
    entryFee: number;
    lastWinners: string[]; // أسماء آخر الفائزين
}

// --- Cards Club Types ---
export interface CardData {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: string; // 2, 3... 10, J, Q, K, A
    value: number;
}

export interface CardsParticipant {
    userId: string;
    nickname: string;
    avatar: string;
    card: CardData;
    slotIndex: number;
}

export interface CardsClubState {
    roundId: string;
    status: 'open' | 'dealing' | 'revealing' | 'completed';
    participants: CardsParticipant[];
    winningCard: CardData | null;
    endTime: number;
    entryFee: number;
    lastWinners: string[];
}
