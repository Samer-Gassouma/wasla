import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Clock } from 'lucide-react';

interface LatencyDisplayProps {
  connected: boolean;
  latency?: number;
  compact?: boolean;
}

export default function LatencyDisplay({ connected, latency, compact = false }: LatencyDisplayProps) {
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [avgLatency, setAvgLatency] = useState<number>(0);

  useEffect(() => {
    if (latency !== undefined && latency > 0) {
      setLatencyHistory(prev => {
        const newHistory = [...prev, latency].slice(-10); // Keep last 10 measurements
        const avg = newHistory.reduce((sum, l) => sum + l, 0) / newHistory.length;
        setAvgLatency(avg);
        return newHistory;
      });
    }
  }, [latency]);

  // kept for future styling needs
  // const getLatencyColor = (latency: number) => {
  //   if (latency < 50) return 'text-green-600';
  //   if (latency < 100) return 'text-yellow-600';
  //   if (latency < 200) return 'text-orange-600';
  //   return 'text-red-600';
  // };

  const getLatencyBadgeVariant = (latency: number) => {
    if (latency < 50) return 'default';
    if (latency < 100) return 'secondary';
    if (latency < 200) return 'outline';
    return 'destructive';
  };

  const getConnectionStatus = () => {
    if (!connected) return { text: 'Déconnecté', color: 'text-red-600', icon: WifiOff };
    if (latency === undefined) return { text: 'Connexion…', color: 'text-yellow-600', icon: Clock };
    return { text: 'Connecté', color: 'text-green-600', icon: Wifi };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <StatusIcon className={`h-4 w-4 ${status.color}`} />
        {connected && latency !== undefined && (
          <Badge variant={getLatencyBadgeVariant(latency)} className="text-xs">
            {Math.round(latency)}ms
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusIcon className={`h-5 w-5 ${status.color}`} />
          <span className={`font-medium ${status.color}`}>
            {status.text}
          </span>
        </div>
        
        {connected && latency !== undefined && (
          <div className="flex items-center space-x-2">
            <Badge variant={getLatencyBadgeVariant(latency)}>
              {Math.round(latency)}ms
            </Badge>
            {avgLatency > 0 && (
              <span className="text-xs text-gray-500">
                Moy.: {Math.round(avgLatency)}ms
              </span>
            )}
          </div>
        )}
      </div>
      
      {connected && latencyHistory.length > 1 && (
        <div className="mt-2">
          <div className="flex items-center space-x-1">
            {latencyHistory.slice(-5).map((l, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full ${
                  l < 50 ? 'bg-green-500' :
                  l < 100 ? 'bg-yellow-500' :
                  l < 200 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                title={`${Math.round(l)}ms`}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}