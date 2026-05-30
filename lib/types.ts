// Type definitions for API responses and app state

export type UserRole = 'handler' | 'manager' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  name: string;
  strain: string;
  hatchDate: string;
  handlerIds: string[];
  managerId: string;
  status: 'brooding' | 'ranging' | 'selection' | 'complete';
  totalBirds: number;
  createdAt: string;
}

export interface BroodingRecord {
  id: string;
  batchId: string;
  recordDate: string;
  temperature: number;
  humidity: number;
  ventilation: string;
  mortalityCount: number;
  mortalityCause: string;
  feedIntake: number;
  waterIntake: number;
  healthObservations: string[];
  createdAt: string;
  createdBy: string;
}

export interface RangingRecord {
  id: string;
  batchId: string;
  recordDate: string;
  outdoorTemp: number;
  precipitation: boolean;
  predatorsObserved: string[];
  forageConsumption: number;
  waterIntake: number;
  healthIssues: string[];
  predatorLosses: PredatorLoss[];
  createdAt: string;
  createdBy: string;
}

export interface PredatorLoss {
  species: string;
  count: number;
  notes?: string;
}

export interface WeightRecord {
  id: string;
  birdId: string;
  recordDate: string;
  weight: number;
  bandId?: string;
  createdAt: string;
}

export interface Bird {
  id: string;
  batchId: string;
  bandId: string;
  strain: string;
  hatchDate: string;
  weights: WeightRecord[];
  crs?: number;
  decision?: 'advance' | 'hold' | 'reject' | null;
  createdAt: string;
}

export interface BatchIndicator {
  id: string;
  batchId: string;
  bhi: number;
  mortalityRate: number;
  avgTemp: number;
  avgHumidity: number;
  avgFeedIntake: number;
  avgWaterIntake: number;
  computedAt: string;
}

export interface BirdIndicator {
  id: string;
  birdId: string;
  growthScore: number;
  healthScore: number;
  behavioralScore: number;
  weightTrend: number;
  computedAt: string;
}

export interface RankingData {
  batchId: string;
  totalBirds: number;
  birds: {
    id: string;
    bandId: string;
    crs: number;
    growthScore: number;
    healthScore: number;
    behavioralScore: number;
    weightTrend: number;
    decision: 'advance' | 'hold' | 'reject' | null;
    overrideReason?: string;
  }[];
}

export interface ScoringWeights {
  bhiWeight: number;
  growthWeight: number;
  healthWeight: number;
  behavioralWeight: number;
}

export interface SelectionDecision {
  id: string;
  batchId: string;
  birdId: string;
  decision: 'advance' | 'hold' | 'reject';
  overrideReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
