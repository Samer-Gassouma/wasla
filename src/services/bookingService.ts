// Booking service for API calls
const API_BASE_URL = 'http://localhost:8003/api/v1';

export interface BookingRequest {
  queueEntryId: string;
  seats: number;
}

export interface BookingResponse {
  data: {
    bookings: any[];
    exitPass?: any;
    hasExitPass: boolean;
  };
}

export interface TripCountResponse {
  data: {
    count: number;
  };
}

// Get authentication token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Make authenticated API request
const apiRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response;
};

// Create booking by queue entry
export const createBookingByQueueEntry = async (request: BookingRequest): Promise<BookingResponse> => {
  const response = await apiRequest(`${API_BASE_URL}/bookings/by-queue-entry`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
};

// Get today's trips count
export const getTodayTripsCount = async (destinationId?: string): Promise<TripCountResponse> => {
  const url = destinationId 
    ? `${API_BASE_URL}/trips/today/count?destination_id=${encodeURIComponent(destinationId)}`
    : `${API_BASE_URL}/trips/today/count`;
  const response = await apiRequest(url);
  return response.json();
};

// Get today's trips
export const getTodayTrips = async (search?: string): Promise<any> => {
  const url = search ? `${API_BASE_URL}/trips/today?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/trips/today`;
  const response = await apiRequest(url);
  return response.json();
};
