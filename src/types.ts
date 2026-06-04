// Re-export database types from generated file
export type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';

// Convenient type aliases for table rows
export type Profile = Tables<'profiles'>;
export type Plant = Tables<'plants'>;
export type ActionType = Tables<'action_types'>;
export type Action = Tables<'actions'>;
export type Photo = Tables<'photos'>;

// Re-export for insert/update operations
export type ProfileInsert = TablesInsert<'profiles'>;
export type PlantInsert = TablesInsert<'plants'>;
export type ActionInsert = TablesInsert<'actions'>;
export type PhotoInsert = TablesInsert<'photos'>;

export type ProfileUpdate = TablesUpdate<'profiles'>;
export type PlantUpdate = TablesUpdate<'plants'>;
export type ActionUpdate = TablesUpdate<'actions'>;
export type PhotoUpdate = TablesUpdate<'photos'>;

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

// UI/API helper types (extend base types with relationships)
export interface PlantWithLastAction extends Plant {
  last_action?: Action;
  last_action_type?: ActionType;
}

export interface ActionWithType extends Action {
  action_type?: ActionType;
  plant?: Plant;
}

export interface ActionWithPhotos extends Action {
  photos: Photo[];
}
