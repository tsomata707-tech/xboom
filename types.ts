
import { Timestamp } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  playerID: string; // Added playerID as a core part of the user profile
  isBanned?: boolean; // New: Support for banning users
}

// FIX: Add missing HighValueWin type for the winner marquee.
export interface HighValueWin {
  nickname: string;
  amount: number;
  gameName: string;
}

export interface GiftCode {
  code: string;
  amount: number;
  isRedeemed: boolean;
  createdBy: string;
  createdAt: number;
}

// All game-specific types have been removed. 
// 'xboom' can be used as a placeholder for the main/home view.
export type GameId = 
  | 'xboom' 
  | 'chickenRoad' 
  | 'coinFlip' 
  | 'dragonKing' 
  | 'crashGame' 
  | 'highLow'
  | 'slotMachine'
  | 'guessColor'
  | 'diceRoll'
  | 'rockPaperScissors'
  | 'cardDraw'
  | 'findTheBox'
  | 'numberGuess'
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
  | 'monsterHunt'
  | 'wrestling'
  | 'xboomStockMarket'
  | 'plinko'
  | 'theMaze';

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
  isRead: boolean; // Ensuring consistency with MailboxMessage
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

// --- Coin Flip Types (Real-time) ---
export interface CoinFlipBet {
    userId: string;
    nickname: string;
    avatar: string;
    amount: number;
    choice: 'king' | 'writing';
    timestamp: number;
}

export interface CoinFlipGameState {
    roundId: number;
    status: 'betting' | 'flipping' | 'result';
    startTime: number;
    endTime: number; // When the current phase ends
    result: 'king' | 'writing' | null; // Null during betting
    bets: Record<string, CoinFlipBet>; // Map userId -> Bet
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Generic Multiplayer Game Bet ---
export interface GenericGameBet {
    userId: string;
    nickname: string;
    avatar: string;
    amount: number;
    choice: any; // Can be string, number, object depending on game
    timestamp: number;
}

// --- Crash Game Types ---
export interface CrashGameState {
    roundId: number;
    status: 'waiting' | 'flying' | 'crashed';
    startTime: number; // When flying started
    crashPoint: number; // Predetermined crash point (hidden from client logic, revealed at crash)
    endTime: number; // Expected crash time or next phase start
    bets: Record<string, { userId: string; nickname: string; amount: number; cashedOut: boolean; cashOutPoint?: number; winAmount?: number }>;
    history: number[];
}

// --- Lucky Wheel Types ---
export interface LuckyWheelGameState {
    roundId: number;
    status: 'betting' | 'spinning' | 'result';
    endTime: number;
    resultSegment: string | null; // ID of winning segment
    bets: Record<string, { userId: string; nickname: string; amount: number }>;
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Dice Roll Types ---
export interface DiceRollGameState {
    roundId: number;
    status: 'betting' | 'rolling' | 'result';
    endTime: number;
    result: number | null; // 1-6
    bets: Record<string, GenericGameBet>;
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Guess Color Types ---
export interface GuessColorGameState {
    roundId: number;
    status: 'betting' | 'revealing' | 'result';
    endTime: number;
    result: string | null; // 'red', 'green', etc.
    bets: Record<string, GenericGameBet>;
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Card Draw Types ---
export interface CardDrawGameState {
    roundId: number;
    status: 'betting' | 'drawing' | 'result';
    endTime: number;
    result: { value: string, suit: string } | null;
    bets: Record<string, { userId: string; nickname: string; bets: Record<string, number> }>; // User can bet on multiple outcomes
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Number Guess Types ---
export interface NumberGuessGameState {
    roundId: number;
    status: 'betting' | 'revealing' | 'result';
    endTime: number;
    result: number | null; // 1-10
    bets: Record<string, { userId: string; nickname: string; bets: Record<number, number> }>;
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- Greedy Game Types (Multiplayer) ---
export interface GreedyGameState {
    roundId: number;
    status: 'betting' | 'spinning' | 'result';
    endTime: number;
    winningItemId: string | null; // ID of winning item
    bets: Record<string, { userId: string; nickname: string; bets: Record<string, number> }>; // User bets on item IDs -> Amount
    lastRoundWinners: { nickname: string; amount: number }[];
    history: string[]; // Array of winning Item IDs
}

// --- Stock Market Game Types ---
export interface StockMarketGameState {
    roundId: number;
    status: 'betting' | 'processing' | 'result';
    endTime: number;
    results: Record<string, 'up' | 'down'> | null;
    bets: Record<string, {
        userId: string;
        nickname: string;
        bets: { commodityId: string; direction: 'up' | 'down'; amount: number }[]
    }>;
    history?: any[];
}

// --- Plinko Game Types ---
export interface PlinkoGameState {
    roundId: number;
    status: 'betting' | 'dropping' | 'result';
    endTime: number;
    currentMultipliers?: number[];
    bets: Record<string, { userId: string; nickname: string; amount: number; ballCount: number }>;
    lastRoundWinners: { nickname: string; amount: number }[];
}

// --- The Maze Game Types ---
export interface TheMazeGameState {
    roundId: number;
    status: 'betting' | 'running' | 'result';
    endTime: number;
    pathMap: number[]; // Array index i (door) maps to value (outcome index)
    outcomeValues: number[]; // Array of 10 multiplier values for the outputs
    bets: Record<string, { userId: string; nickname: string; amount: number; doorIndex: number }>;
    lastRoundWinners: { nickname: string; amount: number }[];
}
