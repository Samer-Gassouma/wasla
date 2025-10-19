import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { printerService, PrinterConfig, PrinterStatus } from '@/services/printerService';

interface PrinterConfigProps {
  onConfigUpdate?: (config: PrinterConfig) => void;
}

export default function PrinterConfigComponent({ onConfigUpdate }: PrinterConfigProps) {
  const [config, setConfig] = useState<PrinterConfig>({
    id: 'printer1',
    name: 'TM-T20X Thermal Printer',
    ip: '192.168.192.11',
    port: 9100,
    width: 48,
    timeout: 10000,
    model: 'TM-T20X',
    enabled: true,
    isDefault: true,
  });

  const [status, setStatus] = useState<PrinterStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load configuration on component mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedConfig = await printerService.getPrinterConfig();
      setConfig(loadedConfig);
      if (onConfigUpdate) {
        onConfigUpdate(loadedConfig);
      }
    } catch (err) {
      setError(`Échec du chargement de la configuration de l'imprimante : ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    try {
      const testStatus = await printerService.testPrinterConnection(config.id);
      setStatus(testStatus);
      if (testStatus.connected) {
        setSuccess('Test de connexion à l\'imprimante réussi !');
      } else {
        setError(`Échec de la connexion à l'imprimante : ${testStatus.error}`);
      }
    } catch (err) {
      setError(`Échec du test de connexion : ${err}`);
      setStatus({ connected: false, error: err as string });
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await printerService.updatePrinterConfig(config.id, config);
      setSuccess("Configuration de l'imprimante enregistrée avec succès !");
      if (onConfigUpdate) {
        onConfigUpdate(config);
      }
    } catch (err) {
      setError(`Échec de l'enregistrement de la configuration : ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof PrinterConfig, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
    setSuccess(null);
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
      
      await printerService.printBookingTicket(config.id, testTicketData);
      setSuccess('Test ticket printed successfully!');
    } catch (err) {
      setError(`Failed to print test ticket: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration de l'imprimante</h2>
          <p className="text-gray-600">Configurez les paramètres de votre imprimante thermique TM-T20X</p>
        </div>

        {/* Status Display */}
        <div className="mb-6 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Statut de connexion</h3>
              <div className={`flex items-center mt-1 ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-3 h-3 rounded-full mr-2 ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {status.connected ? 'Connecté' : 'Déconnecté'}
              </div>
              {status.error && (
                <p className="text-sm text-red-600 mt-1">{status.error}</p>
              )}
            </div>
            <Button
              onClick={testConnection}
              disabled={testing}
              variant="outline"
              size="sm"
            >
              {testing ? 'Test…' : 'Tester la connexion'}
            </Button>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'imprimante
              </label>
              <Input
                value={config.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nom de l'imprimante"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modèle
              </label>
              <Input
                value={config.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                placeholder="Modèle de l'imprimante"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse IP
              </label>
              <Input
                value={config.ip}
                onChange={(e) => handleInputChange('ip', e.target.value)}
                placeholder="192.168.192.11"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <Input
                type="number"
                value={config.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 9100)}
                placeholder="9100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Largeur du papier (caractères)
              </label>
              <Input
                type="number"
                value={config.width}
                onChange={(e) => handleInputChange('width', parseInt(e.target.value) || 48)}
                placeholder="48"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Délai d'attente (ms)
              </label>
              <Input
                type="number"
                value={config.timeout}
                onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 10000)}
                placeholder="10000"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Activer l'imprimante</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.isDefault}
                onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Imprimante par défaut</span>
            </label>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="mt-6 flex space-x-3">
          <Button
            onClick={saveConfig}
            disabled={saving || loading}
            className="flex-1"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
          </Button>
          <Button
            onClick={loadConfig}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Chargement…' : 'Recharger'}
          </Button>
          <Button
            onClick={printTestTicket}
            disabled={loading || !status.connected}
            variant="outline"
          >
            Imprimer un ticket de test
          </Button>
        </div>

        {/* Informations sur l'imprimante */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Informations de l'imprimante</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>IP actuelle&nbsp;:</strong> {config.ip}:{config.port}</p>
            <p><strong>Modèle&nbsp;:</strong> {config.model}</p>
            <p><strong>Largeur du papier&nbsp;:</strong> {config.width} caractères</p>
            <p><strong>Statut&nbsp;:</strong> {config.enabled ? 'Activée' : 'Désactivée'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}