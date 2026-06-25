import { useState } from "react";
import { User } from "@supabase/supabase-js";

const API_URL = process.env.EXPO_PUBLIC_SITE_URL;

export function useSubmitPlaceProposal(user: User | null) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !address.trim() || !description.trim()) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ort-vorschlagen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          description: description.trim(),
          submitted_by: user?.email ?? null,
        }),
      });
      if (!res.ok) {
        setError("Ein Fehler ist aufgetreten. Bitte erneut versuchen.");
      } else {
        setSuccess(true);
        setName("");
        setAddress("");
        setDescription("");
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
    isLoading,
    error,
    success,
    handleSubmit,
  };
}
