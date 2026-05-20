// Leerer Stub für optionale Module (z. B. @opentelemetry/api), die in einigen
// Abhängigkeiten via dynamischem import() geladen werden. Hermes kann das
// dynamische import() nicht parsen, wenn das Modul nicht aufgelöst werden kann.
// Mit diesem Alias resolviert es zu einem leeren Objekt – die optionale
// Instrumentation wird stillschweigend übersprungen.
module.exports = {};
