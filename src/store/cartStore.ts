import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  image?: string;
  costPrice?: number;
  category?: string;
  imeis?: string[];
  isSecondHand?: boolean;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearItem: (productId: string) => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getGst: () => number;
  getTotal: () => number;
  updateIMEI: (productId: string, index: number, imei: string) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (product) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.productId === product.productId);
          if (existingItem) {
            const newQuantity = Math.min(existingItem.quantity + (product.quantity || 1), product.stock);
            return {
              items: state.items.map((i) =>
                i.productId === product.productId ? { ...i, quantity: newQuantity } : i
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity: product.quantity || 1 }] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      clearItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (i.productId === productId) {
              return { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) };
            }
            return i;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      updateIMEI: (productId, index, imei) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId === productId) {
              const newImeis = [...(item.imeis || [])];
              newImeis[index] = imei;
              return { ...item, imeis: newImeis };
            }
            return item;
          }),
        }));
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      getGst: () => {
        return get().getSubtotal() * 0.18;
      },

      getTotal: () => {
        return get().getSubtotal() + get().getGst();
      },
    }),
    {
      name: 'smart-retail-cart',
    }
  )
);
