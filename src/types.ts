export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  enrollmentNo?: string;
  dob?: string;
  photoURL?: string;
  major?: string;
  year?: string;
  bio?: string;
  hostel?: string;
  phoneNumber?: string;
  interests?: string[];
  role?: 'student' | 'admin';
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  status: 'available' | 'sold' | 'rented';
  type: 'sell' | 'rent' | 'exchange';
  hostel?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  listingId: string;
  lastMessage?: string;
  updatedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export type Category = 'Books' | 'Electronics' | 'Hostel Items' | 'Cycles' | 'Lab Equipment' | 'Furniture' | 'Notes' | 'Clothing' | 'Other';

export const CATEGORIES: Category[] = [
  'Books',
  'Electronics',
  'Hostel Items',
  'Cycles',
  'Lab Equipment',
  'Furniture',
  'Notes',
  'Clothing',
  'Other'
];
