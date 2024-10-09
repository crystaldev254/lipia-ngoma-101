import { verify } from "@dfinity/agent";
import { auto } from "@popperjs/core";
import {
  query,
  update,
  text,
  Null,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  None,
  Some,
  Ok,
  Err,
  ic,
  Principal,
  Opt,
  nat64,
  Duration,
  Result,
  bool,
  Canister,
} from "azle";
import {
  Address,
  Ledger,
  binaryAddressFromAddress,
  binaryAddressFromPrincipal,
  hexAddressFromPrincipal,
} from "azle/canisters/ledger";
//@ts-ignore
import { hashCode } from "hashcode";
import { v4 as uuidv4 } from "uuid";

// Enums for different features
const RequestStatus = Variant({
  Pending: Null,
  Played: Null,
});

const TipStatus = Variant({
  Pending: Null,
  Completed: Null,
});

const UserStatus = Variant({
  Active: Null,
  Deactivated: Null,
});

const UserRole = Variant({
  RegularUser: Null,
  Admin: Null,
  DJ: Null,
});

// Structs for features
const User = Record({
  id: text,
  name: text,
  contact: text,
  created_at: nat64,
  status: UserStatus,
  role: UserRole,
  points: nat64,
});

const SongRequest = Record({
  id: text,
  user_id: text,
  song_name: text,
  request_status: RequestStatus,
  created_at: nat64,
});

const Tip = Record({
  id: text,
  user_id: text,
  dj_name: text,
  amount: nat64,
  tip_status: TipStatus,
  created_at: nat64,
});

const Event = Record({
  id: text,
  event_name: text,
  dj_name: text,
  venue: text,
  capacity: nat64,
  scheduled_at: nat64,
  created_at: nat64,
});

const Playlist = Record({
  id: text,
  dj_name: text,
  event_id: text,
  song_list: Vec(text),
  created_at: nat64,
});

const Rating = Record({
  id: text,
  user_id: text,
  dj_name: text,
  rating: nat64,
  review: text,
  created_at: nat64,
});

const LeaderboardEntry = Record({
  dj_name: text,
  total_tips: nat64,
  total_ratings: nat64,
  avg_rating: nat64,
});

// Error Struct
const Error = Variant({
  Success: text,
  Error: text,
  NotFound: text,
  InvalidPayload: text,
  PaymentFailed: text,
  PaymentCompleted: text,
});

// Payloads

// User Profile Payload
const UserProfilePayload = Record({
  name: text,
  contact: text,
  role: UserRole,
});

// Song Request Payload
const SongRequestPayload = Record({
  song_name: text,
  user_id: text,
});

// Tip Payload
const TipPayload = Record({
  dj_name: text,
  amount: nat64,
  user_id: text,
});

// Event Payload
const EventPayload = Record({
  event_name: text,
  dj_name: text,
  venue: text,
  capacity: nat64,
  scheduled_at: nat64,
});

// Rating Payload
const RatingPayload = Record({
  dj_name: text,
  rating: nat64,
  review: text,
  user_id: text,
});

// Playlist Payload
const PlaylistPayload = Record({
  dj_name: text,
  event_id: text,
  song_list: Vec(text),
});

// Leaderboard Entry Payload
const LeaderboardEntryPayload = Record({
  dj_name: text,
  total_tips: nat64,
  total_ratings: nat64,
  avg_rating: nat64,
});

// Storage initialization
const usersStorage = StableBTreeMap(0, text, User);
const songRequestsStorage = StableBTreeMap(2, text, SongRequest);
const tipsStorage = StableBTreeMap(3, text, Tip);
const eventsStorage = StableBTreeMap(4, text, Event);
const playlistsStorage = StableBTreeMap(5, text, Playlist);
const ratingsStorage = StableBTreeMap(6, text, Rating);
const leaderboardStorage = StableBTreeMap(7, text, LeaderboardEntry);

// CRUD Operations
export default Canister({
  // Create a User Profile with validation
  createUserProfile: update(
  [UserProfilePayload],
  Result(User, Error),
  (payload) => {
    // Authentication and Authorization: Ensure the caller is authorized to create profiles
    if (!ic.caller().is_admin) {
      return Err({ Unauthorized: "User is not authorized to create profiles" });
    }

    // Validate payload
    if (!payload.name || !payload.contact || !payload.role) {
      return Err({ InvalidPayload: "Missing required fields" });
    }

    // Check if contact already exists
    const users = usersStorage.values();
    const contactExists = users.some((user) => user.contact === payload.contact);
    if (contactExists) {
      return Err({ InvalidPayload: "Contact already exists" });
    }

    // Generate unique user ID and check UUID uniqueness
    let userId = uuidv4();
    while (usersStorage.get(userId) !== None) {
      userId = uuidv4(); // Ensure unique UUID
    }

    // Create user profile
    const user = {
      id: userId,
      name: payload.name,
      contact: payload.contact,
      role: payload.role,
      created_at: ic.time(),
      status: { Active: null },
      points: 0n,
    };

    // Insert user profile into storage
    usersStorage.insert(userId, user);

    return Ok(user); // Return created user profile
  }
);

  // Get User Profile by ID
  getUserProfile: query([text], Result(User, Error), (userId) => {
    const userOpt = usersStorage.get(userId);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${userId} not found` });
    }
    return Ok(userOpt.Some); // Return the user profile
  }),

  // Update User Profile by ID with validation
  updateUserProfile: update(
    [text, UserProfilePayload],
    Result(User, Error),
    (userId, payload) => {
      // Validate the payload
      if (!payload.name || !payload.contact || !payload.role) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Check if the user exists
      const userOpt = usersStorage.get(userId);
      if ("None" in userOpt) {
        return Err({ NotFound: `User with ID ${userId} not found` });
      }

      // Validation for unique contact check
      const users = usersStorage.values();
      const contactExists = users.some(
        (user) => user.contact === payload.contact && user.id !== userId
      );
      if (contactExists) {
        return Err({ InvalidPayload: "Contact already exists" });
      }

      // Proceed to update the user profile
      const user = userOpt.Some;
      const updatedUser = {
        ...user,
        ...payload,
      };

      usersStorage.insert(userId, updatedUser); // Update the user profile

      return Ok(updatedUser); // Successfully return the updated user profile
    }
  ),

  // Get User Profiles
  getUserProfiles: query([], Result(Vec(User), Error), () => {
    const users = usersStorage.values();
    if (users.length === 0) {
      return Err({ NotFound: "No user profiles found" });
    }
    return Ok(users); // Return all user profiles
  }),

  // Create a Song Request with validation
  createSongRequest: update(
  [SongRequestPayload],
  Result(SongRequest, Error),
  (payload) => {
    // Authentication: Ensure the caller is a regular user
    if (!ic.caller().is_regular_user) {
      return Err({ Unauthorized: "Only regular users can request songs" });
    }

    // Validate payload
    if (!payload.song_name || !payload.user_id) {
      return Err({ InvalidPayload: "Missing required fields" });
    }

    // Ensure the user exists and is not a DJ
    const userOpt = usersStorage.get(payload.user_id);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${payload.user_id} not found` });
    }
    const user = userOpt.Some;
    if ("DJ" in user.role) {
      return Err({ Unauthorized: "DJ cannot make song requests" });
    }

    // Basic rate limiting to prevent abuse
    const requests = songRequestsStorage.values();
    const recentRequests = requests.filter(
      (req) => req.user_id === payload.user_id && ic.time() - req.created_at < 600000 // 10-minute window
    );
    if (recentRequests.length > 5) {
      return Err({ RateLimited: "Too many song requests in a short period" });
    }

    // Generate unique song request ID
    let requestId = uuidv4();
    while (songRequestsStorage.get(requestId) !== None) {
      requestId = uuidv4(); // Ensure unique UUID
    }

    // Create song request
    const songRequest = {
      id: requestId,
      user_id: payload.user_id,
      song_name: payload.song_name,
      request_status: { Pending: null },
      created_at: ic.time(),
    };

    songRequestsStorage.insert(requestId, songRequest);

    return Ok(songRequest);
  }
    },

  // Create a Tip with validation
  createTip: update([TipPayload], Result(Tip, Error), (payload) => {
  // Authentication: Ensure the caller is a regular user
  if (!ic.caller().is_regular_user) {
    return Err({ Unauthorized: "Only regular users can make tips" });
  }

  // Validate payload
  if (!payload.dj_name || payload.amount <= 0 || !payload.user_id) {
    return Err({ InvalidPayload: "Missing required fields" });
  }

  // Validate user existence and ensure they are not a DJ
  const userOpt = usersStorage.get(payload.user_id);
  if ("None" in userOpt) {
    return Err({ NotFound: `User with ID ${payload.user_id} not found` });
  }
  const user = userOpt.Some;
  if ("DJ" in user.role) {
    return Err({ InvalidPayload: "DJs cannot make tips" });
  }

  // Validate DJ existence
  const djOpt = usersStorage
    .values()
    .find((dj) => dj.name.toLowerCase() === payload.dj_name.toLowerCase());
  if (!djOpt) {
    return Err({ NotFound: `DJ with name ${payload.dj_name} not found` });
  }

  // Generate unique tip ID
  let tipId = uuidv4();
  while (tipsStorage.get(tipId) !== None) {
    tipId = uuidv4(); // Ensure unique UUID
  }

  // Create tip object
  const tip = {
    id: tipId,
    user_id: payload.user_id,
    dj_name: payload.dj_name,
    amount: payload.amount,
    tip_status: { Pending: null },
    created_at: ic.time(),
  };

  tipsStorage.insert(tipId, tip);

  // Atomic leaderboard update
  ic.atomic(() => {
    const leaderboardEntryOpt = leaderboardStorage.get(payload.dj_name);
    if ("Some" in leaderboardEntryOpt) {
      const leaderboardEntry = leaderboardEntryOpt.Some;
      leaderboardEntry.total_tips += payload.amount;
      leaderboardStorage.insert(payload.dj_name, leaderboardEntry);
    } else {
      const newLeaderboardEntry = {
        dj_name: payload.dj_name,
        total_tips: payload.amount,
        total_ratings: 0n,
        avg_rating: 0n,
      };
      leaderboardStorage.insert(payload.dj_name, newLeaderboardEntry);
    }
  });

  return Ok(tip);
});


  // Create an Event with validation
  createEvent: update([EventPayload], Result(Event, Error), (payload) => {
  // Authorization: Ensure only DJs can create events
  if (!ic.caller().is_dj) {
    return Err({ Unauthorized: "Only DJs can create events" });
  }

  // Validate payload
  if (
    !payload.event_name ||
    !payload.dj_name ||
    !payload.venue ||
    payload.capacity <= 0 ||
    payload.scheduled_at <= ic.time()
  ) {
    return Err({ InvalidPayload: "Invalid or missing fields" });
  }

  // Generate unique event ID
  let eventId = uuidv4();
  while (eventsStorage.get(eventId) !== None) {
    eventId = uuidv4(); // Ensure unique UUID
  }

  // Create event object
  const event = {
    id: eventId,
    event_name: payload.event_name,
    dj_name: payload.dj_name,
    venue: payload.venue,
    capacity: payload.capacity,
    scheduled_at: payload.scheduled_at,
    created_at: ic.time(),
  };

  eventsStorage.insert(eventId, event);

  return Ok(event);
});


  // Get All Events
  getAllEvents: query([], Result(Vec(Event), text), () => {
    const events = eventsStorage.values();
    if (events.length === 0) {
      return Err("No events found");
    }
    return Ok(events);
  }),

  // Get Event by Name
  getEventByName: query([text], Result(Event, text), (event_name) => {
    const events = eventsStorage.values();
    const event = events.find((event) => event.event_name === event_name);
    if (!event) {
      return Err("Event not found");
    }
    return Ok(event);
  }),

  // Create Rating with validation and update leaderboard
  createRating: update([RatingPayload], Result(Rating, Error), (payload) => {
    // Validate the payload
    if (!payload.dj_name || !payload.user_id) {
      return Err({ InvalidPayload: "Missing or invalid input fields" });
    }

    // Check if the user exists
    const userOpt = usersStorage.get(payload.user_id);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${payload.user_id} not found` });
    }

    // Generate a unique ID for the rating
    const ratingId = uuidv4();

    // Create the rating object
    const newRating = {
      id: ratingId,
      user_id: payload.user_id,
      dj_name: payload.dj_name,
      rating: payload.rating,
      review: payload.review,
      created_at: ic.time(), // Record the current time
    };

    // Insert the rating into storage
    ratingsStorage.insert(ratingId, newRating);

    // Update the leaderboard entry for the DJ
    const leaderboardEntryOpt = leaderboardStorage.get(payload.dj_name);
    if ("Some" in leaderboardEntryOpt) {
      // Update existing leaderboard entry
      const leaderboardEntry = leaderboardEntryOpt.Some;

      const total_ratings = leaderboardEntry.total_ratings + 1n;

      const avg_rating =
        (leaderboardEntry.avg_rating * leaderboardEntry.total_ratings) /
        total_ratings;

      leaderboardEntry.total_ratings = total_ratings;
      leaderboardEntry.avg_rating = avg_rating;
      leaderboardStorage.insert(payload.dj_name, leaderboardEntry);
    } else {
      // Create new leaderboard entry for the DJ
      const newLeaderboardEntry = {
        dj_name: payload.dj_name,
        total_tips: 0n,
        total_ratings: 1n,
        avg_rating: BigInt(payload.rating), // Ensure rating is BigInt
      };
      leaderboardStorage.insert(payload.dj_name, newLeaderboardEntry);
    }

    return Ok(newRating); // Return the created rating
  }),

  // Create a Playlist with validation
  createPlaylist: update(
    [PlaylistPayload],
    Result(Playlist, Error),
    (payload) => {
      // Validate the payload
      if (
        !payload.dj_name ||
        payload.song_list.length === 0 ||
        !payload.event_id
      ) {
        return Err({ InvalidPayload: "Missing or invalid input fields" });
      }

      // Check if the event exists
      const eventOpt = eventsStorage.get(payload.event_id);
      if ("None" in eventOpt) {
        return Err({ NotFound: `Event with ID ${payload.event_id} not found` });
      }

      // Generate a unique ID for the playlist
      const playlistId = uuidv4();

      // Create the playlist object
      const playlist = {
        id: playlistId,
        dj_name: payload.dj_name,
        event_id: payload.event_id,
        song_list: payload.song_list,
        created_at: ic.time(), // Record the current time
      };

      // Insert the playlist into storage
      playlistsStorage.insert(playlistId, playlist);

      return Ok(playlist); // Return the created playlist
    }
  ),

  // Get Playlist by DJ Name with validation
  getPlaylistByDjName: query(
    [text],
    Result(Vec(Playlist), Error),
    (dj_name) => {
      const playlists = playlistsStorage
        .values()
        .filter((playlist) => playlist.dj_name === dj_name);

      if (playlists.length === 0) {
        return Err({ NotFound: `No playlists found for DJ: ${dj_name}` });
      }

      return Ok(playlists); // Return the list of playlists
    }
  ),

  // Get Playlist by Event ID with validation
  getPlaylistByEventId: query(
    [nat64],
    Result(Vec(Playlist), Error),
    (event_id) => {
      const playlists = playlistsStorage
        .values()
        .filter((playlist) => playlist.event_id === event_id);

      if (playlists.length === 0) {
        return Err({
          NotFound: `No playlists found for event ID: ${event_id}`,
        });
      }

      return Ok(playlists); // Return the list of playlists
    }
  ),

  // Search DJs by Rating with validation
  searchDJsByRating: query([nat64], Result(Vec(User), Error), (rating) => {
    const leaderboardEntries = leaderboardStorage.values();
    const djs = leaderboardEntries
      .filter((entry) => entry.avg_rating >= rating)
      .map((entry) => {
        return usersStorage.get(entry.dj_name).Some;
      });

    if (djs.length === 0) {
      return Err({ NotFound: `No DJs found with rating >= ${rating}` });
    }

    return Ok(djs); // Return the list of DJs
  }),

  // Get all Leaderboard Entries
  getLeaderboard: query([], Result(Vec(LeaderboardEntry), Error), () => {
  // Authorization: Only Admins or DJs can view the leaderboard
  if (!ic.caller().is_admin && !ic.caller().is_dj) {
    return Err({ Unauthorized: "You are not authorized to view the leaderboard" });
  }

  const entries = leaderboardStorage.values();
  if (entries.length === 0) {
    return Err({ NotFound: "No leaderboard entries found" });
  }

  return Ok(entries);
});

});
