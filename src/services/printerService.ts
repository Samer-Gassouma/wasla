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
  verificationCode: string;
  totalAmount: number;
  createdBy: string;
  createdAt: string;
  stationName: string;
  routeName: string;
  previousVehicles?: string[]; // For exit pass tickets
  // Branding (optional)
  brandName?: string;
  brandLogo?: string; // path or URL to logo image (e.g., /icons/ste_260.png)
}

// Printer service class
export class PrinterService {
  private baseUrl: string;
  private defaultPrinterId: string = 'printer1';
  private defaultBrandName: string = 'Dhraiff Services Transport';
  private defaultBrandLogoPath: string = '/icons/ste_260.png';

  constructor(baseUrl: string = 'http://localhost:8005') {
    this.baseUrl = baseUrl;
  }

  // Get printer configuration
  async getPrinterConfig(printerId: string = this.defaultPrinterId): Promise<PrinterConfig> {
    const response = await fetch(`${this.baseUrl}/api/printer/config/${printerId}`);
    if (!response.ok) {
      throw new Error(`Failed to get printer config: ${response.statusText}`);
    }
    return response.json();
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

  // Test printer connection
  async testPrinterConnection(printerId: string = this.defaultPrinterId): Promise<PrinterStatus> {
    const response = await fetch(`${this.baseUrl}/api/printer/test/${printerId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to test printer connection: ${response.statusText}`);
    }
    return response.json();
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
    };
  }

  // Print booking ticket
  async printBookingTicket(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print booking ticket: ${response.statusText}`);
    }
  }

  // Print entry ticket
  async printEntryTicket(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print entry ticket: ${response.statusText}`);
    }
  }

  // Print exit ticket
  async printExitTicket(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print exit ticket: ${response.statusText}`);
    }
  }

  // Print day pass ticket
  async printDayPassTicket(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/daypass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print day pass ticket: ${response.statusText}`);
    }
  }

  // Print exit pass ticket
  async printExitPassTicket(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/exitpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print exit pass ticket: ${response.statusText}`);
    }
  }

  // Print talon
  async printTalon(printerId: string, ticketData: TicketData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/printer/${printerId}/print/talon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.withBranding(ticketData)),
    });
    if (!response.ok) {
      throw new Error(`Failed to print talon: ${response.statusText}`);
    }
  }

  // Helper method to create ticket data from booking
  createTicketDataFromBooking(booking: any, vehicle: any, destination: any, staffName: string): TicketData {
    return {
      licensePlate: vehicle?.licensePlate || 'Unknown',
      destinationName: destination?.name || 'Unknown Destination',
      seatNumber: booking?.seatNumber || 1,
      verificationCode: booking?.verificationCode || 'N/A',
      totalAmount: booking?.totalAmount || 0,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
      stationName: 'Station Name', // You might want to get this from context
      routeName: destination?.name || 'Unknown Route',
    };
  }

  // Helper method to print ticket after booking
  async printTicketAfterBooking(booking: any, vehicle: any, destination: any, staffName: string, printerId: string = this.defaultPrinterId): Promise<void> {
    const ticketData = this.createTicketDataFromBooking(booking, vehicle, destination, staffName);
    await this.printBookingTicket(printerId, ticketData);
    // Follow with a talon containing plate, seat index, timestamp
    const talonData: TicketData = {
      licensePlate: ticketData.licensePlate,
      destinationName: ticketData.destinationName,
      seatNumber: ticketData.seatNumber,
      verificationCode: '',
      totalAmount: 0,
      createdBy: ticketData.createdBy,
      createdAt: new Date().toISOString(),
      stationName: '',
      routeName: '',
    };
    await this.printTalon(printerId, talonData);
  }
}

// Create a singleton instance
export const printerService = new PrinterService();