import { useState, useEffect, useRef } from 'react';
import { PrinterStatus } from '@/services/printerService';
import { printerIpConfigService } from '@/services/printerIpConfigService';

interface PrinterStatusDisplayProps {
  onConfigUpdate?: () => void;
}

export default function PrinterStatusDisplay({ onConfigUpdate }: PrinterStatusDisplayProps) {
  const [status, setStatus] = useState<PrinterStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [currentIp, setCurrentIp] = useState('');
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load current printer configuration
  useEffect(() => {
    loadPrinterConfig();
  }, []);

  // Refresh status every 10 seconds
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [currentIp]);

  // Listen for printer config updates from other components
  useEffect(() => {
    const handleConfigUpdate = (e: CustomEvent) => {
      const newConfig = e.detail;
      if (newConfig && newConfig.ip !== currentIp) {
        setCurrentIp(newConfig.ip);
        // Refresh status with new IP
        setTimeout(refreshStatus, 500);
      }
    };

    window.addEventListener('printerConfigUpdated', handleConfigUpdate as EventListener);
    return () => window.removeEventListener('printerConfigUpdated', handleConfigUpdate as EventListener);
  }, [currentIp]);

  // F3 key handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'F3') {
        event.preventDefault();
        setShowIpModal(true);
        setNewIp(currentIp);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentIp]);

  const loadPrinterConfig = () => {
    try {
      const config = printerIpConfigService.getConfig();
      setCurrentIp(config.ip);
      setNewIp(config.ip);
    } catch (err) {
      console.error('Failed to load printer config:', err);
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const testStatus = await printerIpConfigService.testPrinterConnection();
      setStatus(testStatus);
    } catch (err) {
      setError(`Échec de la connexion : ${err}`);
      setStatus({ connected: false, error: err as string });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIp = async () => {
    if (!newIp.trim()) {
      setError("L'adresse IP ne peut pas être vide");
      return;
    }

    // Validate IP format
    if (!printerIpConfigService.isValidIp(newIp.trim())) {
      setError("Format d'adresse IP invalide");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update printer configuration
      printerIpConfigService.setPrinterIp(newIp.trim());
      
      setCurrentIp(newIp.trim());
      setSuccess("Adresse IP de l'imprimante mise à jour avec succès !");
      
      // Notify parent component of config update
      onConfigUpdate?.();
      
      // Test connection with new IP
      setTimeout(async () => {
        try {
          const testStatus = await printerIpConfigService.testPrinterConnection();
          setStatus(testStatus);
          if (testStatus.connected) {
            setSuccess("IP mise à jour et connexion réussie !");
          } else {
            setError(`IP mise à jour mais la connexion a échoué : ${testStatus.error}`);
          }
        } catch (err) {
          setError(`IP mise à jour mais le test de connexion a échoué : ${err}`);
        }
      }, 1000);

      // Close modal after a short delay
      setTimeout(() => {
        setShowIpModal(false);
        setSuccess(null);
        setError(null);
      }, 2000);

    } catch (err) {
      setError(`Échec de la mise à jour de l'IP de l'imprimante : ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleModalOpen = () => {
    setShowIpModal(true);
    setNewIp(currentIp);
    setError(null);
    setSuccess(null);
    // Focus input after modal opens
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 100);
  };

  const handleModalClose = () => {
    setShowIpModal(false);
    setError(null);
    setSuccess(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveIp();
    } else if (event.key === 'Escape') {
      handleModalClose();
    }
  };

  return (
    <>
      {/* Affichage de l'état de l'imprimante avec bouton de configuration intégré */}
      <div className="flex items-center space-x-2">
        <div 
          className={`w-3 h-3 rounded-full transition-colors ${
            status.connected ? 'bg-green-500' : 'bg-red-500'
          } ${loading ? 'animate-pulse' : ''}`}
          title={status.connected ? 'Imprimante connectée' : 'Imprimante déconnectée'}
        ></div>
        <span className="text-sm text-gray-600">
          Imprimante {status.connected ? 'en ligne' : 'hors ligne'}
        </span>
        {status.error && (
          <span className="text-xs text-red-500" title={status.error}>
            ⚠️
          </span>
        )}
        <span className="text-xs text-gray-500">IP: {currentIp}</span>
        <button
          onClick={handleModalOpen}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
          title="Configuration de l'IP de l'imprimante (F3)"
        >
          ⚙️ IP Imprimante
        </button>
      </div>

      {/* Fenêtre de configuration IP */}
      {showIpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Configuration de l'IP de l'imprimante</h2>
                <button
                  onClick={handleModalClose}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse IP de l'imprimante
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="192.168.192.11"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Appuyez sur Entrée pour enregistrer, Échap pour annuler
                </div>
              </div>

              {/* Messages d'erreur / de succès */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleModalClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveIp}
                  disabled={saving || !newIp.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>

              {/* Aide */}
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <div className="text-xs text-gray-600">
                  <div className="font-medium mb-1">Astuces :</div>
                  <div>• Appuyez sur <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">F3</kbd> pour ouvrir cette fenêtre</div>
                  <div>• Appuyez sur <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Entrée</kbd> pour enregistrer</div>
                  <div>• Appuyez sur <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Échap</kbd> pour annuler</div>
                  <div>• Port par défaut : 9100</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}