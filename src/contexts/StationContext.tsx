import React, { createContext, useContext, useState, useEffect } from 'react';
import { Station, AVAILABLE_STATIONS } from '@/components/StationSelectionModal';
import StationSelectionModal from '@/components/StationSelectionModal';

interface StationContextType {
  selectedStation: Station | null;
  setSelectedStation: (station: Station | null) => void;
  isStationSelected: boolean;
  showStationSelection: boolean;
  setShowStationSelection: (show: boolean) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showStationSelection, setShowStationSelection] = useState(false);

  // Load station from localStorage on mount
  useEffect(() => {
    const savedStationId = localStorage.getItem('selected-station-id');
    if (savedStationId) {
      const station = AVAILABLE_STATIONS.find(s => s.id === savedStationId);
      if (station) {
        setSelectedStation(station);
      } else {
        // Invalid station ID, show selection
        setShowStationSelection(true);
      }
    } else {
      // No station selected, show selection
      setShowStationSelection(true);
    }
  }, []);

  // Save station to localStorage when it changes
  useEffect(() => {
    if (selectedStation) {
      localStorage.setItem('selected-station-id', selectedStation.id);
    } else {
      localStorage.removeItem('selected-station-id');
    }
  }, [selectedStation]);

  const handleStationSelect = (station: Station) => {
    setSelectedStation(station);
    setShowStationSelection(false);
  };

  const handleStationCancel = () => {
    // Don't allow canceling if no station is selected
    if (!selectedStation) {
      return;
    }
    setShowStationSelection(false);
  };

  const value: StationContextType = {
    selectedStation,
    setSelectedStation: (station) => {
      setSelectedStation(station);
      if (station) {
        setShowStationSelection(false);
      }
    },
    isStationSelected: !!selectedStation,
    showStationSelection,
    setShowStationSelection: (show) => {
      setShowStationSelection(show);
    }
  };

  return (
    <StationContext.Provider value={value}>
      {children}
      {showStationSelection && (
        <StationSelectionModal
          isOpen={showStationSelection}
          onStationSelect={handleStationSelect}
          onCancel={handleStationCancel}
        />
      )}
    </StationContext.Provider>
  );
}

export function useStation() {
  const context = useContext(StationContext);
  if (context === undefined) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return context;
}