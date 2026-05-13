// Skopiowane i dostosowane z fairfuhrer/types.ts
// Usunięte typy webowe (PayPal webhooks, Next.js specifics, CSSProperties itp.)

// ========================================
// PODSTAWOWE TYPY DLA MAP I LOKALIZACJI
// ========================================

export interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface Zertifizierung {
  id: string;
  name: string;
  imageUuid?: string;
  slug?: string;
}

export type Kategorie = Category;

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Place {
  id: number;
  Name: string;
  Adresse: string;
  Telefon?: string;
  Vollbeschreibung?: string;
  location: GeoJSONPoint;
  Kategorie: Category[];
  Hauptbild?: string;
  Titelbild?: string;
  Audio_Datei?: string;
  Audio?: string;
  Link_URL?: string;
  Link_Text?: string;
  Galerie_Bilder?: string[];
  Galerie?: string[];
  Zertifizierungen?: Zertifizierung[];
}

export type Orte = Place;

export type PanelState = "closed" | "opening" | "open" | "closing";
export type LoadingState = "idle" | "loading" | "success" | "error";

export type Coordinates = [longitude: number, latitude: number];

// ========================================
// TYPY DLA DIRECTUS API
// ========================================

export interface DirectusKategorie {
  id: number;
  Name: string;
  Farbe: string;
  Beschreibung?: string;
}

export interface DirectusOrteKategorie {
  id: number;
  Orte_id: number;
  Kategorie_id: DirectusKategorie;
}

export interface DirectusZertifizierungItem {
  Zertifizierungen_id: {
    id: string;
    Name: string;
    Image?: string;
    slug?: string;
  } | null;
}

export interface DirectusOrte {
  id: number;
  Name: string;
  Adresse: string;
  Telefon?: string;
  Vollbeschreibung?: string;
  location?: GeoJSONPoint;
  Kategorie?: DirectusOrteKategorie[];
  Hauptbild?: string;
  Titelbild?: string;
  Audio_Datei?: string;
  Audio?: string;
  Link_URL?: string;
  Link_Text?: string;
  Galerie_Bilder?: string[];
  Galerie?: { directus_files_id: string }[];
  Zertifizierungen?: DirectusZertifizierungItem[];
  Stadt?: string;
  Land?: string;
}

export interface DirectusEinstellungen {
  Logo?: string;
  Slogan?: string;
}

// ========================================
// TYPY DLA UŻYTKOWNIKA / AUTH
// ========================================

export type UserRole = "free" | "premium";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
}
