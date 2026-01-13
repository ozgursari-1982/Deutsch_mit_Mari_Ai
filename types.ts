
export enum ViewMode {
  DOCUMENT = 'document',
  CHAT = 'chat',
  SETTINGS = 'settings',
  DTB_TRAINING = 'dtb_training',
  LIBRARY = 'library',
  GAME = 'game' // NEW
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface LessonDocument {
  id: string;
  name: string;
  displayName: string;
  type: string; // Mime type
  imageUrl?: string; // Firebase Storage URL
  storagePath?: string; // Firebase Storage Reference Path
  data?: string; // Base64 (Runtime only, not saved to Firestore if URL exists)
  messages: Message[];
  timestamp: number;
  themeId?: string; // NEW: e.g., "1"
  subtopicId?: string; // NEW: e.g., "A"
}

export interface AppState {
  currentView: ViewMode;
  sessions: Session[];
  activeSessionId: string | null;
  zoomLevel: number;
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  lastActive: number;
  activeDocId?: string; // Syncs the currently viewed document across devices
  documentCount?: number;
  messageCount?: number;
  // Documents are fetched separately in subcollection for scalability, 
  // but we keep a local array for UI state
  documents: LessonDocument[]; 
}

// --- EXAM TYPES ---

export interface ExamQuestion {
  id: string;
  type: string; // 'mcq', 'gap', 'tf', 'matching', 'essay', etc.
  text: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}

export interface ExamPart {
  title: string;
  content?: string; // Reading text, Audio script, or Scenario description
  instructions?: string;
  questions?: ExamQuestion[];
}

export interface ExamSection {
  title: string;
  type: string; // 'lesen', 'hoeren', 'sprachbausteine', 'schreiben', 'sprechen'
  durationMinutes?: number;
  parts?: ExamPart[];
}

export interface DTBExam {
  id: string;
  title: string;
  topic?: string;
  sections?: ExamSection[];
  createdAt?: number;
  createdBy?: string;
  moduleType?: string; // 'lesen' | 'hoeren' | 'schreiben' | 'sprechen' | 'full'
}

export type TestData = DTBExam;

// --- VOCABULARY TYPES ---
export interface VocabCard {
  word: string;
  article: string;
  definition: string;
  example: string;
}

// --- SPEAKING EVALUATION TYPES (UPDATED FOR PDF COMPLIANCE) ---

export type DTBGrade = 'A' | 'B' | 'C' | 'D';

export interface PartScore {
  grade: DTBGrade;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface GlobalScore {
  grade: DTBGrade;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface DTBSpeakingResult {
  partScores: {
    part1A: PartScore; // Über ein Thema sprechen
    part1B: PartScore; // Prüferfragen
    part1C: PartScore; // Erläuterung eines Aspekts
    part2: PartScore;  // Mit Kollegen sprechen
    part3: PartScore;  // Lösungswege diskutieren
  };
  globalScores: {
    pronunciation: GlobalScore; // Aussprache/Intonation
    grammar: GlobalScore;       // Formale Richtigkeit
    vocabulary: GlobalScore;    // Spektrum sprachl. Mittel
  };
  totalScore: number;
  passed: boolean; // >= 36 points (60%)
  generalFeedback: string;
}

// --- SENTENCE GAME TYPES (NEW) ---

export interface GameQuestion {
  id?: string;
  orderIndex: number; // 1, 2, 3... ensures everyone gets same order
  task: string; // e.g. "Bilde einen Satz im Perfekt!"
  wordList: string[]; // e.g. ["Ich", "habe", "bin", "gelaufen", "gestern", "Hause"]
  level: string; // "B2"
  hint?: string; // NEW: Grammar tip
}

export interface GameValidationResult {
  isValid: boolean;
  scoreChange: number; // +5 or -5
  feedback: string;
  correction: string; // Correct example
}

// --- LEADERBOARD TYPES ---
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;
  email?: string; // Added for filtering Admin
  score: number;
  createdAt: number; // First join timestamp
  lastUpdated: number;
}

// --- SENTENCE BUILDER TYPES ---

export interface WordOption {
  id: string;
  text: string;
  role: string;
  slot?: string;
  isCorrect?: boolean;
}

export interface SentenceState {
  words: WordOption[];
  isComplete: boolean;
  modeId: string | null;
}

export interface GrammarSegment {
  text: string;
  role?: string;
}

export interface GrammarExercise {
  id?: string;
  modeId: string;
  segments: GrammarSegment[];
  createdAt: number;
}
