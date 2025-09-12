// Stripe functionality removed temporarily

// Mock Stripe promise (será null)
export const stripePromise = null;

// Format price for display (mantenemos esta función ya que es útil)
export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) {
    return 'Publico';
  }
  
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numericPrice) || numericPrice === 0) {
    return 'Publico';
  }
  
  return `$${numericPrice.toFixed(2)}`;
}

// Format access type for free events based on privacy type and payment type
export function formatAccessType(paymentType: string, privacyType: string, price?: number | string | null): string {
  // If the event has a price, show the price
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (numericPrice && numericPrice > 0) {
    return `$${numericPrice.toFixed(2)}`;
  }
  
  // For free events, show access type based on privacy
  if (paymentType === 'free') {
    if (privacyType === 'private') {
      return 'Con solicitud';
    } else {
      return 'Evento abierto';
    }
  }
  
  return 'Evento abierto';
}

export default {
  stripePromise,
  formatPrice
};
