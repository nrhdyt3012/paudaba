// src/stores/auth-store.ts
import { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { Profile } from "@/types/auth";
import { INITIAL_STATE_PROFILE } from "@/constants/auth-constant";

type AuthState = {
  user: User | null;
  profile: Profile;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile) => void;
};


export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: INITIAL_STATE_PROFILE,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
}));

