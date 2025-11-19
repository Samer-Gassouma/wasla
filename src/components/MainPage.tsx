import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listQueue, listQueueSummaries, getStaffInfo, reorderQueue, deleteQueueEntry, changeDestination, transferSeats, getVehicleAuthorizedRoutes, searchVehicles, addVehicleToQueue, getVehicleDayPass, createBookingByQueueEntry, createBookingByDestination, cancelOneBookingByQueueEntry, listTodayTrips, printExitPassAndRemove, createGhostBooking, getGhostBookingCount, getAllDestinations, getTodayTripsCountByLicensePlate } from "@/api/client";
import { connectQueue } from "@/ws/client";
import { printerService, TicketData } from "@/services/printerService";
import { getTodayTripsCount } from "@/services/bookingService";
import PrinterStatusDisplay from "@/components/PrinterStatusDisplay";
import LatencyDisplay from "@/components/LatencyDisplay";
import { useStation } from "@/contexts/StationContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Summary = { destinationId: string; destinationName: string; totalVehicles: number; totalSeats: number; availableSeats: number; basePrice: number };
type QueueEntry = { 
  id: string; 
  vehicleId: string; 
  licensePlate: string; 
  availableSeats: number; 
  totalSeats: number; 
  queuePosition: number; 
  bookedSeats: number; 
  status?: string;
  // Day pass status fields
  hasDayPass?: boolean;
  dayPassStatus?: string; // "no_pass", "has_pass", "recent_pass"
  dayPassPurchasedAt?: string;
  hasTripsToday?: boolean;
};

// Day Pass Badge Component
function DayPassBadge({ entry }: { entry: QueueEntry }) {
  if (!entry.dayPassStatus) return null;

  const getBadgeConfig = () => {
    switch (entry.dayPassStatus) {
      case 'no_pass':
        return {
          text: 'Pas de pass',
          className: 'bg-red-100 text-red-800 border-red-200',
          icon: '❌'
        };
      case 'has_pass':
        return {
          text: 'Pass actif',
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: '✅'
        };
      case 'recent_pass':
        return {
          text: 'Nouveau',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: '🆕'
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </div>
  );
}

// Action Menu Component
function ActionMenu({ 
  entry,
  onRemove, 
  onTransferSeats, 
  onChangeDestination,
  onReprintDayPass,
  onPrintExitPassAndRemove
}: { 
  entry: QueueEntry;
  onRemove: () => void;
  onTransferSeats: () => void;
  onChangeDestination: () => void;
  onReprintDayPass: () => void;
  onPrintExitPassAndRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        title="Plus d'actions"
      >
        <div className="w-4 h-4 flex flex-col justify-center items-center">
          <div className="w-1 h-1 bg-gray-600 rounded-full mb-0.5"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full mb-0.5"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => {
                onRemove();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              🗑️ Retirer de la file
            </button>
            <button
              onClick={() => {
                onTransferSeats();
                setIsOpen(false);
              }}
              disabled={!(entry.availableSeats && entry.availableSeats > 0)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                !(entry.availableSeats && entry.availableSeats > 0)
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
              title={!(entry.availableSeats && entry.availableSeats > 0) ? 'Aucun siège disponible à transférer' : 'Transférer des sièges'}
            >
              🔄 Transférer des sièges
            </button>
            <button
              onClick={() => {
                onChangeDestination();
                setIsOpen(false);
              }}
              disabled={!(entry.availableSeats && entry.availableSeats > 0)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                !(entry.availableSeats && entry.availableSeats > 0)
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={!(entry.availableSeats && entry.availableSeats > 0) ? 'Impossible de changer de destination lorsque complet' : 'Changer de destination'}
            >
              Changer de destination
            </button>
            {entry.hasDayPass && (
              <button
                onClick={() => {
                  onReprintDayPass();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 transition-colors"
                title="Réimprimer le ticket pass journalier"
              >
                🎫 Réimprimer le pass jour
              </button>
            )}
          <button
            onClick={() => {
              onPrintExitPassAndRemove();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm transition-colors text-red-600 hover:bg-red-50"
            title="Imprimer sortie et retirer du queue"
          >
            Sortie & Retirer
          </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Transfer Seats Modal Component
function TransferSeatsModal({
  isOpen,
  onClose,
  fromEntry,
  seatsCount,
  onSeatsCountChange,
  searchQuery,
  onSearchChange,
  queue,
  onConfirmTransfer
}: {
  isOpen: boolean;
  onClose: () => void;
  fromEntry: QueueEntry | null;
  seatsCount: number;
  onSeatsCountChange: (count: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  queue: QueueEntry[];
  onConfirmTransfer: (toEntry: QueueEntry) => void;
}) {
  if (!isOpen || !fromEntry) return null;

  // Filter queue based on search query
  const filteredQueue = queue.filter(entry => 
    entry.id !== fromEntry.id && // Exclude the source vehicle
    entry.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transférer des sièges</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Source Vehicle Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Transfert depuis&nbsp;:</div>
            <div className="font-semibold">{fromEntry.licensePlate}</div>
            <div className="text-sm text-gray-500">
              Sièges disponibles&nbsp;: {fromEntry.availableSeats} / {fromEntry.totalSeats}
              {fromEntry.bookedSeats && fromEntry.bookedSeats > 0 && (
                <span className="text-orange-600 ml-2">({fromEntry.bookedSeats} réservés)</span>
              )}
            </div>
          </div>

          {/* Seats Count Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de sièges à transférer&nbsp;:
            </label>
            <Input
              type="number"
              min="1"
              // Limit to booked seats of the source vehicle
              max={fromEntry.bookedSeats ?? 0}
              value={seatsCount}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const max = fromEntry.bookedSeats ?? 0;
                const clamped = Math.max(1, Math.min(raw, max));
                onSeatsCountChange(clamped);
              }}
            />
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un Vehicule destinataire&nbsp;:
            </label>
            <Input
              type="text"
              placeholder="Rechercher par immatriculation..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Vehicle List */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Vehicules disponibles&nbsp;:</div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
              {filteredQueue.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'Aucun Vehicule ne correspond à votre recherche.' : 'Aucun autre Vehicule dans la file.'}
                </div>
              ) : (
                filteredQueue.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onConfirmTransfer(entry)}
                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{entry.licensePlate}</div>
                        <div className="text-sm text-gray-500">Position {entry.queuePosition}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">{entry.availableSeats} / {entry.totalSeats}</div>
                        <div className="text-xs text-gray-500">
                          {entry.bookedSeats && entry.bookedSeats > 0 ? `${entry.bookedSeats} réservés` : 'disponible'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Change Destination Modal Component
function ChangeDestinationModal({
  isOpen,
  onClose,
  fromEntry,
  authorizedStations,
  loadingStations,
  onConfirmChange
}: {
  isOpen: boolean;
  onClose: () => void;
  fromEntry: QueueEntry | null;
  authorizedStations: any[];
  loadingStations: boolean;
  onConfirmChange: (station: any) => void;
}) {
  if (!isOpen || !fromEntry) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Changer de destination</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Source Vehicle Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Vehicule à déplacer&nbsp;:</div>
            <div className="font-semibold">{fromEntry.licensePlate}</div>
            <div className="text-sm text-gray-500">Position actuelle&nbsp;: {fromEntry.queuePosition}</div>
          </div>

          {/* Authorized Stations */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Sélectionner une nouvelle destination&nbsp;:</div>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
              {loadingStations ? (
                <div className="p-4 text-center text-gray-500">
                  Chargement des stations autorisées…
                </div>
              ) : authorizedStations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Aucune station autorisée pour ce Vehicule.
                </div>
              ) : (
                authorizedStations.map((station) => (
                  <button
                    key={station.id}
                    onClick={() => onConfirmChange(station)}
                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{station.stationName}</div>
                        <div className="text-sm text-gray-500">
                          Priorité&nbsp;: {station.priority}
                          {station.isDefault && <span className="ml-2 text-blue-600 font-medium">(Par défaut)</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">ID Station</div>
                        <div className="text-xs text-gray-400">{station.stationId}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Vehicle Trips Count Modal Component
function VehicleTripsCountModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  count,
  loading,
  error,
  onSearch,
  suggestions,
  suggestionsLoading,
  onSelectVehicle
}: {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  count: number | null;
  loading: boolean;
  error: string | null;
  onSearch: () => void;
  suggestions: any[];
  suggestionsLoading: boolean;
  onSelectVehicle: (vehicle: any) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">🚗 Nombre de Trajets</h2>
              <p className="text-orange-100 mt-1">Recherchez le nombre de trajets d'un véhicule aujourd'hui</p>
            </div>
            <button
              onClick={onClose}
              className="text-orange-200 hover:text-white text-3xl transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Search Input */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-800 mb-3">
              Immatriculation du véhicule
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ex: 130 TUN 2221"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch();
                  }
                }}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                autoFocus
              />
            </div>
            
            {/* Vehicle Suggestions */}
            {query && suggestions.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
                  Suggestions ({suggestions.length})
                </div>
                {suggestions.map((vehicle) => {
                  if (!vehicle || !vehicle.licensePlate) return null;
                  
                  return (
                    <div
                      key={vehicle.id}
                      className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                      onClick={() => onSelectVehicle(vehicle)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{vehicle.licensePlate}</div>
                          {vehicle.capacity && (
                            <div className="text-sm text-gray-500">Capacité: {vehicle.capacity} sièges</div>
                          )}
                        </div>
                        <div className="text-orange-500 text-sm">Cliquer pour sélectionner</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {suggestionsLoading && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-600 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                  Recherche de véhicules...
                </div>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600 flex items-center">
                  <span className="mr-2">!</span>
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Search Button */}
          <Button
            onClick={onSearch}
            disabled={loading || !query.trim()}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Recherche...
              </span>
            ) : (
              'Rechercher'
            )}
          </Button>

          {/* Results */}
          {count !== null && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="text-center">
                <div className="text-4xl mb-2">🚗</div>
                <div className="text-lg font-semibold text-green-800 mb-1">
                  Véhicule: {query}
                </div>
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {count} trajet{count > 1 ? 's' : ''}
                </div>
                <div className="text-sm text-green-600">
                  effectué{count > 1 ? 's' : ''} aujourd'hui
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add Vehicle Modal Component
function AddVehicleModal({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchResults,
  loadingSearch,
  onSelectVehicle,
  selectedVehicle,
  authorizedStations,
  loadingStations,
  onConfirmAdd,
  queue,
  searchError,
  currentRoute
}: {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: any[];
  loadingSearch: boolean;
  onSelectVehicle: (vehicle: any) => void;
  selectedVehicle: any;
  authorizedStations: any[];
  loadingStations: boolean;
  onConfirmAdd: (station: any) => void;
  queue: QueueEntry[];
  searchError: string | null;
  currentRoute: Summary | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Robust focus management - ensure input is always focusable
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.disabled = false;
          inputRef.current.readOnly = false;
        }
      }, 100);
    }
  }, [isOpen]);

  // Additional effect to ensure input stays enabled
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const input = inputRef.current;
      input.disabled = false;
      input.readOnly = false;
    }
  }, [isOpen, searchQuery, loadingSearch]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Ajouter un Véhicule</h2>
              <p className="text-blue-100 mt-1">Recherchez et sélectionnez un véhicule pour l'ajouter à la file</p>
            </div>
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white text-3xl transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-800 mb-3">
              Rechercher par immatriculation
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Tapez l'immatriculation du véhicule..."
                value={searchQuery}
                onChange={(e) => {
                  // Ensure input stays enabled
                  e.target.disabled = false;
                  e.target.readOnly = false;
                  onSearchChange(e.target.value);
                }}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                autoFocus
                disabled={false}
                readOnly={false}
              />
              {loadingSearch && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
            
            {/* Search Error */}
            {searchError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600 flex items-center">
                  <span className="mr-2">!</span>
                  {searchError}
                </div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Résultats ({searchResults.length})
                </h3>
                {searchResults.length > 0 && (
                  <span className="text-sm text-gray-500">Cliquez sur un véhicule pour le sélectionner</span>
                )}
              </div>
              
              {loadingSearch ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <div className="text-gray-500 text-lg">Recherche en cours...</div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <div className="text-6xl mb-4">?</div>
                  <div className="text-xl font-medium text-gray-600 mb-2">Aucun véhicule trouvé</div>
                  <div className="text-gray-500">Vérifiez l'orthographe de l'immatriculation</div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {searchResults.map((vehicle) => {
                    // Safety check for vehicle data
                    if (!vehicle || !vehicle.id || !vehicle.licensePlate) {
                      return null;
                    }
                    
                    // Check if vehicle is already in queue
                    const queuedEntry = queue.find(entry => entry.vehicleId === vehicle.id);
                    
                    return (
                      <div
                        key={vehicle.id}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                          queuedEntry 
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                        onClick={() => !queuedEntry && onSelectVehicle(vehicle)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="text-xl font-bold text-gray-800">{vehicle.licensePlate}</div>
                              <div className="flex space-x-2">
                                <span className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full font-medium">
                                  {vehicle.capacity} sièges
                                </span>
                                {vehicle.isActive && (
                                  <span className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full font-medium">
                                    Actif
                                  </span>
                                )}
                                {vehicle.isAvailable && (
                                  <span className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                    Disponible
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {queuedEntry ? (
                              <div className="text-sm text-red-600 font-medium flex items-center">
                                <span className="mr-2">!</span>
                                Déjà en file à la position {queuedEntry.queuePosition} pour {currentRoute?.destinationName || 'cette destination'}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Cliquez pour sélectionner ce véhicule
                              </div>
                            )}
                          </div>
                          
                          {!queuedEntry && (
                            <div className="text-blue-500 text-2xl">
                              &gt;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected Vehicle Info */}
          {selectedVehicle && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">🚗</div>
                <div>
                  <div className="text-sm text-blue-600 font-medium mb-1">Véhicule sélectionné</div>
                  <div className="text-xl font-bold text-gray-800">{selectedVehicle.licensePlate}</div>
                  <div className="text-sm text-gray-600">Capacité: {selectedVehicle.capacity} sièges</div>
                </div>
              </div>
            </div>
          )}

          {/* Authorized Stations */}
          {selectedVehicle && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Choisir la destination</h3>
              
              {loadingStations ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <div className="text-gray-500">Chargement des destinations...</div>
                </div>
              ) : authorizedStations.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <div className="text-4xl mb-3">X</div>
                  <div className="text-gray-600">Aucune destination autorisée pour ce véhicule</div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {authorizedStations.map((station) => (
                    <button
                      key={station.id}
                      onClick={() => onConfirmAdd(station)}
                      className="p-4 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-lg font-semibold text-gray-800">{station.stationName}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Priorité: {station.priority}
                            {station.isDefault && (
                              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                                Par défaut
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">ID: {station.stationId}</div>
                          <div className="text-blue-500 text-xl">&gt;</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sortable Queue Item Component
function SortableQueueItem({ 
  entry, 
  index, 
  totalItems,
  onMoveUp, 
  onMoveDown,
  onRemove,
  onTransferSeats,
  onChangeDestination,
  onReprintDayPass,
  onPrintExitPassAndRemove,
  onSelectForBooking,
  isSelectedForBooking
}: { 
  entry: QueueEntry; 
  index: number; 
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onTransferSeats: () => void;
  onChangeDestination: () => void;
  onReprintDayPass: () => void;
  onPrintExitPassAndRemove: () => void;
  onSelectForBooking: () => void;
  isSelectedForBooking: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculate the actual position based on index (0-based) + 1
  const actualPosition = index + 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelectForBooking}
      className={`p-4 transition-all duration-200 cursor-pointer border-l-4 ${
        index === 0 ? 'border-l-blue-500 bg-blue-50' : 'border-l-transparent'
      } ${isSelectedForBooking ? 'bg-yellow-50 border-2 border-yellow-400 shadow-md' : 'hover:bg-gray-50'} ${
        isDragging ? 'shadow-lg scale-105 z-10' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Position Badge */}
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-colors duration-200 ${
            index === 0 
              ? 'bg-blue-500 text-white shadow-md' 
              : index === 1 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {actualPosition}
          </div>
          
          {/* Vehicle Info */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base text-gray-900 flex items-center space-x-2">
              <span className="truncate">{entry.licensePlate}</span>
              <DayPassBadge entry={entry} />
            </div>
            <div className="text-xs text-gray-500">
              {index === 0 ? '🚀 Prochain départ' : `Position ${actualPosition}`}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Seats Info */}
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <span className="text-lg font-bold text-green-600">{entry.availableSeats}</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-sm text-gray-500">{entry.totalSeats}</span>
            </div>
            <div className="text-xs text-gray-500">
              {entry.bookedSeats && entry.bookedSeats > 0 ? `${entry.bookedSeats} réservés` : 'disponible'}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-1">
            {/* Arrow Controls */}
            <div className="flex flex-col space-y-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                disabled={index === 0}
                className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                  index === 0 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title="Monter dans la file"
              >
                ^
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                disabled={index === totalItems - 1}
                className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                  index === totalItems - 1 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title="Descendre dans la file"
              >
                v
              </button>
            </div>
            
            {/* Drag Handle */}
            <div 
              {...attributes} 
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
              title="Glisser pour réorganiser"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-3 h-3 flex flex-col justify-center items-center">
                <div className="w-2 h-0.5 bg-gray-400 mb-0.5"></div>
                <div className="w-2 h-0.5 bg-gray-400 mb-0.5"></div>
                <div className="w-2 h-0.5 bg-gray-400"></div>
              </div>
            </div>

            {/* Action Menu */}
            <ActionMenu
              entry={entry}
              onRemove={onRemove}
              onTransferSeats={onTransferSeats}
              onChangeDestination={onChangeDestination}
              onReprintDayPass={onReprintDayPass}
              onPrintExitPassAndRemove={onPrintExitPassAndRemove}
            />
          </div>
        </div>
      </div>
      
      {isSelectedForBooking && (
        <div className="mt-2 text-xs text-yellow-600 font-medium flex items-center">
          <span className="mr-1">🎫</span>
          Sélectionné pour réservation
        </div>
      )}
    </div>
  );
}

export default function MainPage() {
  const { selectedStation, setShowStationSelection } = useStation();
  
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [allDestinations, setAllDestinations] = useState<Array<{ id: string; name: string; basePrice: number; isActive: boolean }>>([]);
  const [selected, setSelected] = useState<Summary | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [reorderSuccess, setReorderSuccess] = useState(false);
  
  // Transfer seats modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferFromEntry, setTransferFromEntry] = useState<QueueEntry | null>(null);
  const [transferSeatsCount, setTransferSeatsCount] = useState(1);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  
  // Change destination modal state
  const [changeDestModalOpen, setChangeDestModalOpen] = useState(false);
  const [changeDestFromEntry, setChangeDestFromEntry] = useState<QueueEntry | null>(null);
  const [authorizedStations, setAuthorizedStations] = useState<any[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  
  // Add vehicle modal state
  const [addVehicleModalOpen, setAddVehicleModalOpen] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [vehicleAuthorizedStations, setVehicleAuthorizedStations] = useState<any[]>([]);
  const [loadingVehicleStations, setLoadingVehicleStations] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Robust search control
  const vehicleSearchDebounceRef = useRef<number | null>(null);
  const latestSearchSeqRef = useRef(0);
  
  // Booking state
  const [selectedSeats, setSelectedSeats] = useState<number[]>([1]); // Default to 1 seat
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedVehicleForBooking, setSelectedVehicleForBooking] = useState<QueueEntry | null>(null);
  
  // Ghost booking state
  const [ghostBookingCounts, setGhostBookingCounts] = useState<Record<string, number>>({});
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [selectedGhostDestination, setSelectedGhostDestination] = useState<Summary | null>(null);
  
  // Vehicle trips count state
  const [showVehicleTripsModal, setShowVehicleTripsModal] = useState(false);
  const [vehicleTripsQuery, setVehicleTripsQuery] = useState('');
  const [vehicleTripsCount, setVehicleTripsCount] = useState<number | null>(null);
  const [vehicleTripsLoading, setVehicleTripsLoading] = useState(false);
  const [vehicleTripsError, setVehicleTripsError] = useState<string | null>(null);
  
  // Vehicle suggestions for trips count modal
  const [vehicleTripsSuggestions, setVehicleTripsSuggestions] = useState<any[]>([]);
  const [vehicleTripsSuggestionsLoading, setVehicleTripsSuggestionsLoading] = useState(false);
  const vehicleTripsSearchDebounceRef = useRef<number | null>(null);
  
  // Load ghost booking counts for all destinations
  const loadGhostBookingCounts = async () => {
    try {
      const counts: Record<string, number> = {};
      for (const summary of summaries) {
        try {
          const response = await getGhostBookingCount(summary.destinationId);
          counts[summary.destinationId] = response.data.count;
        } catch (error) {
          console.error(`Failed to load ghost count for ${summary.destinationId}:`, error);
          counts[summary.destinationId] = 0;
        }
      }
      setGhostBookingCounts(counts);
    } catch (error) {
      console.error('Failed to load ghost booking counts:', error);
    }
  };
  
  // Notification state (same as management-desktop)
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null)

  // Centralized refresh function for queue and destination lists
  const refreshQueueAndSummaries = async (destinationId?: string) => {
    setLoading(true);
    try {
      // Refresh queue data for the specified destination or current selected destination
      const targetDestinationId = destinationId || selected?.destinationId;
      if (targetDestinationId) {
        const response = await listQueue(targetDestinationId);
        const items = (response.data as any[]).map((e) => ({
          ...e,
          availableSeats: Number(e.availableSeats ?? 0),
          totalSeats: Number(e.totalSeats ?? 0),
          queuePosition: Number(e.queuePosition ?? 0),
          bookedSeats: Number(e.bookedSeats ?? 0),
          hasDayPass: e.hasDayPass ?? false,
          dayPassStatus: e.dayPassStatus ?? 'no_pass',
          dayPassPurchasedAt: e.dayPassPurchasedAt,
          hasTripsToday: e.hasTripsToday ?? false,
          status: e.status,
        })) as QueueEntry[];
        
        // Check if any vehicle is now fully booked (availableSeats === 0) and remove them
        const fullyBookedVehicles = items.filter(item => item.availableSeats === 0);
        
        if (fullyBookedVehicles.length > 0) {
          console.log('Found fully booked vehicles to remove:', fullyBookedVehicles.map(v => v.licensePlate));
          
          for (const vehicle of fullyBookedVehicles) {
            try {
              await deleteQueueEntry(targetDestinationId, vehicle.id);
              console.log('Fully booked vehicle removed from queue successfully:', vehicle.licensePlate);
              
              // Add notification for vehicle removal
              showNotification(`Le Vehicule ${vehicle.licensePlate} a été retiré de la file car il est maintenant complet.`, 'success');
            } catch (removeError) {
              console.error('Failed to remove fully booked vehicle from queue:', removeError);
            }
          }
          
          // Remove all fully booked vehicles from the local queue state
          const filteredItems = items.filter(item => item.availableSeats > 0);
          
          // Only update queue if this is the currently selected destination
          if (!destinationId || (selected && selected.destinationId === targetDestinationId)) {
            setQueue(filteredItems);
          }
        } else {
          // Only update queue if this is the currently selected destination
          if (!destinationId || (selected && selected.destinationId === targetDestinationId)) {
            setQueue(items);
          }
        }
      }
      
      // Always refresh queue summaries with station filtering and all destinations
      const stationId = selectedStation?.id || 'all';
      const [destinationsResponse, summariesResponse] = await Promise.all([
        getAllDestinations(),
        listQueueSummaries(stationId)
      ]);
      
      const allDests = destinationsResponse.data || [];
      const queueSummaries = summariesResponse.data || [];
      
      setAllDestinations(allDests);
      
      // Merge all destinations with queue data
      const mergedSummaries = allDests.map(dest => {
        const queueData = queueSummaries.find(q => q.destinationId === dest.id);
        return {
          destinationId: dest.id,
          destinationName: dest.name,
          totalVehicles: queueData?.totalVehicles || 0,
          totalSeats: queueData?.totalSeats || 0,
          availableSeats: queueData?.availableSeats || 0,
          basePrice: dest.basePrice
        };
      });
      
      setSummaries(mergedSummaries);
      
      console.log('Queue and summaries refreshed successfully');
    } catch (refreshError) {
      console.error('Failed to refresh queue and summaries:', refreshError);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection status
  const [wsConnected, setWsConnected] = useState(false);
  const [wsLatency, setWsLatency] = useState<number | undefined>(undefined);
  const wsClientRef = useRef<any>(null); // Use ref to persist WebSocket client

  // Trips archive modal state
  const [showTrips, setShowTrips] = useState(false);
  const [trips, setTrips] = useState<Array<{ id: string; licensePlate: string; destinationName: string; startTime: string }>>([]);
  const [tripsSearch, setTripsSearch] = useState('');
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Get staff info from JWT token or localStorage fallback
  const getStaffInfoLocal = () => {
    const jwtInfo = getStaffInfo();
    if (jwtInfo?.firstName && jwtInfo?.lastName) {
      return jwtInfo;
    }
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('staffInfo');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  };
  
  const staffInfo = getStaffInfoLocal();

  // Notification helper (same as management-desktop)
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // Keyboard shortcuts: F6 (open add vehicle), ESC (close add vehicle),
  // AZERTY letters to select destinations, Numpad 1-9 to set seat count, Space to confirm booking
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      const editable = el.getAttribute('contenteditable');
      return tag === 'input' || tag === 'textarea' || tag === 'select' || editable === '' || editable === 'true';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // F6: open Add Vehicle modal
      if (e.key === 'F6') {
        e.preventDefault();
        setAddVehicleModalOpen(true);
        return;
      }

      // ESC: close Add Vehicle modal if open
      if (e.key === 'Escape') {
        if (addVehicleModalOpen) {
          e.preventDefault();
          setAddVehicleModalOpen(false);
          return;
        }
      }

      // AZERTY keys to select destinations (A,Z,E,R,T,Y => indices 0..5)
      const azertyMap: Record<string, number> = { a: 0, z: 1, e: 2, r: 3, t: 4, y: 5 };
      const keyLower = e.key.toLowerCase();
      if (azertyMap[keyLower] !== undefined) {
        const idx = azertyMap[keyLower];
        if (summaries[idx]) {
          e.preventDefault();
          const s = summaries[idx];
          setSelected(s);
          setQueue([]);
          setSelectedVehicleForBooking(null);
          setSelectedSeats([]);
          saveSelectedVehicle(null);
          setLoading(false);
        }
        return;
      }

      // Numpad 1-9: set seat count (within availability)
      if (e.code && e.code.startsWith('Numpad')) {
        const digit = Number(e.key);
        if (!Number.isNaN(digit) && digit > 0 && digit < 10 && selected) {
          e.preventDefault();
          const available = selectedVehicleForBooking ? (selectedVehicleForBooking.availableSeats ?? 0) : (selected.availableSeats ?? 0);
          const seatCount = Math.min(digit, Math.max(0, available));
          if (seatCount > 0) {
            setSelectedSeats(Array.from({ length: seatCount }, (_, i) => i + 1));
          }
        }
        return;
      }

      // Space: confirm booking (works for both normal and ghost mode)
      if (e.code === 'Space' || e.key === ' ') {
        if (isGhostMode && selectedGhostDestination && selectedSeats.length > 0) {
          e.preventDefault();
          handleGhostBooking();
        } else if (selected && selectedSeats.length > 0) {
          e.preventDefault();
          handleConfirmBooking();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [addVehicleModalOpen, summaries, selected, selectedVehicleForBooking, selectedSeats, isGhostMode, selectedGhostDestination]);

  // Save selected vehicle to localStorage
  const saveSelectedVehicle = (vehicle: QueueEntry | null) => {
    if (vehicle) {
      localStorage.setItem('selectedVehicleForBooking', JSON.stringify({
        id: vehicle.id,
        vehicleId: vehicle.vehicleId,
        licensePlate: vehicle.licensePlate,
        queuePosition: vehicle.queuePosition
      }));
    } else {
      localStorage.removeItem('selectedVehicleForBooking');
    }
  };

  // Restore selected vehicle from localStorage
  const restoreSelectedVehicle = () => {
    try {
      const saved = localStorage.getItem('selectedVehicleForBooking');
      if (saved) {
        const savedVehicle = JSON.parse(saved);
        // Find the vehicle in the current queue by ID
        const currentVehicle = queue.find(v => v.id === savedVehicle.id);
        if (currentVehicle) {
          setSelectedVehicleForBooking(currentVehicle);
          console.log('Restored selected vehicle:', currentVehicle.licensePlate);
        } else {
          console.log('Vehicle not found in queue, keeping selection in localStorage');
        }
      }
    } catch (error) {
      console.error('Failed to restore selected vehicle:', error);
      localStorage.removeItem('selectedVehicleForBooking');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('staffInfo');
    localStorage.removeItem('selectedVehicleForBooking');
    window.location.reload();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && selected) {
      const oldIndex = queue.findIndex((item) => item.id === active.id);
      const newIndex = queue.findIndex((item) => item.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        await reorderQueueItems(oldIndex, newIndex);
      }
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index > 0 && selected) {
      await reorderQueueItems(index, index - 1);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index < queue.length - 1 && selected) {
      await reorderQueueItems(index, index + 1);
    }
  };

  const reorderQueueItems = async (oldIndex: number, newIndex: number) => {
    // Immediately update the UI with new positions
    const newQueue = arrayMove(queue, oldIndex, newIndex);
    // Update queue positions to reflect new order
    const updatedQueue = newQueue.map((item, index) => ({
      ...item,
      queuePosition: index + 1
    }));
    setQueue(updatedQueue);
    setReordering(true);

    try {
      // Send the new order to the backend
      const entryIds = updatedQueue.map(item => item.id);
      await reorderQueue(selected!.destinationId, entryIds);
      setReorderSuccess(true);
      // Clear success indicator after 2 seconds
      setTimeout(() => setReorderSuccess(false), 2000);
      
      // Automatically refresh queue and summaries after reordering
      await refreshQueueAndSummaries();
    } catch (error) {
      console.error('Failed to reorder queue:', error);
      // Revert the UI change on error
      setQueue(queue);
    } finally {
      setReordering(false);
    }
  };

  // Action handlers
  const handleRemoveFromQueue = async (entryId: string) => {
    if (!selected) return;
    
    const entry = queue.find(item => item.id === entryId);
    if (!entry) return;
    
    // Check if vehicle has booked seats (calculated from total - available)
    const bookedSeats = entry.totalSeats - entry.availableSeats;
    const hasBookedSeats = bookedSeats > 0;
    
    if (hasBookedSeats) {
      // Find the next vehicle in line
    const nextVehicle = queue.find(item => item.queuePosition === entry.queuePosition + 1);
    
    if (nextVehicle) {
      // Show notification about seat transfer instead of blocking confirm
      showNotification(`Ce véhicule a ${bookedSeats} sièges réservés. Les sièges seront transférés au véhicule suivant: ${nextVehicle.licensePlate}`, 'success');
    } else {
      // Show notification about no next vehicle instead of blocking confirm
      showNotification(`Ce véhicule a ${bookedSeats} sièges réservés. Il n'y a pas de véhicule suivant dans la file pour transférer les sièges.`, 'error');
    }
  }
    
    try {
      await deleteQueueEntry(selected.destinationId, entryId);
      
      // Immediately update the local queue state
      const updatedQueue = queue.filter(item => item.id !== entryId);
      setQueue(updatedQueue);
      
      // If queue is now empty, update the selected summary to show empty state
      if (updatedQueue.length === 0 && selected) {
        const updatedSelected = {
          ...selected,
          totalVehicles: 0,
          totalSeats: 0,
          availableSeats: 0
        };
        setSelected(updatedSelected);
        
        // Also update the summaries array
        setSummaries(prevSummaries => 
          prevSummaries.map(summary => 
            summary.destinationId === selected.destinationId 
              ? updatedSelected 
              : summary
          )
        );
      }
      
      // Check if queue is now empty and show appropriate notification
      if (updatedQueue.length === 0) {
        showNotification(`Le véhicule ${entry.licensePlate} a été retiré. La file ${selected.destinationName} est maintenant vide.`, 'success');
      } else {
        showNotification(`Le véhicule ${entry.licensePlate} a été retiré de la file ${selected.destinationName}.`, 'success');
      }
      
      // Then refresh summaries in the background
      await refreshQueueAndSummaries();
      
      console.log('Successfully removed from queue:', entryId);
    } catch (error) {
      console.error('Échec du retrait de la file :', error);
      showNotification('Échec du retrait du Vehicule de la file. Veuillez réessayer.', 'error');
    }
  };

  const handleTransferSeats = async (entryId: string) => {
    if (!selected) return;
    
    const entry = queue.find(item => item.id === entryId);
    if (!entry) return;
    
    // Open the transfer modal
    setTransferFromEntry(entry);
    setTransferSeatsCount(1);
    setTransferSearchQuery('');
    setTransferModalOpen(true);
  };

  const handlePrintExitPassAndRemove = async (entryId: string) => {
    if (!selected) return;
    const entry = queue.find(item => item.id === entryId);
    if (!entry) return;

    const bookedSeats = entry.bookedSeats ?? (entry.totalSeats - entry.availableSeats);
    
    // Allow printing exit pass even for empty vehicles (bookedSeats = 0)
    // Empty vehicles will be charged service fees instead of base price

    try {
      const printerId = "default"; // use configured/default printer id
      const total = bookedSeats > 0 ? bookedSeats * (selected.basePrice ?? 0) : 0.15 * entry.totalSeats;
      await printExitPassAndRemove(printerId, {
        queueEntryId: entry.id,
        licensePlate: entry.licensePlate,
        destinationName: selected.destinationName,
        bookedSeats,
        totalSeats: entry.totalSeats,
        basePrice: selected.basePrice ?? 0,
        createdBy: (staffInfo?.firstName || "") + (staffInfo?.lastName ? " " + staffInfo.lastName : ""),
        stationName: selected.destinationName,
        routeName: selected.destinationName,
        companyName: "Louaj Transport",
        staffFirstName: staffInfo?.firstName,
        staffLastName: staffInfo?.lastName,
      });

      // Immediately update the local queue state
      const updatedQueue = queue.filter(item => item.id !== entryId);
      setQueue(updatedQueue);
      
      // If queue is now empty, update the selected summary to show empty state
      if (updatedQueue.length === 0 && selected) {
        const updatedSelected = {
          ...selected,
          totalVehicles: 0,
          totalSeats: 0,
          availableSeats: 0
        };
        setSelected(updatedSelected);
        
        // Also update the summaries array
        setSummaries(prevSummaries => 
          prevSummaries.map(summary => 
            summary.destinationId === selected.destinationId 
              ? updatedSelected 
              : summary
          )
        );
      }
      
      // Check if queue is now empty after removal
      if (updatedQueue.length === 0) {
        showNotification(`Imprimé. Total ${total.toFixed(2)} TND. Véhicule retiré. La file ${selected.destinationName} est maintenant vide.`, 'success');
      } else {
        showNotification(`Imprimé. Total ${total.toFixed(2)} TND. Véhicule retiré de la file.`, 'success');
      }
      
      // Then refresh summaries in the background
      await refreshQueueAndSummaries();
    } catch (e) {
      console.error(e);
      showNotification("Échec de l'impression d'autorisation de sortie.", 'error');
    }
  };

  const handleConfirmTransfer = async (toEntry: QueueEntry) => {
    if (!selected || !transferFromEntry) return;
    
    try {
      // Validate requested seats do not exceed booked seats of source vehicle
      const maxTransferable = transferFromEntry.bookedSeats ?? 0;
      if (transferSeatsCount < 1 || transferSeatsCount > maxTransferable) {
        showNotification(`Vous ne pouvez transférer que jusqu'à ${maxTransferable} sièges réservés.`, 'error');
        return;
      }
      console.log('Transfer seats request:', {
        destinationId: selected.destinationId,
        fromEntryId: transferFromEntry.id,
        toEntryId: toEntry.id,
        seats: transferSeatsCount,
        fromEntry: transferFromEntry,
        toEntry: toEntry
      });
      
      await transferSeats(selected.destinationId, transferFromEntry.id, toEntry.id, transferSeatsCount);
      
      // Automatically refresh queue and summaries
      await refreshQueueAndSummaries();
      
      // Close modal
      setTransferModalOpen(false);
      setTransferFromEntry(null);
      
      showNotification(`Transfert réussi: ${transferSeatsCount} sièges de ${transferFromEntry.licensePlate} vers ${toEntry.licensePlate}`, 'success');
      console.log(`Successfully transferred ${transferSeatsCount} seats from ${transferFromEntry.licensePlate} to ${toEntry.licensePlate}`);
    } catch (error) {
      console.error('Failed to transfer seats:', error);
      showNotification('Échec du transfert des sièges. Veuillez réessayer.', 'error');
    }
  };

  const handleChangeDestination = async (entryId: string) => {
    if (!selected) return;
    
    const entry = queue.find(item => item.id === entryId);
    if (!entry) return;
    
    // Open the change destination modal
    setChangeDestFromEntry(entry);
    setAuthorizedStations([]);
    setChangeDestModalOpen(true);
    setLoadingStations(true);
    
    try {
      // Load authorized stations for this vehicle
      const response = await getVehicleAuthorizedRoutes(entry.vehicleId);
      setAuthorizedStations(response.data);
    } catch (error) {
      console.error('Failed to load authorized stations:', error);
      showNotification('Échec du chargement des stations autorisées. Veuillez réessayer.', 'error');
    } finally {
      setLoadingStations(false);
    }
  };

  const handleReprintDayPass = async (vehicleId: string) => {
    try {
      // Get day pass information for the vehicle
      const response = await getVehicleDayPass(vehicleId);
      
      if (!response.data) {
        showNotification("Ce Vehicule n'a pas de pass journalier valide à réimprimer.", 'error');
        return;
      }
      
      const dayPassData = response.data;
      
      // Day pass price is always 2.0 TND regardless of route price
      const dayPassPrice = 2.0;
      
      // Convert day pass data to ticket format
      const ticketData = {
        licensePlate: dayPassData.licensePlate,
        destinationName: dayPassData.destinationName,
        seatNumber: 1, // Day pass doesn't have specific seat
        totalAmount: dayPassPrice,
        createdBy: staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Agent',
        createdAt: new Date().toISOString(), // Use current time for reprint
        stationName: "Station", // Default station name
        routeName: dayPassData.destinationName,
      };
      
       // Print the day pass ticket
       await printerService.printDayPassTicket(ticketData);
      
      showNotification(`Ticket de pass journalier réimprimé pour ${dayPassData.licensePlate}`, 'success');
      
      // Refresh queue and summaries after reprinting day pass
      await refreshQueueAndSummaries();
      
    } catch (error) {
      console.error('Failed to reprint day pass:', error);
      showNotification(`Échec de la réimpression du pass journalier : ${error}`, 'error');
    }
  };

  // handlePrintExitPass removed in favor of print & remove flow

  const handlePrintExitPassForTrip = async (trip: any, tripIndex: number) => {
    try {
      console.log('Printing exit pass for trip:', trip);
      
      // Create exit pass ticket data for the trip
      const exitPassTicketData: TicketData = {
        licensePlate: trip.licensePlate,
        destinationName: trip.destinationName,
        seatNumber: trip.seatsBooked || 0, // Use seats booked for pricing calculation
        totalAmount: trip.seatsBooked && trip.basePrice ? trip.seatsBooked * trip.basePrice : 0,
        createdBy: staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Staff',
        createdAt: trip.startTime ? new Date(trip.startTime).toISOString() : new Date().toISOString(),
        stationName: 'Station',
        routeName: trip.destinationName,
        // Vehicle and pricing information
        vehicleCapacity: trip.vehicleCapacity,
        basePrice: trip.basePrice,
        // Exit pass count for today (use trip index + 1 for display)
        exitPassCount: tripIndex + 1,
      };
      
       // Print the exit pass ticket
       await printerService.printExitPassTicket(exitPassTicketData);
      
      showNotification(`Laissez-passer imprimé pour ${trip.licensePlate} (${trip.destinationName})`, 'success');
      
    } catch (error) {
      console.error('Failed to print exit pass for trip:', error);
      showNotification(`Échec de l'impression du laissez-passer de sortie : ${error}`, 'error');
    }
  };

  const handleConfirmChangeDestination = async (station: any) => {
    if (!selected || !changeDestFromEntry) return;
    
    try {
      await changeDestination(selected.destinationId, changeDestFromEntry.id, station.stationId, station.stationName);
      
      // Automatically refresh queue and summaries
      await refreshQueueAndSummaries();
      
      // Close modal
      setChangeDestModalOpen(false);
      setChangeDestFromEntry(null);
      
      showNotification(`${changeDestFromEntry.licensePlate} déplacé vers ${station.stationName}`, 'success');
      console.log(`Successfully moved ${changeDestFromEntry.licensePlate} to ${station.stationName}`);
    } catch (error) {
      console.error('Failed to change destination:', error);
      showNotification('Échec du changement de destination. Veuillez réessayer.', 'error');
    }
  };

  // Add vehicle handlers
  const handleVehicleSearch = async (query: string) => {
    // Always allow search, even with empty or single character queries
    if (query.length === 0) {
      setSearchResults([]);
      setSearchError(null);
      setLoadingSearch(false);
      return;
    }
    
    const seq = ++latestSearchSeqRef.current;
    setLoadingSearch(true);
    setSearchError(null);
    try {
      const response = await searchVehicles(query);
      // Ensure we have valid data
      if (seq !== latestSearchSeqRef.current) {
        // Obsolete response; ignore
        return;
      }
      if (response && (response as any).data && Array.isArray((response as any).data)) {
        setSearchResults((response as any).data);
        // If no results found, show a helpful message
        if ((response as any).data.length === 0) {
          setSearchError(null); // Clear any previous errors
        }
      } else {
        setSearchResults([]);
        setSearchError('Aucun Vehicule trouvé correspondant à votre recherche.');
      }
    } catch (error) {
      console.error('Échec de la recherche de Vehicules :', error);
      if (seq === latestSearchSeqRef.current) {
        setSearchResults([]);
        setSearchError('Échec de la recherche de Vehicules. Veuillez réessayer.');
      }
    } finally {
      if (seq === latestSearchSeqRef.current) {
        setLoadingSearch(false);
      }
    }
  };

  const handleSearchInputChange = (query: string) => {
    setVehicleSearchQuery(query);
    if (vehicleSearchDebounceRef.current) {
      window.clearTimeout(vehicleSearchDebounceRef.current);
    }
    vehicleSearchDebounceRef.current = window.setTimeout(() => {
      handleVehicleSearch(query);
    }, 300);
  };

  const handleSelectVehicle = async (vehicle: any) => {
    if (!vehicle || !vehicle.id) {
      console.error('Vehicule sélectionné non valide');
      return;
    }
    
    setSelectedVehicle(vehicle);
    setVehicleAuthorizedStations([]);
    setLoadingVehicleStations(true);
    
    try {
      const response = await getVehicleAuthorizedRoutes(vehicle.id);
      if (response && response.data && Array.isArray(response.data)) {
        setVehicleAuthorizedStations(response.data);
      } else {
        setVehicleAuthorizedStations([]);
        console.warn('Aucune station autorisée trouvée pour le Vehicule :', vehicle.licensePlate);
      }
    } catch (error) {
      console.error('Échec du chargement des stations autorisées :', error);
      setVehicleAuthorizedStations([]);
    } finally {
      setLoadingVehicleStations(false);
    }
  };

  const handleConfirmAddVehicle = async (station: any) => {
    if (!selectedVehicle) return;
    
    try {
      setLoadingVehicleStations(true);
      const response = await addVehicleToQueue(station.stationId, selectedVehicle.id, station.stationName);
      
      // Handle day pass status based on response
      if (response.data?.dayPassStatus === "created" && response.data?.dayPass) {
        // New day pass was created
        const dayPassData = response.data.dayPass;
        // Day pass price is always 2.0 TND regardless of route price
        const dayPassPrice = 2.0;
        const ticketData = {
          licensePlate: dayPassData.licensePlate,
          destinationName: dayPassData.destinationName,
          seatNumber: 1, // Day pass doesn't have specific seat
          totalAmount: dayPassPrice,
          createdBy: staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Agent',
          createdAt: dayPassData.purchaseDate,
          stationName: "Station", // Default station name
          routeName: dayPassData.destinationName,
        };
        
         // Print the day pass ticket automatically
         try {
           await printerService.printDayPassTicket(ticketData);
          showNotification(`Nouveau pass journalier créé et imprimé pour ${dayPassData.licensePlate}`, 'success');
        } catch (printError) {
          console.error('Échec de l\'impression du pass journalier :', printError);
          showNotification(`Le pass journalier a été créé mais l\'impression a échoué : ${printError}`, 'error');
        }
      } else if (response.data?.dayPassStatus === "valid" && response.data?.dayPassValid) {
        // Vehicle already has a valid day pass
        const dayPassData = response.data.dayPassValid;
        showNotification(`${dayPassData.licensePlate} ajouté à la file (possède déjà un pass valide)`, 'success');
      } else {
        // No day pass involved
        showNotification(`${selectedVehicle.licensePlate} ajouté à la file de ${station.stationName}`, 'success');
      }
      
      // Automatically refresh queue and summaries for the destination where vehicle was added
      await refreshQueueAndSummaries(station.stationId);
      
      // Close modal and reset state
      setAddVehicleModalOpen(false);
      setVehicleSearchQuery('');
      setSearchResults([]);
      setSelectedVehicle(null);
      setVehicleAuthorizedStations([]);
      
      console.log(`Successfully added ${selectedVehicle.licensePlate} to ${station.stationName} queue`);
    } catch (error) {
      console.error('Échec de l\'ajout du Vehicule à la file :', error);
      showNotification('Échec de l\'ajout du Vehicule à la file. Veuillez réessayer.', 'error');
    } finally {
      setLoadingVehicleStations(false);
    }
  };

  // Booking handlers
  const handleSeatCountSelect = (seatCount: number) => {
    // Create an array with seatCount number of elements (representing the number of seats to book)
    setSelectedSeats(Array.from({ length: seatCount }, (_, i) => i + 1));
  };

  const handleConfirmBooking = async () => {
    if (!selected || selectedSeats.length === 0) return;
    
    setBookingLoading(true);
    
    try {
      if (selectedVehicleForBooking) {
        // Booking with specific vehicle selected
        const response = await createBookingByQueueEntry({
          queueEntryId: selectedVehicleForBooking.id,
          seats: selectedSeats.length
        });
        console.log('Booking response:', response);
        const bookings = (response as any).data.bookings || [];
        const exitPass = (response as any).data?.exitPass;
        const hasExitPass = (response as any).data?.hasExitPass || false;
        console.log('Parsed booking data:', { bookings: bookings.length, exitPass: !!exitPass, hasExitPass });
        const vehicleLP = bookings[0]?.licensePlate || selectedVehicleForBooking.licensePlate;
        const bookedSeatsCount = bookings.length || selectedSeats.length;
        
        // Print talons for each booking (one per seat)
        if (bookings.length > 0) {
          try {
            for (const booking of bookings) {
              const ticketData: TicketData = {
                licensePlate: booking.licensePlate || selectedVehicleForBooking.licensePlate,
                destinationName: selected.destinationName,
                seatNumber: booking.seatNumber || 1, // Use actual seat number from backend
                totalAmount: booking.totalAmount,
                basePrice: selected.basePrice || 0, // Include base price for detailed pricing display
                createdBy: booking.createdByName || booking.createdBy || staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Staff', // Use staff name from backend
                createdAt: booking.createdAt,
                stationName: 'Station', // You might want to get this from context
                routeName: selected.destinationName,
              };
              
              // Immediately print a small talon with plate, seat index, date/time
              const talonData: TicketData = {
                licensePlate: ticketData.licensePlate,
                destinationName: ticketData.destinationName,
                seatNumber: ticketData.seatNumber,
                totalAmount: booking.totalAmount,
                basePrice: selected.basePrice || 0, // Add base price for talon
                createdBy: ticketData.createdBy,
                createdAt: booking.createdAt,
                stationName: '',
                routeName: '',
              };
              await printerService.printTalon(talonData);
            }
          } catch (printError) {
            console.error('Failed to print tickets:', printError);
            // Don't fail the booking if printing fails, just log the error
          }
        }
        
        // Print exit pass if vehicle is fully booked
        if (hasExitPass && exitPass) {
          console.log('Vehicle is fully booked, printing exit pass for:', exitPass.licensePlate);
          
          try {
            // Get current trip count for today for this specific destination (this will be the index for the new trip)
            const tripCountResponse = await getTodayTripsCount(exitPass.destinationId);
            const currentTripCount = tripCountResponse.data.count;
            
            const exitPassTicketData: TicketData = {
              licensePlate: exitPass.licensePlate,
              destinationName: exitPass.destinationName,
              seatNumber: 0, // Not applicable for exit pass
              totalAmount: exitPass.totalPrice,
              createdBy: exitPass.createdByName || exitPass.createdBy || 'Staff',
              createdAt: exitPass.createdAt,
              stationName: 'Station',
              routeName: exitPass.destinationName,
              // Vehicle and pricing information
              vehicleCapacity: exitPass.vehicleCapacity,
              basePrice: exitPass.basePrice,
              // Exit pass count for today (use current count + 1 as the new trip index)
              exitPassCount: currentTripCount + 1,
            };
            
            console.log('Printing exit pass:', exitPassTicketData);
            await printerService.printExitPassTicket(exitPassTicketData);
            console.log('Exit pass printed successfully');
            
            // Remove vehicle from queue after successful exit pass printing
            try {
              console.log('Removing vehicle from queue:', exitPass.queueId, 'destination:', exitPass.destinationId);
              await deleteQueueEntry(exitPass.destinationId, exitPass.queueId);
              console.log('Vehicle removed from queue successfully');
              
              // Refresh queue data to reflect the removal
              await refreshQueueAndSummaries();
            } catch (removeError) {
              console.error('Failed to remove vehicle from queue:', removeError);
              // Don't fail the booking if removal fails, just log the error
            }
          } catch (printError) {
            console.error('Failed to print exit pass:', printError);
            // Don't fail the booking if printing fails, just log the error
          }
        } else {
          console.log('No exit pass needed - vehicle not fully booked');
        }
        
        // Update notification message to include vehicle removal info
        let notificationMessage = `Réservation réussie: ${vehicleLP} - ${bookedSeatsCount} ticket${bookedSeatsCount === 1 ? '' : 's'} imprimé`;
        if (hasExitPass) {
          notificationMessage += ' + Laissez-passer imprimé + Vehicule retiré de la file';
        }
        
        showNotification(notificationMessage, 'success');
      } else {
        // Booking by destination only (no specific vehicle selected)
        console.log('Creating booking by destination:', selected.destinationId, 'seats:', selectedSeats.length);
        const response = await createBookingByDestination({
          destinationId: selected.destinationId,
          seats: selectedSeats.length,
          preferExactFit: true
        });
        const b: any = (response as any).data;
        
        // Print talon for auto-assigned booking
        if (b) {
          try {
            const ticketData: TicketData = {
              licensePlate: b.licensePlate || 'Attribué automatiquement',
              destinationName: selected.destinationName,
              seatNumber: 1,
              totalAmount: b.totalAmount || 0,
              createdBy: staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Agent',
              createdAt: b.createdAt || new Date().toISOString(),
              stationName: 'Station',
              routeName: selected.destinationName,
            };
            
            const talonData: TicketData = {
              licensePlate: ticketData.licensePlate,
              destinationName: ticketData.destinationName,
              seatNumber: ticketData.seatNumber,
              totalAmount: b.totalAmount || 0,
              createdBy: ticketData.createdBy,
              createdAt: b.createdAt || new Date().toISOString(),
              stationName: '',
              routeName: '',
            };
            await printerService.printTalon(talonData);
          } catch (printError) {
            console.error('Failed to print ticket:', printError);
          }
        }
        
        showNotification(`Réservation réussie: ${b?.licensePlate || 'Attribué automatiquement'} - ${selectedSeats.length} ticket${selectedSeats.length === 1 ? '' : 's'} imprimé`, 'success');
      }
      
      // Automatically refresh queue and summaries after booking completion
      await refreshQueueAndSummaries();
      
      // Clear selected seats; reset to default 1 seat
      setSelectedSeats([1]);
      
      console.log(`Successfully booked ${selectedSeats.length} seats for ${selectedVehicleForBooking?.licensePlate || 'auto-selected vehicle'} on route ${selected.destinationName}`);
    } catch (error) {
      console.error('Échec de la création de la réservation :', error);
      const message = (error as any)?.message || 'Échec de la création de la réservation. Veuillez réessayer.';
      showNotification(message, 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  // Load all destinations from routes table
  const loadAllDestinations = async () => {
    try {
      const response = await getAllDestinations();
      setAllDestinations(response.data || []);
    } catch (error) {
      console.error('Failed to load destinations:', error);
    }
  };

  // Ghost mode handlers
  const handleEnterGhostMode = async () => {
    setIsGhostMode(true);
    setSelectedGhostDestination(null);
    await loadAllDestinations();
  };

  const handleExitGhostMode = () => {
    setIsGhostMode(false);
    setSelectedGhostDestination(null);
  };

  const handleGhostDestinationSelect = (destination: { id: string; name: string; basePrice: number; isActive: boolean }) => {
    // Convert to Summary format for compatibility
    const summaryDestination: Summary = {
      destinationId: destination.id,
      destinationName: destination.name,
      totalVehicles: 0,
      totalSeats: 0,
      availableSeats: 0,
      basePrice: destination.basePrice
    };
    setSelectedGhostDestination(summaryDestination);
  };

  const handleGhostBooking = async () => {
    if (!selectedGhostDestination || selectedSeats.length === 0) return;
    
    setBookingLoading(true);
    
    try {
      console.log('Creating ghost booking for destination:', selectedGhostDestination.destinationId, 'seats:', selectedSeats.length);
      const response = await createGhostBooking(selectedGhostDestination.destinationId, selectedSeats.length);
      const ghostBooking = (response as any).data;
      
      // Print ghost talon
      if (ghostBooking) {
        try {
          const ticketData: TicketData = {
            licensePlate: 'N/A', // Ghost booking has no vehicle
            destinationName: selectedGhostDestination.destinationName,
            seatNumber: ghostBooking.seatNumber || 1,
            totalAmount: ghostBooking.totalAmount || 0,
            basePrice: selectedGhostDestination.basePrice || 0, // Include base price for pricing breakdown
            createdBy: ghostBooking.createdByName || 'Agent',
            createdAt: ghostBooking.createdAt || new Date().toISOString(),
            stationName: 'Station',
            routeName: selectedGhostDestination.destinationName,
          };
          
          // Print talon
          const talonData: TicketData = {
            licensePlate: 'N/A',
            destinationName: ticketData.destinationName,
            seatNumber: ticketData.seatNumber,
            totalAmount: ticketData.totalAmount, // Restore correct total amount
            basePrice: ticketData.basePrice, // Include base price for talon too
            createdBy: ticketData.createdBy,
            createdAt: ticketData.createdAt,
            stationName: '',
            routeName: '',
          };
          await printerService.printTalon(talonData);
        } catch (printError) {
          console.error('Failed to print ghost ticket:', printError);
        }
      }
      
      showNotification(`Réservation fantôme réussie: Ticket #${ghostBooking?.seatNumber || 1} imprimé pour ${selectedGhostDestination.destinationName}`, 'success');
      
      // Refresh ghost booking counts
      await loadGhostBookingCounts();
      
      // Reset to default 1 seat
      setSelectedSeats([1]);
      
      console.log(`Successfully created ghost booking for ${selectedSeats.length} seats on route ${selectedGhostDestination.destinationName}`);
    } catch (error) {
      console.error('Échec de la création de la réservation fantôme :', error);
      const message = (error as any)?.message || 'Échec de la création de la réservation fantôme. Veuillez réessayer.';
      showNotification(message, 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleGetVehicleTripsCount = async () => {
    if (!vehicleTripsQuery.trim()) {
      setVehicleTripsError('Veuillez saisir une immatriculation');
      return;
    }
    
    setVehicleTripsLoading(true);
    setVehicleTripsError(null);
    setVehicleTripsCount(null);
    
    try {
      const response = await getTodayTripsCountByLicensePlate(vehicleTripsQuery.trim());
      setVehicleTripsCount(response.data.count);
      
      showNotification(`Le véhicule ${vehicleTripsQuery.trim()} a effectué ${response.data.count} trajet${response.data.count > 1 ? 's' : ''} aujourd'hui`, 'success');
    } catch (error) {
      console.error('Failed to get vehicle trips count:', error);
      setVehicleTripsError('Échec de la recherche. Vérifiez l\'immatriculation.');
      showNotification('Impossible de récupérer le nombre de trajets pour cette immatriculation', 'error');
    } finally {
      setVehicleTripsLoading(false);
    }
  };

  const handleCloseVehicleTripsModal = () => {
    setShowVehicleTripsModal(false);
    setVehicleTripsQuery('');
    setVehicleTripsCount(null);
    setVehicleTripsError(null);
    setVehicleTripsSuggestions([]);
  };

  const handleSelectVehicleForTrips = (vehicle: any) => {
    if (!vehicle || !vehicle.licensePlate) {
      return;
    }
    setVehicleTripsQuery(vehicle.licensePlate);
    setVehicleTripsSuggestions([]); // Clear suggestions after selection
  };

  // Vehicle search for trips count modal suggestions
  const handleVehicleTripsSearch = async (query: string) => {
    if (query.length === 0) {
      setVehicleTripsSuggestions([]);
      setVehicleTripsSuggestionsLoading(false);
      return;
    }
    
    const seq = ++latestSearchSeqRef.current;
    setVehicleTripsSuggestionsLoading(true);
    try {
      const response = await searchVehicles(query);
      if (seq !== latestSearchSeqRef.current) {
        return;
      }
      if (response && (response as any).data && Array.isArray((response as any).data)) {
        setVehicleTripsSuggestions((response as any).data);
      } else {
        setVehicleTripsSuggestions([]);
      }
    } catch (error) {
      console.error('Vehicle search error:', error);
      setVehicleTripsSuggestions([]);
    } finally {
      if (seq === latestSearchSeqRef.current) {
        setVehicleTripsSuggestionsLoading(false);
      }
    }
  };

  const handleVehicleTripsInputChange = (query: string) => {
    setVehicleTripsQuery(query);
    setVehicleTripsCount(null); // Clear previous count when typing
    setVehicleTripsError(null); // Clear previous error
    
    if (vehicleTripsSearchDebounceRef.current) {
      window.clearTimeout(vehicleTripsSearchDebounceRef.current);
    }
    vehicleTripsSearchDebounceRef.current = window.setTimeout(() => {
      handleVehicleTripsSearch(query);
    }, 300);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const stationId = selectedStation?.id || 'all';
        
        // Load all destinations and queue summaries in parallel
        const [destinationsResponse, summariesResponse] = await Promise.all([
          getAllDestinations(),
          listQueueSummaries(stationId)
        ]);
        
        const allDests = destinationsResponse.data || [];
        const queueSummaries = summariesResponse.data || [];
        
        // Filter destinations based on selected station
        const stationDestinations = selectedStation?.destinations || ['JEMMAL', 'MOKNIN', 'TEBOULBA', 'KSAR HLEL'];
        const filteredDests = selectedStation?.id === 'all' 
          ? allDests 
          : allDests.filter(dest => stationDestinations.includes(dest.name));
        
        setAllDestinations(filteredDests);
        
        // Merge filtered destinations with queue data
        const mergedSummaries = filteredDests.map(dest => {
          const queueData = queueSummaries.find(q => q.destinationId === dest.id);
          return {
            destinationId: dest.id,
            destinationName: dest.name,
            totalVehicles: queueData?.totalVehicles || 0,
            totalSeats: queueData?.totalSeats || 0,
            availableSeats: queueData?.availableSeats || 0,
            basePrice: dest.basePrice
          };
        });
        
        setSummaries(mergedSummaries);
        
        // Auto-select first destination on app load to bring data/WS online immediately
        if (!selected && mergedSummaries.length > 0) {
          setSelected(mergedSummaries[0]);
        }
      } catch (err) {
        console.error('Failed to load destinations and summaries:', err);
      }
    };
    
    loadData();
  }, [selectedStation]);

  // Load ghost booking counts when summaries change
  useEffect(() => {
    if (summaries.length > 0) {
      loadGhostBookingCounts();
    }
  }, [summaries]);

  // Restore selected vehicle whenever queue changes
  useEffect(() => {
    if (queue.length > 0) {
      restoreSelectedVehicle();
    }
  }, [queue]);

  // Ensure default seat selection of 1 when booking section loads or selection is restored
  useEffect(() => {
    if (
      selectedVehicleForBooking &&
      selectedSeats.length === 0 &&
      (selectedVehicleForBooking.availableSeats ?? 0) > 0
    ) {
      setSelectedSeats([1]);
    }
  }, [selectedVehicleForBooking]);

  // Default seat selection when only destination is selected
  useEffect(() => {
    if (
      selected &&
      !selectedVehicleForBooking &&
      selectedSeats.length === 0 &&
      (selected.availableSeats ?? 0) > 0
    ) {
      setSelectedSeats([1]);
    }
  }, [selected]);

  // WebSocket connection effect
  useEffect(() => {
    if (!selected) {
      // Close existing connection if no destination selected
      if (wsClientRef.current) {
        wsClientRef.current.close();
        wsClientRef.current = null;
        setWsConnected(false);
        setWsLatency(undefined);
      }
      return;
    }

    // Close existing connection before creating new one
    if (wsClientRef.current) {
      wsClientRef.current.close();
      wsClientRef.current = null;
    }

    // Load initial queue data
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const r = await listQueue(selected.destinationId);
        const items = (r.data as any[]).map((e) => ({
          ...e,
          availableSeats: Number(e.availableSeats ?? 0),
          totalSeats: Number(e.totalSeats ?? 0),
          queuePosition: Number(e.queuePosition ?? 0),
          status: e.status,
          hasDayPass: e.hasDayPass ?? false,
          dayPassStatus: e.dayPassStatus ?? 'no_pass',
          dayPassPurchasedAt: e.dayPassPurchasedAt,
          hasTripsToday: e.hasTripsToday ?? false,
        })) as QueueEntry[];
        setQueue(items);
      } finally {
        setLoading(false);
      }
    };

    // Create WebSocket connection
    const wsCtrl = connectQueue(selected.destinationId, {
      onOpen: () => {
        console.log('WebSocket connected to', selected.destinationId);
        setWsConnected(true);
      },
      onClose: () => {
        console.log('WebSocket disconnected from', selected.destinationId);
        setWsConnected(false);
        setWsLatency(undefined);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
        setWsLatency(undefined);
      },
      onLatencyUpdate: (latency) => {
        setWsLatency(latency);
      },
      onConnectionStatus: (connected, latency) => {
        setWsConnected(connected);
        if (latency !== undefined) setWsLatency(latency);
      },
      onMessage: (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          console.log('WebSocket message received:', msg.type);
          
          if (msg.type && (msg.type.includes("queue_") || msg.type.includes("queue_entry"))) {
            if (msg.data?.queue) {
              const items = (msg.data.queue as any[]).map((e) => ({
                ...e,
                availableSeats: Number(e.availableSeats ?? 0),
                totalSeats: Number(e.totalSeats ?? 0),
                queuePosition: Number(e.queuePosition ?? 0),
                status: e.status,
                hasDayPass: e.hasDayPass ?? false,
                dayPassStatus: e.dayPassStatus ?? 'no_pass',
                dayPassPurchasedAt: e.dayPassPurchasedAt,
                hasTripsToday: e.hasTripsToday ?? false,
              })) as QueueEntry[];
              // Only update if we're not currently reordering to avoid conflicts
              if (!reordering) {
                setQueue(items);
              }
            } else if (msg.type === "queue_reordered" && !reordering) {
              // Handle queue reordered events from other clients
              listQueue(selected.destinationId).then((r) => {
                const items = (r.data as any[]).map((e) => ({
                  ...e,
                  availableSeats: Number(e.availableSeats ?? 0),
                  totalSeats: Number(e.totalSeats ?? 0),
                  queuePosition: Number(e.queuePosition ?? 0),
                  status: e.status,
                  hasDayPass: e.hasDayPass ?? false,
                  dayPassStatus: e.dayPassStatus ?? 'no_pass',
                  dayPassPurchasedAt: e.dayPassPurchasedAt,
                  hasTripsToday: e.hasTripsToday ?? false,
                })) as QueueEntry[];
                setQueue(items);
              }).catch(console.error);
            } else if (msg.type === "queue_entry_removed" && !reordering) {
              // Handle queue entry removal - check if destination should be removed
              if (msg.data?.queueEmpty === true) {
                console.log('Queue is now empty for destination:', msg.data.destinationId);
                // Refresh summaries to show empty destination (not remove it)
                const stationId = selectedStation?.id || 'all';
                
                // Load all destinations and queue summaries to maintain empty destinations
                Promise.all([
                  getAllDestinations(),
                  listQueueSummaries(stationId)
                ]).then(([destinationsResponse, summariesResponse]) => {
                  const allDests = destinationsResponse.data || [];
                  const queueSummaries = summariesResponse.data || [];
                  
                  setAllDestinations(allDests);
                  
                  // Merge all destinations with queue data
                  const mergedSummaries = allDests.map(dest => {
                    const queueData = queueSummaries.find(q => q.destinationId === dest.id);
                    return {
                      destinationId: dest.id,
                      destinationName: dest.name,
                      totalVehicles: queueData?.totalVehicles || 0,
                      totalSeats: queueData?.totalSeats || 0,
                      availableSeats: queueData?.availableSeats || 0,
                      basePrice: dest.basePrice
                    };
                  });
                  
                  setSummaries(mergedSummaries);
                  
                  // If the current destination is now empty, clear the queue
                  if (selected && selected.destinationId === msg.data.destinationId) {
                    setQueue([]);
                  }
                }).catch(console.error);
              } else {
                // For other queue events, refetch if not reordering
                listQueue(selected.destinationId).then((r) => {
                  const items = (r.data as any[]).map((e) => ({
                    ...e,
                    availableSeats: Number(e.availableSeats ?? 0),
                    totalSeats: Number(e.totalSeats ?? 0),
                    queuePosition: Number(e.queuePosition ?? 0),
                    status: e.status,
                    hasDayPass: e.hasDayPass ?? false,
                    dayPassStatus: e.dayPassStatus ?? 'no_pass',
                    dayPassPurchasedAt: e.dayPassPurchasedAt,
                    hasTripsToday: e.hasTripsToday ?? false,
                  })) as QueueEntry[];
                  setQueue(items);
                }).catch(console.error);
              }
            } else if (!reordering) {
              // For other queue events, refetch if not reordering
              listQueue(selected.destinationId).then((r) => {
                const items = (r.data as any[]).map((e) => ({
                  ...e,
                  availableSeats: Number(e.availableSeats ?? 0),
                  totalSeats: Number(e.totalSeats ?? 0),
                  queuePosition: Number(e.queuePosition ?? 0),
                  status: e.status,
                  hasDayPass: e.hasDayPass ?? false,
                  dayPassStatus: e.dayPassStatus ?? 'no_pass',
                  dayPassPurchasedAt: e.dayPassPurchasedAt,
                  hasTripsToday: e.hasTripsToday ?? false,
                })) as QueueEntry[];
                setQueue(items);
              }).catch(console.error);
            }
          }
          
          // Handle day pass creation events
          if (msg.type === "day_pass_created") {
            console.log("Day pass created:", msg.data);
            // Automatically print the day pass ticket
            if (msg.data) {
              const dayPassData = msg.data as any;
              // Day pass price is always 2.0 TND regardless of route price
              const dayPassPrice = 2.0;
              const ticketData = {
                licensePlate: dayPassData.licensePlate,
                destinationName: dayPassData.destinationName,
                seatNumber: 1, // Day pass doesn't have specific seat
                totalAmount: dayPassPrice,
                createdBy: staffInfo?.firstName + ' ' + staffInfo?.lastName || 'Agent',
                createdAt: dayPassData.purchaseDate,
                stationName: "Station", // Default station name
                routeName: dayPassData.destinationName,
              };
              
              // Print the day pass ticket automatically
              printerService.printDayPassTicket(ticketData)
                .then(() => {
                  console.log("Day pass ticket printed successfully");
                  showNotification(`Day pass ticket printed for ${dayPassData.licensePlate}`, 'success');
                })
                .catch((error) => {
                  console.error("Failed to print day pass ticket:", error);
                  showNotification(`Failed to print day pass ticket for ${dayPassData.licensePlate}: ${error}`, 'error');
                });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      },
    });

    // Store the client reference
    wsClientRef.current = wsCtrl;

    // Load initial data
    loadInitialData();

    // Cleanup function
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.close();
        wsClientRef.current = null;
      }
      setWsConnected(false);
      setWsLatency(undefined);
    };
  }, [selected?.destinationId]); // Only depend on destinationId, not the entire selected object

  return (
    <div className="w-full h-screen bg-gray-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center w-full flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="icons/logo.png" alt="Wasla" className="h-8 w-8 object-contain -translate-y-0.5" />
          <div className="w-1 h-6 bg-blue-500 -skew-x-12 opacity-60 rounded-full"></div>
          <img src="icons/ste.png" alt="STE Dhraiff Services Transport" className="h-8 w-8 object-contain rounded-full bg-white p-0.5 translate-y-0.5" />
        </div>
        <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-semibold">Files de station</h1>
            {selectedStation && (
              <div className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {selectedStation.name}
              </div>
            )}
        </div>
          <div className="flex-1 flex justify-end items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStationSelection(true)}
              title="Changer de station"
            >
              🏢 Station
            </Button>
            <PrinterStatusDisplay onConfigUpdate={() => {
              console.log('Printer config updated, refreshing status...');
              // The PrinterStatusDisplay will automatically refresh its own status
            }} />
            <LatencyDisplay connected={wsConnected} latency={wsLatency} compact={true} />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await refreshQueueAndSummaries();
                showNotification('Données de la file et destinations mises à jour.', 'success');
              } catch (e) {
                showNotification("Échec de l'actualisation.", 'error');
              }
            }}
          >
            Rafraîchir
          </Button>
          <Button 
            onClick={() => setAddVehicleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            + Ajouter un Vehicule
          </Button>
          {staffInfo && (
            <>
              <div className="font-medium">{staffInfo.firstName} {staffInfo.lastName}</div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Queue List (1/3 width) */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          {/* Queue Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">File des Véhicules</h2>
                {selected && (
                  <div className="text-sm text-gray-600 mt-1">
                    Destination: <span className="font-medium text-blue-600">{selected.destinationName}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {reordering && <span className="text-blue-500 text-sm">Réorganisation…</span>}
                {reorderSuccess && <span className="text-green-500 text-sm">Réorganisé !</span>}
              </div>
            </div>
          </div>

          {/* Queue Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  Chargement des véhicules…
                </div>
              </div>
            ) : queue.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">🚗</div>
                  <div className="text-xl font-medium mb-2 text-gray-600">
                    {selected ? `File ${selected.destinationName}` : 'Aucune destination sélectionnée'}
                  </div>
                  <div className="text-lg font-semibold mb-2 text-gray-400">Vide</div>
                  <div className="text-sm text-gray-500 mb-4">
                    {selected ? `Aucun véhicule dans la file pour ${selected.destinationName}` : 'Sélectionnez une destination pour voir les véhicules'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Utilisez le bouton "Ajouter un Véhicule" pour commencer
                  </div>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={(queue || []).map(item => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="divide-y divide-gray-100">
                    {(queue || []).map((entry, index) => (
                      <SortableQueueItem 
                        key={entry.id} 
                        entry={entry} 
                        index={index}
                        totalItems={(queue || []).length}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onRemove={() => handleRemoveFromQueue(entry.id)}
                        onTransferSeats={() => handleTransferSeats(entry.id)}
                        onChangeDestination={() => handleChangeDestination(entry.id)}
                        onSelectForBooking={() => {
                          // Toggle selection - if already selected, unselect it
                          if (selectedVehicleForBooking?.id === entry.id) {
                            setSelectedVehicleForBooking(null);
                            saveSelectedVehicle(null);
                            setSelectedSeats([]);
                          } else {
                            setSelectedVehicleForBooking(entry);
                            saveSelectedVehicle(entry);
                            // Default to 1 seat selected when booking section opens
                            setSelectedSeats([1]);
                          }
                        }}
                        onReprintDayPass={() => handleReprintDayPass(entry.vehicleId)}
                        onPrintExitPassAndRemove={() => handlePrintExitPassAndRemove(entry.id)}
                        isSelectedForBooking={selectedVehicleForBooking?.id === entry.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right Side - Routes and Booking (2/3 width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Routes Section */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Routes Section */}
            <div className="space-y-6">
              <div className="text-center">
                <h2 className={`text-2xl font-semibold mb-2 ${isGhostMode ? 'text-purple-700' : 'text-gray-800'}`}>
                  {isGhostMode ? 'Mode Fantôme - Destinations' : 'Destinations Disponibles'}
                </h2>
                <p className={`${isGhostMode ? 'text-purple-600' : 'text-gray-600'}`}>
                  {isGhostMode ? 'Choisissez une destination pour créer une réservation fantôme' : 'Sélectionnez une destination pour voir les véhicules en file'}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {isGhostMode ? (
                  // Ghost mode: show all destinations
                  allDestinations.map((dest) => {
                    const isSelected = selectedGhostDestination?.destinationId === dest.id;
                    
                    return (
                      <Card
                        key={dest.id}
                        className={`p-4 text-center cursor-pointer transition-all duration-200 relative hover:shadow-lg ${
                          isSelected
                            ? "bg-purple-50 border-purple-500 border-2 shadow-lg" 
                            : "hover:bg-purple-50 border-gray-200"
                        }`}
                        onClick={() => handleGhostDestinationSelect(dest)}
                      >
                        {/* Ghost booking count badge */}
                        {ghostBookingCounts[dest.id] > 0 && (
                          <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {ghostBookingCounts[dest.id]}
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-purple-800">{dest.name}</h3>
                        <div className="mt-3">
                          <p className={`text-2xl font-bold ${isSelected ? 'text-purple-600' : 'text-purple-500'}`}>{dest.basePrice.toFixed(2)}</p>
                          <span className="text-sm text-gray-500">TND</span>
                          <div className="text-xs text-gray-400 mt-1">
                            {dest.isActive ? 'Actif' : 'Inactif'}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  // Normal mode: show summaries
                  (summaries || []).map((s) => {
                    const isSelected = selected?.destinationId === s.destinationId;
                    
                    return (
                      <Card
                        key={s.destinationId}
                        className={`p-4 text-center cursor-pointer transition-all duration-200 relative hover:shadow-lg ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 border-2 shadow-lg" 
                            : "hover:bg-gray-50 border-gray-200"
                        }`}
                        onClick={() => {
                          setSelected(s);
                          // Clear queue and selected vehicle when switching routes
                          setQueue([]);
                          setSelectedVehicleForBooking(null);
                          setSelectedSeats([]);
                          saveSelectedVehicle(null);
                          setLoading(false); // Ensure loading state is cleared
                        }}
                      >
                        {/* Ghost booking count badge */}
                        {ghostBookingCounts[s.destinationId] > 0 && (
                          <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {ghostBookingCounts[s.destinationId]}
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-gray-800">{s.destinationName}</h3>
                        <div className="mt-3">
                          {s.totalVehicles > 0 ? (
                            <>
                              <p className="text-2xl font-bold text-blue-600">{s.availableSeats}</p>
                              <span className="text-sm text-gray-500">sièges disponibles</span>
                              <div className="text-xs text-gray-400 mt-1">
                                {s.totalVehicles} véhicule{s.totalVehicles > 1 ? 's' : ''} en file
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-4xl mb-2">🚗</div>
                              <p className="text-lg font-bold text-gray-400">Vide</p>
                              <span className="text-sm text-gray-500">Aucun véhicule</span>
                              <div className="text-xs text-gray-400 mt-1">
                                Cliquez pour ajouter
                              </div>
                            </>
                          )}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Global Actions */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex justify-end space-x-4">
              <Button
                className="bg-gray-700 hover:bg-gray-800 text-white"
                onClick={async () => {
                  setShowTrips(true);
                  setLoadingTrips(true);
                  try {
                    setTripsError(null);
                    console.log('Loading today\'s trips...');
                    const r = await listTodayTrips();
                    console.log('Trips API response:', r);
                    setTrips(Array.isArray(r.data) ? r.data : []);
                    console.log('Trips loaded:', Array.isArray(r.data) ? r.data.length : 0, 'trips');
                  } catch (error) {
                    console.error('Failed to load trips:', error);
                    setTripsError('Échec du chargement des trajets. Veuillez réessayer.');
                    setTrips([]);
                  } finally {
                    setLoadingTrips(false);
                  }
                }}
              >
                Voir les trajets d'aujourd'hui
              </Button>
              
              {/* Vehicle Trips Count Button */}
              <Button
                onClick={() => setShowVehicleTripsModal(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-2 rounded-xl shadow-lg"
              >
                🚗 Nombre de trajets
              </Button>
              
              {/* Ghost Mode Button */}
              {!isGhostMode ? (
                <Button
                  onClick={handleEnterGhostMode}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl shadow-lg"
                >
                  Mode Fantôme
                </Button>
              ) : (
                <Button
                  onClick={handleExitGhostMode}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-xl shadow-lg"
                >
                  Sortir du Mode Fantôme
                </Button>
              )}
            </div>
          </div>
          {/* Booking Section - Fixed at bottom of right panel */}
          {(selected || (isGhostMode && selectedGhostDestination)) && (
            <div className={`border-t ${isGhostMode ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50' : 'border-gray-200 bg-white'}`}>
              <div className="px-6 py-6">
                {/* Booking Section Header */}
                <div className="mb-6 text-center">
                  <h3 className={`text-xl font-semibold mb-2 ${isGhostMode ? 'text-purple-800' : 'text-gray-800'}`}>
                    {isGhostMode ? (
                      <>Réservation Fantôme pour {selectedGhostDestination?.destinationName}</>
                    ) : (
                      <>Réservation pour {selected?.destinationName}</>
                    )}
                  </h3>
                  <div className={`text-sm ${isGhostMode ? 'text-purple-600' : 'text-gray-600'}`}>
                    {isGhostMode ? (
                      <>Mode fantôme activé - <span className="font-medium text-purple-600">réservation sans véhicule</span></>
                    ) : selectedVehicleForBooking ? (
                      <>Véhicule sélectionné: <span className="font-medium text-blue-600">{selectedVehicleForBooking.licensePlate}</span></>
                    ) : (
                      <>Aucun véhicule sélectionné - <span className="font-medium text-green-600">attribution automatique</span></>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-8 items-end">
                  {/* Left: Seat Selection */}
                  <div className="flex-1">
                    <div className="text-center mb-4">
                      <h4 className={`text-lg font-medium mb-3 ${isGhostMode ? 'text-purple-700' : 'text-gray-700'}`}>Nombre de sièges</h4>
                      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((seatCount) => {
                          const availableSeatsForBooking = isGhostMode ? 8 : (selectedVehicleForBooking ? selectedVehicleForBooking.availableSeats : (selected?.availableSeats ?? 0));
                          const isDisabled = !isGhostMode && seatCount > availableSeatsForBooking;
                          const isSelected = selectedSeats.length === seatCount;

                          return (
                            <button
                              key={seatCount}
                              onClick={() => handleSeatCountSelect(seatCount)}
                              disabled={isDisabled}
                              className={`w-16 h-16 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                                isSelected
                                  ? isGhostMode 
                                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-700 text-white shadow-lg scale-105 ring-2 ring-purple-300'
                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-700 text-white shadow-lg scale-105 ring-2 ring-blue-300'
                                  : isDisabled
                                  ? 'bg-gradient-to-br from-gray-200 to-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-50'
                                  : isGhostMode
                                  ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 text-purple-700 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-100 hover:to-purple-200'
                                  : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100'
                              }`}
                            >
                              <div className="text-lg font-bold">{seatCount}</div>
                              <div className="text-xs opacity-75">
                                {seatCount === 1 ? 'Siège' : 'Sièges'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className={`text-sm mt-3 ${isGhostMode ? 'text-purple-500' : 'text-gray-500'}`}>
                        {isGhostMode ? (
                          <>Mode fantôme - <span className="font-medium">tous les sièges disponibles</span></>
                        ) : (
                          <>Sièges disponibles: {selectedVehicleForBooking ? selectedVehicleForBooking.availableSeats : (selected?.availableSeats ?? 0)}</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Booking Actions */}
                  <div className="w-80">
                    <div className="space-y-4">
                      {!isGhostMode && selectedVehicleForBooking && (
                        <Button
                          onClick={async () => {
                            if (!selectedVehicleForBooking) return;
                            setBookingLoading(true);
                            try {
                              await cancelOneBookingByQueueEntry({ queueEntryId: selectedVehicleForBooking.id });
                              showNotification(`1 siège annulé pour le véhicule ${selectedVehicleForBooking.licensePlate}`, 'success');
                              // Refresh queue and summaries
                              setLoading(true);
                              try {
                                const response = await listQueue(selected!.destinationId);
                                const items = (response.data as any[]).map((e) => ({
                                  ...e,
                                  availableSeats: Number(e.availableSeats ?? 0),
                                  totalSeats: Number(e.totalSeats ?? 0),
                                  queuePosition: Number(e.queuePosition ?? 0),
                                  bookedSeats: Number(e.bookedSeats ?? 0),
                                })) as QueueEntry[];
                                setQueue(items);
                                const summariesResponse = await listQueueSummaries();
                                setSummaries(summariesResponse.data || []);
                              } finally {
                                setLoading(false);
                              }
                            } catch (error) {
                              const message = (error as any)?.message || "Échec de l'annulation du siège.";
                              showNotification(message, 'error');
                            } finally {
                              setBookingLoading(false);
                            }
                          }}
                          disabled={bookingLoading}
                          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 text-sm font-semibold w-full rounded-xl shadow disabled:opacity-50"
                        >
                          Annuler 1 siège
                        </Button>
                      )}
                      
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-2 ${isGhostMode ? 'text-purple-800' : 'text-gray-800'}`}>
                          Total: {(selectedSeats.length * ((isGhostMode ? selectedGhostDestination?.basePrice : selected?.basePrice) || 0) + (selectedSeats.length * 0.15)).toFixed(2)} TND
                        </div>
                        <Button
                          onClick={isGhostMode ? handleGhostBooking : handleConfirmBooking}
                          disabled={bookingLoading || selectedSeats.length === 0}
                          className={isGhostMode 
                            ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-bold w-full rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 text-lg font-bold w-full rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          }
                        >
                          {bookingLoading ? (
                            <span className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              {isGhostMode ? 'Création...' : 'Traitement…'}
                            </span>
                          ) : isGhostMode ? (
                            `Créer Réservation Fantôme (${selectedSeats.length} siège${selectedSeats.length === 1 ? '' : 's'})`
                          ) : (
                            `Réserver ${selectedSeats.length} siège${selectedSeats.length === 1 ? '' : 's'}${selectedVehicleForBooking ? ` (${selectedVehicleForBooking.licensePlate})` : ' (auto-assigné)'}`
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Seats Modal */}
      <TransferSeatsModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        fromEntry={transferFromEntry}
        seatsCount={transferSeatsCount}
        onSeatsCountChange={setTransferSeatsCount}
        searchQuery={transferSearchQuery}
        onSearchChange={setTransferSearchQuery}
        queue={queue}
        onConfirmTransfer={handleConfirmTransfer}
      />

      {/* Change Destination Modal */}
      <ChangeDestinationModal
        isOpen={changeDestModalOpen}
        onClose={() => setChangeDestModalOpen(false)}
        fromEntry={changeDestFromEntry}
        authorizedStations={authorizedStations}
        loadingStations={loadingStations}
        onConfirmChange={handleConfirmChangeDestination}
      />

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={addVehicleModalOpen}
        onClose={() => {
          setAddVehicleModalOpen(false);
          setVehicleSearchQuery('');
          setSearchResults([]);
          setSelectedVehicle(null);
          setSearchError(null);
          setLoadingSearch(false);
        }}
        searchQuery={vehicleSearchQuery}
        onSearchChange={handleSearchInputChange}
        searchResults={searchResults}
        loadingSearch={loadingSearch}
        onSelectVehicle={handleSelectVehicle}
        selectedVehicle={selectedVehicle}
        authorizedStations={vehicleAuthorizedStations}
        loadingStations={loadingVehicleStations}
        onConfirmAdd={handleConfirmAddVehicle}
        queue={queue}
        searchError={searchError}
        currentRoute={selected}
      />

      {/* Vehicle Trips Count Modal */}
      <VehicleTripsCountModal
        isOpen={showVehicleTripsModal}
        onClose={handleCloseVehicleTripsModal}
        query={vehicleTripsQuery}
        onQueryChange={handleVehicleTripsInputChange}
        count={vehicleTripsCount}
        loading={vehicleTripsLoading}
        error={vehicleTripsError}
        onSearch={handleGetVehicleTripsCount}
        suggestions={vehicleTripsSuggestions}
        suggestionsLoading={vehicleTripsSuggestionsLoading}
        onSelectVehicle={handleSelectVehicleForTrips}
      />

      {/* Notification Toast (same as management-desktop) */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-md ${
            notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg flex-shrink-0">{notification.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-medium break-words">{notification.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Trips Archive Modal */}
      {showTrips && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Trajets d'aujourd'hui</h2>
                <button onClick={() => setShowTrips(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              <div className="mb-4 flex gap-2">
                <Input
                  type="text"
                  placeholder="Rechercher par immatriculation..."
                  value={tripsSearch}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setTripsSearch(val);
                    setLoadingTrips(true);
                    try {
                      setTripsError(null);
                      console.log('Searching trips with query:', val.trim());
                      const r = await listTodayTrips(val.trim());
                      console.log('Search trips API response:', r);
                      setTrips(Array.isArray(r.data) ? r.data : []);
                      console.log('Search trips loaded:', Array.isArray(r.data) ? r.data.length : 0, 'trips');
                    } catch (err) {
                      console.error('Failed to search trips:', err);
                      setTrips([]);
                      setTripsError('Échec du chargement des trajets. Veuillez réessayer.');
                    } finally {
                      setLoadingTrips(false);
                    }
                  }}
                  className="flex-1"
                />
              </div>
              {tripsError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{tripsError}</div>
              )}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                {loadingTrips ? (
                  <div className="p-4 text-center text-gray-500">Chargement des trajets…</div>
                ) : trips.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">Aucun trajet trouvé pour aujourd'hui.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {trips.map((t, index) => (
                      <div key={t.id} className="p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-semibold">{t.licensePlate}</div>
                          <div className="text-sm text-gray-500">{t.destinationName}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-600">
                            {(() => { try { return new Date(t.startTime || '').toLocaleTimeString(); } catch { return '—'; } })()}
                          </div>
                          <button
                            onClick={() => handlePrintExitPassForTrip(t, index)}
                            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Imprimer le laissez-passer pour ce Vehicule"
                          >
                            Imprimer laissez-passer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



