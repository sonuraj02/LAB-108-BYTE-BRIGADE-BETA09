import React from 'react';
import { Listing } from '../types';
import { MapPin, Tag, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface ListingCardProps {
  listing: Listing;
  onClick: (listing: Listing) => void;
  key?: React.Key;
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const timeAgo = (date: any) => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.toDate().getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => onClick(listing)}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      id={`listing-card-${listing.id}`}
    >
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {listing.images && listing.images.length > 0 ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Tag size={48} />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full">
            {listing.type}
          </span>
          <span className="bg-indigo-600 text-white text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full">
            {listing.category}
          </span>
        </div>
        {listing.status !== 'available' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-black px-4 py-1 rounded-full font-bold uppercase tracking-widest text-xs">
              {listing.status}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {listing.title}
          </h3>
          <span className="font-bold text-indigo-600 whitespace-nowrap">
            ₹{listing.price === 0 ? 'Free' : listing.price}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {listing.hostel && (
            <div className="flex items-center text-gray-500 text-xs">
              <MapPin size={12} className="mr-1" />
              {listing.hostel}
            </div>
          )}
          <div className="flex items-center text-gray-400 text-[10px]">
            <Clock size={12} className="mr-1" />
            {timeAgo(listing.createdAt)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
