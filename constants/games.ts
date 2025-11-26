
import React from 'react';

export const GAME_CATEGORIES = {
  SINGLE: 'single',
  CLUB: 'club'
} as const;

export const GAME_NAVIGATION_TYPES = {
    DASHBOARD: 'dashboard',
    ARENA: 'arena',
    SINGLE: 'single',
    CLUB: 'club'
} as const;

export const GAME_CONFIG = {
  SINGLE_GAMES: [
    { id: 'coinFlip', name: 'ملك وكتابة', icon: '🪙', category: 'single' },
    { id: 'theMaze', name: 'المتاهة', icon: '🌀', category: 'single' },
    { id: 'highLow', name: 'أعلى أم أدنى', icon: '🃏', category: 'single' },
    { id: 'slotMachine', name: 'ماكينة الحظ', icon: '🎰', category: 'single' },
    { id: 'guessColor', name: 'خمن اللون', icon: '🎨', category: 'single' },
    { id: 'diceRoll', name: 'رمي النرد', icon: '🎲', category: 'single' },
    { id: 'rockPaperScissors', name: 'حجر ورقة مقص', icon: '✌️', category: 'single' },
    { id: 'cardDraw', name: 'سحب الورقة', icon: '🎴', category: 'single' },
    { id: 'findTheBox', name: 'اكتشف الصندوق', icon: '🎁', category: 'single' },
    { id: 'luckyWheel', name: 'عجلة الحظ', icon: '🎡', category: 'single' },
    { id: 'treasureHunt', name: 'التفاحة', icon: '🍎', category: 'single' },
    { id: 'numberGuess', name: 'خمن الرقم', icon: '🔢', category: 'single' },
    { id: 'domino', name: 'دومينو', icon: '🁙', category: 'single' },
    { id: 'greedyGame', name: 'Greedy', icon: '🥗', category: 'single' },
    { id: 'crashGame', name: 'الصاروخ', icon: '🚀', category: 'single' },
    { id: 'chickenRoad', name: 'طريق الدجاج', icon: '🐔', category: 'single' },
    { id: 'wrestling', name: 'المصارعة', icon: '💪', category: 'single' },
  ],
  CLUB_GAMES: [
    { id: 'quickSyndicate', name: 'الجمعية السريعة', icon: '💰', category: 'club', minPlayers: 5 },
    { id: 'colorWar', name: 'حرب الألوان', icon: '⚔️', category: 'club' },
    { id: 'timeBomb', name: 'القنبلة الموقوتة', icon: '💣', category: 'club', minPlayers: 3 },
    { id: 'camelRace', name: 'سباق الجمال', icon: '🐫', category: 'club' },
    { id: 'uniqueBid', name: 'المزاد العكسي', icon: '🔨', category: 'club' },
    { id: 'safeZone', name: 'المنطقة الآمنة', icon: '🛡️', category: 'club' },
    { id: 'bankOfLuck', name: 'خزنة الحظ', icon: '🏦', category: 'club', minPlayers: 10 },
    { id: 'majorityRules', name: 'حكم الأغلبية', icon: '⚖️', category: 'club' },
    { id: 'zodiacArena', name: 'ساحة الأبراج', icon: '♈', category: 'club' },
    { id: 'forestRun', name: 'سباق الغابة', icon: '🦁', category: 'club' },
    { id: 'pearlDiving', name: 'صيد اللؤلؤ', icon: '🦪', category: 'club' },
    { id: 'cyberHack', name: 'الاختراق الإلكتروني', icon: '💻', category: 'club' },
    { id: 'desertCaravan', name: 'قافلة الصحراء', icon: '🏜️', category: 'club' },
    { id: 'cardsClub', name: 'نادي الورق', icon: '🃏', category: 'club', minPlayers: 2 },
    { id: 'spaceWar', name: 'حرب الفضاء', icon: '🚀', category: 'club' },
    { id: 'potionLab', name: 'مختبر الكيمياء', icon: '🧪', category: 'club' },
    { id: 'fishingNet', name: 'الصيد الوفير', icon: '🎣', category: 'club' },
    { id: 'chefBattle', name: 'تحدي الطبخ', icon: '👨‍🍳', category: 'club' },
    { id: 'monsterHunt', name: 'صيد الوحوش', icon: '🐉', category: 'club' },
  ]
};
