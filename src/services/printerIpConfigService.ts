// Simple printer IP configuration service for louaj-desktop
// Each app instance will have its own printer IP saved locally

export interface PrinterIpConfig {
  ip: string;
  port: number;
}

class PrinterIpConfigService {
  private readonly STORAGE_KEY = 'louaj-desktop-printer-ip';
  private readonly DEFAULT_CONFIG: PrinterIpConfig = {
    ip: '192.168.1.100',
    port: 9100
  };

  // Get printer IP configuration
  getConfig(): PrinterIpConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load printer IP config from localStorage:', error);
    }
    return this.DEFAULT_CONFIG;
  }

  // Save printer IP configuration
  saveConfig(config: PrinterIpConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save printer IP config to localStorage:', error);
    }
  }

  // Get printer IP
  getPrinterIp(): string {
    const config = this.getConfig();
    return config.ip;
  }

  // Get printer port
  getPrinterPort(): number {
    const config = this.getConfig();
    return config.port;
  }

  // Set printer IP
  setPrinterIp(ip: string): void {
    const config = this.getConfig();
    config.ip = ip;
    this.saveConfig(config);
  }

  // Set printer port
  setPrinterPort(port: number): void {
    const config = this.getConfig();
    config.port = port;
    this.saveConfig(config);
  }

  // Test printer connection
  async testPrinterConnection(): Promise<{ connected: boolean; error?: string }> {
    const config = this.getConfig();

    try {
      // Simple network connectivity test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`http://${config.ip}:${config.port}`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // Avoid CORS issues
      });
      
      clearTimeout(timeoutId);
      return { connected: true };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  // Reset to default configuration
  resetToDefault(): void {
    this.saveConfig(this.DEFAULT_CONFIG);
  }

  // Validate IP address format
  isValidIp(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  // Validate port number
  isValidPort(port: number): boolean {
    return port > 0 && port <= 65535;
  }
}

// Create singleton instance
export const printerIpConfigService = new PrinterIpConfigService();