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
  float64,
  Result,
  Canister,
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Enums for different statuses
const RequestStatus = Variant({ Pending: Null, Played: Null });
const TipStatus = Variant({ Pending: Null, Completed: Null });
const UserStatus = Variant({ Active: Null, Deactivated: Null });
const UserRole = Variant({ RegularUser: Null, Admin: Null, DJ: Null });

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
  total_rating_points: nat64,
  avg_rating: float64,
});

// Error Variant without 'Success'
const Error = Variant({
  Error: text,
  NotFound: text,
  InvalidPayload: text,
  PaymentFailed: text,
  PaymentCompleted: text,
});

// Storage initialization with improved structures
const usersStorage = new StableBTreeMap<text, User>(0, text, User);
const contactsStorage = new StableBTreeMap<text, text>(1, text, text); // contact -> user_id
const songRequestsStorage = new StableBTreeMap<text, SongRequest>(2, text, SongRequest);
const tipsStorage = new StableBTreeMap<text, Tip>(3, text, Tip);
const eventsStorage = new StableBTreeMap<text, Event>(4, text, Event);
const playlistsStorage = new StableBTreeMap<text, Playlist>(5, text, Playlist);
const ratingsStorage = new StableBTreeMap<text, Rating>(6, text, Rating);
const leaderboardStorage = new StableBTreeMap<text, LeaderboardEntry>(7, text, LeaderboardEntry);

// Centralized error handling function
function createError<T>(errorType: string, message: string): Result<T, Error> {
  return Err({ [errorType]: message });
}

// CRUD Operations with type annotations and improved validations
export default Canister({
  // Create a User Profile
  createUserProfile: update(
    [User],
    Result(User, Error),
    (payload: User): Result<User, Error> => {
      const { name, contact, role } = payload;

      // Validate payload
      if (!name || !contact || !role || name.trim() === "" || contact.trim() === "") {
        return createError<User>("InvalidPayload", "Missing or invalid required fields");
      }

      // Check if contact already exists
      const existingUserIdOpt = contactsStorage.get(contact.trim());
      if ("Some" in existingUserIdOpt) {
        return createError<User>("InvalidPayload", "Contact already exists");
      }

      const userId = uuidv4();
      const user: User = {
        id: userId,
        name: name.trim(),
        contact: contact.trim(),
        role: role,
        created_at: ic.time(),
        status: { Active: null },
        points: 0n,
      };

      usersStorage.insert(userId, user);
      contactsStorage.insert(contact.trim(), userId);

      return Ok(user);
    }
  ),

  // Get User Profile by ID
  getUserProfile: query(
    [text],
    Result(User, Error),
    (userId: text): Result<User, Error> => {
      const userOpt = usersStorage.get(userId);
      if ("None" in userOpt) {
        return createError<User>("NotFound", `User with ID ${userId} not found`);
      }
      return Ok(userOpt.Some);
    }
  ),

  // Update User Profile by ID
  updateUserProfile: update(
    [text, User],
    Result(User, Error),
    (userId: text, payload: User): Result<User, Error> => {
      const { name, contact, role } = payload;

      // Validate payload
      if (!name || !contact || !role || name.trim() === "" || contact.trim() === "") {
        return createError<User>("InvalidPayload", "Missing or invalid required fields");
      }

      // Check if user exists
      const userOpt = usersStorage.get(userId);
      if ("None" in userOpt) {
        return createError<User>("NotFound", `User with ID ${userId} not found`);
      }

      // Check if contact is used by another user
      const existingUserIdOpt = contactsStorage.get(contact.trim());
      if ("Some" in existingUserIdOpt && existingUserIdOpt.Some !== userId) {
        return createError<User>("InvalidPayload", "Contact already exists");
      }

      const updatedUser: User = {
        ...userOpt.Some,
        name: name.trim(),
        contact: contact.trim(),
        role: role,
      };

      usersStorage.insert(userId, updatedUser);
      contactsStorage.insert(contact.trim(), userId);

      return Ok(updatedUser);
    }
  ),

  // Get All User Profiles
  getUserProfiles: query(
    [],
    Result(Vec(User), Error),
    (): Result<Vec<User>, Error> => {
      const users = usersStorage.values();
      if (users.length === 0) {
        return createError<Vec<User>>("NotFound", "No user profiles found");
      }
      return Ok(users);
    }
  ),

  // Create a Song Request
  createSongRequest: update(
    [SongRequest],
    Result(SongRequest, Error),
    (payload: SongRequest): Result<SongRequest, Error> => {
      const { song_name, user_id } = payload;

      // Validate payload
      if (!song_name || !user_id || song_name.trim() === "") {
        return createError<SongRequest>("InvalidPayload", "Missing or invalid input fields");
      }

      // Check if user exists
      const userOpt = usersStorage.get(user_id);
      if ("None" in userOpt) {
        return createError<SongRequest>("NotFound", `User with ID ${user_id} not found`);
      }

      const user = userOpt.Some;
      if ("DJ" in user.role) {
        return createError<SongRequest>("InvalidPayload", "DJ cannot make song requests");
      }

      const requestId = uuidv4();
      const songRequest: SongRequest = {
        id: requestId,
        user_id: user_id,
        song_name: song_name.trim(),
        request_status: { Pending: null },
        created_at: ic.time(),
      };

      songRequestsStorage.insert(requestId, songRequest);

      return Ok(songRequest);
    }
  ),

  // Create a Tip
  createTip: update(
    [Tip],
    Result(Tip, Error),
    (payload: Tip): Result<Tip, Error> => {
      const { user_id, dj_name, amount } = payload;

      // Validate payload
      if (!dj_name || !user_id || dj_name.trim() === "" || amount <= 0n) {
        return createError<Tip>("InvalidPayload", "Missing or invalid input fields");
      }

      // Check if user exists
      const userOpt = usersStorage.get(user_id);
      if ("None" in userOpt) {
        return createError<Tip>("NotFound", `User with ID ${user_id} not found`);
      }

      const user = userOpt.Some;
      if ("DJ" in user.role) {
        return createError<Tip>("InvalidPayload", "DJ cannot make tips");
      }

      // Find DJ by name (case-insensitive)
      const djOpt = usersStorage
        .values()
        .find(
          (dj) => dj.name.toLowerCase() === dj_name.trim().toLowerCase() && "DJ" in dj.role
        );

      if (!djOpt) {
        return createError<Tip>("NotFound", `DJ with name ${dj_name} not found`);
      }

      const tipId = uuidv4();
      const tip: Tip = {
        id: tipId,
        user_id: user_id,
        dj_name: dj_name.trim(),
        amount: amount,
        tip_status: { Pending: null },
        created_at: ic.time(),
      };

      tipsStorage.insert(tipId, tip);

      // Update leaderboard
      const leaderboardEntryOpt = leaderboardStorage.get(dj_name.trim());
      if ("Some" in leaderboardEntryOpt) {
        const leaderboardEntry = leaderboardEntryOpt.Some;
        leaderboardEntry.total_tips += amount;
        leaderboardStorage.insert(dj_name.trim(), leaderboardEntry);
      } else {
        const newLeaderboardEntry: LeaderboardEntry = {
          dj_name: dj_name.trim(),
          total_tips: amount,
          total_ratings: 0n,
          total_rating_points: 0n,
          avg_rating: 0.0,
        };
        leaderboardStorage.insert(dj_name.trim(), newLeaderboardEntry);
      }

      return Ok(tip);
    }
  ),

  // Create a Rating
  createRating: update(
    [Rating],
    Result(Rating, Error),
    (payload: Rating): Result<Rating, Error> => {
      const { dj_name, rating, user_id, review } = payload;

      // Validate payload
      if (
        !dj_name ||
        !user_id ||
        dj_name.trim() === "" ||
        rating < 1n ||
        rating > 5n
      ) {
        return createError<Rating>("InvalidPayload", "Invalid input fields");
      }

      // Check if user exists
      const userOpt = usersStorage.get(user_id);
      if ("None" in userOpt) {
        return createError<Rating>("NotFound", `User with ID ${user_id} not found`);
      }

      // Find DJ by name
      const djOpt = usersStorage
        .values()
        .find(
          (dj) => dj.name.toLowerCase() === dj_name.trim().toLowerCase() && "DJ" in dj.role
        );

      if (!djOpt) {
        return createError<Rating>("NotFound", `DJ with name ${dj_name} not found`);
      }

      const ratingId = uuidv4();
      const newRating: Rating = {
        id: ratingId,
        user_id: user_id,
        dj_name: dj_name.trim(),
        rating: rating,
        review: review || "",
        created_at: ic.time(),
      };

      ratingsStorage.insert(ratingId, newRating);

      // Update leaderboard
      const leaderboardEntryOpt = leaderboardStorage.get(dj_name.trim());
      if ("Some" in leaderboardEntryOpt) {
        const leaderboardEntry = leaderboardEntryOpt.Some;
        leaderboardEntry.total_ratings += 1n;
        leaderboardEntry.total_rating_points += rating;
        leaderboardEntry.avg_rating =
          Number(leaderboardEntry.total_rating_points) /
          Number(leaderboardEntry.total_ratings);
        leaderboardStorage.insert(dj_name.trim(), leaderboardEntry);
      } else {
        const newLeaderboardEntry: LeaderboardEntry = {
          dj_name: dj_name.trim(),
          total_tips: 0n,
          total_ratings: 1n,
          total_rating_points: rating,
          avg_rating: Number(rating),
        };
        leaderboardStorage.insert(dj_name.trim(), newLeaderboardEntry);
      }

      return Ok(newRating);
    }
  ),

  // Create an Event
  createEvent: update(
    [Event],
    Result(Event, Error),
    (payload: Event): Result<Event, Error> => {
      const { event_name, dj_name, venue, capacity, scheduled_at } = payload;

      // Validate payload
      if (
        !event_name ||
        !dj_name ||
        !venue ||
        event_name.trim() === "" ||
        dj_name.trim() === "" ||
        venue.trim() === "" ||
        capacity <= 0n ||
        scheduled_at <= ic.time()
      ) {
        return createError<Event>("InvalidPayload", "Invalid event details");
      }

      const eventId = uuidv4();
      const newEvent: Event = {
        id: eventId,
        event_name: event_name.trim(),
        dj_name: dj_name.trim(),
        venue: venue.trim(),
        capacity: capacity,
        scheduled_at: scheduled_at,
        created_at: ic.time(),
      };

      eventsStorage.insert(eventId, newEvent);
      return Ok(newEvent);
    }
  ),

  // Get Event by ID
  getEvent: query(
    [text],
    Result(Event, Error),
    (eventId: text): Result<Event, Error> => {
      const eventOpt = eventsStorage.get(eventId);
      if ("None" in eventOpt) {
        return createError<Event>("NotFound", `Event with ID ${eventId} not found`);
      }
      return Ok(eventOpt.Some);
    }
  ),

  // Get All Events
  getAllEvents: query(
    [],
    Result(Vec(Event), Error),
    (): Result<Vec<Event>, Error> => {
      const events = eventsStorage.values();
      if (events.length === 0) {
        return createError<Vec<Event>>("NotFound", "No events found");
      }
      return Ok(events);
    }
  ),

  // Create a Playlist
  createPlaylist: update(
    [Playlist],
    Result(Playlist, Error),
    (payload: Playlist): Result<Playlist, Error> => {
      const { dj_name, event_id, song_list } = payload;

      // Validate payload
      if (
        !dj_name ||
        !event_id ||
        dj_name.trim() === "" ||
        event_id.trim() === "" ||
        song_list.length === 0
      ) {
        return createError<Playlist>("InvalidPayload", "Missing required fields");
      }

      // Check if event exists
      const eventOpt = eventsStorage.get(event_id);
      if ("None" in eventOpt) {
        return createError<Playlist>("NotFound", `Event with ID ${event_id} not found`);
      }

      const playlistId = uuidv4();
      const newPlaylist: Playlist = {
        id: playlistId,
        dj_name: dj_name.trim(),
        event_id: event_id,
        song_list: song_list.map((song) => song.trim()),
        created_at: ic.time(),
      };

      playlistsStorage.insert(playlistId, newPlaylist);
      return Ok(newPlaylist);
    }
  ),

  // Get Playlist by DJ Name
  getPlaylistByDjName: query(
    [text],
    Result(Vec(Playlist), Error),
    (dj_name: text): Result<Vec(Playlist>, Error> => {
      const playlists = playlistsStorage
        .values()
        .filter((playlist) => playlist.dj_name.toLowerCase() === dj_name.trim().toLowerCase());

      if (playlists.length === 0) {
        return createError<Vec<Playlist>>("NotFound", `No playlists found for DJ: ${dj_name}`);
      }

      return Ok(playlists);
    }
  ),

  // Search DJs by Rating
  searchDJsByRating: query(
    [float64],
    Result(Vec(User), Error),
    (rating: float64): Result<Vec<User>, Error> => {
      const leaderboardEntries = leaderboardStorage.values();

      const djNames = leaderboardEntries
        .filter((entry) => entry.avg_rating >= rating)
        .map((entry) => entry.dj_name);

      const djs: Vec<User> = [];
      for (const djName of djNames) {
        const djOpt = usersStorage
          .values()
          .find(
            (user) =>
              user.name.toLowerCase() === djName.toLowerCase() && "DJ" in user.role
          );
        if (djOpt) {
          djs.push(djOpt);
        }
      }

      if (djs.length === 0) {
        return createError<Vec<User>>("NotFound", `No DJs found with rating >= ${rating}`);
      }

      return Ok(djs);
    }
  ),

  // Get Leaderboard
  getLeaderboard: query(
    [],
    Result(Vec(LeaderboardEntry), Error),
    (): Result<Vec<LeaderboardEntry>, Error> => {
      const entries = leaderboardStorage.values();
      if (entries.length === 0) {
        return createError<Vec<LeaderboardEntry>>("NotFound", "No leaderboard entries found");
      }
      return Ok(entries);
    }
  ),
});
