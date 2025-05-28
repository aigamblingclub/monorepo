export interface User {
  id: number;
  nearImplicitAddress: string;
  nearNamedAddress: string;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: number;
  keyValue: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  totalUses: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  apiKey: string | null;
} 