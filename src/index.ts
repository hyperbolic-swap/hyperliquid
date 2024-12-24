import { InfoAPI } from './rest/info';
import { ExchangeAPI } from './rest/exchange';
import { WebSocketClient } from './websocket/connection';
import { WebSocketSubscriptions } from './websocket/subscriptions';
import { RateLimiter } from './utils/rateLimiter';
import * as CONSTANTS from './types/constants';
import { CustomOperations } from './rest/custom';
import { SymbolConversion } from './utils/symbolConversion';
import { AuthenticationError } from './utils/errors';



export class Hyperliquid {
  public info: InfoAPI;
  public exchange: ExchangeAPI;
  public ws: WebSocketClient;
  public subscriptions: WebSocketSubscriptions;
  public custom: CustomOperations;

  private rateLimiter: RateLimiter;
  private symbolConversion: SymbolConversion;
  private isValidPrivateKey: boolean = false;
  private walletAddress: string | null = null;
  private _initialized: boolean = false;
  private _initializing: Promise<void> | null = null;
  private _privateKey?: string;
  private _walletAddress?: string;

  constructor(testnet: boolean = false, walletAddress?: string) {
    const baseURL = testnet ? CONSTANTS.BASE_URLS.TESTNET : CONSTANTS.BASE_URLS.PRODUCTION;

    this.rateLimiter = new RateLimiter();
    this.symbolConversion = new SymbolConversion(baseURL, this.rateLimiter);
    this.walletAddress = walletAddress || null;

    // Initialize info API
    this.info = new InfoAPI(baseURL, this.rateLimiter, this.symbolConversion, this);
    
    // Initialize WebSocket
    this.ws = new WebSocketClient(testnet);
    this.subscriptions = new WebSocketSubscriptions(this.ws, this.symbolConversion);
    
    // Create proxy objects for exchange and custom
    this.exchange = this.createAuthenticatedProxy(ExchangeAPI);
    this.custom = this.createAuthenticatedProxy(CustomOperations);
  }

  public async connect(): Promise<void> {
    if (!this._initialized) {
      if (!this._initializing) {
        this._initializing = this.initialize();
      }
      await this._initializing;
    }
  }

  private async initialize(): Promise<void> {
    if (this._initialized) return;
    
    try {
      // Initialize symbol conversion first
      await this.symbolConversion.initialize();
      
      // Connect WebSocket
      await this.ws.connect();
      
      this._initialized = true;
      this._initializing = null;
    } catch (error) {
      this._initializing = null;
      throw error;
    }
  }

  public async ensureInitialized(): Promise<void> {
    await this.connect();
  }

  private createAuthenticatedProxy<T extends object>(Class: new (...args: any[]) => T): T {
    return new Proxy({} as T, {
      get: (target, prop) => {
        // if (!this.isValidPrivateKey) {
        //   throw new AuthenticationError('Invalid or missing private key. This method requires authentication.');
        // }
        return target[prop as keyof T];
      }
    });
  }


  // Modify existing methods to check initialization
  public isAuthenticated(): boolean {
    this.ensureInitialized();
    return this.isValidPrivateKey;
}


  // public isAuthenticated(): boolean {
  //   return this.isValidPrivateKey;
  // }

disconnect(): void {
    this.ensureInitialized();
    this.ws.close();
}

}

export * from './types';
export * from './utils/signing';
