// Metro-Konfiguration für Expo.
// Erweitert die Standard-Konfiguration mit einem Alias, der @opentelemetry/api
// auf einen leeren Stub umleitet. Hintergrund: @supabase/supabase-js verwendet
// `import("@opentelemetry/api")` für optionale Instrumentation; Hermes (im
// Production-Bundling) kann dieses dynamische import() nicht parsen, wenn das
// Modul nicht installiert ist – der Build bricht ab. Mit diesem Alias liefert
// Metro stattdessen ein leeres Modul, die Instrumentation wird übersprungen.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const emptyModulePath = path.resolve(__dirname, "empty-module.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@opentelemetry/api") {
    return { type: "sourceFile", filePath: emptyModulePath };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
