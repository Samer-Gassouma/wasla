import { API } from '../config';
import { printerIpConfigService, PrinterIpConfig } from './printerIpConfigService';

// Printer configuration interface
export interface PrinterConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  width: number;
  timeout: number;
  model: string;
  enabled: boolean;
  isDefault: boolean;
}

// Print job interface
export interface PrintJob {
  content: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  size?: 'normal' | 'double_height' | 'double_width' | 'quad';
  cut?: boolean;
  openCashDrawer?: boolean;
}

// Printer status interface
export interface PrinterStatus {
  connected: boolean;
  error?: string;
}

// Print job type enum
export enum PrintJobType {
  BOOKING_TICKET = 'booking_ticket',
  ENTRY_TICKET = 'entry_ticket',
  EXIT_TICKET = 'exit_ticket',
  DAY_PASS_TICKET = 'day_pass_ticket',
  EXIT_PASS_TICKET = 'exit_pass_ticket',
  TALON = 'talon',
  STANDARD_TICKET = 'standard_ticket',
  RECEIPT = 'receipt',
  QR_CODE = 'qr_code'
}

// Queued print job interface
export interface QueuedPrintJob {
  id: string;
  jobType: PrintJobType;
  content: string;
  staffName?: string;
  priority: number;
  createdAt: string;
  retryCount: number;
}

// Print queue status interface
export interface PrintQueueStatus {
  queueLength: number;
  isProcessing: boolean;
  lastPrintedAt?: string;
  failedJobs: number;
}

// Ticket data interface
export interface TicketData {
  licensePlate: string;
  destinationName: string;
  seatNumber: number;
  totalAmount: number;
  createdBy: string;
  createdAt: string;
  stationName: string;
  routeName: string;
  // Vehicle and pricing information
  vehicleCapacity?: number;  // Vehicle capacity for total amount calculation
  basePrice?: number;        // Base price per seat from route
  // Exit pass count for today
  exitPassCount?: number;    // Current count of exit passes for today
  // Branding (optional)
  brandName?: string;
  brandLogo?: string; // path or URL to logo image (e.g., /icons/ste_260.png)
  // Company branding (mapped to backend fields)
  companyName?: string;
  companyLogo?: string;
  // Staff information
  staffFirstName?: string;
  staffLastName?: string;
}

// Printer service class
export class PrinterService {
  private baseUrl: string;
  private defaultBrandName: string = 'STE';
  private defaultBrandLogoPath: string = '/icons/ste_260.png';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Get printer configuration from local storage
  async getPrinterConfig(): Promise<PrinterIpConfig> {
    return printerIpConfigService.getConfig();
  }

  // Update printer configuration
  async updatePrinterConfig(printerId: string, config: PrinterConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/config/${printerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error(`Failed to update printer config: ${response.statusText}`);
    }
  }

  // Test printer connection using local configuration
  async testPrinterConnection(): Promise<PrinterStatus> {
    return await printerIpConfigService.testPrinterConnection();
  }

  // Get print queue
  async getPrintQueue(): Promise<QueuedPrintJob[]> {
    const response = await fetch(`${this.baseUrl}/api/printer/queue`);
    if (!response.ok) {
      throw new Error(`Failed to get print queue: ${response.statusText}`);
    }
    return response.json();
  }

  // Get print queue status
  async getPrintQueueStatus(): Promise<PrintQueueStatus> {
    const response = await fetch(`${this.baseUrl}/api/printer/queue/status`);
    if (!response.ok) {
      throw new Error(`Failed to get print queue status: ${response.statusText}`);
    }
    return response.json();
  }

  // Add print job to queue
  async addPrintJob(jobType: PrintJobType, content: string, staffName?: string, priority: number = 100): Promise<QueuedPrintJob> {
    const response = await fetch(`${this.baseUrl}/api/printer/queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobType,
        content,
        staffName,
        priority,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add print job: ${response.statusText}`);
    }
    return response.json();
  }

  private withBranding(data: TicketData): TicketData {
    return {
      ...data,
      // Ensure brand fields are present with fallbacks
      brandName: data.brandName || this.defaultBrandName,
      brandLogo: data.brandLogo || this.defaultBrandLogoPath,
      // Map to backend fields
      companyName: data.companyName || data.brandName || this.defaultBrandName,
      companyLogo: data.companyLogo || data.brandLogo || this.defaultBrandLogoPath,
    };
  }

  // Print booking ticket using local printer configuration
  async printBookingTicket(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print booking ticket: ${response.statusText}`);
    }
  }

  // Print entry ticket using local printer configuration
  async printEntryTicket(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print entry ticket: ${response.statusText}`);
    }
  }

  // Print exit ticket using local printer configuration
  async printExitTicket(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print exit ticket: ${response.statusText}`);
    }
  }

  // Print day pass ticket using local printer configuration
  async printDayPassTicket(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/daypass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print day pass ticket: ${response.statusText}`);
    }
  }

  // Print exit pass ticket using local printer configuration
  async printExitPassTicket(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/exitpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print exit pass ticket: ${response.statusText}`);
    }
  }

  // Print talon using local printer configuration
  async printTalon(ticketData: TicketData): Promise<void> {
    const printerConfig = await this.getPrinterConfig();
    
    const response = await fetch(`${this.baseUrl}/api/printer/print/talon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...this.withBranding(ticketData),
        printerConfig: printerConfig
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to print talon: ${response.statusText}`);
    }
  }

  // Helper method to create ticket data from booking
  createTicketDataFromBooking(booking: any, vehicle: any, destination: any, staffName: string, staffFirstName?: string, staffLastName?: string): TicketData {
    return {
      licensePlate: vehicle?.licensePlate || 'Unknown',
      destinationName: destination?.name || 'Unknown Destination',
      seatNumber: booking?.seatNumber || 1,
      totalAmount: booking?.totalAmount || 0,
      basePrice: destination?.basePrice || vehicle?.basePrice || 0, // Include base price from destination or vehicle
      createdBy: staffName,
      createdAt: booking?.createdAt || new Date().toISOString(),
      stationName: 'Station Name', // You might want to get this from context
      routeName: destination?.name || 'Unknown Route',
      // Staff information
      staffFirstName: staffFirstName || '',
      staffLastName: staffLastName || '',
    };
  }

  // Helper method to print ticket after booking
  async printTicketAfterBooking(booking: any, vehicle: any, destination: any, staffName: string, staffFirstName?: string, staffLastName?: string): Promise<void> {
    const ticketData = this.createTicketDataFromBooking(booking, vehicle, destination, staffName, staffFirstName, staffLastName);
    await this.printBookingTicket(ticketData);
    // Follow with a talon containing plate, seat index, timestamp
    const talonData: TicketData = {
      licensePlate: ticketData.licensePlate,
      destinationName: ticketData.destinationName,
      seatNumber: ticketData.seatNumber,
      totalAmount: ticketData.totalAmount,
      basePrice: ticketData.basePrice, // Include base price for talon
      createdBy: ticketData.createdBy,
      createdAt: booking?.createdAt || new Date().toISOString(),
      stationName: ticketData.stationName,
      routeName: ticketData.routeName,
      staffFirstName: staffFirstName || '',
      staffLastName: staffLastName || '',
    };
    await this.printTalon(talonData);
  }
}

// Create a singleton instance
export const printerService = new PrinterService(API.printer);