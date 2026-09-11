export interface SetuAaConfig {
  clientId: string;
  clientSecret: string;
  productInstanceId: string;
  baseUrl: string;
  redirectUrl: string;
  mockMobile: string;
}

export const getSetuAaConfig = (): SetuAaConfig => ({
  clientId: process.env.SETU_AA_CLIENT_ID || "6f18a68c-059f-4e23-bfe1-cf36b16d6e57",
  clientSecret: process.env.SETU_AA_CLIENT_SECRET || "kQ2y5LL912RnRP3jnsVURvH5iM1MGNa8",
  productInstanceId:
    process.env.SETU_AA_PRODUCT_INSTANCE_ID || "55d2b944-262e-47c5-8ce0-87bf1365c3ea",
  baseUrl: process.env.SETU_AA_BASE_URL || "https://fiu-uat.setu.co",
  redirectUrl: process.env.SETU_AA_REDIRECT_URL || "https://wealthcompass.app/aa/callback",
  mockMobile: process.env.SETU_AA_MOCK_MOBILE || "9999999999",
});
