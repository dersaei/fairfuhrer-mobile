import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User, FunctionsHttpError } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react-native";
import { supabase } from "@/lib/supabase";
import {
  identifyUser,
  resetUser,
  getCustomerInfo,
  hasPro,
  setUserEmail,
  addCustomerInfoListener,
  syncPremiumToWeb,
} from "@/lib/revenuecat";
import { reconcileOfflineDataOwner } from "@/lib/offlineOwnership";

export interface Profile {
  id: string;
  role: "consumer" | "partner";
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  premium_until: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isPro: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPro: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isPro: false,
  isLoading: true,
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => {},
  refreshPro: async () => {},
});

// Natywne mosty (RevenueCat) i fetch potrafia zawisnac bez odrzucenia promise.
// Wtedy caly delete konczy sie cisza — zaden catch nie odpala, user widzi tylko
// znikajacy modal i konto zostaje. Kazdy krok dostaje wiec twardy limit czasu.
function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${ms} ms w kroku: ${step}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// functions.invoke zwraca blad jako obiekt, nie rzuca — a prawdziwy powod
// (status + body odpowiedzi Edge Function) siedzi dopiero w error.context.
async function describeFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    try {
      const body = await error.context.text();
      return `HTTP ${status}: ${body || "(puste body)"}`;
    } catch {
      return `HTTP ${status}`;
    }
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPro = async () => {
    const info = await getCustomerInfo();
    setIsPro(hasPro(info));
  };

  // Identify the user in RC and propagate the email as a subscriber attribute.
  // Nach dem Merge (Purchases.logIn) triggern wir zusätzlich einen Web-Sync,
  // damit ein Kauf, der zuvor anonym gemacht wurde, sich in Supabase
  // (profiles.premium_until) und damit auf der Website widerspiegelt.
  // Fire-and-forget: syncPremiumToWeb loggt Fehler selbst nach Sentry.
  const identifyAndAttachEmail = async (user: User) => {
    await identifyUser(user.id);
    await setUserEmail(user.email);
    void syncPremiumToWeb();
  };

  // Reactive RC customer info — premium toggles take effect without polling.
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    listenerCleanupRef.current = addCustomerInfoListener((info) => {
      setIsPro(hasPro(info));
    });
    return () => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Safety-net: bez tego apka mogla wisiec na splashu na zawsze, gdy
    // getSession / fetchProfile / RevenueCat init wisi (network hang).
    // isLoading zostawal true → _layout.tsx nie wywolal fetchAll →
    // dataReady zostawal false → native splash sie nie chowa.
    // Po 8s wymuszamy przejscie dalej — nawet jesli auth nie odpowiedzial.
    const forceReadyTimer = setTimeout(() => {
      setIsLoading((current) => {
        if (current) {
          Sentry.captureMessage("Auth init timeout (8s) — forcing isLoading=false", {
            level: "warning",
            tags: { feature: "auth-init" },
          });
        }
        return false;
      });
    }, 8000);

    // Premium-Status wird immer geprüft — auch für anonyme Nutzer ohne Konto,
    // da RevenueCat einen $RCAnonymousID vergibt und Käufe über Apple/Google
    // Store an das Gerät gebunden werden (Apple-Richtlinie 5.1.1(v): der Kauf
    // darf keine Registrierung erfordern).
    checkPro();

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          // Czyści dane offline, jeśli to inne konto niż poprzednio na tym
          // urządzeniu — zapobiega dziedziczeniu danych premium między kontami.
          await reconcileOfflineDataOwner(session.user.id);
          const [p] = await Promise.all([
            fetchProfile(session.user.id),
            identifyAndAttachEmail(session.user),
          ]);
          setProfile(p);
          await checkPro();
        }
      })
      .catch((err) => {
        Sentry.captureException(err, { tags: { feature: "auth-init" } });
      })
      .finally(() => {
        clearTimeout(forceReadyTimer);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        // Wykryj zmianę konta i w razie potrzeby wyczyść dane offline
        // poprzedniego konta przed załadowaniem danych nowego.
        await reconcileOfflineDataOwner(session.user.id);
        const [p] = await Promise.all([
          fetchProfile(session.user.id),
          identifyAndAttachEmail(session.user),
        ]);
        setProfile(p);
        await checkPro();
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        setIsPro(false);
        await resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    // Znaczniki przebiegu — w dev buildzie widoczne w konsoli Metro, na
    // produkcji jako breadcrumby przy zdarzeniu Sentry. Bez nich nie da sie
    // ustalic, na ktorym kroku usuwanie konta sie urywa.
    const mark = (step: string) => {
      console.log(`[delete-account] ${step}`);
      Sentry.addBreadcrumb({ category: "delete-account", message: step, level: "info" });
    };

    const fail = (reason: string): never => {
      mark(`FAIL: ${reason}`);
      Sentry.captureMessage(`delete-account: ${reason}`, {
        level: "error",
        tags: { feature: "delete-account" },
      });
      throw new Error(reason);
    };

    mark("start");

    let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
    try {
      result = await withTimeout(
        supabase.functions.invoke("delete-account"),
        20000,
        "functions.invoke",
      );
    } catch (e) {
      return fail(await describeFunctionsError(e));
    }
    mark("invoke done");

    if (result.error) return fail(await describeFunctionsError(result.error));

    // Dopiero po potwierdzonym usunieciu konta odpinamy RevenueCat. Wczesniej
    // bylo odwrotnie i nieudane usuniecie zostawialo usera odpietego od jego
    // uprawnien premium. Blad ani timeout na tym kroku nie moga juz zablokowac
    // wylogowania — konto w bazie i tak jest juz usuniete.
    try {
      await withTimeout(resetUser(), 10000, "revenuecat resetUser");
      mark("rc reset ok");
    } catch (e) {
      mark(`rc reset pominiety: ${e instanceof Error ? e.message : String(e)}`);
      Sentry.captureException(e, { tags: { feature: "delete-account" } });
    }

    await supabase.auth.signOut();
    mark("signed out");
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const p = await fetchProfile(session.user.id);
      setProfile(p);
    }
  };

  const refreshPro = async () => {
    await checkPro();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isPro,
        isLoading,
        signOut,
        deleteAccount,
        refreshProfile,
        refreshPro,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
