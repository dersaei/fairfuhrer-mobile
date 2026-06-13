// Wyłącza auto-link pakietu @react-native-google-signin/google-signin
// dla iOS. Pakiet zostaje w node_modules (Android go używa), ale CocoaPods
// nie wciąga go do iOS Pods. Bez tego AppCheckCore + Mapbox dynamic-framework
// kolidują w pod install (Expo SDK 55 precompiled modules + Mapbox forsuje
// dynamic linking).
//
// Na iOS używamy Sign in with Apple (wymóg Apple App Store) i email/hasło.
// Google Sign-In na iOS jest świadomie pominięty.
module.exports = {
  dependencies: {
    "@react-native-google-signin/google-signin": {
      platforms: {
        ios: null,
      },
    },
  },
};
