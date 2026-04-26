import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';

const API_KEY_IOS = 'test_xldOopxcqijWSVcxYwaAdxnykjl';
const API_KEY_ANDROID = 'test_xldOopxcqijWSVcxYwaAdxnykjl';

export const ENTITLEMENT_ID = 'Fairführer Pro';

export function initializePurchases() {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
  Purchases.configure({ apiKey });
}

export async function identifyUser(userId: string) {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.error('[RevenueCat] identifyUser error:', e);
  }
}

export async function resetUser() {
  try {
    await Purchases.logOut();
  } catch (e) {
    console.error('[RevenueCat] resetUser error:', e);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.error('[RevenueCat] getCustomerInfo error:', e);
    return null;
  }
}

export function hasPro(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return ENTITLEMENT_ID in customerInfo.entitlements.active;
}
