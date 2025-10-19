import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { printerService, PrinterStatus, PrintQueueStatus } from '@/services/printerService';

interface PrinterStatusWidgetProps {
  printerId?: string;
  compact?: boolean;
}

export default function PrinterStatusWidget({ printerId = 'printer1', compact = false }: PrinterStatusWidgetProps) {
  const [status, setStatus] = useState<PrinterStatus>({ connected: false });
  const [queueStatus, setQueueStatus] = useState<PrintQueueStatus>({
    queueLength: 0,
    isProcessing: false,
    failedJobs: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh status every 30 seconds
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [printerId]);

  const refreshStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [printerStatus, queueStatus] = await Promise.all([
        printerService.testPrinterConnection(printerId),
        printerService.getPrintQueueStatus(),
      ]);
      setStatus(printerStatus);
      setQueueStatus(queueStatus);
    } catch (err) {
      setError(`Failed to refresh status: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const printTestTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const testTicketData = {
        licensePlate: 'TEST-123',
        destinationName: 'Test Destination',
        seatNumber: 1,
        totalAmount: 10.0,
        createdBy: 'Test User',
        createdAt: new Date().toISOString(),
        stationName: 'Test Station',
        routeName: 'Test Route',
      };
      
      await printerService.printBookingTicket(printerId, testTicketData);
    } catch (err) {
      setError(`Failed to print test ticket: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-sm text-gray-600">
          Imprimante {status.connected ? 'en ligne' : 'hors ligne'}
        </span>
        {queueStatus.queueLength > 0 && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            {queueStatus.queueLength} jobs
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Statut de l'imprimante</h3>
        <Button
          onClick={refreshStatus}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? 'Actualisation…' : 'Actualiser'}
        </Button>
      </div>

      <div className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Connexion</span>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
              {status.connected ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>
        </div>

        {/* Queue Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Longueur de file</span>
          <span className="text-sm font-medium text-gray-900">{queueStatus.queueLength}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Traitement</span>
          <span className={`text-sm font-medium ${queueStatus.isProcessing ? 'text-blue-600' : 'text-gray-600'}`}>
            {queueStatus.isProcessing ? 'Actif' : 'Inactif'}
          </span>
        </div>

        {queueStatus.failedJobs > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Tâches échouées</span>
            <span className="text-sm font-medium text-red-600">{queueStatus.failedJobs}</span>
          </div>
        )}

        {queueStatus.lastPrintedAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Dernière impression</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(queueStatus.lastPrintedAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex space-x-2">
        <Button
          onClick={printTestTicket}
          disabled={loading || !status.connected}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          Impression de test
        </Button>
      </div>
    </Card>
  );
}