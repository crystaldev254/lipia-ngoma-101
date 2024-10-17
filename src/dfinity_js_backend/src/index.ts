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
  nat64,
  Result,
  Canister,
} from "azle";
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
});

// Payloads for input validation
const UserProfilePayload = Record({
  name: text,
  contact: text,
  role: UserRole,
});

const EventPayload = Record({
  event_name: text,
  dj_name: text,
  venue: text,
  capacity: nat64,
  scheduled_at: nat64,
});

const LeaderboardEntryPayload = Record({
  dj_name: text,
  total_tips: nat64,
  total_ratings: nat64,
  avg_rating: nat64,
});

// Storage initialization
const usersStorage = StableBTreeMap(0, text, User);
const eventsStorage = StableBTreeMap(1, text, Event);
const leaderboardStorage = StableBTreeMap(2, text, LeaderboardEntry);

// CRUD Operations
export default Canister({
  // Create a User Profile with validation
  createUserProfile: update(
    [UserProfilePayload],
    Result(User, Error),
    (payload) => {
      // Validate the payload
      if (!payload.name || !payload.contact || !payload.role) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Validation for unique contact check
      const users = usersStorage.values();
      const contactExists = users.some((user) => user.contact === payload.contact);
      if (contactExists) {
        return Err({ InvalidPayload: "Contact already exists" });
      }

      // Generate unique user ID and create profile
      const userId = uuidv4();
      const user = {
        id: userId,
        name: payload.name,
        contact: payload.contact,
        role: payload.role,
        created_at: ic.time(),
        status: { Active: null },
        points: 0n,
      };

      usersStorage.insert(userId, user);
      return Ok(user);
    }
  ),

  // Get User Profile by ID
  getUserProfile: query([text], Result(User, Error), (userId) => {
    const userOpt = usersStorage.get(userId);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${userId} not found` });
    }
    return Ok(userOpt.Some);
  }),

  // Update User Profile by ID
  updateUserProfile: update(
    [text, UserProfilePayload],
    Result(User, Error),
    (userId, payload) => {
      if (!payload.name || !payload.contact || !payload.role) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      const userOpt = usersStorage.get(userId);
      if ("None" in userOpt) {
        return Err({ NotFound: `User with ID ${userId} not found` });
      }

      const updatedUser = { ...userOpt.Some, ...payload };
      usersStorage.insert(userId, updatedUser);

      return Ok(updatedUser);
    }
  ),

  // **New Route**: Delete User Profile by ID
  deleteUserProfile: update([text], Result(bool, Error), (userId) => {
    const userOpt = usersStorage.get(userId);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${userId} not found` });
    }
    usersStorage.remove(userId);
    return Ok(true); // Return success
  }),

  // Create an Event with validation
  createEvent: update([EventPayload], Result(Event, Error), (payload) => {
    if (!payload.event_name || !payload.dj_name || !payload.venue || payload.capacity <= 0) {
      return Err({ InvalidPayload: "Missing or invalid input fields" });
    }

    const eventId = uuidv4();
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
  }),

  // **New Route**: Update Event by ID
  updateEvent: update([text, EventPayload], Result(Event, Error), (eventId, payload) => {
    if (!payload.event_name || !payload.dj_name || !payload.venue || payload.capacity <= 0) {
      return Err({ InvalidPayload: "Invalid input" });
    }

    const eventOpt = eventsStorage.get(eventId);
    if ("None" in eventOpt) {
      return Err({ NotFound: `Event with ID ${eventId} not found` });
    }

    const updatedEvent = { ...eventOpt.Some, ...payload };
    eventsStorage.insert(eventId, updatedEvent);
    return Ok(updatedEvent);
  }),

  // **New Route**: Delete Event by ID
  deleteEvent: update([text], Result(bool, Error), (eventId) => {
    const eventOpt = eventsStorage.get(eventId);
    if ("None" in eventOpt) {
      return Err({ NotFound: `Event with ID ${eventId} not found` });
    }
    eventsStorage.remove(eventId);
    return Ok(true); // Successfully deleted
  }),

  // Get All Events
  getAllEvents: query([], Result(Vec(Event), text), () => {
    const events = eventsStorage.values();
    if (events.length === 0) {
      return Err("No events found");
    }
    return Ok(events);
  }),

  // **New Route**: Get Top DJs by Tips and Ratings
  getLeaderboardForTopDJs: query([], Result(Vec(LeaderboardEntry), Error), () => {
    const leaderboard = leaderboardStorage.values();
    const topDJs = leaderboard.sort((a, b) => {
      if (b.total_tips === a.total_tips) {
        return Number(b.avg_rating - a.avg_rating); // Sort by avg rating if tips are equal
      }
      return Number(b.total_tips - a.total_tips);
    });
    return Ok(topDJs.slice(0, 5)); // Return top 5 DJs
  }),

  // Get all Leaderboard Entries
  getLeaderboard: query([], Result(Vec(LeaderboardEntry), Error), () => {
    const entries = leaderboardStorage.values();
    if (entries.length === 0) {
      return Err({ NotFound: "No leaderboard entries found" });
    }
    return Ok(entries);
  }),

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
      // Validate the payload
      if (!payload.song_name || !payload.user_id) {
        return Err({ InvalidPayload: "Missing or invalid input fields" });
      }

      // Validate if the user exists
      const userOpt = usersStorage.get(payload.user_id);
      if ("None" in userOpt) {
        return Err({ NotFound: `User with ID ${payload.user_id} not found` });
      }

      // Ensure the user is not a DJ
      const user = userOpt.Some; // Safely unwrap the user

      if ("DJ" in user.role) {
        return Err({ InvalidPayload: "DJ cannot make song requests" });
      }

      // Generate a unique ID for the song request using uuidv4
      const requestId = uuidv4();

      // Create the song request object
      const songRequest = {
        id: requestId,
        user_id: payload.user_id,
        song_name: payload.song_name,
        request_status: { Pending: null },
        created_at: ic.time(), // Record the current time
      };

      // Insert the song request into storage
      songRequestsStorage.insert(requestId, songRequest);

      return Ok(songRequest); // Successfully return the created song request
    }
  ),

  // Create a Tip with validation
  createTip: update([TipPayload], Result(Tip, Error), (payload) => {
    // Validate the payload
    if (!payload.dj_name || payload.amount <= 0 || !payload.user_id) {
      return Err({ InvalidPayload: "Missing or invalid input fields" });
    }

    // Validate if the user exists
    const userOpt = usersStorage.get(payload.user_id);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${payload.user_id} not found` });
    }

    // Ensure the user is not a DJ
    const user = userOpt.Some; // Safely unwrap the user
    if ("DJ" in user.role) {
      return Err({ InvalidPayload: "DJ cannot make tips" });
    }

    // Ensure the DJ exists (case-insensitive search)
    const djOpt = usersStorage
      .values()
      .find((dj) => dj.name.toLowerCase() === payload.dj_name.toLowerCase());

    if (!djOpt) {
      return Err({ NotFound: `DJ with name ${payload.dj_name} not found` });
    }

    // Generate a unique ID for the tip
    const tipId = uuidv4();

    // Create the tip object
    const tip = {
      id: tipId,
      user_id: payload.user_id,
      dj_name: payload.dj_name,
      amount: payload.amount,
      tip_status: { Pending: null }, // Correct use of variant
      created_at: ic.time(), // Record the current time
    };

    // Insert the tip into storage
    tipsStorage.insert(tipId, tip);

    // Update the leaderboard entry for the DJ
    const leaderboardEntryOpt = leaderboardStorage.get(payload.dj_name);
    if ("Some" in leaderboardEntryOpt) {
      // Update existing leaderboard entry
      const leaderboardEntry = leaderboardEntryOpt.Some;
      leaderboardEntry.total_tips += payload.amount;
      leaderboardStorage.insert(payload.dj_name, leaderboardEntry);
    } else {
      // Create new leaderboard entry for the DJ
      const newLeaderboardEntry = {
        dj_name: payload.dj_name,
        total_tips: payload.amount,
        total_ratings: 0n,
        avg_rating: 0n,
      };
      leaderboardStorage.insert(payload.dj_name, newLeaderboardEntry);
    }

    return Ok(tip); // Successfully return the created tip
  }),

  // Create an Event with validation
  createEvent: update([EventPayload], Result(Event, Error), (payload) => {
    // Validate the payload
    if (
      !payload.event_name ||
      !payload.dj_name ||
      !payload.venue ||
      payload.capacity <= 0 ||
      !payload.scheduled_at
    ) {
      return Err({ InvalidPayload: "Missing or invalid input fields" });
    }

    // Generate a unique ID for the event
    const eventId = uuidv4();

    // Create the event object
    const event = {
      id: eventId,
      event_name: payload.event_name,
      dj_name: payload.dj_name,
      venue: payload.venue,
      capacity: payload.capacity,
      scheduled_at: payload.scheduled_at,
      created_at: ic.time(), // Record the current time
    };

    // Insert the event into storage
    eventsStorage.insert(eventId, event);

    return Ok(event); // Successfully return the created event
  }),

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
    const entries = leaderboardStorage.values();
    if (entries.length === 0) {
      return Err({ NotFound: "No leaderboard entries found" });
    }
    return Ok(entries); // Return all leaderboard entries
  }),
});
