// Coin, costume and referral endpoints (docs/API.md "코인·코스튬"). Screens call these instead of api() directly.
import { api } from "./api/client";
import type {
  CheckIn,
  CoinWallet,
  CollectResult,
  OutfitList,
  Referral,
  ReferralResult,
} from "./types";

export const checkIn = () => api<CheckIn>("/coins/check-in", { method: "POST" });
export const ackRewards = (ids: number[]) =>
  api<void>("/coins/rewards/ack", { method: "POST", body: { ids } });
export const getWallet = () => api<CoinWallet>("/coins");
export const collectCoins = () => api<CollectResult>("/coins/collect", { method: "POST" });

export const getOutfits = () => api<OutfitList>("/outfits");
export const purchaseOutfit = (id: string) =>
  api<OutfitList>(`/outfits/${encodeURIComponent(id)}/purchase`, { method: "POST" });
export const equipOutfit = (outfitId: string | null) =>
  api<OutfitList>("/outfits/equipped", { method: "PUT", body: { outfitId } });

export const getReferral = () => api<Referral>("/referrals/me");
export const registerReferral = (code: string) =>
  api<ReferralResult>("/referrals", { method: "POST", body: { code } });
