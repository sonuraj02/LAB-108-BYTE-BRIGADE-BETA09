# Security Specification - CampusX Marketplace

## Data Invariants
- A listing must have a valid `sellerId` matching the creator's UID.
- A message must belong to a conversation where the sender is a participant.
- A profile can only be modified by the user who owns it.
- Images must be an array of strings (URLs).

## The Dirty Dozen (Potential Attacks)
1. **Profile Hijacking**: User A attempts to update User B's profile.
2. **Ghost Listing**: User A attempts to create a listing with `sellerId` set to User B.
3. **Price Manipulation**: A buyer attempts to update the price of a listing they don't own.
4. **Conversation Snooping**: User C attempts to read messages in a conversation between User A and User B.
5. **Unauthorized Messaging**: User C attempts to send a message to a conversation they are not part of.
6. **Fake Sold Status**: User B (not the seller) attempts to mark a listing as "sold".
7. **Role Escalation**: User A attempts to set their own `role` to "admin".
8. **Malicious ID**: User A uses a 1MB string as a document ID.
9. **Spam Listings**: User A creates 1000 listings in a single batch (rule should limit size/content).
10. **Shadow Fields**: User A adds extra fields like `isVerified: true` to their profile which doesn't exist in schema.
11. **Timestamp Spoofing**: User A sets `createdAt` to a future date.
12. **Unverified Email Access**: A user with an unverified email attempts to list an item (if we enforce verification).

## Test Runner Logic
We will implement rules that deny all the above.
