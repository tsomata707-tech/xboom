
import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { doc, onSnapshot, updateDoc, increment, setDoc, collection, query, where, orderBy, deleteDoc, limit, serverTimestamp, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, GameId, TransactionRequest, SystemNotification, ProfitLogEntry, HighValueWin } from './types';
import { formatNumber } from './components/utils/formatNumber';

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
import JoinNotification from './components/JoinNotification';
import ImageBannerDisplay from './components/ImageBannerDisplay';

// Games
import CoinFlipGame from './components/games/CoinFlipGame';
import HighLowGame from './components/games/HighLowGame';
import SlotMachineGame from './components/games/SlotMachineGame';
import GuessColorGame from './components/games/GuessColorGame';
import DiceRollGame from './components/games/DiceRollGame';
import RockPaperScissorsGame from './components/games/RockPaperScissorsGame';
import CardDrawGame from './components/games/CardDrawGame';
import FindTheBoxGame from './components/games/FindTheBoxGame';
import XboomStockMarketGame from './components/games/XboomStockMarketGame';
import LuckyWheelGame from './components/games/LuckyWheelGame';
import TreasureHuntGame from './components/games/TreasureHuntGame';
import PlinkoGame from './components/games/PlinkoGame';
import NumberGuessGame from './components/games/NumberGuessGame';
import DominoGame from './components/games/DominoGame';
import GreedyGame from './components/games/GreedyGame';
import CrashGame from './components/games/CrashGame';
import ChickenRoadGame from './components/games/ChickenRoadGame';

// Club Games
import QuickSyndicateGame from './components/games/QuickSyndicateGame';
import ColorWarGame from './components/games/ColorWarGame';
import TimeBombGame from './components/games/TimeBombGame';
import CamelRaceGame from './components/games/CamelRaceGame';
import UniqueBidGame from './components/games/UniqueBidGame';
import SafeZoneGame from './components/games/SafeZoneGame';
import BankOfLuckGame from './components/games/BankOfLuckGame';
import MajorityRulesGame from './components/games/MajorityRulesGame';
// New Club Games
import ZodiacArenaGame from './components/games/ZodiacArenaGame';
import ForestRunGame from './components/games/ForestRunGame';
import PearlDivingGame from './components/games/PearlDivingGame';
import CyberHackGame from './components/games/CyberHackGame';
import DesertCaravanGame from './components/games/DesertCaravanGame';
import CardsClubGame from './components/games/CardsClubGame';
// Newly Added Club Games
import SpaceWarGame from './components/games/SpaceWarGame';
import PotionLabGame from './components/games/PotionLabGame';
import FishingNetGame from './components/games/FishingNetGame';
import ChefBattleGame from './components/games/ChefBattleGame';
import MonsterHuntGame from './components/games/MonsterHuntGame';

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

interface BalanceUpdateResult {
  success: boolean;
  error?: string;
}

interface AdminActionResult {
  success: boolean;
  message?: string;
}

// Constants
const GAME_CONFIG = {
  CLUB_GAMES: [
    { id: 'quickSyndicate', name: 'الجمعية السريعة', icon: '💰', category: 'club' as const, minPlayers: 2 },
    { id: 'cardsClub', name: 'الكوتشينة', icon: '🃏', category: 'club' as const, minPlayers: 2 },
    { id: 'colorWar', name: 'حرب الألوان', icon: '⚔️', category: 'club' as const, minPlayers: 3 },
    { id: 'timeBomb', name: 'القنبلة الموقوتة', icon: '💣', category: 'club' as const, minPlayers: 4 },
    { id: 'camelRace', name: 'سباق الجمال', icon: '🐫', category: 'club' as const, minPlayers: 2 },
    { id: 'uniqueBid', name: 'المزاد العكسي', icon: '🔨', category: 'club' as const, minPlayers: 3 },
    { id: 'safeZone', name: 'المنطقة الآمنة', icon: '🛡️', category: 'club' as const, minPlayers: 5 },
    { id: 'bankOfLuck', name: 'خزنة الحظ', icon: '🏦', category: 'club' as const, minPlayers: 4 },
    { id: 'majorityRules', name: 'تحدي الأغلبية', icon: '⚖️', category: 'club' as const, minPlayers: 6 },
    { id: 'zodiacArena', name: 'حلبة الأبراج', icon: '♈', category: 'club' as const, minPlayers: 2 },
    { id: 'forestRun', name: 'سباق الغابة', icon: '🦁', category: 'club' as const, minPlayers: 3 },
    { id: 'pearlDiving', name: 'غواص اللؤلؤ', icon: '🤿', category: 'club' as const, minPlayers: 2 },
    { id: 'cyberHack', name: 'الاختراق', icon: '💻', category: 'club' as const, minPlayers: 2 },
    { id: 'desertCaravan', name: 'قافلة الصحراء', icon: '⛺', category: 'club' as const, minPlayers: 4 },
    { id: 'spaceWar', name: 'حرب الفضاء', icon: '🚀', category: 'club' as const, minPlayers: 3 },
    { id: 'potionLab', name: 'مختبر الكيمياء', icon: '🧪', category: 'club' as const, minPlayers: 2 },
    { id: 'fishingNet', name: 'الصيد الوفير', icon: '🎣', category: 'club' as const, minPlayers: 2 },
    { id: 'chefBattle', name: 'تحدي الطبخ', icon: '🍳', category: 'club' as const, minPlayers: 2 },
    { id: 'monsterHunt', name: 'صيد الوحوش', icon: '🏹', category: 'club' as const, minPlayers: 3 },
  ],
  SINGLE_GAMES: [
    { id: 'crashGame', name: 'الصاروخ', icon: '🚀', category: 'single' as const },
    { id: 'chickenRoad', name: 'طريق الدجاج', icon: '🐔', category: 'single' as const },
    { id: 'luckyWheel', name: 'عجلة الحظ', icon: '🎡', category: 'single' as const },
    { id: 'plinko', name: 'بلينكو', icon: '🎱', category: 'single' as const },
    { id: 'greedyGame', name: 'سوق الخضار', icon: '🥦', category: 'single' as const },
    { id: 'xboomStockMarket', name: 'البورصة', icon: '📈', category: 'single' as const },
    { id: 'domino', name: 'دومينو', icon: '🁙', category: 'single' as const },
    { id: 'treasureHunt', name: 'كنز', icon: '🗺️', category: 'single' as const },
    { id: 'slotMachine', name: 'سلوتس', icon: '🎰', category: 'single' as const },
    { id: 'coinFlip', name: 'ملك وكتابة', icon: '🪙', category: 'single' as const },
    { id: 'highLow', name: 'أعلى/أدنى', icon: '🃏', category: 'single' as const },
    { id: 'diceRoll', name: 'نرد', icon: '🎲', category: 'single' as const },
    { id: 'rockPaperScissors', name: 'حجر ورقة', icon: '✌️', category: 'single' as const },
    { id: 'guessColor', name: 'ألوان', icon: '🎨', category: 'single' as const },
    { id: 'findTheBox', name: 'صناديق', icon: '🎁', category: 'single' as const },
    { id: 'numberGuess', name: 'تخمين الرقم', icon: '🔢', category: 'single' as const },
    { id: 'cardDraw', name: 'سحب ورقة', icon: '🂡', category: 'single' as const },
  ],
  TRANSACTION_TYPES: {
    DEPOSIT: 'deposit',
    WITHDRAW: 'withdraw'
  } as const
} satisfies { CLUB_GAMES: GameConfig[], SINGLE_GAMES: GameConfig[], TRANSACTION_TYPES: { DEPOSIT: string; WITHDRAW: string } };

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
  xboomStockMarket: XboomStockMarketGame,
  luckyWheel: LuckyWheelGame,
  treasureHunt: TreasureHuntGame,
  plinko: PlinkoGame,
  numberGuess: NumberGuessGame,
  domino: DominoGame,
  greedyGame: GreedyGame,
  crashGame: CrashGame,
  chickenRoad: ChickenRoadGame,
  
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

// Modal Reducer
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
      return Object.keys(state).reduce((acc, key) => ({ 
        ...acc, [key]: false 
      }), {} as ModalState);
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
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Explicitly including playerID in the profile state to ensure it's available
        setUserProfile({ ...data, uid: userId, email: userEmail, playerID: data.playerID });
        setBalance(data.balance || 0);
        setIsAdmin(data.isAdmin || false);
      }
      setLoading(false);
    });

    return unsubUser;
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
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMailboxMessages(msgs);
      setUnreadCount(msgs.filter((m: any) => !m.isRead).length);
    });

    return unsubMailbox;
  }, [userId]);

  return { mailboxMessages, unreadCount, setMailboxMessages };
};

const usePublicData = () => {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [imageBanner, setImageBanner] = useState<any>(null);
  const [highValueWin, setHighValueWin] = useState<HighValueWin | null>(null);

  useEffect(() => {
    const announcementRef = doc(db, 'public', 'announcement');
    const unsubAnnounce = onSnapshot(announcementRef, (snap) => {
      if (snap.exists()) setAnnouncement(snap.data());
    });

    const bannerRef = doc(db, 'public', 'imageBanner');
    const unsubBanner = onSnapshot(bannerRef, (snap) => {
      if (snap.exists()) setImageBanner(snap.data());
    });
    
    const winnerRef = doc(db, 'public', 'lastWinner');
    const unsubWinner = onSnapshot(winnerRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Only show if recent (within 15 seconds)
        if (Date.now() - data.timestamp?.toMillis() < 15000) {
          setHighValueWin(data as HighValueWin);
        }
      }
    });

    return () => {
      unsubAnnounce();
      unsubBanner();
      unsubWinner();
    };
  }, []);

  return { announcement, imageBanner, highValueWin, setAnnouncement, setHighValueWin };
};

const useAdminData = (isAdmin: boolean) => {
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [profitLog, setProfitLog] = useState<ProfitLogEntry[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    
    const treasuryRef = doc(db, 'public', 'treasury');
    const unsubTreasury = onSnapshot(treasuryRef, (snap) => {
      if(snap.exists()) setTreasuryBalance(snap.data().balance);
    });

    const requestsQuery = query(
      collection(db, 'transactions'), 
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(requestsQuery, (snap) => {
      const reqs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionRequest));
      reqs.sort((a, b) => b.timestamp - a.timestamp);
      setRequests(reqs);
    });

    const profitQuery = query(
      collection(db, 'profitLog'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubProfit = onSnapshot(profitQuery, (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProfitLogEntry));
      setProfitLog(logs);
    });
    
    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', 'ADMIN'),
      where('isRead', '==', false),
      orderBy('timestamp', 'desc')
    );
    const unsubNotifs = onSnapshot(notifQuery, (snap) => {
      const notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemNotification));
      setSystemNotifications(notifs);
    });

    return () => {
      unsubTreasury();
      unsubRequests();
      unsubProfit();
      unsubNotifs();
    };
  }, [isAdmin]);

  return { treasuryBalance, requests, profitLog, systemNotifications, setRequests };
};

// Dynamic Game Component
const DynamicGame: React.FC<{
  gameId: string;
  userProfile: any;
  onBalanceUpdate: (amount: number, gameId: GameId) => Promise<BalanceUpdateResult>;
  onAnnounceWin: (nickname: string, amount: number, gameName: string) => void;
}> = ({ gameId, userProfile, onBalanceUpdate, onAnnounceWin }) => {
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
};

// Main App Component
interface AppProps {
  user: AppUser;
}

const App: React.FC<AppProps> = ({ user }) => {
  // State
  const [modalState, dispatchModal] = useReducer(modalReducer, {
    isWalletOpen: false,
    isAgentsOpen: false,
    isManagementOpen: false,
    isMailboxOpen: false,
    isHistoryOpen: false,
    isAvatarModalOpen: false,
  });
  
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [adminView, setAdminView] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [isClubOpen, setIsClubOpen] = useState(false);
  const [isSinglePlayerOpen, setIsSinglePlayerOpen] = useState(false);
  const [isArenaOpen, setIsArenaOpen] = useState(false); // New State for Arena
  const [activeClubGame, setActiveClubGame] = useState<string | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());

  // Custom Hooks
  const { userProfile, balance, isAdmin, loading, setBalance } = useUserData(user.uid, user.email || '');
  const { mailboxMessages, unreadCount } = useMailbox(user.uid);
  const { announcement, imageBanner, highValueWin, setAnnouncement, setHighValueWin } = usePublicData();
  const { treasuryBalance, requests, profitLog, systemNotifications: rawSystemNotifications } = useAdminData(isAdmin);

  // Filter system notifications based on local dismissals
  const systemNotifications = useMemo(() => 
    rawSystemNotifications.filter(n => !locallyDismissedIds.has(n.id)), 
    [rawSystemNotifications, locallyDismissedIds]
  );

  // Handlers
  const handleBalanceUpdate = useCallback(async (amount: number, gameId: GameId): Promise<BalanceUpdateResult> => {
    const cleanAmount = Math.round(amount * 100) / 100;

    if (cleanAmount < 0 && balance < Math.abs(cleanAmount)) {
      return { success: false, error: 'رصيد غير كافي' };
    }
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(cleanAmount),
        lastActive: new Date()
      });
      
      // Update local balance immediately for better UX
      setBalance(prev => prev + cleanAmount);
      
      return { success: true };
    } catch (error) {
      console.error("فشل تحديث الرصيد:", error);
      return { success: false, error: 'فشل في المعاملة' };
    }
  }, [user.uid, balance, setBalance]);

  const handleGameNavigation = useCallback(async (gameId: GameId) => {
    setGameLoading(true);
    // Simulate loading for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    setActiveGame(gameId);
    setGameLoading(false);
  }, []);

  const handleClubGameNavigation = useCallback(async (gameId: string) => {
    setGameLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setActiveClubGame(gameId);
    setGameLoading(false);
  }, []);

  const handleAnnounceWin = useCallback(async (nickname: string, amount: number, gameName: string) => {
    try {
      const ref = doc(db, 'public', 'lastWinner');
      await setDoc(ref, {
        nickname,
        amount: Math.floor(amount),
        gameName,
        timestamp: new Date()
      });
    } catch (e) {
      console.error("Failed to announce win", e);
    }
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
      timestamp: Date.now()
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
      // Verify admin permissions
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists() || !userDoc.data().isAdmin) {
        console.error('صلاحيات إدارة غير صالحة');
        return;
      }

      if (action === 'approve') {
        const targetUserRef = doc(db, 'users', req.userId);
        if (req.type === 'deposit') {
          await updateDoc(targetUserRef, { balance: increment(req.amount) });
        } else {
          await updateDoc(targetUserRef, { balance: increment(-req.amount) });
        }
        
        const treasuryRef = doc(db, 'public', 'treasury');
        if (req.type === 'deposit') {
          await updateDoc(treasuryRef, { balance: increment(req.amount) });
        } else {
          await updateDoc(treasuryRef, { balance: increment(-req.amount) });
        }
      }

      const reqRef = doc(db, 'transactions', req.id);
      await updateDoc(reqRef, { status: action });

      const notifRef = doc(collection(db, 'users', req.userId, 'mailbox'));
      await setDoc(notifRef, {
        title: action === 'approve' ? '✅ تمت الموافقة على طلبك' : '❌ تم رفض طلبك',
        body: `طلب ${req.type === 'deposit' ? 'الإيداع' : 'السحب'} بقيمة ${formatNumber(req.amount)} تم ${action === 'approve' ? 'الموافقة عليه' : 'رفضه'}.`,
        type: action === 'approve' ? 'success' : 'error',
        isRead: false,
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setProcessingRequestId(null);
    }
  }, [processingRequestId, user.uid]);

  const handleAdminRecharge = useCallback(async (playerId: string, amount: number): Promise<AdminActionResult> => {
    try {
      if (!isAdmin) {
        return { success: false, message: 'غير مصرح بالوصول' };
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('playerID', '==', playerId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'المستخدم غير موجود' };
      }
      
      const userDoc = querySnapshot.docs[0];
      await updateDoc(userDoc.ref, { balance: increment(amount) });
      
      const treasuryRef = doc(db, 'public', 'treasury');
      await updateDoc(treasuryRef, { balance: increment(amount) });

      return { success: true, message: 'تم شحن الرصيد بنجاح' };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'فشل في عملية الشحن' };
    }
  }, [isAdmin]);

  const handleTreasuryTopUp = useCallback(async (amount: number): Promise<AdminActionResult> => {
    try {
      if (!isAdmin) {
        return { success: false, message: 'غير مصرح بالوصول' };
      }

      const treasuryRef = doc(db, 'public', 'treasury');
      await updateDoc(treasuryRef, { balance: increment(amount) });
      return { success: true, message: 'تم زيادة رصيد الخزينة بنجاح' };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'فشل في عملية زيادة الرصيد' };
    }
  }, [isAdmin]);

  const handleSendNotification = useCallback(async (userId: string, title: string, body: string, type: string): Promise<void> => {
    try {
      const notifRef = doc(collection(db, 'users', userId, 'mailbox'));
      await setDoc(notifRef, {
        title,
        body,
        type,
        isRead: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (e: any) {
      // Handle permission errors gracefully by dismissing locally
      if (e.code === 'permission-denied' || e.message?.includes('permission') || e.code === 'missing-permission') {
          console.warn("Permission denied updating notification. Dismissing locally.");
          setLocallyDismissedIds(prev => {
              const newSet = new Set(prev);
              newSet.add(notificationId);
              return newSet;
          });
      } else {
          console.error("Failed to mark notification read:", e);
      }
    }
  }, []);

  const handleMarkAllSystemNotificationsAsRead = useCallback(async () => {
      if (!systemNotifications.length) return;
      
      const updates = systemNotifications
        .map(note => 
            updateDoc(doc(db, 'notifications', note.id), { isRead: true })
                .catch(e => {
                    // Handle permission errors gracefully by dismissing locally
                    if (e.code === 'permission-denied' || e.message?.includes('permission') || e.code === 'missing-permission') {
                         console.warn(`Permission denied updating notification ${note.id}. Dismissing locally.`);
                         setLocallyDismissedIds(prev => {
                            const newSet = new Set(prev);
                            newSet.add(note.id);
                            return newSet;
                        });
                    } else {
                        console.error(`Error marking notification ${note.id} as read:`, e);
                    }
                })
        );

      await Promise.all(updates);
  }, [systemNotifications]);

  // Modal Handlers
  const openModal = useCallback((modal: keyof ModalState) => {
    dispatchModal({ type: `OPEN_${modal.toUpperCase()}` as any });
  }, []);

  const closeModal = useCallback((modal: keyof ModalState) => {
    dispatchModal({ type: `CLOSE_${modal.toUpperCase()}` as any });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatchModal({ type: 'CLOSE_ALL' });
  }, []);

  // Memoized Values
  const memoizedGameConfig = useMemo(() => GAME_CONFIG, []);
  const memoizedClubGames = useMemo(() => memoizedGameConfig.CLUB_GAMES, [memoizedGameConfig]);
  const memoizedSingleGames = useMemo(() => memoizedGameConfig.SINGLE_GAMES, [memoizedGameConfig]);

  if (loading) return <LoadingScreen isDataReady={false} onLoadingComplete={() => {}} />;

  // Admin View
  if (isAdmin && adminView) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <Header 
          balance={balance}
          onOpenManagementModal={() => openModal('management')}
          onOpenMailbox={() => openModal('mailbox')}
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
            formatNumber={formatNumber}
            treasuryBalance={treasuryBalance}
            requests={requests}
            onProcessRequest={handleProcessRequest}
            processingRequestId={processingRequestId}
            activePlayers={[]} 
            systemNotifications={systemNotifications}
            sendNotification={handleSendNotification}
            onTreasuryTopUp={handleTreasuryTopUp}
            isMaintenanceMode={false} 
            announcement={announcement}
            imageBanner={imageBanner}
            profitLog={profitLog}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsRead={handleMarkAllSystemNotificationsAsRead}
          />
        </div>
      </div>
    );
  }

  // Main Game View
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans selection:bg-purple-500 selection:text-white overflow-hidden">
      <Header 
        balance={balance}
        onOpenManagementModal={() => openModal('management')}
        onOpenMailbox={() => openModal('mailbox')}
        unreadCount={unreadCount}
        formatNumber={formatNumber}
        isAdmin={isAdmin}
        adminView={adminView}
        onToggleView={() => setAdminView(!adminView)}
        userProfile={userProfile}
      />

      <AnnouncementBanner announcement={announcement} onClose={() => setAnnouncement(null)} />
      <WinnerMarquee winToAnnounce={highValueWin} onClose={() => setHighValueWin(null)} />

      {/* Loading Overlay */}
      {gameLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white text-xl font-bold">جاري التحميل...</div>
          </div>
        </div>
      )}

      <main className="flex-grow p-4 overflow-y-auto relative">
        {/* 1. Club Mode (Inside Arena) */}
        {isClubOpen ? (
          activeClubGame ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => setActiveClubGame(null)}
                  className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                  disabled={gameLoading}
                >
                  <span>⬅️</span> عودة للنادي
                </button>
                <h2 className="text-xl font-bold text-purple-400">
                  {memoizedClubGames.find(g => g.id === activeClubGame)?.name}
                </h2>
              </div>
              <div className="flex-grow bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700 relative">
                <DynamicGame 
                  gameId={activeClubGame}
                  userProfile={userProfile}
                  onBalanceUpdate={handleBalanceUpdate}
                  onAnnounceWin={handleAnnounceWin}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 px-2">
                <button 
                  onClick={() => setIsClubOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors group"
                  disabled={gameLoading}
                >
                  <span className="text-2xl group-hover:-translate-x-1 transition-transform">🔙</span>
                  <span className="font-bold text-gray-300 group-hover:text-white">الساحة</span>
                </button>
                <h2 className="text-2xl font-bold text-purple-400">نادي اكس بوم 🌐</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-4 overflow-y-auto pb-20">
                {memoizedClubGames.map(game => (
                  <button 
                    key={game.id}
                    onClick={() => handleClubGameNavigation(game.id)}
                    disabled={gameLoading}
                    className="relative group w-full aspect-square bg-gray-800 border-2 border-purple-500/30 rounded-3xl flex flex-col items-center justify-center p-2 sm:p-4 transition-all duration-300 hover:bg-gray-700 hover:border-purple-500 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="mb-2 sm:mb-4 h-12 sm:h-16 w-full flex items-center justify-center text-4xl sm:text-6xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                      {game.icon}
                    </div>
                    <h3 className="text-sm sm:text-lg md:text-xl font-black text-white group-hover:text-purple-300 transition-colors text-center leading-tight line-clamp-2">{game.name}</h3>
                    
                    {/* Live Status Indicator */}
                    <div className="absolute top-3 right-3 flex gap-1" title="مباشر">
                      <span className="animate-ping absolute inline-flex h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-green-500"></span>
                    </div>

                    {/* Players Count */}
                    {game.minPlayers && (
                      <div className="absolute top-3 left-3 bg-purple-600 text-xs px-2 py-1 rounded-full">
                        {game.minPlayers}+ لاعبين
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : activeGame ? (
          // 2. Active Single Player Game (Inside Arena)
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => setActiveGame(null)}
                className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                disabled={gameLoading}
              >
                <span>🏠</span> القائمة
              </button>
            </div>
            <div className="flex-grow bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700 relative shadow-2xl">
              <DynamicGame 
                gameId={activeGame}
                userProfile={userProfile}
                onBalanceUpdate={handleBalanceUpdate}
                onAnnounceWin={handleAnnounceWin}
              />
            </div>
          </div>
        ) : isSinglePlayerOpen ? (
          // 3. Single Player Games Grid View (Inside Arena)
          <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 px-2">
              <button 
                onClick={() => setIsSinglePlayerOpen(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors group"
                disabled={gameLoading}
              >
                <span className="text-2xl group-hover:-translate-x-1 transition-transform">🔙</span>
                <span className="font-bold text-gray-300 group-hover:text-white">الساحة</span>
              </button>
              <h2 className="text-2xl font-bold text-cyan-400">ألعاب فردية 🎲</h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-20">
              {memoizedSingleGames.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleGameNavigation(game.id as GameId)}
                  disabled={gameLoading}
                  className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col items-center gap-3 hover:bg-gray-700 hover:border-cyan-500/50 hover:scale-105 transition-all shadow-lg group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform">{game.icon}</span>
                  <span className="font-bold text-gray-200 group-hover:text-white">{game.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : isArenaOpen ? (
          // 4. The Arena (Selection View)
          <div className="w-full h-full flex flex-col">
             <div className="flex items-center justify-between mb-6 px-2">
                <button 
                  onClick={() => setIsArenaOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors group"
                  disabled={gameLoading}
                >
                  <span className="text-2xl group-hover:-translate-x-1 transition-transform">🔙</span>
                  <span className="font-bold text-gray-300 group-hover:text-white">الرئيسية</span>
                </button>
                <h2 className="text-3xl font-black text-yellow-400 drop-shadow-md">⚔️ الساحة</h2>
            </div>

            <div className="flex flex-col gap-6 justify-center h-full pb-20">
               {/* Club Entry */}
                <button 
                  onClick={() => setIsClubOpen(true)}
                  disabled={gameLoading}
                  className="w-full p-8 rounded-3xl bg-gradient-to-r from-purple-900 to-indigo-900 border-2 border-purple-500 shadow-2xl relative overflow-hidden group transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-right">
                      <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-purple-300 to-pink-300 mb-2">
                        نادي اكس بوم 🌐
                      </h2>
                      <p className="text-gray-300 text-lg">ألعاب جماعية ومنافسات حية</p>
                    </div>
                    <div className="text-7xl animate-bounce">🏰</div>
                  </div>
                </button>

                {/* Single Player Entry */}
                <button 
                  onClick={() => setIsSinglePlayerOpen(true)}
                  disabled={gameLoading}
                  className="w-full p-8 rounded-3xl bg-gradient-to-r from-blue-900 to-cyan-900 border-2 border-cyan-500 shadow-2xl relative overflow-hidden group transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-right">
                      <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-cyan-300 to-blue-300 mb-2">
                        ألعاب فردية 🎲
                      </h2>
                      <p className="text-gray-300 text-lg">تحدى نفسك واربح الجوائز</p>
                    </div>
                    <div className="text-7xl animate-bounce">🕹️</div>
                  </div>
                </button>
            </div>
          </div>
        ) : (
          // 5. Dashboard Main Menu (Landing)
          <div className="flex flex-col gap-6 h-full">
            {/* Arena Entry Button */}
             <button 
              onClick={() => setIsArenaOpen(true)}
              disabled={gameLoading}
              className="w-full p-10 rounded-3xl bg-gradient-to-br from-yellow-700 via-orange-800 to-red-900 border-4 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)] relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(234,179,8,0.5)] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
              {/* Light Sweep Effect */}
              <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform skew-x-[-25deg] animate-shine pointer-events-none"></div>

              <div className="relative z-10 flex flex-col items-center justify-center text-center gap-4">
                <div className="text-8xl filter drop-shadow-lg animate-pulse">🏟️</div>
                <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 drop-shadow-sm">
                  الساحة
                </h2>
                <p className="text-yellow-100/80 text-xl font-bold tracking-wider">بوابة الألعاب والتحديات الكبرى</p>
                <span className="mt-4 px-6 py-2 bg-black/30 rounded-full text-yellow-400 border border-yellow-500/30 font-bold flex items-center gap-2">
                   اضغط للدخول <span className="text-xl">⚔️</span>
                </span>
              </div>
            </button>

             {/* Image Banner Display Area - Positioned below Arena */}
            <div className="mt-auto mb-4">
                <ImageBannerDisplay banner={imageBanner} />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <WalletModal 
        isOpen={modalState.isWalletOpen} 
        onClose={() => closeModal('wallet')} 
        balance={balance} 
        userId={user.uid} 
        onRequestTransaction={handleTransactionRequest}
        formatNumber={formatNumber}
      />
      <AgentsModal 
        isOpen={modalState.isAgentsOpen} 
        onClose={() => closeModal('agents')} 
        userProfile={userProfile} 
      />
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
      <MailboxModal 
        isOpen={modalState.isMailboxOpen} 
        onClose={() => closeModal('mailbox')} 
        messages={mailboxMessages}
        onMarkAsRead={handleMarkUserMessageRead}
        onMarkAllAsRead={handleMarkAllUserMessagesRead}
      />
      <AvatarModal 
        isOpen={modalState.isAvatarModalOpen} 
        onClose={() => closeModal('avatar')} 
        onAvatarChange={handleAvatarChange} 
        currentAvatar={userProfile?.photoURL} 
        userId={user.uid} 
      />
      <RoundHistoryModal 
        isOpen={modalState.isHistoryOpen} 
        onClose={() => closeModal('history')} 
      />
    </div>
  );
};

export default App;
