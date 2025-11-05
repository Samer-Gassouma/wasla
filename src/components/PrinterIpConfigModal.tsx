import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { printerIpConfigService, PrinterIpConfig } from '@/services/printerIpConfigService';

interface PrinterIpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdate?: (config: PrinterIpConfig) => void;
}

export default function PrinterIpConfigModal({ isOpen, onClose, onConfigUpdate }: PrinterIpConfigModalProps) {
  const [config, setConfig] = useState<PrinterIpConfig>({ ip: '', port: 9100 });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; error?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<{ ip?: string; port?: string }>({});

  // Load configuration on component mount
  useEffect(() => {
    if (isOpen) {
      const currentConfig = printerIpConfigService.getConfig();
      setConfig(currentConfig);
      setIsEditing(false);
      setConnectionStatus(null);
      setErrors({});
    }
  }, [isOpen]);

  const handleSave = () => {
    // Validate inputs
    const newErrors: { ip?: string; port?: string } = {};
    
    if (!config.ip.trim()) {
      newErrors.ip = 'Adresse IP requise';
    } else if (!printerIpConfigService.isValidIp(config.ip)) {
      newErrors.ip = 'Format d\'adresse IP invalide';
    }
    
    if (!printerIpConfigService.isValidPort(config.port)) {
      newErrors.port = 'Port invalide (1-65535)';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      printerIpConfigService.saveConfig(config);
      setIsEditing(false);
      
      // Trigger custom event to notify other components
      window.dispatchEvent(new CustomEvent('printerConfigUpdated', { 
        detail: config 
      }));
      
      onConfigUpdate?.(config);
    }
  };

  const handleCancel = () => {
    const currentConfig = printerIpConfigService.getConfig();
    setConfig(currentConfig);
    setIsEditing(false);
    setConnectionStatus(null);
    setErrors({});
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      const result = await printerIpConfigService.testPrinterConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Test failed' 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleResetToDefault = () => {
    // Remove blocking confirm - just reset directly
    printerIpConfigService.resetToDefault();
    const defaultConfig = printerIpConfigService.getConfig();
    setConfig(defaultConfig);
    setIsEditing(false);
    setConnectionStatus(null);
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Configuration de l'IP de l'imprimante</h2>
            <Button variant="outline" onClick={onClose}>
              ✕ Fermer
            </Button>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="ip">Adresse IP de l'imprimante</Label>
                <Input
                  id="ip"
                  value={config.ip}
                  onChange={(e) => {
                    setConfig({...config, ip: e.target.value});
                    if (errors.ip) {
                      setErrors({...errors, ip: undefined});
                    }
                  }}
                  disabled={!isEditing}
                  placeholder="192.168.1.100"
                  className={errors.ip ? 'border-red-500' : ''}
                />
                {errors.ip && (
                  <p className="text-red-500 text-sm mt-1">{errors.ip}</p>
                )}
              </div>

              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={config.port}
                  onChange={(e) => {
                    setConfig({...config, port: parseInt(e.target.value) || 9100});
                    if (errors.port) {
                      setErrors({...errors, port: undefined});
                    }
                  }}
                  disabled={!isEditing}
                  min="1"
                  max="65535"
                  className={errors.port ? 'border-red-500' : ''}
                />
                {errors.port && (
                  <p className="text-red-500 text-sm mt-1">{errors.port}</p>
                )}
              </div>

              {/* Connection test */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <Label>Test de connexion</Label>
                  <Button 
                    onClick={handleTestConnection} 
                    disabled={testingConnection || !isEditing}
                    size="sm"
                  >
                    {testingConnection ? 'Test...' : 'Tester'}
                  </Button>
                </div>
                
                {connectionStatus && (
                  <div className={`p-2 rounded text-sm ${
                    connectionStatus.connected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {connectionStatus.connected 
                      ? '✓ Connexion réussie' 
                      : `✗ Échec: ${connectionStatus.error}`
                    }
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={handleResetToDefault}
                  size="sm"
                >
                  Réinitialiser
                </Button>
                
                <div className="flex space-x-2">
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} size="sm">
                      Modifier
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleSave} size="sm">
                        Sauvegarder
                      </Button>
                      <Button variant="outline" onClick={handleCancel} size="sm">
                        Annuler
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Configuration actuelle:</strong></p>
            <p>IP: {printerIpConfigService.getPrinterIp()}</p>
            <p>Port: {printerIpConfigService.getPrinterPort()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}