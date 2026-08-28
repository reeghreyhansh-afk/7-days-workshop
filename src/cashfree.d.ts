declare module '@cashfreepayments/cashfree-js' {
  type CashfreeCheckoutResult = {
    error?: { message?: string };
    redirect?: boolean;
    paymentDetails?: { paymentMessage?: string };
  };

  type CashfreeClient = {
    checkout: (options: { paymentSessionId: string; redirectTarget: '_modal' }) => Promise<CashfreeCheckoutResult>;
  };

  export function load(options: { mode: 'sandbox' | 'production' }): Promise<CashfreeClient | null>;
}
