import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/apiAuth";

// Kategorie komercyjne — Sehenswertes (id=1) idzie przez Redaktion (pelny formularz).
// Reisender wybiera z tej listy przy sugestii komercyjnego pinu.
export const KATEGORIEN_KOMMERZIELL = [
  { id: 2, name: "Essen & Übernachten" },
  { id: 3, name: "Einkaufen" },
  { id: 5, name: "Engagement" },
  { id: 8, name: "Unternehmen" },
] as const;

export function useSubmitPlaceProposal(_user: User | null) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [kategorieId, setKategorieId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !address.trim() || !description.trim()) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    if (kategorieId === null) {
      setError("Bitte eine Kategorie wählen.");
      return;
    }
    setIsLoading(true);
    try {
      // apiFetch dodaje Authorization: Bearer <supabase_access_token>
      // Endpoint web `/api/ort-vorschlagen` bierze email/imie/nazwisko z sesji,
      // nigdy z body — anti-spoofing.
      const res = await apiFetch("/api/ort-vorschlagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          description: description.trim(),
          kategorie_id: kategorieId,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Bitte anmelden, um einen Ort vorzuschlagen.");
        } else {
          setError("Ein Fehler ist aufgetreten. Bitte erneut versuchen.");
        }
      } else {
        setSuccess(true);
        setName("");
        setAddress("");
        setDescription("");
        setKategorieId(null);
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte erneut versuchen.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    name,
    setName,
    address,
    setAddress,
    description,
    setDescription,
    kategorieId,
    setKategorieId,
    isLoading,
    error,
    success,
    handleSubmit,
  };
}
