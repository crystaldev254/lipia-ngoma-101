
# DJ Event Management and Tipping Platform

## Overview

This is a decentralized platform to manage DJ events, song requests, tips, playlists, and ratings. Users can create profiles, request songs, tip DJs, rate DJs, and manage events and playlists. The platform uses Azle and Dfinity for canister management.

## Features

### User Profile Management
- Create user profiles with role-based access (`RegularUser`, `Admin`, `DJ`).
- Update user profiles with validation checks.
- Fetch user profiles by ID or retrieve all user profiles.

### Song Requests
- Users can make song requests with validation to ensure only non-DJ users can request songs.
- Song requests are assigned a `Pending` or `Played` status.

### Tips Management
- Users can tip DJs, and tips are stored with a `Pending` or `Completed` status.
- Tips are reflected in the DJ's leaderboard stats, updating total tips and average rating.

### Event Management
- DJs can create events with venue and capacity details.
- Events are scheduled with validation for proper input fields.

### Playlists
- DJs can create playlists associated with their events.
- Playlists are linked to both the DJ and the event.

### Ratings and Reviews
- Users can rate DJs and leave reviews.
- Ratings are reflected in the DJ's leaderboard stats, updating total ratings and average rating.

### Leaderboards
- Leaderboards track DJ performance, total tips, total ratings, and average rating.
- DJs can be searched based on ratings.

## Canister Operations

### User Profile Operations
- **createUserProfile**: Create a user profile with validation.
- **getUserProfile**: Get a user profile by ID.
- **updateUserProfile**: Update a user profile with validation.
- **getUserProfiles**: Fetch all user profiles.

### Song Request Operations
- **createSongRequest**: Create a song request with validation.
- **getSongRequests**: Fetch song requests.

### Tip Operations
- **createTip**: Create a tip for a DJ with validation and leaderboard updates.

### Event Operations
- **createEvent**: Create an event for DJs with validation.
- **getAllEvents**: Fetch all events.
- **getEventByName**: Fetch events by name.

### Playlist Operations
- **createPlaylist**: Create a playlist for an event with validation.
- **getPlaylistByDjName**: Get playlists by DJ name.
- **getPlaylistByEventId**: Get playlists by event ID.

### Rating Operations
- **createRating**: Rate a DJ and update the leaderboard.

### Leaderboard Operations
- **getLeaderboard**: Fetch the leaderboard.
- **searchDjs**: Search DJs by rating.



## Things to be explained in the course:
1. What is Ledger? More details here: https://internetcomputer.org/docs/current/developer-docs/integrations/ledger/
2. What is Internet Identity? More details here: https://internetcomputer.org/internet-identity
3. What is Principal, Identity, Address? https://internetcomputer.org/internet-identity | https://yumimarketplace.medium.com/whats-the-difference-between-principal-id-and-account-id-3c908afdc1f9
4. Canister-to-canister communication and how multi-canister development is done? https://medium.com/icp-league/explore-backend-multi-canister-development-on-ic-680064b06320

## How to deploy canisters implemented in the course

### Ledger canister
`./deploy-local-ledger.sh` - deploys a local Ledger canister. IC works differently when run locally so there is no default network token available and you have to deploy it yourself. Remember that it's not a token like ERC-20 in Ethereum, it's a native token for ICP, just deployed separately.
This canister is described in the `dfx.json`:
```
	"ledger_canister": {
  	"type": "custom",
  	"candid": "https://raw.githubusercontent.com/dfinity/ic/928caf66c35627efe407006230beee60ad38f090/rs/rosetta-api/icp_ledger/ledger.did",
  	"wasm": "https://download.dfinity.systems/ic/928caf66c35627efe407006230beee60ad38f090/canisters/ledger-canister.wasm.gz",
  	"remote": {
    	"id": {
      	"ic": "ryjl3-tyaaa-aaaaa-aaaba-cai"
    	}
  	}
	}
```
`remote.id.ic` - that is the principal of the Ledger canister and it will be available by this principal when you work with the ledger.

Also, in the scope of this script, a minter identity is created which can be used for minting tokens
for the testing purposes.
Additionally, the default identity is pre-populated with 1000_000_000_000 e8s which is equal to 10_000 * 10**8 ICP.
The decimals value for ICP is 10**8.

List identities:
`dfx identity list`

Switch to the minter identity:
`dfx identity use minter`

Transfer ICP:
`dfx ledger transfer <ADDRESS>  --memo 0 --icp 100 --fee 0`
where:
 - `--memo` is some correlation id that can be set to identify some particular transactions (we use that in the marketplace canister).
 - `--icp` is the transfer amount
 - `--fee` is the transaction fee. In this case it's 0 because we make this transfer as the minter idenity thus this transaction is of type MINT, not TRANSFER.
 - `<ADDRESS>` is the address of the recipient. To get the address from the principal, you can use the helper function from the marketplace canister - `getAddressFromPrincipal(principal: Principal)`, it can be called via the Candid UI.


### Internet identity canister

`dfx deploy internet_identity` - that is the canister that handles the authentication flow. Once it's deployed, the `js-agent` library will be talking to it to register identities. There is UI that acts as a wallet where you can select existing identities
or create a new one.

### Marketplace canister

`dfx deploy dfinity_js_backend` - deploys the marketplace canister where the business logic is implemented.
Basically, it implements functions like add, view, update, delete, and buy products + a set of helper functions.

Do not forget to run `dfx generate dfinity_js_backend` anytime you add/remove functions in the canister or when you change the signatures.
Otherwise, these changes won't be reflected in IDL's and won't work when called using the JS agent.

