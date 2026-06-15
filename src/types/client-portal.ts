import type { ProjectTrackingLookupResponse } from "@/types/project-tracking";

export type ClientPortalProjectSummary = {
  id: string;
  currentTrackingLeadId: string | null;
  clientPortalUserId: string | null;
  clientName: string | null;
  companyName: string | null;
  displayName: string | null;
  flowType: "company_opening" | "existing_company";
  flowLabel: string;
  status: "active" | "completed" | "paused";
  statusLabel: string;
  updatedAt: string;
  trackingCode: string;
};

export type ClientPortalIdentity = {
  id: string;
  fullName: string;
  email: string | null;
};

export type ClientPortalOverviewResponse = {
  ok: true;
  client: ClientPortalIdentity;
  projects: ClientPortalProjectSummary[];
  referralsCount: number;
};

export type ClientPortalProjectResponse = {
  ok: true;
  client: ClientPortalIdentity;
  projects: ClientPortalProjectSummary[];
  activeProjectId: string | null;
  tracking: ProjectTrackingLookupResponse | null;
};

export type ClientPortalReferralStage = {
  key: string;
  label: string;
  description: string;
  isTerminal: boolean;
  isWon: boolean;
  isLost: boolean;
};

export type ClientPortalReferralTimelineStep = {
  key: string;
  label: string;
  description: string;
  status: "complete" | "current" | "upcoming";
};

export type ClientPortalReferralReward = {
  title: string;
  description: string;
  tone: "neutral" | "positive" | "muted";
};

export type ClientPortalReferralItem = {
  id: string;
  trackingToken: string;
  createdAt: string;
  updatedAt: string;
  referredCompanyOrPerson: string;
  referredContactName: string | null;
  currentStage: ClientPortalReferralStage;
  timeline: ClientPortalReferralTimelineStep[];
  reward: ClientPortalReferralReward;
};

export type ClientPortalReferralListResponse = {
  ok: true;
  client: ClientPortalIdentity;
  projects: ClientPortalProjectSummary[];
  activeProjectId: string | null;
  referrals: ClientPortalReferralItem[];
};

export type ClientPortalReferralSubmitResponse = {
  ok: true;
  duplicate?: boolean;
  lead_id: string;
  tracking_token: string;
  referred_company_or_person: string;
  referred_contact_name: string;
};

export type ClientPortalUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  access_status: string | null;
  is_active: boolean;
};

export type ClientPortalLinkResponse = {
  project_id: string | null;
  client_user: ClientPortalUser | null;
};
