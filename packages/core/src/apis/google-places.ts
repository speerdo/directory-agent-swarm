import { createLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rate-limiter.js';

const logger = createLogger('google-places');

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: Array<{ text: string; author: string }>;
  lat?: number;
  lng?: number;
  hours?: string[];
}

interface PlaceApiPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  phoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    text?: { text?: string };
    authorAttribution?: { displayName?: string };
  }>;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

interface PlacesApiResponse {
  places?: PlaceApiPlace[];
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  await rateLimiter.waitForLimit('google-places');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required');
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.phoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.reviews.text,places.reviews.authorAttribution,places.location,places.regularOpeningHours.weekdayDescriptions',
    },
    body: JSON.stringify({
      textQuery: query,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ query, status: response.status, error }, 'Places API search failed');
    throw new Error(`Places API error: ${response.status} ${error}`);
  }

  const data = await response.json() as PlacesApiResponse;

  return (data.places ?? []).map((place): PlaceSearchResult => ({
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    phone: place.phoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    reviews: place.reviews?.map(r => ({
      text: r.text?.text ?? '',
      author: r.authorAttribution?.displayName ?? '',
    })),
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    hours: place.regularOpeningHours?.weekdayDescriptions,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
  await rateLimiter.waitForLimit('google-places');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required');
  }

  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,phoneNumber,websiteUri,rating,userRatingCount,reviews.text,reviews.authorAttribution,location,regularOpeningHours.weekdayDescriptions',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.text();
    logger.error({ placeId, status: response.status, error }, 'Places API get details failed');
    throw new Error(`Places API error: ${response.status} ${error}`);
  }

  const place = await response.json() as PlaceApiPlace;

  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    phone: place.phoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    reviews: place.reviews?.map(r => ({
      text: r.text?.text ?? '',
      author: r.authorAttribution?.displayName ?? '',
    })),
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    hours: place.regularOpeningHours?.weekdayDescriptions,
  };
}

export async function getPlaceReviews(placeId: string): Promise<Array<{ text: string; author: string }>> {
  const place = await getPlaceDetails(placeId);
  return place?.reviews ?? [];
}
