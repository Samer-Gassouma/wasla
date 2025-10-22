import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface Station {
  id: string;
  name: string;
  description: string;
  destinations: string[];
}

export const AVAILABLE_STATIONS: Station[] = [
  {
    id: 'jammel',
    name: 'JAMMEL',
    description: 'Station de Jammel uniquement',
    destinations: ['JEMMAL']
  },
  {
    id: 'moknin-tboulba',
    name: 'MOKNIN + TBOULBA',
    description: 'Stations de Moknin et Tboulba',
    destinations: ['MOKNIN', 'TEBOULBA']
  },
  {
    id: 'kasra-hlele',
    name: 'KASRA HLELE',
    description: 'Station de Kasra Hlele uniquement',
    destinations: ['KSAR HLEL']
  },
  {
    id: 'all',
    name: 'TOUTES LES STATIONS',
    description: 'Voir toutes les stations disponibles',
    destinations: ['JEMMAL', 'MOKNIN', 'TEBOULBA', 'KSAR HLEL']
  }
];

interface StationSelectionModalProps {
  isOpen: boolean;
  onStationSelect: (station: Station) => void;
  onCancel?: () => void;
}

export default function StationSelectionModal({ 
  isOpen, 
  onStationSelect, 
  onCancel 
}: StationSelectionModalProps) {
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  const handleConfirm = () => {
    const selectedStation = AVAILABLE_STATIONS.find(station => station.id === selectedStationId);
    if (selectedStation) {
      onStationSelect(selectedStation);
    }
  };

  const handleCancel = () => {
    setSelectedStationId('');
    onCancel?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Sélection de la Station</h2>
            <Button variant="outline" onClick={handleCancel}>
              ✕ Fermer
            </Button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Veuillez sélectionner la station sur laquelle vous travaillez :
            </p>
            
            <RadioGroup value={selectedStationId} onValueChange={setSelectedStationId}>
              {AVAILABLE_STATIONS.map((station) => (
                <div key={station.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={station.id} id={station.id} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={station.id} className="font-medium cursor-pointer">
                      {station.name}
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {station.description}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      Destinations: {station.destinations.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedStationId}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}