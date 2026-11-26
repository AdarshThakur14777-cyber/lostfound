export type RootStackParamList = {
  Tabs: undefined;
  ItemDetail: { itemId: string };
  ClaimCreate: { itemId: string };
  ClaimDetail: { claimId: string };
  Notifications: undefined;
};

export type TabParamList = {
  Board: undefined;
  Report: undefined;
  Me: undefined;
  Staff?: undefined;
  Admin?: undefined;
};
