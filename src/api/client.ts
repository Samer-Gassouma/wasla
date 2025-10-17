export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

import { API } from "@/config";

let authToken: string | null = null;

// Initialize auth token from localStorage on module load (for refresh persistence)
if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem("authToken");
    if (saved) authToken = saved;
  } catch {}
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        window.localStorage.setItem("authToken", token);
      } else {
        window.localStorage.removeItem("authToken");
      }
    } catch {}
  }
}

export function getAuthToken() {
  return authToken;
}

export function getStaffInfo() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      staffId: payload.staff_id,
      firstName: payload.first_name || '',
      lastName: payload.last_name || '',
    };
  } catch {
    return null;
  }
}

async function request<T>(base: string, path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// Auth
export async function login(cin: string): Promise<{ data: { token: string; staff: { firstName: string; lastName: string } } }> {
  const r = await request<{ data: { token: string; staff: { firstName: string; lastName: string } } }>(API.auth, "/api/v1/auth/login", "POST", { cin });
  const token = r.data.token;
  setAuthToken(token);
  return r;
}

// Queue service
export async function listRoutes() {
  return request<{ data: Array<{ id: string; name: string; isActive?: boolean }> }>(API.queue, "/api/v1/routes");
}

export async function listVehicles() {
  return request<{ data: Array<{ id: string; licensePlate: string }> }>(API.queue, "/api/v1/vehicles");
}

export async function getVehicle(id: string) {
  return request<{ data: { id: string; licensePlate: string } }>(API.queue, `/api/v1/vehicles/${id}`);
}

export async function listQueue(destinationId: string) {
  return request<{ data: any[] }>(API.queue, `/api/v1/queue/${destinationId}`);
}

export async function listDayPasses() {
  return request<{ data: any[] }>(API.queue, "/api/v1/day-passes");
}

export async function listQueueSummaries() {
  return request<{ data: Array<{ destinationId: string; destinationName: string; totalVehicles: number; totalSeats: number; availableSeats: number; basePrice: number }> }>(API.queue, "/api/v1/queue-summaries");
}

export async function listRouteSummaries() {
  return request<{ data: Array<{ routeId: string; routeName: string; totalVehicles: number; totalSeats: number; availableSeats: number }> }>(API.queue, "/api/v1/route-summaries");
}

export async function reorderQueue(destinationId: string, entryIds: string[]) {
  return request<{ data: { entryIds: string[] } }>(API.queue, `/api/v1/queue/${destinationId}/reorder`, "PUT", { entryIds });
}

export async function deleteQueueEntry(destinationId: string, entryId: string) {
  return request<{ data: any }>(API.queue, `/api/v1/queue/${destinationId}/entry/${entryId}`, "DELETE");
}

export async function transferSeats(destinationId: string, fromEntryId: string, toEntryId: string, seats: number) {
  return request<{ data: any }>(API.queue, `/api/v1/queue/${destinationId}/transfer-seats`, "POST", { 
    fromEntryId, 
    toEntryId, 
    seats 
  });
}

export async function changeDestination(destinationId: string, entryId: string, newDestinationId: string, newDestinationName: string) {
  return request<{ data: any }>(API.queue, `/api/v1/queue/${destinationId}/entry/${entryId}/change-destination`, "PUT", {
    newDestinationId,
    newDestinationName
  });
}

export async function getVehicleAuthorizedRoutes(vehicleId: string) {
  return request<{ data: Array<{ id: string; stationId: string; stationName: string; priority: number; isDefault: boolean }> }>(API.queue, `/api/v1/vehicles/${vehicleId}/authorized-routes`);
}

export async function searchVehicles(query: string) {
  return request<{ data: Array<{ id: string; licensePlate: string; capacity: number; isActive: boolean; isAvailable: boolean }> }>(API.queue, `/api/v1/vehicles?search=${encodeURIComponent(query)}`);
}

export async function addVehicleToQueue(destinationId: string, vehicleId: string, destinationName: string) {
  return request<{ 
    data: { 
      queueEntry: any; 
      dayPass?: any;
      dayPassValid?: any;
      dayPassStatus: string;
    } 
  }>(API.queue, `/api/v1/queue/${destinationId}`, "POST", {
    vehicleId,
    destinationId,
    destinationName
  });
}

export async function getVehicleDayPass(vehicleId: string) {
  return request<{ data: any }>(API.queue, `/api/v1/day-pass/vehicle/${vehicleId}`);
}

export async function createBookingByDestination(payload: { destinationId: string; seats: number; subRoute?: string; preferExactFit?: boolean }) {
  return request<{ data: any }>(API.booking, "/api/v1/bookings", "POST", payload);
}

export async function createBookingByQueueEntry(payload: { queueEntryId: string; seats: number }) {
  return request<{ data: { 
    bookings: Array<{ 
      id: string; 
      queueId: string; 
      vehicleId: string; 
      licensePlate: string; 
      seatsBooked: number; 
      seatNumber: number; 
      totalAmount: number; 
      bookingStatus: string; 
      paymentStatus: string; 
      verificationCode: string; 
      createdBy: string; 
      createdByName: string; 
      createdAt: string 
    }>;
    exitPass?: {
      id: string;
      queueId: string;
      vehicleId: string;
      licensePlate: string;
      destinationId: string;
      destinationName: string;
      previousVehicles: Array<{
        licensePlate: string;
        exitTime: string;
      }>;
      currentExitTime: string;
      totalPrice: number;
      createdBy: string;
      createdByName: string;
      createdAt: string;
    };
    hasExitPass: boolean;
  } }>(API.booking, "/api/v1/bookings/by-queue-entry", "POST", payload);
}

// Booking service

export async function cancelBooking(id: string) {
  return request<{ data: any }>(API.booking, `/api/v1/bookings/${id}/cancel`, "PUT");
}

export async function cancelOneBookingByQueueEntry(payload: { queueEntryId: string }) {
  return request<{ data: { id: string } }>(API.booking, "/api/v1/bookings/cancel-one-by-queue-entry", "POST", payload);
}

export async function listTrips() {
  return request<{ data: any[] }>(API.booking, "/api/v1/trips");
}

export async function listTodayTrips(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<{ data: Array<{ id: string; licensePlate: string; destinationName: string; startTime: string }> }>(API.booking, `/api/v1/trips/today${qs}`);
}

export async function healthAuth() {
  return fetch(`${API.auth}/health`).then((r) => ({ ok: r.ok }));
}
export async function healthQueue() {
  return fetch(`${API.queue}/health`).then((r) => ({ ok: r.ok }));
}
export async function healthBooking() {
  return fetch(`${API.booking}/health`).then((r) => ({ ok: r.ok }));
}
export async function healthWS() {
  return fetch(`${API.ws.replace('ws', 'http')}/health`).then((r) => ({ ok: r.ok }));
}
