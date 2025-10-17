import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, setAuthToken } from "@/api/client";

type Props = { onLoggedIn: (token: string, staffInfo: { firstName: string; lastName: string }) => void };

export default function LoginScreen({ onLoggedIn }: Props) {
  const [cin, setCin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await login(cin.trim()) as any;
      const { token, staff } = response.data;
      try {
        localStorage.setItem("authToken", token);
        localStorage.setItem("staffInfo", JSON.stringify({
          firstName: staff.firstName,
          lastName: staff.lastName
        }));
      } catch {}
      setAuthToken(token);
      onLoggedIn(token, { firstName: staff.firstName, lastName: staff.lastName });
  } catch (e: any) {
      setError(e?.message || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100">
      <Card className="w-full max-w-sm p-6 space-y-5 shadow-xl">
        {/* Branding */}
        <div className="flex flex-col items-center select-none">
          <div className="flex items-center justify-center gap-4">
            {/* Wasla logo */}
            <img src="/icons/logo.png" alt="Wasla" className="w-20 h-20 object-contain -translate-y-1" />
            {/* Backslash accent */}
            <div className="w-1 h-10 bg-blue-500 -skew-x-12 opacity-60 rounded-full"></div>
            {/* STE logo (same size) */}
            <img src="/icons/ste.png" alt="STE Dhraiff Services Transport" className="w-20 h-20 object-contain rounded-full bg-white p-1 translate-y-1" />
          </div>
          <div className="mt-4 text-center">
            <div className="text-base font-semibold">Wasla</div>
            <div className="text-xs text-gray-600">STE Dhraiff Services Transport</div>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm text-gray-600 font-medium">CIN</label>
            <Input value={cin} onChange={(e) => setCin(e.target.value)} placeholder="Saisissez votre CIN" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button className="w-full" type="submit" disabled={loading || !cin.trim()}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <div className="text-[11px] text-center text-gray-500">
          Accès réservé au personnel autorisé.
        </div>
      </Card>
    </div>
  );
}


