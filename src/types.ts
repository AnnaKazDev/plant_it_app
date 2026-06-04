// Database row types
export interface Profile {
  id: string; // UUID
  locationLat: number | null;
  locationLng: number | null;
  gardenWidth: number | null;
  gardenHeight: number | null;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface Plant {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  gridX: number;
  gridY: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionType {
  id: string;
  name: string;
  iconEmoji: string;
  createdAt: string;
}

export interface Action {
  id: string;
  plantId: string;
  actionTypeId: string | null;
  customActionName: string | null;
  date: string; // ISO timestamp
  weatherData: WeatherData | null;
  additionalData: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  actionId: string;
  photoUrl: string;
  orderIndex: number;
  createdAt: string;
}

// Weather data structure from WeatherAPI.com
// Reference: https://www.weatherapi.com/api-explorer.aspx
export interface WeatherData {
  temp_max: number; // Celsius
  temp_min: number;
  wind: number; // km/h or mph depending on API config
  precip: number; // mm
  humidity: number; // percentage
  sunrise: string; // time string
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  // Additional fields as needed; store full API response as JSONB
  [key: string]: unknown;
}

// UI/API helper types
export interface PlantWithLastAction extends Plant {
  lastAction?: Action;
  lastActionType?: ActionType;
}

export interface ActionWithType extends Action {
  actionType?: ActionType;
  plant?: Plant;
}

export interface ActionWithPhotos extends Action {
  photos: Photo[];
}
