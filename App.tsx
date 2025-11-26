
import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { doc, onSnapshot, updateDoc, increment, setDoc, collection, query, where, orderBy, limit, serverTimestamp, getDoc, getDocs, writeBatch, addDoc, getCountFromServer, Timestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, GameId, TransactionRequest, SystemNotification, ProfitLogEntry, HighValueWin, CoinFlipGameState, CoinFlipBet, CrashGameState, LuckyWheelGameState, DiceRollGameState, GuessColorGameState, CardDrawGameState, NumberGuessGameState, GreedyGameState, TimeBombState, TheMazeGameState } from './types';
import { formatNumber } from './components/utils/formatNumber';
import { convertTimestamps } from './components/utils/convertTimestamps';
import { getCached, setCached } from './components/utils/simpleCache';

// Components
import Header from './components/Header';
import LoadingScreen from './components/LoadingScreen';
import AdminPanel from './components/AdminPanel';
import WalletModal from './components/WalletModal';
import AgentsModal from './components/AgentsModal';
import AvatarModal from './components/AvatarModal';
import ManagementModal from './components/ManagementModal';
import MailboxModal from './components/MailboxModal';
import RoundHistoryModal from './components/RoundHistoryModal';
import AnnouncementBanner from './components/AnnouncementBanner';
import WinnerMarquee from './components/WinnerMarquee';
import ImageBannerDisplay from './components/ImageBannerDisplay';
import HowToPlay from './components/HowToPlay';
import InfoIcon from './components/icons/InfoIcon';

// Games - Import all game components
import CoinFlipGame from './components/games/CoinFlipGame';
import HighLowGame from './components/games/HighLowGame';
import SlotMachineGame from './components/games/SlotMachineGame';
import GuessColorGame from './components/games/GuessColorGame';
import DiceRollGame from './components/games/DiceRollGame';
import RockPaperScissorsGame from './components/games/RockPaperScissorsGame';
import CardDrawGame from './components/games/CardDrawGame';
import FindTheBoxGame from './components/games/FindTheBoxGame';
import LuckyWheelGame from './components/games/LuckyWheelGame';
import TreasureHuntGame from './components/games/TreasureHuntGame';
import NumberGuessGame from './components/games/NumberGuessGame';
import DominoGame from './components/games/DominoGame';
import GreedyGame from './components/games/GreedyGame';
import CrashGame from './components/games/CrashGame';
import ChickenRoadGame from './components/games/ChickenRoadGame';
import WrestlingGame from './components/games/WrestlingGame';
import TheMazeGame from './components/games/TheMazeGame';

// Club Games
import QuickSyndicateGame from './components/games/QuickSyndicateGame';
import ColorWarGame from './components/games/ColorWarGame';
import TimeBombGame from './components/games/TimeBombGame';
import CamelRaceGame from './components/games/CamelRaceGame';
import UniqueBidGame from './components/games/UniqueBidGame';
import SafeZoneGame from './components/games/SafeZoneGame';
import BankOfLuckGame from './components/games/BankOfLuckGame';
import MajorityRulesGame from './components/games/MajorityRulesGame';
import ZodiacArenaGame from './components/games/ZodiacArenaGame';
import ForestRunGame from './components/games/ForestRunGame';
import PearlDivingGame from './components/games/PearlDivingGame';
import CyberHackGame from './components/games/CyberHackGame';
import DesertCaravanGame from './components/games/DesertCaravanGame';
import CardsClubGame from './components/games/CardsClubGame';
import SpaceWarGame from './components/games/SpaceWarGame';
import PotionLabGame from './components/games/PotionLabGame';
import FishingNetGame from './components/games/FishingNetGame';
import ChefBattleGame from './components/games/ChefBattleGame';
import MonsterHuntGame from './components/games/MonsterHuntGame';

// Constants
import { GAME_CONFIG } from './constants/games';

// Services
import { GameService, AdminService, NotificationService } from './services';

// Types and Interfaces
interface GameConfig {
  id: string;
  name: string;
  icon: string;
  category: 'single' | 'club';
  isActive?: boolean;
  minPlayers?: number;
}

interface ModalState {
  isWalletOpen: boolean;
  isAgentsOpen: boolean;
  isManagementOpen: boolean;
  isMailboxOpen: boolean;
  isHistoryOpen: boolean;
  isAvatarModalOpen: boolean;
}

type ModalName = 'wallet' | 'agents' | 'management' | 'mailbox' | 'history' | 'avatar';

interface AppState {
  activeGame: GameId | null;
  activeClubGame: string | null;
  view: 'dashboard' | 'arena' | 'single' | 'club' | 'single_list' | 'all_games';
  loading: {
    game: boolean;
    navigation: boolean;
    targetGame?: string;
  };
}

interface AdminActionResult {
  success: boolean;
  message?: string;
}

interface ActivePlayer {
  id: string;
  email: string;
  lastActive: number;
}

interface AppProps {
  user: AppUser;
}

// Game Components Map
const GAME_COMPONENTS: Record<string, React.ComponentType<any>> = {
  // Single Player Games
  coinFlip: CoinFlipGame,
  highLow: HighLowGame,
  slotMachine: SlotMachineGame,
  guessColor: GuessColorGame,
  diceRoll: DiceRollGame,
  rockPaperScissors: RockPaperScissorsGame,
  cardDraw: CardDrawGame,
  findTheBox: FindTheBoxGame,
  luckyWheel: LuckyWheelGame,
  treasureHunt: TreasureHuntGame,
  numberGuess: NumberGuessGame,
  domino: DominoGame,
  greedyGame: GreedyGame,
  crashGame: CrashGame,
  chickenRoad: ChickenRoadGame,
  wrestling: WrestlingGame,
  theMaze: TheMazeGame,
  
  // Club Games
  quickSyndicate: QuickSyndicateGame,
  colorWar: ColorWarGame,
  timeBomb: TimeBombGame,
  camelRace: CamelRaceGame,
  uniqueBid: UniqueBidGame,
  safeZone: SafeZoneGame,
  bankOfLuck: BankOfLuckGame,
  majorityRules: MajorityRulesGame,
  zodiacArena: ZodiacArenaGame,
  forestRun: ForestRunGame,
  pearlDiving: PearlDivingGame,
  cyberHack: CyberHackGame,
  desertCaravan: DesertCaravanGame,
  cardsClub: CardsClubGame,
  spaceWar: SpaceWarGame,
  potionLab: PotionLabGame,
  fishingNet: FishingNetGame,
  chefBattle: ChefBattleGame,
  monsterHunt: MonsterHuntGame,
};

// Game Instructions Map - Updated for Multiplayer
const GAME_INSTRUCTIONS: Record<string, React.ReactNode> = {
    coinFlip: (
        <>
            <p>1. لعبة جماعية مباشرة! تبدأ جولة جديدة كل 15 ثانية.</p>
            <p>2. اختر جانب العملة (ملك أو كتابة) وضع رهانك.</p>
            <p>3. عند انتهاء وقت الرهان، يتم رمي العملة تلقائياً.</p>
            <p>4. إذا تطابق اختيارك مع النتيجة، تربح ضعف رهانك (x2).</p>
        </>
    ),
    theMaze: (
        <>
            <p>1. لعبة جماعية! اختر واحداً من 10 أبواب.</p>
            <p>2. الأنابيب ملتوية وتتغير كل جولة.</p>
            <p>3. في الجهة الأخرى، 10 مخارج بمضاعفات مختلفة.</p>
            <p>4. معظم المخارج X0 (خسارة)، لكن يوجد مضاعفات تصل لـ X100.</p>
        </>
    ),
    crashGame: (
        <>
            <p>1. لعبة جماعية مباشرة! تبدأ كل 10 ثواني.</p>
            <p>2. ضع رهانك قبل أن ينطلق الصاروخ.</p>
            <p>3. راقب المضاعف يزداد. اضغط "سحب" قبل أن ينفجر الصاروخ.</p>
            <p>4. إذا انفجر الصاروخ قبل السحب، تخسر رهانك.</p>
        </>
    ),
    luckyWheel: (
        <>
            <p>1. لعبة جماعية تدور كل 20 ثانية.</p>
            <p>2. راهن على أن العجلة ستقف على مضاعف معين.</p>
            <p>3. الجميع يرى نفس النتيجة.</p>
            <p>4. الجوائز تصل إلى x50!</p>
        </>
    ),
    guessColor: (
        <>
            <p>1. لعبة جماعية مباشرة. اختر لوناً (أحمر، أخضر، أزرق، أصفر).</p>
            <p>2. يتم اختيار لون فائز واحد لكل اللاعبين.</p>
            <p>3. الربح 4 أضعاف الرهان (x4).</p>
        </>
    ),
    diceRoll: (
        <>
            <p>1. راهن على الرقم الذي سيظهر على النرد (1-6).</p>
            <p>2. يتم رمي نرد واحد لجميع اللاعبين.</p>
            <p>3. التخمين الصحيح يربح 5 أضعاف الرهان (x5).</p>
        </>
    ),
    cardDraw: (
        <>
            <p>1. راهن على لون الكرت (x2) أو الشكل (x4).</p>
            <p>2. يتم سحب ورقة واحدة لكل اللاعبين.</p>
            <p>3. اربح إذا تطابق توقعك مع الورقة المسحوبة.</p>
        </>
    ),
    numberGuess: (
        <>
            <p>1. اختر رقماً من 1 إلى 10.</p>
            <p>2. يتم اختيار رقم فائز عشوائياً كل جولة.</p>
            <p>3. الفوز يعطيك 9 أضعاف الرهان (x9).</p>
        </>
    ),
    greedyGame: (
        <>
            <p>1. اختر عنصراً أو أكثر (خضروات أو لحوم).</p>
            <p>2. الخضروات (x5)، اللحوم (x10, x15, x25, x45).</p>
            <p>3. انتظر دوران المؤشر ليرى الجميع النتيجة.</p>
            <p>4. إذا توقف المؤشر على اختيارك، تربح المضاعف الخاص به!</p>
        </>
    ),
    timeBomb: (
        <>
            <p>1. انضم للغرفة قبل الانفجار.</p>
            <p>2. عندما ينتهي الوقت، يتم تفجير القنبلة.</p>
            <p>3. ينجو 30% فقط من اللاعبين عشوائياً.</p>
            <p>4. يتقاسم الناجون مجموع الجوائز.</p>
        </>
    ),
    cardsClub: (
        <>
            <p>1. اشترك في الجولة بسحب ورقة عشوائية (500 💎).</p>
            <p>2. عند انتهاء الوقت، يسحب النظام "ورقة رابحة".</p>
            <p>3. إذا كان رقم ورقتك يطابق رقم الورقة الرابحة، تفوز!</p>
            <p>4. يتم توزيع الجائزة بالتساوي على جميع الفائزين.</p>
        </>
    ),
    default: (
        <p>اتبع التعليمات الموجودة داخل اللعبة. حظاً موفقاً!</p>
    )
};


// Reducers
const modalReducer = (state: ModalState, action: { type: string; payload?: boolean }): ModalState => {
  switch (action.type) {
    case 'OPEN_WALLET':
      return { ...state, isWalletOpen: true };
    case 'CLOSE_WALLET':
      return { ...state, isWalletOpen: false };
    case 'OPEN_AGENTS':
      return { ...state, isAgentsOpen: true };
    case 'CLOSE_AGENTS':
      return { ...state, isAgentsOpen: false };
    case 'OPEN_MANAGEMENT':
      return { ...state, isManagementOpen: true };
    case 'CLOSE_MANAGEMENT':
      return { ...state, isManagementOpen: false };
    case 'OPEN_MAILBOX':
      return { ...state, isMailboxOpen: true };
    case 'CLOSE_MAILBOX':
      return { ...state, isMailboxOpen: false };
    case 'OPEN_AVATAR':
      return { ...state, isAvatarModalOpen: true };
    case 'CLOSE_AVATAR':
      return { ...state, isAvatarModalOpen: false };
    case 'CLOSE_ALL':
      return {
        isWalletOpen: false,
        isAgentsOpen: false,
        isManagementOpen: false,
        isMailboxOpen: false,
        isHistoryOpen: false,
        isAvatarModalOpen: false,
      };
    default:
      return state;
  }
};

const appReducer = (state: AppState, action: any): AppState => {
  switch (action.type) {
    case 'SET_VIEW':
      return {
        ...state,
        view: action.payload,
        activeGame: null,
        activeClubGame: null,
      };
    case 'SET_ACTIVE_GAME':
      return {
        ...state,
        activeGame: action.payload,
        view: 'single',
      };
    case 'SET_ACTIVE_CLUB_GAME':
      return {
        ...state,
        activeClubGame: action.payload,
        view: 'club',
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, ...action.payload },
      };
    case 'NAVIGATE_BACK':
      if (state.view === 'single' && state.activeGame) {
        return { ...state, activeGame: null, view: 'all_games' };
      }
      if (state.view === 'club' && state.activeClubGame) {
        return { ...state, activeClubGame: null, view: 'all_games' };
      }
      if (state.view === 'single_list' || state.view === 'arena' || state.view === 'all_games') {
        return { ...state, view: 'dashboard' };
      }
      return { ...state, view: 'dashboard' };
    default:
      return state;
  }
};

// Custom Hooks
const useUserData = (userId: string, userEmail: string) => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    
    // Heartbeat function to keep user "online" in database
    const updatePresence = async () => {
        try {
            // Update lastActive timestamp to now
            await updateDoc(userRef, { 
                lastActive: serverTimestamp(),
                // Ensure email is always up to date for admin view
                email: userEmail 
            });
        } catch (err) {
            console.warn("Presence update failed (offline or permission)", err);
        }
    };

    // 1. Run immediately on mount
    updatePresence();
    
    // 2. Run every 2 minutes (120000 ms) to maintain online status
    const presenceInterval = setInterval(updatePresence, 2 * 60 * 1000);

    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        const data = convertTimestamps(rawData);
        
        setUserProfile({ ...data, uid: userId, email: userEmail, playerID: data.playerID });
        setBalance(data.balance || 0);
        setIsAdmin(data.isAdmin || false);
      }
      setLoading(false);
    }, (error) => {
        console.error("User snapshot error:", error);
        setLoading(false);
    });

    return () => {
        clearInterval(presenceInterval);
        unsubUser();
    };
  }, [userId, userEmail]);

  return { userProfile, balance, isAdmin, loading, setUserProfile, setBalance, setIsAdmin };
};

const useMailbox = (userId: string) => {
  const [mailboxMessages, setMailboxMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const mailboxRef = collection(db, 'users', userId, 'mailbox');
    const q = query(mailboxRef, orderBy('timestamp', 'desc'));
    
    const unsubMailbox = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
      setMailboxMessages(msgs);
      setUnreadCount(msgs.filter((m: any) => !m.isRead).length);
    }, (error) => {
        console.error("Mailbox error", error);
    });

    return unsubMailbox;
  }, [userId]);

  return { mailboxMessages, unreadCount, setMailboxMessages };
};

const usePublicData = () => {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [imageBanner, setImageBanner] = useState<any>(null);
  const [highValueWin, setHighValueWin] = useState<HighValueWin | null>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  useEffect(() => {
    const announcementRef = doc(db, 'public', 'announcement');
    const unsubAnnounce = onSnapshot(announcementRef, (snap) => {
      if (snap.exists()) setAnnouncement(convertTimestamps(snap.data()));
    });

    const bannerRef = doc(db, 'public', 'imageBanner');
    const unsubBanner = onSnapshot(bannerRef, (snap) => {
      if (snap.exists()) setImageBanner(convertTimestamps(snap.data()));
    });
    
    const winnerRef = doc(db, 'public', 'lastWinner');
    const unsubWinner = onSnapshot(winnerRef, (snap) => {
      if (snap.exists()) {
        const data = convertTimestamps(snap.data());
        if (Date.now() - data.timestamp < 15000) {
          setHighValueWin(data as HighValueWin);
        }
      }
    });

    const maintenanceRef = doc(db, 'public', 'maintenance');
    const unsubMaintenance = onSnapshot(maintenanceRef, (snap) => {
        if (snap.exists()) {
            setIsMaintenanceMode(snap.data().isActive === true);
        }
    });

    return () => {
      unsubAnnounce();
      unsubBanner();
      unsubWinner();
      unsubMaintenance();
    };
  }, []);

  return { announcement, imageBanner, highValueWin, isMaintenanceMode, setAnnouncement, setHighValueWin };
};

// UPDATED: Admin hook using real-time listeners (onSnapshot)
const useAdminData = (isAdmin: boolean) => {
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [profitLog, setProfitLog] = useState<ProfitLogEntry[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    if (!isAdmin) return;

    // 1. Real-time Treasury
    const unsubTreasury = onSnapshot(doc(db, 'public', 'treasury'), (doc) => {
        if (doc.exists()) setTreasuryBalance(doc.data().balance);
    });

    // 2. Real-time Requests (Pending only)
    const requestsQuery = query(
      collection(db, 'transactions'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    const unsubRequests = onSnapshot(requestsQuery, (snap) => {
        const reqs = snap.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as TransactionRequest));
        setRequests(reqs);
    });

    // 3. Real-time Profit Log (Today)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startOfDayTimestamp = Timestamp.fromDate(now);
    const profitQuery = query(
      collection(db, 'profitLog'),
      where('timestamp', '>=', startOfDayTimestamp),
      orderBy('timestamp', 'desc')
    );
    const unsubProfit = onSnapshot(profitQuery, (snap) => {
        const logs = snap.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as ProfitLogEntry));
        setProfitLog(logs);
    });

    // 4. Notifications
    const notifQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', 'ADMIN'),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    const unsubNotif = onSnapshot(notifQuery, (snap) => {
        const notifs = snap.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as SystemNotification));
        setSystemNotifications(notifs);
    });

    // 5. Active Players Interval (Keep interval to reduce reads, but refresh often)
    const fetchActivePlayers = async () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeQuery = query(
            collection(db, 'users'),
            where('lastActive', '>=', fiveMinutesAgo),
            orderBy('lastActive', 'desc'),
            limit(50)
        );
        const activeSnap = await getDocs(activeQuery);
        const players = activeSnap.docs.map(doc => {
            const rawData = convertTimestamps(doc.data());
            return {
                id: doc.id,
                email: rawData.email || 'Unknown',
                lastActive: rawData.lastActive || Date.now()
            } as ActivePlayer;
        });
        setActivePlayers(players);
        
        // Total users count (less frequent)
        const coll = collection(db, 'users');
        const snapshot = await getCountFromServer(coll);
        setTotalUsers(snapshot.data().count);
    };

    fetchActivePlayers(); // Initial fetch
    const activeInterval = setInterval(fetchActivePlayers, 30000); // Refresh active players every 30s

    return () => {
        unsubTreasury();
        unsubRequests();
        unsubProfit();
        unsubNotif();
        clearInterval(activeInterval);
    };
  }, [isAdmin]);

  return { 
      treasuryBalance, 
      requests, 
      profitLog, 
      systemNotifications, 
      activePlayers, 
      totalUsers, 
      setRequests
  };
};

// --- ENGINES: Multiplayer Game Logic Loops (Client-Side Simulation) ---
// This hook runs all multiplayer game loops if needed.
const useMultiplayerEngines = () => {
    useEffect(() => {
        const engines = [
            { 
                id: 'coinFlip', 
                interval: 1000, 
                logic: async (data: any, ref: any) => {
                    // Simple betting loop
                    if (data.status === 'betting') {
                        await runTransaction(db, async (t) => {
                            t.update(ref, { status: 'flipping', endTime: Date.now() + 5000, result: Math.random() < 0.5 ? 'king' : 'writing' });
                        });
                    } else if (data.status === 'flipping') {
                        await runTransaction(db, async (t) => {
                            const winningSide = data.result;
                            const bets = data.bets || {};
                            const winners = [];
                            for (const [uid, bet] of Object.entries(bets as Record<string, CoinFlipBet>)) {
                                if (bet.choice === winningSide) {
                                    t.update(doc(db, 'users', uid), { balance: increment(bet.amount * 2) });
                                    winners.push({ nickname: bet.nickname, amount: bet.amount * 2 });
                                }
                            }
                            t.update(ref, { status: 'result', endTime: Date.now() + 5000, lastRoundWinners: winners });
                        });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 15000, result: null, bets: {}, lastRoundWinners: [] });
                    }
                }
            },
            {
                id: 'theMaze',
                interval: 1000,
                logic: async (data: TheMazeGameState, ref: any) => {
                    // Betting Phase -> Running (Generate Outcomes) -> Result (Payout)
                    if (data.status === 'betting') {
                        // Transition to Running
                        // Generate Mapping and Outcomes
                        const newOutcomes = Array(10).fill(0);
                        // Logic: 1x Big, 2x Medium, 7x Zero
                        const jackpotChance = Math.random() < 0.01; // 1% for 100x
                        const bigMulti = jackpotChance ? 100 : 10;
                        const mediumMulti = Math.random() > 0.5 ? 5 : 2;
                        
                        // Place winners randomly
                        const indices = [0,1,2,3,4,5,6,7,8,9].sort(() => 0.5 - Math.random());
                        newOutcomes[indices[0]] = bigMulti;
                        newOutcomes[indices[1]] = mediumMulti;
                        newOutcomes[indices[2]] = 1.5; // Small win
                        
                        // Shuffle connections: Input i maps to Output map[i]
                        const newMap = [0,1,2,3,4,5,6,7,8,9].sort(() => 0.5 - Math.random());

                        await updateDoc(ref, { 
                            status: 'running', 
                            endTime: Date.now() + 5000, // 5s animation
                            pathMap: newMap,
                            outcomeValues: newOutcomes
                        });

                    } else if (data.status === 'running') {
                        // Transition to Result & Calculate Payouts
                        await runTransaction(db, async (t) => {
                            const sfDoc = await t.get(ref);
                            const current = sfDoc.data() as TheMazeGameState;
                            if (current.status !== 'running') return;

                            const bets = current.bets || {};
                            const winners = [];
                            const pathMap = current.pathMap;
                            const outcomes = current.outcomeValues;

                            for (const [uid, bet] of Object.entries(bets)) {
                                const doorIdx = bet.doorIndex;
                                const outputIdx = pathMap[doorIdx];
                                const multiplier = outcomes[outputIdx];

                                if (multiplier > 0) {
                                    const winAmount = Math.floor(bet.amount * multiplier);
                                    t.update(doc(db, 'users', uid), { balance: increment(winAmount) });
                                    winners.push({ nickname: bet.nickname, amount: winAmount });
                                }
                            }

                            t.update(ref, { 
                                status: 'result', 
                                endTime: Date.now() + 5000, // 5s show result
                                lastRoundWinners: winners
                            });
                        });

                    } else if (data.status === 'result') {
                        // Transition back to Betting
                        await updateDoc(ref, { 
                            status: 'betting', 
                            roundId: increment(1), 
                            endTime: Date.now() + 15000, // 15s Betting
                            bets: {}, 
                            lastRoundWinners: [],
                            pathMap: [],
                            outcomeValues: []
                        });
                    } else if (!data.status) {
                        // Init
                        await setDoc(ref, { 
                            status: 'betting', 
                            roundId: 1, 
                            endTime: Date.now() + 15000, 
                            bets: {}, 
                            pathMap: [], 
                            outcomeValues: [] 
                        });
                    }
                }
            },
            {
                id: 'timeBomb',
                interval: 1000,
                logic: async (data: TimeBombState, ref: any) => {
                    const GAME_DURATION_MS = 10000;
                    const COOLDOWN_MS = 10000;
                    const ENTRY_FEE = 100;

                    if (data.status === 'active' && Date.now() >= data.explosionTime) {
                        // EXPLODE Logic (Server-side simulation)
                        await runTransaction(db, async (t) => {
                            const sfDoc = await t.get(ref);
                            if (!sfDoc.exists()) return;
                            const current = convertTimestamps(sfDoc.data()) as TimeBombState;
                            
                            // Ensure we are still active and time is up to prevent double execution
                            if (current.status !== 'active') return;

                            const participants = current.participants || [];
                            let updatedParticipants = [];
                            let survivorNicknames = [];
                            let houseFee = 0;

                            if (participants.length > 0) {
                                if (participants.length === 1) {
                                    // Solo player loses
                                    updatedParticipants = participants.map(p => ({ ...p, status: 'dead' }));
                                    
                                    // House takes all
                                    const treasuryRef = doc(db, 'public', 'treasury');
                                    const treasuryDoc = await t.get(treasuryRef);
                                    const currentTreasury = treasuryDoc.exists() ? treasuryDoc.data().balance || 0 : 0;
                                    t.set(treasuryRef, { balance: currentTreasury + ENTRY_FEE }, { merge: true });
                                } else {
                                    // Multiplayer logic
                                    const survivorsCount = Math.max(1, Math.ceil(participants.length * 0.3));
                                    const totalPot = participants.length * ENTRY_FEE;
                                    houseFee = totalPot * 0.30;
                                    const prizePool = totalPot - houseFee;
                                    const winAmountPerPerson = Math.floor(prizePool / survivorsCount);

                                    // Determine survivors
                                    const shuffled = [...participants].sort(() => 0.5 - Math.random());
                                    const survivors = shuffled.slice(0, survivorsCount);
                                    survivorNicknames = survivors.map(s => s.nickname);

                                    updatedParticipants = participants.map(p => {
                                        const isSurvivor = survivors.some(s => s.userId === p.userId);
                                        return { ...p, status: isSurvivor ? 'winner' : 'dead' };
                                    });

                                    // Update Treasury
                                    const treasuryRef = doc(db, 'public', 'treasury');
                                    const treasuryDoc = await t.get(treasuryRef);
                                    const currentTreasury = treasuryDoc.exists() ? treasuryDoc.data().balance || 0 : 0;
                                    t.set(treasuryRef, { balance: currentTreasury + houseFee }, { merge: true });

                                    // Pay Winners
                                    for (const s of survivors) {
                                        const uRef = doc(db, 'users', s.userId);
                                        const uDoc = await t.get(uRef);
                                        if (uDoc.exists()) {
                                            const newBal = (uDoc.data().balance || 0) + winAmountPerPerson;
                                            t.update(uRef, { balance: newBal });
                                        }
                                    }
                                    
                                    // Log Profit
                                    const logRef = doc(collection(db, 'profitLog'));
                                    const newLogRef = doc(logRef.parent); // Generate ID for set
                                    t.set(newLogRef, {
                                        amount: houseFee,
                                        percentage: 0.30,
                                        gameId: 'timeBomb',
                                        userId: 'SYSTEM',
                                        userEmail: 'TimeBomb Engine',
                                        originalBet: totalPot,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            } else {
                                updatedParticipants = [];
                            }

                            t.update(ref, {
                                status: 'exploded',
                                participants: updatedParticipants,
                                lastWinners: survivorNicknames
                            });
                        });
                    } else if (data.status === 'exploded') {
                        // Check cooldown to restart
                        if (Date.now() >= data.explosionTime + COOLDOWN_MS) {
                            await updateDoc(ref, {
                                status: 'active',
                                participants: [],
                                startTime: Date.now(),
                                explosionTime: Date.now() + GAME_DURATION_MS,
                                roundId: Date.now().toString()
                            });
                        }
                    } else if (!data.status) {
                        // Init if broken
                        await setDoc(ref, {
                            status: 'active',
                            participants: [],
                            startTime: Date.now(),
                            explosionTime: Date.now() + GAME_DURATION_MS,
                            roundId: Date.now().toString(),
                            entryFee: ENTRY_FEE,
                            lastWinners: []
                        });
                    }
                }
            },
            {
                id: 'cardsClub',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
                    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
                    const GAME_DURATION = 20000; // 20s betting
                    const REVEAL_DURATION = 5000; // 5s reveal
                    const COOLDOWN = 5000; // 5s result

                    if (data.status === 'open' && Date.now() >= data.endTime) {
                         // Switch to revealing
                         const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
                         const randomRank = RANKS[Math.floor(Math.random() * RANKS.length)];
                         const winningCard = { suit: randomSuit, rank: randomRank, value: 0 }; // Value doesn't matter for matching

                         await updateDoc(ref, {
                             status: 'revealing',
                             winningCard: winningCard,
                             endTime: Date.now() + REVEAL_DURATION
                         });
                    } else if (data.status === 'revealing' && Date.now() >= data.endTime) {
                         // Calculate results
                         await runTransaction(db, async (t) => {
                             const docSnap = await t.get(ref);
                             const current = convertTimestamps(docSnap.data());
                             if(current.status !== 'revealing') return;

                             const participants = current.participants || [];
                             const winningCard = current.winningCard;
                             const entryFee = current.entryFee || 500;

                             // Logic: Winner if Rank matches
                             const winners = participants.filter((p: any) => p.card.rank === winningCard.rank);
                             
                             const totalPot = participants.length * entryFee;
                             const houseFee = Math.floor(totalPot * 0.15); // 15% fee
                             const prizePool = totalPot - houseFee;

                             // Treasury
                             const treasuryRef = doc(db, 'public', 'treasury');
                             t.update(treasuryRef, { balance: increment(houseFee) });

                             // Pay Winners
                             if (winners.length > 0) {
                                 const winPerPerson = Math.floor(prizePool / winners.length);
                                 winners.forEach((w: any) => {
                                     const uRef = doc(db, 'users', w.userId);
                                     t.update(uRef, { balance: increment(winPerPerson) });
                                 });
                             } else {
                                 // No winners, house takes all (or pot carries over? stick to house takes for simplicity/high stakes)
                                 t.update(treasuryRef, { balance: increment(prizePool) });
                             }

                             // Log Profit
                             const logRef = doc(collection(db, 'profitLog'));
                             const newLog = doc(logRef.parent);
                             t.set(newLog, {
                                 amount: houseFee + (winners.length === 0 ? prizePool : 0),
                                 percentage: 0.15,
                                 gameId: 'cardsClub',
                                 userId: 'SYSTEM',
                                 userEmail: 'Cards Engine',
                                 originalBet: totalPot,
                                 timestamp: serverTimestamp()
                             });

                             t.update(ref, {
                                 status: 'completed',
                                 endTime: Date.now() + COOLDOWN,
                                 lastWinners: winners.map((w: any) => w.nickname)
                             });
                         });
                    } else if (data.status === 'completed' && Date.now() >= data.endTime) {
                         // Reset
                         await updateDoc(ref, {
                             status: 'open',
                             participants: [],
                             winningCard: null,
                             endTime: Date.now() + GAME_DURATION,
                             lastWinners: [] // or keep previous? usually clear or move to history
                         });
                    } else if (!data.status) {
                         // Init
                         await setDoc(ref, {
                             status: 'open',
                             participants: [],
                             winningCard: null,
                             endTime: Date.now() + GAME_DURATION,
                             entryFee: 500,
                             lastWinners: [],
                             roundId: Date.now().toString()
                         });
                    }
                }
            },
            {
                id: 'crashGame',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    // Force 10s Waiting
                    if (data.status === 'waiting') {
                        // Initialize or check if waiting period is over
                        if (!data.endTime || Date.now() >= data.endTime) {
                             // Transition to Flying
                             const crashPoint = Math.max(1.00, Math.floor((0.99 / (1 - Math.random())) * 100) / 100);
                             await updateDoc(ref, { 
                                 status: 'flying', 
                                 startTime: Date.now(), 
                                 crashPoint, 
                                 endTime: Date.now() + 120000 // Fail-safe max flight time
                             });
                        }
                    } else if (data.status === 'flying') {
                        // Check if crashed based on time elapsed
                        const elapsed = Date.now() - data.startTime;
                        const currentM = Math.max(1, Math.exp(0.00006 * elapsed));
                        
                        const FORCE_CRASH_LIMIT = 60.00;
                        const naturalCrash = currentM >= data.crashPoint;
                        const forcedCrash = currentM >= FORCE_CRASH_LIMIT;

                        if (naturalCrash || forcedCrash) {
                            await updateDoc(ref, { 
                                status: 'crashed', 
                                endTime: Date.now() + 3000, 
                                history: [Number(currentM.toFixed(2)), ...(data.history || []).slice(0, 9)],
                                crashPoint: Number(currentM.toFixed(2)) // Ensure recorded crash point matches reality
                            });
                        }
                    } else if (data.status === 'crashed') {
                        // After cooldown, go back to waiting (10s)
                        if (Date.now() >= data.endTime) {
                            await updateDoc(ref, { 
                                status: 'waiting', 
                                roundId: increment(1), 
                                endTime: Date.now() + 10000, // 10 Seconds Waiting
                                bets: {} 
                            });
                        }
                    } else {
                        // Fallback/Init
                        await updateDoc(ref, { status: 'waiting', endTime: Date.now() + 10000 });
                    }
                }
            },
            // Greedy Game (Multiplayer Engine)
            {
                id: 'greedyGame',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        // Probability Logic:
                        // Veggies (x5): 80% chance
                        // Low Meats (x10, x15): ~19.8%
                        // High Meats (x25, x45): ~0.2% (Rare)
                        
                        const veggies = ['tomato', 'cucumber', 'carrot', 'corn'];
                        const lowMeat = ['chicken', 'bacon'];
                        const highMeat = ['beef', 'fish']; // x25, x45
                        
                        let winnerId = '';
                        const r = Math.random();
                        
                        if (r < 0.002) { // 0.2% chance for Ultra Rare
                             winnerId = highMeat[Math.floor(Math.random() * highMeat.length)];
                        } else if (r < 0.20) { // ~20% chance for Meat
                             winnerId = lowMeat[Math.floor(Math.random() * lowMeat.length)];
                        } else { // 80% chance for Veggies
                             winnerId = veggies[Math.floor(Math.random() * veggies.length)];
                        }
                        
                        await updateDoc(ref, { 
                            status: 'spinning', 
                            winningItemId: winnerId,
                            endTime: Date.now() + 5000 // Spin time
                        });
                    } else if (data.status === 'spinning') {
                        // Calculate Payouts and switch to result
                        await runTransaction(db, async (t) => {
                            const multipliers: Record<string, number> = {
                                'tomato': 5,    
                                'chicken': 10,  
                                'cucumber': 5,  
                                'bacon': 15,    
                                'carrot': 5,    
                                'beef': 25,     
                                'corn': 5,      
                                'fish': 45      
                            };
                            
                            const bets = data.bets || {};
                            const winners = [];
                            const winnerId = data.winningItemId;
                            const multiplier = multipliers[winnerId] || 0;
                            
                            for (const [uid, betData] of Object.entries(bets as Record<string, any>)) {
                                // betData.bets is map: { itemId: amount }
                                if (betData.bets && typeof betData.bets === 'object' && betData.bets[winnerId]) {
                                    const betAmount = Number(betData.bets[winnerId]);
                                    if (!isNaN(betAmount) && betAmount > 0) {
                                        const win = betAmount * multiplier;
                                        t.update(doc(db, 'users', uid), { balance: increment(win) });
                                        winners.push({ nickname: betData.nickname, amount: win });
                                    }
                                }
                            }
                            
                            // Update History (Keep last 10)
                            const oldHistory = data.history || [];
                            const newHistory = [winnerId, ...oldHistory].slice(0, 10);

                            t.update(ref, { 
                                status: 'result', 
                                endTime: Date.now() + 5000, 
                                lastRoundWinners: winners,
                                history: newHistory
                            });
                        });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { 
                            status: 'betting', 
                            roundId: increment(1), 
                            endTime: Date.now() + 20000, // Betting time (20s)
                            bets: {}, 
                            lastRoundWinners: [],
                            winningItemId: null
                        });
                    }
                }
            },
            // Lucky Wheel
            {
                id: 'luckyWheel',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        // Determine winner
                        const segments = ['x50', 'x0', 'x2', 'x0', 'free', 'x5', 'x0', 'x1.5', 'x0', 'x10'];
                        // Simplified random pick
                        const resultId = 'x' + [0, 2, 5, 10, 1.5, 50][Math.floor(Math.random() * 6)]; 
                        await updateDoc(ref, { status: 'spinning', endTime: Date.now() + 4000, resultSegment: resultId });
                    } else if (data.status === 'spinning') {
                        // Payout logic
                        const bets = data.bets || {};
                        const winners = [];
                        // Logic to calc winnings based on segment... simplified
                        await updateDoc(ref, { status: 'result', endTime: Date.now() + 5000, lastRoundWinners: winners });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 15000, bets: {} });
                    }
                }
            },
            // Dice Roll
            {
                id: 'diceRoll',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        const result = Math.floor(Math.random() * 6) + 1;
                        await updateDoc(ref, { status: 'rolling', endTime: Date.now() + 3000, result });
                    } else if (data.status === 'rolling') {
                        const bets = data.bets || {};
                        const winners = [];
                        for (const [uid, bet] of Object.entries(bets as Record<string, any>)) {
                            if (bet.choice === data.result) {
                                const win = bet.amount * 5;
                                await updateDoc(doc(db, 'users', uid), { balance: increment(win) });
                                winners.push({ nickname: bet.nickname, amount: win });
                            }
                        }
                        await updateDoc(ref, { status: 'result', endTime: Date.now() + 4000, lastRoundWinners: winners });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 10000, bets: {} });
                    }
                }
            },
            // Guess Color
            {
                id: 'guessColor',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        const colors = ['red', 'green', 'blue', 'yellow'];
                        const result = colors[Math.floor(Math.random() * 4)];
                        await updateDoc(ref, { status: 'revealing', endTime: Date.now() + 3000, result });
                    } else if (data.status === 'revealing') {
                        const bets = data.bets || {};
                        const winners = [];
                        for (const [uid, bet] of Object.entries(bets as Record<string, any>)) {
                            if (bet.choice === data.result) {
                                const win = bet.amount * 4;
                                await updateDoc(doc(db, 'users', uid), { balance: increment(win) });
                                winners.push({ nickname: bet.nickname, amount: win });
                            }
                        }
                        await updateDoc(ref, { status: 'result', endTime: Date.now() + 4000, lastRoundWinners: winners });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 10000, bets: {} });
                    }
                }
            },
            // Card Draw
            {
                id: 'cardDraw',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        const suits = ['♥', '♦', '♣', '♠'];
                        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
                        const suit = suits[Math.floor(Math.random() * 4)];
                        const value = values[Math.floor(Math.random() * 13)];
                        await updateDoc(ref, { status: 'drawing', endTime: Date.now() + 3000, result: { suit, value } });
                    } else if (data.status === 'drawing') {
                        // Simplified Payout
                        await updateDoc(ref, { status: 'result', endTime: Date.now() + 4000, lastRoundWinners: [] });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 10000, bets: {} });
                    }
                }
            },
            // Number Guess
            {
                id: 'numberGuess',
                interval: 1000,
                logic: async (data: any, ref: any) => {
                    if (data.status === 'betting') {
                        const result = Math.floor(Math.random() * 10) + 1;
                        await updateDoc(ref, { status: 'revealing', endTime: Date.now() + 3000, result });
                    } else if (data.status === 'revealing') {
                        const bets = data.bets || {};
                        const winners = [];
                        for (const [uid, betData] of Object.entries(bets as Record<string, any>)) {
                            // betData.bets is map of number -> amount
                            if (betData.bets && betData.bets[data.result]) {
                                const win = betData.bets[data.result] * 9;
                                await updateDoc(doc(db, 'users', uid), { balance: increment(win) });
                                winners.push({ nickname: betData.nickname, amount: win });
                            }
                        }
                        await updateDoc(ref, { status: 'result', endTime: Date.now() + 4000, lastRoundWinners: winners });
                    } else if (data.status === 'result') {
                        await updateDoc(ref, { status: 'betting', roundId: increment(1), endTime: Date.now() + 10000, bets: {} });
                    }
                }
            }
        ];

        const unsubscribes = engines.map(engine => {
            const ref = doc(db, 'public', engine.id);
            let localState: any = null;
            let processing = false;

            // Initial Create if missing
            getDoc(ref).then(s => {
                if (!s.exists()) {
                    if (engine.id === 'timeBomb') {
                        setDoc(ref, {
                            status: 'active',
                            participants: [],
                            startTime: Date.now(),
                            explosionTime: Date.now() + 10000,
                            roundId: Date.now().toString(),
                            entryFee: 100,
                            lastWinners: []
                        });
                    } else {
                        setDoc(ref, { status: 'betting', roundId: 1, endTime: Date.now() + 10000, bets: {} });
                    }
                }
            });

            const sub = onSnapshot(ref, (snap) => {
                if (snap.exists()) {
                    localState = convertTimestamps(snap.data());
                    // Avoid contention if client clock is ahead
                    if (localState.endTime > Date.now()) processing = false;
                }
            });

            const int = setInterval(async () => {
                if (!localState || processing) return;
                
                // Special logic for continuous monitoring engines like crash/timeBomb
                if (engine.id === 'crashGame' || engine.id === 'timeBomb') {
                     processing = true;
                     await engine.logic(localState, ref);
                     processing = false;
                     return;
                }

                if (Date.now() >= localState.endTime) {
                    processing = true;
                    // Random delay to prevent race conditions among clients
                    setTimeout(async () => {
                        if (!localState || Date.now() < localState.endTime) { processing = false; return; }
                        try {
                            await engine.logic(localState, ref);
                        } catch (e) {
                            console.log("Engine contention", engine.id);
                            processing = false;
                        }
                    }, Math.random() * 2000);
                }
            }, engine.interval);

            return () => {
                sub();
                clearInterval(int);
            };
        });

        return () => {
            unsubscribes.forEach(u => u());
        };
    }, []);
};


// Dynamic Game Component with React.memo
const DynamicGame = React.memo<{
  gameId: string;
  userProfile: any;
  onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
  onAnnounceWin: (nickname: string, amount: number, gameName: string) => void;
}>(({ gameId, userProfile, onBalanceUpdate, onAnnounceWin }) => {
  const GameComponent = GAME_COMPONENTS[gameId];
  
  if (!GameComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h3 className="text-xl font-bold text-gray-300">اللعبة غير متوفرة</h3>
          <p className="text-gray-500">عذراً، هذه اللعبة غير متاحة حالياً</p>
        </div>
      </div>
    );
  }

  return (
    <GameComponent 
      userProfile={userProfile}
      onBalanceUpdate={onBalanceUpdate}
      onAnnounceWin={onAnnounceWin}
    />
  );
});

DynamicGame.displayName = 'DynamicGame';

// Main App Component
const App: React.FC<AppProps> = ({ user }) => {
  // State with useReducer for complex state
  const [modalState, dispatchModal] = useReducer(modalReducer, {
    isWalletOpen: false,
    isAgentsOpen: false,
    isManagementOpen: false,
    isMailboxOpen: false,
    isHistoryOpen: false,
    isAvatarModalOpen: false,
  });
  
  const [appState, dispatchApp] = useReducer(appReducer, {
    activeGame: null,
    activeClubGame: null,
    view: 'dashboard',
    loading: {
      game: false,
      navigation: false,
    },
  });

  const [adminView, setAdminView] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());

  // Custom Hooks
  const { userProfile, balance, isAdmin, loading, setBalance } = useUserData(user.uid, user.email || '');
  const { mailboxMessages, unreadCount } = useMailbox(user.uid);
  const { announcement, imageBanner, highValueWin, isMaintenanceMode, setAnnouncement, setHighValueWin } = usePublicData();
  const { 
      treasuryBalance, 
      requests, 
      profitLog, 
      systemNotifications: rawSystemNotifications, 
      activePlayers, 
      totalUsers,
      setRequests, 
  } = useAdminData(isAdmin);

  // *** ACTIVATE GAME ENGINES ***
  useMultiplayerEngines(); 
  // *****************************

  // Memoized values for performance
  const memoizedClubGames = useMemo(() => GAME_CONFIG.CLUB_GAMES, []);
  const memoizedSingleGames = useMemo(() => GAME_CONFIG.SINGLE_GAMES, []);
  
  const systemNotifications = useMemo(() => 
    rawSystemNotifications.filter(n => !locallyDismissedIds.has(n.id)), 
    [rawSystemNotifications, locallyDismissedIds]
  );

  // Handlers
  const handleBalanceUpdate = useCallback(async (amount: number, gameId: GameId): Promise<boolean> => {
    const cleanAmount = Math.round(amount * 100) / 100;

    if (cleanAmount < 0 && balance < Math.abs(cleanAmount)) {
      return false;
    }
    
    const success = await GameService.updateBalance(user.uid, cleanAmount);
    if (success) {
      setBalance(prev => prev + cleanAmount);
    }
    
    return success;
  }, [user.uid, balance, setBalance]);

  const handleGameNavigation = useCallback(async (gameId: GameId) => {
    dispatchApp({ type: 'SET_LOADING', payload: { navigation: true, targetGame: gameId } });
    await new Promise(resolve => setTimeout(resolve, 300));
    dispatchApp({ type: 'SET_ACTIVE_GAME', payload: gameId });
    dispatchApp({ type: 'SET_LOADING', payload: { navigation: false, targetGame: undefined } });
  }, []);

  const handleClubGameNavigation = useCallback(async (gameId: string) => {
    dispatchApp({ type: 'SET_LOADING', payload: { navigation: true, targetGame: gameId } });
    await new Promise(resolve => setTimeout(resolve, 300));
    dispatchApp({ type: 'SET_ACTIVE_CLUB_GAME', payload: gameId });
    dispatchApp({ type: 'SET_LOADING', payload: { navigation: false, targetGame: undefined } });
  }, []);

  const handleAnnounceWin = useCallback(async (nickname: string, amount: number, gameName: string) => {
    await GameService.announceWin(nickname, amount, gameName);
  }, []);

  const handleDisplayNameChange = useCallback(async (newName: string): Promise<boolean> => {
    if (!newName.trim()) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { 
      displayName: newName,
      lastNameChange: Date.now()
    });
    return true;
  }, [user.uid]);

  const handleAvatarChange = useCallback(async (url: string) => {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { photoURL: url });
  }, [user.uid]);

  const handleTransactionRequest = useCallback(async (type: 'deposit' | 'withdraw', amount: number): Promise<boolean> => {
    const reqRef = doc(collection(db, 'transactions'));
    await setDoc(reqRef, {
      userId: user.uid,
      userEmail: user.email,
      type,
      amount,
      status: 'pending',
      timestamp: serverTimestamp()
    });
    return true;
  }, [user.uid, user.email]);
  
  const handleMarkUserMessageRead = useCallback(async (messageId: string) => {
    try {
      const msgRef = doc(db, 'users', user.uid, 'mailbox', messageId);
      await updateDoc(msgRef, { isRead: true });
    } catch (e) {
      console.error("Error marking message read:", e);
    }
  }, [user.uid]);
  
  const handleMarkAllUserMessagesRead = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      mailboxMessages.forEach(msg => {
        if (!msg.isRead) {
          const msgRef = doc(db, 'users', user.uid, 'mailbox', msg.id);
          batch.update(msgRef, { isRead: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error marking all messages read:", e);
    }
  }, [user.uid, mailboxMessages]);

  // Admin Actions
  const handleProcessRequest = useCallback(async (req: TransactionRequest, action: 'approve' | 'reject'): Promise<void> => {
    if (processingRequestId) return;
    setProcessingRequestId(req.id);
    try {
      await AdminService.processTransactionRequest(req, action, user.uid);
      const reqRef = doc(db, 'transactions', req.id);
      await updateDoc(reqRef, { status: action });
      
      // Manually update state to remove processed request immediately from view
      setRequests(prev => prev.filter(r => r.id !== req.id));

      await NotificationService.sendUserNotification(
        req.userId,
        action === 'approve' ? '✅ تمت الموافقة على طلبك' : '❌ تم رفض طلبك',
        `طلب ${req.type === 'deposit' ? 'إيداع' : 'السحب'} بقيمة ${formatNumber(req.amount)} تم ${action === 'approve' ? 'الموافقة عليه' : 'رفضه'}.`,
        action === 'approve' ? 'success' : 'error'
      );
    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setProcessingRequestId(null);
    }
  }, [processingRequestId, user.uid, setRequests]);

  // New: Admin Recharge (Deposit) - Adds to user, Adds to Treasury (Sales logic)
  const handleAdminRecharge = useCallback(async (playerId: string, amount: number): Promise<AdminActionResult> => {
    try {
      if (!isAdmin) return { success: false, message: 'غير مصرح بالوصول' };
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('playerID', '==', playerId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return { success: false, message: 'المستخدم غير موجود' };
      const userDoc = querySnapshot.docs[0];
      
      // Transaction: Add to User, Add to Treasury (Asset/Sales increase)
      await updateDoc(userDoc.ref, { balance: increment(amount) });
      const treasuryRef = doc(db, 'public', 'treasury');
      await updateDoc(treasuryRef, { balance: increment(amount) });
      
      await NotificationService.sendUserNotification(
        userDoc.id,
        'شحن رصيد',
        `تم شحن حسابك بـ ${formatNumber(amount)} 💎 من قبل الإدارة.`,
        'success'
      );
      
      return { success: true, message: 'تم شحن الرصيد بنجاح' };
    } catch (e) {
      return { success: false, message: 'فشل في عملية الشحن' };
    }
  }, [isAdmin]);

  // New: Admin Deduct - Removes from user, Removes from Treasury
  const handleAdminDeduct = useCallback(async (playerId: string, amount: number): Promise<AdminActionResult> => {
    try {
      if (!isAdmin) return { success: false, message: 'غير مصرح بالوصول' };
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('playerID', '==', playerId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return { success: false, message: 'المستخدم غير موجود' };
      const userDoc = querySnapshot.docs[0];
      
      const currentBalance = userDoc.data().balance || 0;
      if (currentBalance < amount) return { success: false, message: 'رصيد المستخدم غير كافٍ للخصم' };

      // Transaction: Deduct from User, Deduct from Treasury
      await updateDoc(userDoc.ref, { balance: increment(-amount) });
      const treasuryRef = doc(db, 'public', 'treasury');
      await updateDoc(treasuryRef, { balance: increment(-amount) });
      
      await NotificationService.sendUserNotification(
        userDoc.id,
        'خصم رصيد',
        `تم خصم ${formatNumber(amount)} 💎 من حسابك من قبل الإدارة.`,
        'error'
      );
      
      return { success: true, message: 'تم خصم الرصيد بنجاح' };
    } catch (e) {
      return { success: false, message: 'فشل في عملية الخصم' };
    }
  }, [isAdmin]);

  // New: Ban User
  const handleBanUser = useCallback(async (userId: string, isBanned: boolean): Promise<boolean> => {
      try {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { isBanned: isBanned });
          return true;
      } catch (e) {
          console.error("Error banning user:", e);
          return false;
      }
  }, []);

  const handleTreasuryUpdate = useCallback(async (amount: number, type: 'deposit' | 'withdraw'): Promise<AdminActionResult> => {
    try {
      if (!isAdmin) return { success: false, message: 'غير مصرح بالوصول' };
      if (amount <= 0) return { success: false, message: 'المبلغ غير صالح' };
      
      const treasuryRef = doc(db, 'public', 'treasury');
      const adjustment = type === 'deposit' ? amount : -amount;
      
      await updateDoc(treasuryRef, { balance: increment(adjustment) });
      
      return { success: true, message: type === 'deposit' ? 'تم الإيداع في الخزينة' : 'تم السحب من الخزينة' };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'فشل تحديث الخزينة' };
    }
  }, [isAdmin]);

  const handleSendNotification = useCallback(async (userId: string, title: string, body: string, type: string): Promise<void> => {
    await NotificationService.sendUserNotification(userId, title, body, type);
  }, []);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (e: any) {
       setLocallyDismissedIds(prev => new Set(prev).add(notificationId));
    }
  }, []);

  const handleMarkAllSystemNotificationsAsRead = useCallback(async () => {
    if (!systemNotifications.length) return;
    const updates = systemNotifications
      .filter(n => !n.isRead)
      .map(note => 
        updateDoc(doc(db, 'notifications', note.id), { isRead: true }).catch(() => setLocallyDismissedIds(prev => new Set(prev).add(note.id)))
      );
    await Promise.all(updates);
  }, [systemNotifications]);

  // --- NEW ADMIN HANDLERS ---
  const handlePublishAnnouncement = useCallback(async (text: string) => {
      try {
          const ref = doc(db, 'public', 'announcement');
          await setDoc(ref, {
              text: text,
              timestamp: serverTimestamp()
          });
          return true;
      } catch (e) {
          console.error("Failed to publish announcement", e);
          return false;
      }
  }, []);

  const handleStopAnnouncement = useCallback(async () => {
      try {
          const ref = doc(db, 'public', 'announcement');
          await setDoc(ref, { text: '' }, { merge: true });
          return true;
      } catch (e) {
          console.error("Failed to stop announcement", e);
          return false;
      }
  }, []);

  const handleUpdateImageBanner = useCallback(async (imageUrl: string) => {
      try {
          const ref = doc(db, 'public', 'imageBanner');
          await setDoc(ref, {
              imageUrl: imageUrl,
              isActive: true,
              timestamp: serverTimestamp()
          });
          return true;
      } catch (e) {
          console.error("Failed to update image banner", e);
          return false;
      }
  }, []);

  const handleToggleImageBanner = useCallback(async (isActive: boolean) => {
      try {
          const ref = doc(db, 'public', 'imageBanner');
          await setDoc(ref, { isActive: isActive }, { merge: true });
          return true;
      } catch (e) {
          console.error("Failed to toggle banner", e);
          return false;
      }
  }, []);

  const handleDeleteImageBanner = useCallback(async () => {
      try {
          const ref = doc(db, 'public', 'imageBanner');
          await setDoc(ref, { imageUrl: '', isActive: false }, { merge: true });
          return true;
      } catch (e) {
          console.error("Failed to delete banner", e);
          return false;
      }
  }, []);

  const handleToggleMaintenance = useCallback(async (isActive: boolean) => {
      try {
          const ref = doc(db, 'public', 'maintenance');
          await setDoc(ref, { isActive: isActive }, { merge: true });
          return true;
      } catch (e) {
          console.error("Failed to toggle maintenance", e);
          return false;
      }
  }, []);

  const navigateToView = useCallback((view: AppState['view']) => {
    dispatchApp({ type: 'SET_VIEW', payload: view });
  }, []);

  const navigateBack = useCallback(() => {
    dispatchApp({ type: 'NAVIGATE_BACK' });
  }, []);

  const openModal = useCallback((modal: ModalName) => {
    dispatchModal({ type: `OPEN_${modal.toUpperCase()}` as any });
  }, []);

  const closeModal = useCallback((modal: ModalName) => {
    dispatchModal({ type: `CLOSE_${modal.toUpperCase()}` as any });
  }, []);

  const renderCurrentView = useCallback(() => {
    if (appState.loading.navigation) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (appState.view === 'single' && appState.activeGame) {
        const activeGameConfig = memoizedSingleGames.find(g => g.id === appState.activeGame);
        const instructions = GAME_INSTRUCTIONS[appState.activeGame] || GAME_INSTRUCTIONS.default;

        return (
            <div className="h-full flex flex-col animate-fade-in">
                <div className="flex items-center justify-between mb-4 bg-gray-800/80 p-3 rounded-xl backdrop-blur-sm sticky top-0 z-30 border-b border-gray-700 shadow-md">
                    <button onClick={navigateBack} className="flex items-center text-gray-300 hover:text-white transition group bg-gray-700/50 px-3 py-1 rounded-lg">
                        <span className="text-xl mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="font-bold">خروج</span>
                    </button>
                    <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        {activeGameConfig?.name}
                    </h2>
                    <HowToPlay customTrigger={
                         <button className="bg-gray-700/50 p-2 rounded-lg hover:bg-gray-600 hover:text-cyan-400 text-gray-300 transition-all cursor-pointer shadow-lg flex items-center gap-1 font-bold text-xs">
                             <InfoIcon className="w-5 h-5" />
                             <span className="hidden sm:inline">كيف تلعب</span>
                         </button>
                     }>
                        {instructions}
                    </HowToPlay>
                </div>
                <div className="flex-grow overflow-y-auto no-scrollbar">
                    <DynamicGame 
                        gameId={appState.activeGame} 
                        userProfile={userProfile} 
                        onBalanceUpdate={handleBalanceUpdate}
                        onAnnounceWin={handleAnnounceWin}
                    />
                </div>
            </div>
        );
    }

    if (appState.view === 'club' && appState.activeClubGame) {
        const activeGameConfig = memoizedClubGames.find(g => g.id === appState.activeClubGame);
        const instructions = GAME_INSTRUCTIONS[appState.activeClubGame] || GAME_INSTRUCTIONS.default;

         return (
            <div className="h-full flex flex-col animate-fade-in">
                <div className="flex items-center justify-between mb-4 bg-gray-800/80 p-3 rounded-xl backdrop-blur-sm sticky top-0 z-30 border-b border-gray-700 shadow-md">
                    <button onClick={navigateBack} className="flex items-center text-gray-300 hover:text-white transition group bg-gray-700/50 px-3 py-1 rounded-lg">
                        <span className="text-xl mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="font-bold">خروج</span>
                    </button>
                    <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                        {activeGameConfig?.name}
                    </h2>
                    <HowToPlay customTrigger={
                         <button className="bg-gray-700/50 p-2 rounded-lg hover:bg-gray-600 hover:text-cyan-400 text-gray-300 transition-all cursor-pointer shadow-lg flex items-center gap-1 font-bold text-xs">
                             <InfoIcon className="w-5 h-5" />
                             <span className="hidden sm:inline">كيف تلعب</span>
                         </button>
                     }>
                        {instructions}
                    </HowToPlay>
                </div>
                <div className="flex-grow overflow-y-auto no-scrollbar">
                    <DynamicGame 
                        gameId={appState.activeClubGame} 
                        userProfile={userProfile} 
                        onBalanceUpdate={handleBalanceUpdate}
                        onAnnounceWin={handleAnnounceWin}
                    />
                </div>
            </div>
        );
    }

    // View for ALL games (The Gold List)
    if (appState.view === 'all_games') {
        const allGames = [...memoizedSingleGames, ...memoizedClubGames];
        return (
            <div className="flex flex-col gap-4 animate-fade-in pb-20">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 bg-gray-800/80 p-3 rounded-xl backdrop-blur-sm sticky top-0 z-30 border-b border-[#FFD700]/30 shadow-md">
                    <button onClick={() => navigateToView('dashboard')} className="flex items-center text-gray-300 hover:text-white transition group bg-gray-700/50 px-3 py-1 rounded-lg border border-[#FFD700]/20">
                        <span className="text-xl mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="font-bold">الرئيسية</span>
                    </button>
                    <h2 className="text-xl font-black text-[#FFD700] drop-shadow-md">منطقة الالعاب</h2>
                    <div className="w-8"></div>
                </div>

                {/* List of all games */}
                <div className="flex flex-col gap-3">
                    {allGames.map(game => (
                        <button
                            key={game.id}
                            onClick={() => game.category === 'club' ? handleClubGameNavigation(game.id) : handleGameNavigation(game.id as GameId)}
                            className="relative w-full bg-gray-900/80 border border-[#FFD700]/20 rounded-xl p-4 flex items-center gap-4 hover:border-[#FFD700]/60 transition-all group shadow-lg overflow-hidden"
                        >
                            {/* Gold Glow Effect on Hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            
                            <span className="text-4xl filter drop-shadow-md transform group-hover:scale-110 transition-transform duration-300">{game.icon}</span>
                            <div className="flex-grow text-right z-10">
                                <h3 className="font-bold text-lg text-gray-100 group-hover:text-[#FFD700] transition-colors">{game.name}</h3>
                                <span className="text-xs text-gray-500">{game.category === 'club' ? 'لعبة جماعية' : 'لعبة فردية'}</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-[#FFD700]/20 flex items-center justify-center group-hover:bg-[#FFD700] transition-colors z-10">
                                <span className="text-[#FFD700] group-hover:text-black text-sm font-bold">➔</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-20">
            <div className="w-full">
                <ImageBannerDisplay banner={imageBanner} />
            </div>

            {/* Gold Button - All Games Entry */}
            <button 
                onClick={() => navigateToView('all_games')}
                className="w-full bg-gradient-to-r from-[#FDB931] via-[#FFD700] to-[#FDB931] text-black rounded-full py-4 px-6 shadow-[0_0_15px_rgba(255,215,0,0.4)] border-2 border-[#FFF8DC] transform transition hover:scale-[1.02] flex justify-between items-center group relative overflow-hidden"
            >
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                
                <div className="flex items-center gap-2 z-10">
                    <span className="text-2xl">🎰</span>
                    <span className="font-black text-xl tracking-wide drop-shadow-sm">منطقة الالعاب</span>
                </div>
                <span className="text-xs font-bold bg-black/20 px-3 py-1.5 rounded-full group-hover:bg-black/30 transition z-10 text-black backdrop-blur-sm">ادخل هنا 👈</span>
            </button>
        </div>
    );
}, [appState.view, appState.activeGame, appState.activeClubGame, appState.loading.navigation, memoizedSingleGames, memoizedClubGames, userProfile, handleBalanceUpdate, handleAnnounceWin, navigateBack, navigateToView, imageBanner, handleGameNavigation, handleClubGameNavigation]);

  if (loading) return <LoadingScreen isDataReady={false} onLoadingComplete={() => {}} />;

  if (isAdmin && adminView) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <Header 
          balance={balance}
          onOpenManagementModal={() => openModal('management')}
          onOpenMailbox={() => openModal('mailbox')}
          onOpenWallet={() => openModal('wallet')}
          unreadCount={unreadCount}
          formatNumber={formatNumber}
          isAdmin={isAdmin}
          adminView={adminView}
          onToggleView={() => setAdminView(!adminView)}
          userProfile={userProfile}
        />
        <div className="mt-6">
          <AdminPanel 
            onRecharge={handleAdminRecharge}
            onDeduct={handleAdminDeduct}
            formatNumber={formatNumber}
            treasuryBalance={treasuryBalance}
            requests={requests}
            onProcessRequest={handleProcessRequest}
            processingRequestId={processingRequestId}
            activePlayers={activePlayers} 
            systemNotifications={systemNotifications}
            sendNotification={handleSendNotification}
            onTreasuryUpdate={handleTreasuryUpdate}
            isMaintenanceMode={isMaintenanceMode}
            announcement={announcement}
            imageBanner={imageBanner}
            profitLog={profitLog}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsRead={handleMarkAllSystemNotificationsAsRead}
            onPublishAnnouncement={handlePublishAnnouncement}
            onStopAnnouncement={handleStopAnnouncement}
            onUpdateImageBanner={handleUpdateImageBanner}
            onToggleImageBanner={handleToggleImageBanner}
            onDeleteImageBanner={handleDeleteImageBanner}
            onToggleMaintenance={handleToggleMaintenance}
            onAnnounceWin={handleAnnounceWin}
            totalUsers={totalUsers}
            onBanUser={handleBanUser}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans selection:bg-purple-500 selection:text-white overflow-hidden">
      <Header 
        balance={balance}
        onOpenManagementModal={() => openModal('management')}
        onOpenMailbox={() => openModal('mailbox')}
        onOpenWallet={() => openModal('wallet')}
        unreadCount={unreadCount}
        formatNumber={formatNumber}
        isAdmin={isAdmin}
        adminView={adminView}
        onToggleView={() => setAdminView(!adminView)}
        userProfile={userProfile}
      />

      <AnnouncementBanner announcement={announcement} onClose={() => setAnnouncement(null)} />
      <WinnerMarquee winToAnnounce={highValueWin} onClose={() => setHighValueWin(null)} />

      <main className="flex-grow p-4 overflow-y-auto relative">
        {renderCurrentView()}
      </main>

      <WalletModal isOpen={modalState.isWalletOpen} onClose={() => closeModal('wallet')} balance={balance} userId={user.uid} onRequestTransaction={handleTransactionRequest} formatNumber={formatNumber} />
      <AgentsModal isOpen={modalState.isAgentsOpen} onClose={() => closeModal('agents')} userProfile={userProfile} />
      
      {/* Wrap ManagementModal in memo inside App implicitly by keeping props clean */}
      <ManagementModal 
        isOpen={modalState.isManagementOpen} 
        onClose={() => closeModal('management')} 
        onOpenWallet={() => { closeModal('management'); openModal('wallet'); }} 
        onOpenAgentsModal={() => { closeModal('management'); openModal('agents'); }} 
        onOpenAvatarModal={() => { closeModal('management'); openModal('avatar'); }} 
        onLogout={() => window.location.reload()} 
        isAdmin={isAdmin} 
        userProfile={userProfile} 
        onDisplayNameChange={handleDisplayNameChange} 
      />
      
      <MailboxModal isOpen={modalState.isMailboxOpen} onClose={() => closeModal('mailbox')} messages={mailboxMessages} onMarkAsRead={handleMarkUserMessageRead} onMarkAllAsRead={handleMarkAllUserMessagesRead} />
      <AvatarModal isOpen={modalState.isAvatarModalOpen} onClose={() => closeModal('avatar')} onAvatarChange={handleAvatarChange} currentAvatar={userProfile?.photoURL} userId={user.uid} />
      <RoundHistoryModal isOpen={modalState.isHistoryOpen} onClose={() => closeModal('history')} />
    </div>
  );
};

export default App;
