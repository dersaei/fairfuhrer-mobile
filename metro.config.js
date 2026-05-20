// Metro-Konfiguration für Expo.
//
// Deaktiviert `unstable_enablePackageExports`, weil Metros Package-Exports-
// Auflösung bei einigen Libraries (z. B. @supabase/supabase-js) den
// Node-spezifischen Eintrag wählt. Dieser enthält dynamische import()-Aufrufe
// mit Webpack-Kommentaren (`/* webpackIgnore: true */`), die Hermes beim
// Production-Bundling nicht parsen kann – der Build bricht ab mit:
//   "Invalid expression encountered ... otelModulePromise = import(...)"
//
// Mit dieser Einstellung greift Metro wieder auf den klassischen
// `main`/`react-native`-Eintrag zurück, der für React Native passt.
// Empfohlene Workaround aus expo/expo Discussion #36551.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

module.exports = config;
