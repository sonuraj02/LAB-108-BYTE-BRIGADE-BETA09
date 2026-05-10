/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, handleFirestoreError, OperationType 
} from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc,
  limit
} from 'firebase/firestore';
import { 
  CATEGORIES, 
  Category, 
  Listing, 
  UserProfile,
  Conversation,
  Message,
  Offer
} from './types';
import { 
  Search, 
  Plus, 
  MessageCircle, 
  User as UserIcon, 
  LogOut, 
  Grid, 
  ShoppingCart, 
  Filter,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Send,
  Camera,
  X,
  CreditCard,
  RefreshCw,
  Clock,
  Handshake,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ListingCard } from './components/ListingCard';
import { getRecommendations } from './services/geminiService';

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'marketplace' | 'profile' | 'my-listings' | 'chats' | 'listing-detail'>('marketplace');
  const [listings, setListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'available' | 'sold' | 'rented'>('available');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recommendations, setRecommendations] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListingFormOpen, setIsListingFormOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else if (!user.isAnonymous) {
            // Only create profile automatically for Google users
            // Anonymous students will create theirs during the custom login step
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email!,
              displayName: user.displayName || 'Student',
              photoURL: user.photoURL || undefined,
              role: 'student',
              interests: []
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          } else {
             // For anonymous users, we wait for the login modal to set the profile
             // But if we already had a profile (re-login), fetch it
             // (Added empty block for clarity)
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch Listings
  useEffect(() => {
    const path = 'listings';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
      setListings(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  // Fetch Conversations
  useEffect(() => {
    if (!user) return;
    const path = 'conversations';
    const q = query(
      collection(db, path), 
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [user]);

  // Fetch Messages for active conversation
  useEffect(() => {
    if (!user || !activeConversation) return;
    const path = `conversations/${activeConversation.id}/messages`;
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [user, activeConversation]);

  // AI Recommendations
  useEffect(() => {
    if (profile && listings.length > 0 && view === 'marketplace') {
      const fetchRecs = async () => {
        const recIds = await getRecommendations(profile.major || '', profile.interests || [], listings);
        const filteredRecs = listings.filter(l => recIds.includes(l.id));
        setRecommendations(filteredRecs);
      };
      const timer = setTimeout(fetchRecs, 2000); // Debounce to allow listings to load
      return () => clearTimeout(timer);
    }
  }, [profile, listings, view]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setView('marketplace');
  };

  const requireAuth = (callback: () => void) => {
    if (!profile) {
      setIsLoginModalOpen(true);
    } else {
      callback();
    }
  };

  const handleCustomLogin = async (enrollment: string, dob: string) => {
    try {
      // For this campus demo, we'll use Anonymous Auth + Firestore Profile
      // In a real app, you'd verify enrollment/dob on a backend
      let currentUser = user;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      const q = query(collection(db, 'users'), where('enrollmentNo', '==', enrollment));
      const snap = await getDocs(q);
      
      let studentProfile: UserProfile;

      if (!snap.empty) {
        studentProfile = snap.docs[0].data() as UserProfile;
        // Verify DOB (simple string check for this demo)
        if (studentProfile.dob && studentProfile.dob !== dob) {
          alert("Invalid DOB for this enrollment number.");
          return;
        }
      } else {
        // Create new profile
        studentProfile = {
          uid: currentUser!.uid,
          email: `${enrollment}@campus.edu`,
          displayName: `Student ${enrollment}`,
          enrollmentNo: enrollment,
          dob: dob,
          role: 'student',
          interests: []
        };
        await setDoc(doc(db, 'users', currentUser!.uid), studentProfile);
      }
      
      setProfile(studentProfile);
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error("Custom Login Error:", error);
    }
  };

  const filteredListings = useMemo(() => {
    return listings.filter(l => {
      const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || l.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || l.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [listings, searchQuery, selectedCategory, selectedStatus]);

  const startConversation = async (listing: Listing) => {
    if (!user) return;
    if (user.uid === listing.sellerId) return;

    // Check if conversation exists
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      where('listingId', '==', listing.id)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      setActiveConversation({ id: snap.docs[0].id, ...snap.docs[0].data() } as Conversation);
    } else {
      const newConv = {
        participantIds: [user.uid, listing.sellerId],
        listingId: listing.id,
        updatedAt: serverTimestamp(),
        lastMessage: `Inquiry about: ${listing.title}`
      };
      const docRef = await addDoc(collection(db, 'conversations'), newConv);
      setActiveConversation({ id: docRef.id, ...newConv } as Conversation);
    }
    setView('chats');
  };

  const sendMessage = async (text: string) => {
    if (!user || !activeConversation) return;
    const path = `conversations/${activeConversation.id}/messages`;
    const msg = {
      senderId: user.uid,
      participantIds: activeConversation.participantIds, // Store for secure listing without get()
      text,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, path), msg);
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <ShoppingCart size={18} />
          </div>
          <span className="font-bold text-xl tracking-tight">CampusX</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <NavItem 
            icon={<Grid size={20} />} 
            label="Marketplace" 
            active={view === 'marketplace'} 
            onClick={() => setView('marketplace')} 
          />
          <NavItem 
            icon={<Plus size={20} />} 
            label="Post Item" 
            active={isListingFormOpen} 
            onClick={() => requireAuth(() => setIsListingFormOpen(true))} 
          />
          <NavItem 
            icon={<MessageCircle size={20} />} 
            label="Conversations" 
            active={view === 'chats'} 
            onClick={() => requireAuth(() => setView('chats'))} 
          />
          <NavItem 
            icon={<CreditCard size={20} />} 
            label="My Listings" 
            active={view === 'my-listings'} 
            onClick={() => requireAuth(() => setView('my-listings'))} 
          />
          <NavItem 
            icon={<UserIcon size={20} />} 
            label="Profile" 
            active={view === 'profile'} 
            onClick={() => requireAuth(() => setView('profile'))} 
          />
        </nav>

        <div className="p-4 mt-auto border-t border-gray-50">
          {profile ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium text-sm"
            >
              <LogOut size={18} />
              Logout
            </button>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-indigo-600 text-white rounded-xl transition-all font-bold text-sm shadow-lg shadow-indigo-100"
            >
              Login to CampusX
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search textbooks, electronics, cycles..."
              className="w-full bg-gray-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 ml-6">
            {profile ? (
              <>
                <span className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{profile.displayName}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{profile.major || 'Unset Major'}</p>
                </span>
                <div 
                  className="w-10 h-10 rounded-full bg-indigo-100 bg-cover bg-center border-2 border-white shadow-sm cursor-pointer hover:border-indigo-400 transition-all"
                  style={{ backgroundImage: `url(${profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + profile.uid})` }}
                  onClick={() => setView('profile')}
                />
              </>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto p-6">
            {view === 'marketplace' && (
              <div className="space-y-10">
                {/* Categories and Status Filter */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar flex-1">
                      <CategoryChip 
                        label="All" 
                        active={selectedCategory === 'All'} 
                        onClick={() => setSelectedCategory('All')} 
                      />
                      {CATEGORIES.map(cat => (
                        <CategoryChip 
                          key={cat} 
                          label={cat} 
                          active={selectedCategory === cat} 
                          onClick={() => setSelectedCategory(cat as Category)} 
                        />
                      ))}
                    </div>
                    
                    <div className="ml-4 flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-1 shadow-sm shrink-0">
                      {(['available', 'sold', 'rented', 'All'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setSelectedStatus(status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                            selectedStatus === status 
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Recommendations */}
                {profile && recommendations.length > 0 && selectedCategory === 'All' && !searchQuery && (
                  <section>
                    <div className="flex items-center gap-2 mb-6 text-indigo-600">
                      <Sparkles size={20} className="fill-indigo-600" />
                      <h2 className="text-lg font-bold tracking-tight">Recommended for You</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {recommendations.map(listing => (
                        <ListingCard 
                          key={listing.id} 
                          listing={listing} 
                          onClick={(l) => { setSelectedListing(l); setView('listing-detail'); }} 
                        />
                      ))}
                    </div>
                    <div className="mt-8 border-b border-gray-100" />
                  </section>
                )}

                {/* All Listings */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold tracking-tight">
                      {selectedCategory === 'All' ? 'Latest Discoveries' : `${selectedCategory} Listings`}
                    </h2>
                    <span className="text-sm text-gray-400 font-medium">{filteredListings.length} items found</span>
                  </div>
                  
                  {filteredListings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredListings.map(listing => (
                        <ListingCard 
                          key={listing.id} 
                          listing={listing} 
                          onClick={(l) => { setSelectedListing(l); setView('listing-detail'); }} 
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Filter size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium">No listings found in this category</p>
                      <button 
                        onClick={() => { setSelectedCategory('All'); setSearchQuery(''); setSelectedStatus('available'); }}
                        className="mt-4 text-indigo-600 font-semibold hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}

            {view === 'listing-detail' && selectedListing && (
              <ListingDetailView 
                listing={selectedListing} 
                onBack={() => setView('marketplace')} 
                onContact={() => requireAuth(() => startConversation(selectedListing))}
                isOwner={profile?.uid === selectedListing.sellerId}
                userProfile={profile}
              />
            )}

            {view === 'my-listings' && (
              <MyListingsView 
                listings={listings.filter(l => l.sellerId === profile?.uid)}
                onEdit={(l) => { setSelectedListing(l); setIsListingFormOpen(true); }}
              />
            )}

            {view === 'chats' && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 flex overflow-hidden min-h-[600px] h-[calc(100vh-160px)]">
                <div className="w-80 border-r border-gray-100 flex flex-col">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-bold text-lg">Chats</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    {conversations.length > 0 ? (
                      conversations.map(conv => (
                        <div 
                          key={conv.id}
                          onClick={() => setActiveConversation(conv)}
                          className={`p-4 cursor-pointer transition-colors border-b border-gray-50 hover:bg-gray-50 ${activeConversation?.id === conv.id ? 'bg-indigo-50/50' : ''}`}
                        >
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                              {conv.lastMessage?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">Chat for {conv.listingId}</p>
                              <p className="text-xs text-gray-500 truncate mt-1">{conv.lastMessage}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-gray-400">
                        <MessageCircle size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No chats yet</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col bg-[#FAFBFF]">
                  {activeConversation ? (
                    <div className="flex flex-col h-full">
                      <div className="p-6 bg-white border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                          #
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">Conversation</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Chat</p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.map(msg => (
                          <div 
                            key={msg.id} 
                            className={`flex ${msg.senderId === profile?.uid ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                              msg.senderId === profile?.uid 
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100' 
                                : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none shadow-sm'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                      </div>
                      <ChatInput onSend={sendMessage} />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                      <MessageCircle size={64} strokeWidth={1} className="mb-4" />
                      <p className="text-lg font-medium">Select a conversation to start chatting</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'profile' && profile && (
              <ProfileView 
                profile={profile} 
                onUpdate={async (p) => {
                  const path = `users/${profile.uid}`;
                  try {
                    await setDoc(doc(db, path), p);
                    setProfile(p);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, path);
                  }
                }} 
              />
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => requireAuth(() => setIsListingFormOpen(true))}
          className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <AuthModal 
            onClose={() => setIsLoginModalOpen(false)} 
            onLogin={handleCustomLogin}
            onGoogleLogin={handleLogin}
          />
        )}
      </AnimatePresence>

      {/* Listing Form Modal */}
      <AnimatePresence>
        {isListingFormOpen && profile && (
          <ListingForm 
            user={profile}
            listingToEdit={selectedListing && view === 'my-listings' ? selectedListing : null}
            onClose={() => { setIsListingFormOpen(false); setSelectedListing(null); }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all ${
        active 
          ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  key?: React.Key;
}

function CategoryChip({ label, active, onClick }: CategoryChipProps) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${
        active 
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
          : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function ListingDetailView({ listing, onBack, onContact, isOwner, userProfile }: { listing: Listing, onBack: () => void, onContact: () => void, isOwner: boolean, userProfile: UserProfile | null }) {
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerSent, setOfferSent] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-semibold text-sm transition-all mb-4">
        <ArrowLeft size={16} />
        Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50">
        <div className="space-y-4">
          <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden ring-1 ring-gray-100">
            {listing.images?.[0] ? (
              <img src={listing.images[0]} className="w-full h-full object-cover" alt={listing.title} referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                 <Camera size={64} />
              </div>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
             {listing.images?.slice(1).map((img, i) => (
                <img key={i} src={img} className="w-20 h-20 rounded-xl object-cover ring-1 ring-gray-100 cursor-pointer hover:ring-indigo-400" alt="" referrerPolicy="no-referrer" />
             ))}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{listing.category}</span>
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{listing.type}</span>
          </div>

          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">{listing.title}</h1>
          <p className="text-3xl font-bold text-indigo-600 mb-8">₹{listing.price}</p>
          
          <div className="bg-gray-50 rounded-2xl p-4 mb-8">
            <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">{listing.description}</p>
          </div>

          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <UserIcon size={20} />
              </div>
              <div>
                <p className="text-sm font-bold">{listing.sellerName}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Verified Seller</p>
              </div>
            </div>
          </div>

          {!isOwner ? (
            <div className="space-y-3">
              <button 
                onClick={onContact}
                className="w-full bg-indigo-600 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <MessageCircle size={20} />
                Contact Seller
              </button>
              
              {offerSent ? (
                <div className="flex items-center justify-center gap-2 py-4 bg-green-50 text-green-700 rounded-2xl font-bold border border-green-100 animate-pulse">
                  <CheckCircle2 size={20} />
                  Offer Sent!
                </div>
              ) : (
                <button 
                  onClick={() => setIsOfferModalOpen(true)}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all active:scale-95"
                >
                  <Handshake size={20} />
                  Make an Offer
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl border-2 border-dashed border-gray-100 text-center text-gray-400 font-semibold">
              This is your listing
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOfferModalOpen && (
          <MakeOfferModal 
            listing={listing} 
            userProfile={userProfile}
            onClose={() => setIsOfferModalOpen(false)}
            onSuccess={() => {
              setIsOfferModalOpen(false);
              setOfferSent(true);
              setTimeout(() => setOfferSent(false), 5000);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProfileView({ profile, onUpdate }: { profile: UserProfile, onUpdate: (p: UserProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(profile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-100/50">
          <h2 className="text-2xl font-black mb-8">Edit Your Profile</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Major</label>
                <input 
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="e.g., Computer Science"
                  value={formData.major || ''}
                  onChange={e => setFormData({...formData, major: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Year</label>
                <select 
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                  value={formData.year || ''}
                  onChange={e => setFormData({...formData, year: e.target.value})}
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Bio</label>
              <textarea 
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                rows={3}
                placeholder="Tell us about yourself..."
                value={formData.bio || ''}
                onChange={e => setFormData({...formData, bio: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Hostel</label>
                <input 
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="Block B, Room 201"
                  value={formData.hostel || ''}
                  onChange={e => setFormData({...formData, hostel: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Phone Number</label>
                <input 
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="+91 98765 43210"
                  value={formData.phoneNumber || ''}
                  onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-100/50">
        <div className="flex items-center gap-6 mb-10">
          <div 
            className="w-24 h-24 rounded-3xl bg-indigo-50 bg-cover bg-center border-4 border-white shadow-xl"
            style={{ backgroundImage: `url(${profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + profile.uid})` }}
          />
          <div>
            <h2 className="text-2xl font-black">{profile.displayName}</h2>
            <p className="text-gray-400 font-semibold">{profile.email}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <ProfileField label="Major" value={profile.major || 'Not set'} />
            <ProfileField label="Year" value={profile.year || 'Not set'} />
          </div>
          <ProfileField label="Hostel/Local" value={profile.hostel || 'Not set'} />
          <ProfileField label="Bio" value={profile.bio || 'Product reuse advocate. Interested in tech and books.'} />
        </div>

        <button 
          onClick={() => setEditing(true)}
          className="mt-10 w-full py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function MyListingsView({ listings, onEdit }: { listings: Listing[], onEdit: (l: Listing) => void }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black">My Campus Listings</h2>
      {listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(listing => (
            <div key={listing.id} className="relative group">
              <ListingCard listing={listing} onClick={() => {}} />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(listing); }}
                  className="p-2 bg-white rounded-lg shadow-lg text-indigo-600 hover:bg-indigo-50"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400">
           <Grid size={48} className="mx-auto mb-4 opacity-20" />
           <p className="font-semibold">You haven't listed anything yet</p>
        </div>
      )}
    </div>
  );
}

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100 flex gap-2 items-center">
      <input 
        type="text" 
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
      />
      <button type="submit" className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-90 transition-all shadow-md shadow-indigo-100">
        <Send size={18} />
      </button>
    </form>
  );
}function AuthModal({ onClose, onLogin, onGoogleLogin }: { onClose: () => void, onLogin: (enroll: string, dob: string) => void, onGoogleLogin: () => void }) {
  const [enroll, setEnroll] = useState('');
  const [dob, setDob] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-8">
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-black">Student Login</h2>
           <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all"><X size={20} /></button>
        </div>

        <div className="space-y-6">
           <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Enrollment Number</label>
              <input 
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="e.g., 2024CS001"
                value={enroll}
                onChange={e => setEnroll(e.target.value)}
              />
           </div>
           <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Date of Birth</label>
              <input 
                type="date"
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                value={dob}
                onChange={e => setDob(e.target.value)}
              />
           </div>

           <button 
             onClick={() => onLogin(enroll, dob)}
             className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
           >
             Continue to Marketplace
           </button>

           <div className="relative flex items-center justify-center pt-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <span className="relative bg-white px-4 text-[10px] text-gray-300 font-bold uppercase tracking-widest">or</span>
           </div>

           <button 
             onClick={onGoogleLogin}
             className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-4 rounded-2xl font-semibold text-gray-600 hover:bg-gray-50 transition-all"
           >
             <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
             Sign in with Google
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function MakeOfferModal({ listing, userProfile, onClose, onSuccess }: { listing: Listing, userProfile: UserProfile | null, onClose: () => void, onSuccess: () => void }) {
  const [offerPrice, setOfferPrice] = useState(listing.price);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSubmitting(true);
    
    try {
      const offerData = {
        listingId: listing.id,
        buyerId: userProfile.uid,
        buyerName: userProfile.displayName,
        price: Number(offerPrice),
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      const path = `listings/${listing.id}/offers`;
      await addDoc(collection(db, path), offerData);
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `listings/${listing.id}/offers`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-8"
      >
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-black">Make an Offer</h2>
           <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all"><X size={20} /></button>
        </div>

        <p className="text-sm text-gray-500 mb-6 font-medium">Propose a price for <span className="text-gray-900 font-bold">{listing.title}</span>. The seller will be notified.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
           <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Your Offer Price (₹)</label>
              <div className="relative">
                <input 
                  type="number"
                  required
                  min="1"
                  className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                  value={offerPrice}
                  onChange={e => setOfferPrice(Number(e.target.value))}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold">INR</span>
              </div>
              <p className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Listed Price: ₹{listing.price}</p>
           </div>

           <button 
             disabled={submitting}
             type="submit"
             className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
           >
             {submitting ? 'Sending...' : 'Send Offer'}
           </button>
        </form>
      </motion.div>
    </div>
  );
}

function ListingForm({ user, listingToEdit, onClose }: { user: UserProfile, listingToEdit: Listing | null, onClose: () => void }) {
  const [formData, setFormData] = useState({
    title: listingToEdit?.title || '',
    description: listingToEdit?.description || '',
    price: listingToEdit?.price || 0,
    category: listingToEdit?.category || CATEGORIES[0],
    type: listingToEdit?.type || 'sell',
    hostel: listingToEdit?.hostel || '',
    images: listingToEdit?.images || []
  });
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 500000) { // 500KB limit for base64 to keep firestore docs small
        alert("Image too large. Please upload images smaller than 500KB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, reader.result as string].slice(0, 5) // Limit to 5 images
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        ...formData,
        sellerId: user.uid,
        sellerName: user.displayName || 'Student',
        status: listingToEdit?.status || 'available',
        updatedAt: serverTimestamp(),
        createdAt: listingToEdit?.createdAt || serverTimestamp(),
      };

      if (listingToEdit) {
        await updateDoc(doc(db, 'listings', listingToEdit.id), data);
      } else {
        await addDoc(collection(db, 'listings'), data);
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'listings');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-xl bg-white rounded-[32px] overflow-hidden shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="p-8 pb-0 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-black">{listingToEdit ? 'Edit Item' : 'Post New Item'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {/* Image Upload Area */}
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 block">Upload Photos (Max 5)</label>
              <div className="grid grid-cols-5 gap-2">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
                    <img src={img} className="w-full h-full object-cover" alt="" />
                    <button 
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {formData.images.length < 5 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-400 cursor-pointer transition-all">
                    <Camera size={20} />
                    <span className="text-[8px] font-bold mt-1 uppercase">Add</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Title</label>
              <input 
                required
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="Physics textbook, Bose headphones, etc."
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Category</label>
                <select 
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none appearance-none"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value as Category})}
                >
                  {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Price (₹)</label>
                <input 
                  type="number"
                  required
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Description</label>
              <textarea 
                required
                rows={3}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                placeholder="Give some details about the item's condition..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Type</label>
                  <div className="flex gap-2">
                    {['sell', 'rent', 'exchange'].map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => setFormData({...formData, type: t as any})}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                          formData.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
               </div>
               <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Hostel / Location</label>
                  <input 
                    className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                    placeholder="Block A, Room 302"
                    value={formData.hostel}
                    onChange={e => setFormData({...formData, hostel: e.target.value})}
                  />
               </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-4 px-6 rounded-2xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          >
            {submitting ? 'Processing...' : (listingToEdit ? 'Update Listing' : 'Publish Item')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
