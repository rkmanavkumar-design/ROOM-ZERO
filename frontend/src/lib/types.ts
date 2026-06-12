export interface User {
  id: string;
  nickname: string;
  socketId: string;
  joinedAt: number;
  score: number;
  awards: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderNickname: string;
  text?: string;
  imageUrl?: string;
  isOneTime: boolean;
  timestamp: number;
}

export type GameType = 'scribble' | 'story' | 'nhie';

export interface ScribbleSession {
  drawerId: string;
  word: string;
  timer: number;
  chaosModifier?: 'opposite-hand' | 'circles-only' | 'one-line';
  guessedUsers: string[];
}

export interface StoryBuilderSession {
  turnUserId: string;
  sentences: { userId: string; nickname: string; text: string; isTwist: boolean }[];
  turnCount: number;
  currentTwist?: string;
}

export interface NhieSession {
  currentQuestion: string;
  answers: Record<string, 'have' | 'never'>;
  discussionPrompt?: string;
  history: string[];
}

export interface Room {
  id: string;
  users: Record<string, User>;
  theme: 'space' | 'ocean' | 'arcade' | 'sakura' | 'carnival';
  messages: Message[];
  activeGame?: GameType;
  scribble?: ScribbleSession;
  story?: StoryBuilderSession;
  nhie?: NhieSession;
  createdAt: number;
  lastActiveAt: number;
}
