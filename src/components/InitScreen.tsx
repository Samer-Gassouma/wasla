import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { healthAuth, healthBooking, healthQueue, healthWS } from "@/api/client";

type Props = { onReady: () => void };

export default function InitScreen({ onReady }: Props) {
  const [status, setStatus] = useState<Record<string, boolean | null>>({
    auth: null,
    queue: null,
    booking: null,
    ws: null,
  });
  const allOk = Object.values(status).every((v) => v === true);

  const checkAll = async () => {
    setStatus({ auth: null, queue: null, booking: null, ws: null });
    const [a, q, b, w] = await Promise.all([
      healthAuth().catch(() => ({ ok: false })),
      healthQueue().catch(() => ({ ok: false })),
      healthBooking().catch(() => ({ ok: false })),
      healthWS().catch(() => ({ ok: false })),
    ]);
    setStatus({ auth: a.ok, queue: q.ok, booking: b.ok, ws: w.ok });
  };

  useEffect(() => {
    checkAll();
  }, []);

  useEffect(() => {
    if (allOk) onReady();
  }, [allOk, onReady]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h2 className="text-xl font-semibold">Initialisation…</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">Auth:</span> {render(status.auth)}
          </li>
          <li>
            <span className="font-medium">File d'attente&nbsp;:</span> {render(status.queue)}
          </li>
          <li>
            <span className="font-medium">Réservations&nbsp;:</span> {render(status.booking)}
          </li>
          <li>
            <span className="font-medium">Hub WebSocket&nbsp;:</span> {render(status.ws)}
          </li>
        </ul>
        {!allOk && (
          <Button className="w-full" onClick={checkAll}>
            Réessayer
          </Button>
        )}
      </Card>
    </div>
  );
}

function render(v: boolean | null) {
  if (v === null) return <span className="text-muted-foreground">vérification…</span>;
  return v ? (
    <span className="text-green-600">ok</span>
  ) : (
    <span className="text-red-600">hors service</span>
  );
}


